# ai-video-saas

Plateforme de génération de vidéos animées par IA. Premier projet : **Opération Éclipse**, un jeu de commando dont chaque vidéo est filmée directement dans le jeu.

## Contenu

| Dossier | Rôle |
|---|---|
| `game/` | Le jeu réaliste (Three.js, modules dans `game/js/`) : 4 missions jouables sur PC et téléphone. `v1-prototype.html` = premier prototype en blocs |
| `game/assets/` | Ciels, textures et modèles 3D (Poly Haven CC0, licences dans `LICENCES.md`) |
| `video/tools/` | La chaîne de fabrication des vidéos : tournage dans le jeu, voix off, son, sous-titres, montage |
| `video/shorts/` | Le script de chaque Short (répliques et moments clés) |
| `video/assets/fonts/` | Polices des sous-titres (licence libre OFL) |
| `docs/plan-contenu.md` | Plan des Shorts, de la vidéo longue YouTube et de la feuille de route du jeu |

## Jouer

```bash
python3 -m http.server 8765
# puis ouvrir http://localhost:8765/game/
```

- PC : ZQSD/WASD, souris, clic pour tirer, clic droit pour la lunette, F couteau, R recharger, E (maintenir) action, C s'accroupir, Maj courir
- Téléphone : joystick à gauche, glisser à droite pour viser, boutons à l'écran
- `?demo=1` lance la démo cinématique

## Vidéos v2 (réalistes, FR et EN)

```bash
bash video/tools/shoot_all.sh                       # tourne toutes les images (sans texte), plusieurs heures sans carte graphique
python3 video/tools/tts.py video/shorts/short-02/script.json video/build/v2/voice_short_fr fr   # voix (fr ou en)
python3 video/tools/make_short.py video/shorts/short-02/script.json video/build/v2 fr video/output/short-02-fr.mp4
python3 video/tools/make_long.py video/long/film.json video/build/v2 video            # montage image (une fois)
python3 video/tools/make_long.py video/long/film.json video/build/v2 fr video/output/film-fr.mp4
```

Les textes du jeu (« TIR À LA TÊTE », messages radio, titres de mission…) sont ajoutés au montage et traduits par `video/tools/subslib.py`.

## Fabriquer le premier Short (prototype v1)

```bash
npm install playwright        # une seule fois
pip install numpy scipy       # une seule fois
export ELEVENLABS_API_KEY=... # clé ElevenLabs (voix off)
bash video/tools/build.sh short-01
# -> video/output/short-01.mp4 (1080x1920, son à -14 LUFS)
```

Étapes : `capture.cjs` filme la démo image par image, `tts.py` génère la voix off, `audio.py` crée la musique et les bruitages calés sur l'action puis mixe le tout, `captions.py` écrit les sous-titres animés, et ffmpeg assemble la vidéo.

Pour un nouveau Short : copier `video/shorts/short-01/script.json`, changer les répliques, et (si besoin) la mise en scène dans `demoScript()` de `game/index.html`.
