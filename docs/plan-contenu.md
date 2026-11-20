# Opération Éclipse : plan vidéos et jeu

Le principe : **le jeu sert de studio de tournage**. Chaque vidéo est filmée directement dans le jeu (mode démo scripté), avec voix off ElevenLabs, sous-titres animés, musique et bruitages générés par code. Les vidéos font connaître le jeu, et les commentaires mesurent si les gens veulent y jouer.

## 1. Les formats

| Format | Durée | Plateformes | Fréquence |
|---|---|---|---|
| Short « mission » | 30 à 50 s, vertical 1080×1920 | TikTok, Reels, YouTube Shorts | 3 par semaine |
| Vidéo longue « histoire » | 20 à 30 min, horizontal 1920×1080 | YouTube | 1 par mois au début |
| Short « coulisses » | 20 à 40 s | TikTok, Reels | 1 par semaine |

Le même Short est publié sur les trois plateformes. Seule la description change.

## 2. Short n° 1 (prêt)

**Titre :** 1 commando contre 12 gardes
**Accroche à l'écran :** 1 COMMANDO / CONTRE 12 GARDES
**Fichiers :** `video/shorts/short-01/script.json`, fabriqué avec `bash video/tools/build.sh short-01`

| Moment | Image | Voix off |
|---|---|---|
| 0 s | Vue drone de la base de nuit | Un seul commando. Douze gardes. Une antenne à faire sauter. |
| 5 s | Faucon accroupi, vise avec la lunette | Nom de code : Faucon. |
| 7 s | Approche lente derrière un garde | Règle numéro un : ne jamais se faire repérer. |
| 12 s | Élimination au couteau | (bruitage seulement) |
| 14 s | Un garde le voit, alarme | Raté. … Plan B : on fonce. |
| 19 s | Course et tirs vers l'antenne | Objectif : l'antenne radar. |
| 27 s | Pose de la charge | Charge posée. |
| 30 s | Fuite, compte à rebours | Huit secondes pour sortir de là. |
| 37 s | Explosion de l'antenne | (bruitage seulement) |
| 40 s | L'hélico se pose | Mission accomplie. |
| 43 s | Carte de fin | Je crée ce jeu. Tu veux y jouer ? Écris Faucon en commentaire. |

**Texte de publication :**
> Mission 01 : Base Vipère. 12 gardes, 4 minutes, aucun renfort. Je crée ce jeu de commando de A à Z. Si tu veux y jouer, écris FAUCON en commentaire.
> #jeuvideo #commando #fps #gaming #indiedev #gamedev #mission

## 3. Les 10 prochains Shorts

1. **Zéro alarme** : toute la mission au couteau, sans un coup de feu.
2. **Le garde qui n'aurait pas dû se retourner** : un plan raté, puis la fusillade.
3. **4 minutes chrono** : la mission en accéléré avec le chrono à l'écran.
4. **Le fusil VK-12** : présentation de l'arme (tir, rechargement, lunette).
5. **Tireur dans la tour** : neutraliser la sentinelle des tours de guet.
6. **L'explosion vue de près** : ralenti de l'antenne qui tombe.
7. **Coulisses : comment je fabrique un jeu avec l'IA** (écran du code et du jeu côte à côte).
8. **Vous avez voté** : une nouvelle arme choisie dans les commentaires.
9. **Mission 02 (teaser)** : nouvelle carte, nouveau décor.
10. **Échec de mission** : tout ce qui peut mal tourner (format drôle).

Chaque Short finit par une question ou une demande de commentaire. C'est ce qui fait monter la vidéo et ce qui mesure l'intérêt pour le jeu.

## 4. Vidéo longue n° 1 (YouTube, ~24 min)

**Titre :** Opération Éclipse : l'histoire complète du commando Faucon
**Idée :** un « film » raconté, monté à partir du jeu, en 5 missions. Chaque mission est un chapitre YouTube. Pour cela, le jeu doit avoir 5 missions : la mission 01 existe, il faut créer les 4 autres.

| Chapitre | Durée | Contenu |
|---|---|---|
| 00:00 Accroche | 0:45 | Les 45 secondes les plus fortes de toute la vidéo (explosion, fusillade) + la question : « Comment un seul homme a-t-il fait tomber le réseau Vipère ? » |
| 00:45 Le dossier | 2:00 | Qui est Faucon, qui sont les Vipères, la carte des 5 cibles |
| 02:45 Mission 01 : Base Vipère | 4:30 | Infiltration de nuit, l'antenne radar |
| 07:15 Mission 02 : Le port | 4:30 | Conteneurs, docks, sauver un otage |
| 11:45 Mission 03 : Le convoi | 4:00 | Embuscade dans le désert |
| 15:45 Mission 04 : La montagne | 4:00 | Tireur d'élite, neige, tempête |
| 19:45 Mission 05 : Le QG | 3:30 | Assaut final, le chef des Vipères |
| 23:15 Fin et suite | 1:00 | Appel à jouer au jeu, abonnement, vote pour la suite |

Repères pour garder les spectateurs jusqu'au bout :
- une accroche visuelle forte dans les 30 premières secondes, puis un changement d'image toutes les 5 à 8 secondes ;
- chaque chapitre finit sur un suspense (« … mais Faucon ne savait pas que quelqu'un l'attendait au port ») ;
- la voix off raconte l'histoire au lieu de commenter l'action ;
- tirer 6 à 10 Shorts de chaque vidéo longue.

**Fabrication :** même chaîne que les Shorts (`capture.cjs` en 1920×1080, `tts.py`, `audio.py`). Sur ce serveur, une image prend environ 0,4 s à rendre, donc 24 min de vidéo prennent plusieurs heures. Sur un ordinateur avec une carte graphique, c'est presque en temps réel.

## 5. Mesurer si les gens veulent le jeu

Après 10 à 15 Shorts, regarde ces chiffres :

| Signal | Bon signe |
|---|---|
| Commentaires « FAUCON » | Plus de 1 % des vues |
| Partages et enregistrements | Plus de 2 % des vues |
| Abonnés gagnés par vidéo | Ça monte d'une vidéo à l'autre |
| Questions « où on télécharge ? » | Plusieurs par vidéo |

Si c'est bon, on passe à la version publique du jeu (voir ci-dessous) et on ajoute un lien dans la bio pour y jouer gratuitement dans le navigateur.

## 6. Feuille de route du jeu

| Version | Contenu |
|---|---|
| **0.1 (maintenant)** | Mission 01 jouable sur PC et téléphone : fusil, couteau, discrétion, alarme, charge explosive, hélico d'extraction, démo filmable |
| 0.2 | Pistolet silencieux, fusil de précision, grenades, 3 missions |
| 0.3 | Progression (médailles, déblocages), sons et musique dans le jeu, réglages |
| 0.5 | Version publique gratuite sur le web (itch.io, CrazyGames, Poki) avec un lien dans la bio |
| 1.0 | 5 missions + application mobile (Android puis iPhone) |

## 7. Ce qu'il faut de ton côté

1. **Choisir le nom de la chaîne** (par exemple « Opération Éclipse » ou « Commando Faucon ») et créer les comptes TikTok, Instagram et YouTube avec ce nom.
2. **Écouter la voix off** du Short n° 1 et dire si elle te plaît. Sinon, on peut en essayer une autre.
3. **Publier** : soit tu publies toi-même les fichiers MP4, soit tu connectes tes comptes (connecteur OmniSocials dans les réglages de claude.ai) et je programme les publications.
4. **Ton avis sur le jeu** : joue à la mission 01 et dis-moi ce que tu veux changer.
