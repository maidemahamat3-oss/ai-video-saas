// Fulgur : moteur speed-to-lead.
// Reçoit un lead -> déclenche un appel sortant ElevenLabs (via Twilio) en quelques secondes
// -> reçoit le résumé post-appel -> le transmet au CRM du client.
// Node 20+, zéro dépendance. Lancer : node server.mjs
import http from 'node:http';
import crypto from 'node:crypto';

const cfg = {
  port: Number(process.env.PORT || 8787),
  apiKey: process.env.ELEVENLABS_API_KEY || '',
  agentId: process.env.AGENT_ID || '',
  phoneNumberId: process.env.AGENT_PHONE_NUMBER_ID || '', // id du numéro Twilio importé dans ElevenLabs
  leadKey: process.env.LEAD_KEY || '', // secret partagé : /lead?key=...
  webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET || '', // secret HMAC du webhook post-appel
  clientWebhook: process.env.CLIENT_WEBHOOK_URL || '', // CRM / Zapier / Make / Slack
  tz: process.env.TZ_CALLS || 'Europe/Paris',
  openHour: Number(process.env.OPEN_HOUR || 9),
  closeHour: Number(process.env.CLOSE_HOUR || 20),
  openDays: (process.env.OPEN_DAYS || '1,2,3,4,5,6').split(',').map(Number), // 0 = dimanche
  maxAttempts: Number(process.env.MAX_ATTEMPTS || 3),
  retryMinutes: Number(process.env.RETRY_MINUTES || 15),
  dryRun: process.env.DRY_RUN === '1',
};

const leads = new Map(); // leadId -> lead (mémoire : remplacer par une base pour la prod multi-instance)
const recentPhones = new Map(); // phone -> timestamp, anti-doublon 24 h
const log = (...a) => console.log(new Date().toISOString(), ...a);

export function normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (/^0[1-9]\d{8}$/.test(p)) p = '+33' + p.slice(1);
  if (/^33[1-9]\d{8}$/.test(p)) p = '+' + p;
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}

export function normalizeLead(body) {
  const pick = (...keys) => keys.map((k) => body[k]).find((v) => v != null && v !== '');
  return {
    prenom: pick('prenom', 'first_name', 'firstname', 'name', 'nom') || '',
    phone: normalizePhone(pick('phone', 'telephone', 'tel', 'phone_number', 'mobile')),
    email: pick('email', 'mail') || '',
    programme: pick('programme', 'program', 'product', 'produit', 'offer') || '',
    source: pick('source', 'utm_source', 'form_name') || 'formulaire',
  };
}

function parisParts(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: cfg.tz, weekday: 'short', hour: 'numeric', hour12: false });
  const parts = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { day, hour: Number(parts.hour) % 24 };
}

export function isCallWindow(date = new Date()) {
  const { day, hour } = parisParts(date);
  return cfg.openDays.includes(day) && hour >= cfg.openHour && hour < cfg.closeHour;
}

function msUntilNextWindow(from = new Date()) {
  // Avance par pas de 5 min jusqu'à la prochaine fenêtre d'appel (max 7 jours).
  for (let t = from.getTime(); t < from.getTime() + 7 * 864e5; t += 5 * 60e3) {
    if (isCallWindow(new Date(t))) return t - from.getTime();
  }
  return 60 * 60e3;
}

async function placeCall(lead) {
  lead.attempts += 1;
  const payload = {
    agent_id: cfg.agentId,
    agent_phone_number_id: cfg.phoneNumberId,
    to_number: lead.phone,
    conversation_initiation_client_data: {
      dynamic_variables: { lead_id: lead.id, prenom: lead.prenom, programme: lead.programme, source: lead.source },
    },
  };
  if (cfg.dryRun) {
    log('[DRY_RUN] appel', lead.phone, 'tentative', lead.attempts, JSON.stringify(payload.conversation_initiation_client_data));
    lead.status = 'appel_simule';
    return;
  }
  const res = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': cfg.apiKey },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    log('échec appel', lead.id, res.status, JSON.stringify(data));
    scheduleRetry(lead, 'echec_lancement');
    return;
  }
  lead.status = 'appel_en_cours';
  lead.conversationId = data.conversation_id;
  log('appel lancé', lead.id, lead.phone, data.conversation_id || '');
}

