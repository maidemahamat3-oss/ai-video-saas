#!/usr/bin/env bash
# Tourne toutes les images du Short (vertical) et de la vidéo longue (horizontal), sans aucun texte du jeu.
set -u
ROOT=$(cd "$(dirname "$0")/../.." && pwd); B="$ROOT/video/build/v2"; mkdir -p "$B"
cap() { node "$ROOT/video/tools/capture2.cjs" "$@" 2>&1 | grep -v "^$"; }
# Short vertical 1080x1920 (rendu 540x960, agrandi au montage), 30 i/s
cap sniper demo "$B/short_sniper" --size 540x960 --fps 30 --windows 11.8-16.3,18.8-31.3
cap base   demo "$B/short_base"   --size 540x960 --fps 30 --windows 1-5,11.6-14.6
cap port   demo "$B/short_port"   --size 540x960 --fps 30 --windows 30.6-33.6
cap tower  demo "$B/short_tower"  --size 540x960 --fps 30 --windows 13.4-17.9,43-46,75.5-78.5,91.4-97.9
echo "SHORT_DONE"
# Vidéo longue 16:9 (rendu 960x540), 24 i/s
for m in sniper tower port base; do cap $m demo "$B/long_$m" --size 960x540 --fps 24; done
echo "LONG_DEMOS_DONE"
for m in base port sniper tower; do cap $m cine "$B/cine_$m" --size 960x540 --fps 12; done
echo "ALL_DONE"
