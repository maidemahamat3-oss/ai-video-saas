# ai-video-saas

Plateforme de génération de vidéos animées par IA. Premier projet : **Opération Éclipse**, un jeu de commando dont chaque vidéo est filmée directement dans le jeu.

## Contenu

| Dossier | Rôle |
|---|---|
| `game/` | Le jeu (un seul fichier `index.html`, Three.js). Mission 01 « Base Vipère » jouable sur PC et téléphone |
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

## Fabriquer un Short

```bash
npm install playwright        # une seule fois
pip install numpy scipy       # une seule fois
export ELEVENLABS_API_KEY=... # clé ElevenLabs (voix off)
bash video/tools/build.sh short-01
# -> video/output/short-01.mp4 (1080x1920, son à -14 LUFS)
```

Étapes : `capture.cjs` filme la démo image par image, `tts.py` génère la voix off, `audio.py` crée la musique et les bruitages calés sur l'action puis mixe le tout, `captions.py` écrit les sous-titres animés, et ffmpeg assemble la vidéo.

Pour un nouveau Short : copier `video/shorts/short-01/script.json`, changer les répliques, et (si besoin) la mise en scène dans `demoScript()` de `game/index.html`.