function scheduleCall(lead, delayMs = 0) {
  const wait = isCallWindow(new Date(Date.now() + delayMs)) ? delayMs : msUntilNextWindow(new Date(Date.now() + delayMs)) + delayMs;
  lead.status = wait > 0 ? 'programme' : 'en_file';
  lead.nextCallAt = new Date(Date.now() + wait).toISOString();
  setTimeout(() => placeCall(lead).catch((e) => log('erreur appel', lead.id, e.message)), wait);
}

function scheduleRetry(lead, reason) {
  if (lead.attempts >= cfg.maxAttempts) {
    lead.status = 'injoignable';
    forward({ event: 'lead_injoignable', lead, reason }).catch(() => {});
    return;
  }
  scheduleCall(lead, cfg.retryMinutes * 60e3 * lead.attempts);
}

async function forward(event) {
  if (!cfg.clientWebhook) return log('[CRM] (pas de CLIENT_WEBHOOK_URL)', JSON.stringify(event).slice(0, 300));
  const res = await fetch(cfg.clientWebhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event) });
  log('[CRM] transmis', event.event, res.status);
}

export function verifySignature(rawBody, header, secret, now = Date.now()) {
  if (!secret) return true;
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.trim().split('=')));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 30 * 60) return false;
  const expected = 'v0=' + crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const got = 'v0=' + (parts.v0 || '');
  return expected.length === got.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

function handlePostCall(evt) {
  const data = evt.data || {};
  const vars = data.conversation_initiation_client_data?.dynamic_variables || {};
  const lead = leads.get(vars.lead_id);
  if (evt.type === 'call_initiation_failure') {
    // Pas de réponse, occupé, messagerie… -> nouvelle tentative.
    if (lead) scheduleRetry(lead, data.failure_reason || 'non_joint');
    return;
  }
  if (evt.type !== 'post_call_transcription') return;
  const a = data.analysis || {};
  const collected = Object.fromEntries(Object.entries(a.data_collection_results || {}).map(([k, v]) => [k, v?.value]));
  if (lead) lead.status = 'appel_termine';
  forward({
    event: 'appel_termine',
    lead: lead || { id: vars.lead_id, prenom: vars.prenom, programme: vars.programme },
    conversation_id: data.conversation_id,
    duree_s: data.metadata?.call_duration_secs,
    reussi: a.call_successful,
    resume: a.transcript_summary,
    qualification: collected,
  }).catch((e) => log('erreur CRM', e.message));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { reject(new Error('trop gros')); req.destroy(); }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseBody(raw, type = '') {
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return raw ? JSON.parse(raw) : {};
}

const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, leads: leads.size, dryRun: cfg.dryRun });

    if (req.method === 'POST' && url.pathname === '/lead') {
      const key = url.searchParams.get('key') || req.headers['x-lead-key'];
      if (cfg.leadKey && key !== cfg.leadKey) return send(res, 401, { error: 'clé invalide' });
      const lead = normalizeLead(parseBody(await readBody(req), req.headers['content-type']));
      if (!lead.phone) return send(res, 400, { error: 'téléphone manquant ou invalide' });
      const last = recentPhones.get(lead.phone);
      if (last && Date.now() - last < 864e5) return send(res, 200, { ok: true, doublon: true });
      recentPhones.set(lead.phone, Date.now());
      Object.assign(lead, { id: crypto.randomUUID(), attempts: 0, receivedAt: new Date().toISOString() });
      leads.set(lead.id, lead);
      scheduleCall(lead);
      log('lead reçu', lead.id, lead.phone, lead.status);
      return send(res, 202, { ok: true, id: lead.id, status: lead.status, nextCallAt: lead.nextCallAt });
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/elevenlabs') {
      const raw = await readBody(req);
      if (!verifySignature(raw, req.headers['elevenlabs-signature'], cfg.webhookSecret)) return send(res, 401, { error: 'signature invalide' });
      handlePostCall(JSON.parse(raw));
      return send(res, 200, { ok: true });
    }

    send(res, 404, { error: 'introuvable' });
  } catch (e) {
    log('erreur', e.message);
    send(res, 400, { error: 'requête invalide' });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!cfg.dryRun && (!cfg.apiKey || !cfg.agentId || !cfg.phoneNumberId)) {
    console.error('Variables manquantes : ELEVENLABS_API_KEY, AGENT_ID, AGENT_PHONE_NUMBER_ID (ou DRY_RUN=1).');
    process.exit(1);
  }
  server.listen(cfg.port, () => log(`Fulgur moteur sur :${cfg.port}${cfg.dryRun ? ' (DRY_RUN)' : ''}`));
}
