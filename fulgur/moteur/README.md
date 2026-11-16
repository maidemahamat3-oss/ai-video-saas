# Moteur Fulgur

Lead reçu → appel sortant de l'agent vocal ElevenLabs en quelques secondes → résumé envoyé au CRM.

## Démarrer
```bash
DRY_RUN=1 node server.mjs          # test sans appel réel
node --test test.mjs               # tests
```
Production (Render / Railway / VPS, Node 20+) :
| Variable | Rôle |
|---|---|
| `ELEVENLABS_API_KEY` | clé API ElevenLabs |
| `AGENT_ID` | agent du client (dupliqué depuis la démo) |
| `AGENT_PHONE_NUMBER_ID` | numéro Twilio importé dans ElevenLabs (Agents → Phone numbers) |
| `LEAD_KEY` | secret à mettre dans l'URL du formulaire : `/lead?key=...` |
| `ELEVENLABS_WEBHOOK_SECRET` | secret HMAC du webhook post-appel |
| `CLIENT_WEBHOOK_URL` | où envoyer les résultats (Zapier, Make, HubSpot, Slack…) |
| `OPEN_HOUR` / `CLOSE_HOUR` / `OPEN_DAYS` | fenêtre d'appel (défaut 9h-20h, lun-sam, heure de Paris) |
| `MAX_ATTEMPTS` / `RETRY_MINUTES` | relances si non joint (défaut 3 tentatives, 15 min puis 30 min) |

## Routes
- `POST /lead` : JSON ou formulaire. Champs acceptés : `prenom|first_name`, `phone|telephone|tel`, `email`, `programme|product`, `source`. Anti-doublon 24 h. Hors horaires → appel programmé à la prochaine ouverture.
- `POST /webhooks/elevenlabs` : à déclarer dans ElevenLabs (post-call webhook). Gère `post_call_transcription` (résumé + qualification → CRM) et `call_initiation_failure` (relance).
- `GET /health`

Variables dynamiques transmises à l'agent : `{{prenom}}`, `{{programme}}`, `{{source}}`, `{{lead_id}}`. Les utiliser dans le prompt et le premier message de l'agent du client.

Limite actuelle : file d'attente en mémoire, donc une seule instance. Passer à Redis/Postgres au-delà de ~10 clients.
