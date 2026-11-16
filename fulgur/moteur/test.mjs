import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { normalizePhone, normalizeLead, verifySignature } from './server.mjs';

test('numéros français', () => {
  assert.equal(normalizePhone('06 12 34 56 78'), '+33612345678');
  assert.equal(normalizePhone('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(normalizePhone('0033612345678'), '+33612345678');
  assert.equal(normalizePhone('12'), null);
});
test('lead normalisé depuis champs variés', () => {
  const l = normalizeLead({ first_name: 'Inès', tel: '07.11.22.33.44', program: 'Terrasses' });
  assert.deepEqual([l.prenom, l.phone, l.programme], ['Inès', '+33711223344', 'Terrasses']);
});
test('signature webhook', () => {
  const t = Math.floor(Date.now() / 1000), body = '{"a":1}';
  const h = `t=${t},v0=` + crypto.createHmac('sha256', 's').update(`${t}.${body}`).digest('hex');
  assert.ok(verifySignature(body, h, 's'));
  assert.ok(!verifySignature(body, h, 'autre'));
  assert.ok(!verifySignature(body, undefined, 's'));
});
