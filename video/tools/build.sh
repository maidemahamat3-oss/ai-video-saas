#!/usr/bin/env bash
# Fabrique un Short de A à Z : tournage dans le jeu -> voix off -> son -> sous-titres -> MP4 vertical.
# Usage : bash video/tools/build.sh short-01
# Prérequis : node + playwright, python3 + numpy + scipy, ffmpeg, ELEVENLABS_API_KEY
set -euo pipefail
SHORT=${1:-short-01}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
B="$ROOT/video/build/$SHORT"
S="$ROOT/video/shorts/$SHORT/script.json"
OUT="$ROOT/video/output/$SHORT.mp4"
mkdir -p "$B" "$ROOT/video/output"

# 1. le jeu doit être servi en local pour être filmé
if ! curl -s -o /dev/null http://127.0.0.1:8765/game/index.html; then
  python3 -m http.server 8765 --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
  SRV=$!; trap 'kill $SRV' EXIT; sleep 1
fi

# 2. tournage image par image (sauté si déjà fait)
[ -f "$B/events.json" ] || node "$ROOT/video/tools/capture.cjs" "$B" 30

# 3. voix off, 4. bande-son, 5. sous-titres
python3 "$ROOT/video/tools/tts.py" "$S" "$B/voice"
python3 "$ROOT/video/tools/audio.py" "$S" "$B"
python3 "$ROOT/video/tools/captions.py" "$S" "$B"

# 6. montage final : étalonnage léger + sous-titres + loudness -14 LUFS (norme TikTok/YouTube)
cd "$B"
DUR=$(python3 -c "import json,os; s=json.load(open('$S')); n=len([f for f in os.listdir('frames') if f.endswith('.jpg')]); print(min(n/30, s.get('duration', 1e9)))")
ffmpeg -y -v error -stats -framerate 30 -i frames/%05d.jpg -i mix.wav \
  -filter_complex "[0:v]eq=contrast=1.06:saturation=1.12,vignette=PI/5,subtitles=subs.ass:fontsdir=$ROOT/video/assets/fonts[v];[1:a]loudnorm=I=-14:TP=-2:LRA=11,aresample=48000,alimiter=limit=0.63:attack=1:release=60:level=disabled[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -c:a aac -aac_coder twoloop -b:a 256k -ar 48000 -t "$DUR" "$OUT"
echo "Vidéo prête : $OUT"
