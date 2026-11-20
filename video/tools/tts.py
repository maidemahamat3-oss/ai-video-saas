"""Génère la voix off de chaque réplique avec ElevenLabs (+ minutage mot à mot).

Usage : python3 tts.py <script.json> <dossier_sortie>
Clé API : variable d'environnement ELEVENLABS_API_KEY.
Sortie : <id>.mp3 et <id>.json (alignement caractère par caractère) pour chaque réplique.
"""
import base64
import json
import os
import ssl
import sys
import urllib.request

script_path, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
script = json.load(open(script_path, encoding="utf-8"))
key = os.environ.get("ELEVENLABS_API_KEY", "dummy")
ca = os.environ.get("SSL_CERT_FILE") or ("/root/.ccr/ca-bundle.crt" if os.path.exists("/root/.ccr/ca-bundle.crt") else None)
ctx = ssl.create_default_context(cafile=ca)

for line in script["lines"]:
    mp3 = os.path.join(out, line["id"] + ".mp3")
    meta = os.path.join(out, line["id"] + ".json")
    if os.path.exists(mp3) and os.path.exists(meta) and json.load(open(meta)).get("text") == line["text"]:
        continue  # déjà généré
    body = {
        "text": line["text"],
        "model_id": script.get("model_id", "eleven_multilingual_v2"),
        "language_code": "fr",
        "voice_settings": {"stability": 0.42, "similarity_boost": 0.8, "style": 0.45, "use_speaker_boost": True, "speed": line.get("speed", 1.0)},
    }
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{script['voice_id']}/with-timestamps?output_format=mp3_44100_128"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        res = json.load(urllib.request.urlopen(req, context=ctx, timeout=120))
    except urllib.error.HTTPError as e:
        if e.code in (400, 422) and "language_code" in body:  # modèle sans language_code
            body.pop("language_code")
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"xi-api-key": key, "Content-Type": "application/json"})
            res = json.load(urllib.request.urlopen(req, context=ctx, timeout=120))
        else:
            raise SystemExit(f"Erreur ElevenLabs {e.code} : {e.read()[:300]}")
    open(mp3, "wb").write(base64.b64decode(res["audio_base64"]))
    al = res.get("alignment") or res.get("normalized_alignment")
    json.dump({"text": line["text"], "chars": al["characters"], "start": al["character_start_times_seconds"], "end": al["character_end_times_seconds"]}, open(meta, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"{line['id']}  {al['character_end_times_seconds'][-1]:.2f} s  {line['text']}")
print("voix off prête")
