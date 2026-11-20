"""Monte la vidéo longue 16:9 (1920x1080) à partir des plans tournés dans le jeu.

Étape 1 (une seule fois) : python3 make_long.py <film.json> <build_v2> video   → master.mp4 (images seules, sans texte)
Étape 2 (par langue)     : python3 make_long.py <film.json> <build_v2> fr|en <sortie.mp4>
"""
import json
import os
import re
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import sfxlib as S
import subslib as T

film_path, B, step = sys.argv[1:4]
film = json.load(open(film_path, encoding="utf-8"))
FPS = film["fps"]
FONTS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "fonts"))
work = os.path.join(B, "_long"); os.makedirs(work, exist_ok=True)
cache = {}


def src_info(src):
    if src not in cache:
        d = os.path.join(B, src)
        if not os.path.exists(os.path.join(d, "meta.json")):  # plans cinéma pas encore tournés : 12 i/s depuis 0
            return {"meta": {"fps": 12, "windows": [{"start": 0, "duration": 1e9}]}, "marks": {}, "events": [], "missing": True}
        cache[src] = {"meta": json.load(open(os.path.join(d, "meta.json"))), "marks": json.load(open(os.path.join(d, "marks.json"))), "events": json.load(open(os.path.join(d, "events.json")))}
    return cache[src]


def tval(v, src):
    """Temps de jeu : nombre, 'end' ou 'repère±décalage'."""
    if isinstance(v, (int, float)): return float(v)
    info = src_info(src); w = info["meta"]["windows"][0]
    if v == "end": return w["start"] + w["duration"]
    m = re.fullmatch(r"([a-z_0-9]+)([+-][\d.]+)?", v)
    return info["marks"][m.group(1)] + (float(m.group(2)) if m.group(2) else 0)


# ------------------------------------------------------------ chronologie
segs, T0 = [], 0.0
for s in film["segments"]:
    s = dict(s); s["T"] = T0
    if "card" in s or "still" in s or "compare" in s:
        s["dur"] = s["d"]
    else:
        info = src_info(s["src"]); w = info["meta"]["windows"][0]; fps_s = info["meta"]["fps"]
        a, b = tval(s["from"], s["src"]), tval(s["to"], s["src"])
        a = max(a, w["start"]); b = min(b, w["start"] + w["duration"])
        s["a"], s["b"], s["fps_s"] = a, b, fps_s
        s["f0"] = int(round((a - w["start"]) * fps_s)) + 1; s["nf"] = max(1, int(round((b - a) * fps_s)))
        s["speed"] = s.get("speed", 1.0); s["dur"] = s["nf"] / fps_s / s["speed"]
    T0 += s["dur"]; segs.append(s)
DUR = T0
print(f"{len(segs)} séquences · durée {DUR / 60:.1f} min")


def to_video(s, t_game):
    """Temps de jeu → temps dans la vidéo (None si hors du plan)."""
    if "src" not in s or not (s["a"] <= t_game < s["b"]): return None
    return s["T"] + (t_game - s["a"]) / s["speed"]


# ---------------------------------------------------- étape 1 : images
if step == "video":
    clips = []
    missing = False
    for i, s in enumerate(segs):
        out = os.path.join(work, f"c{i:03d}.mp4"); clips.append(out)
        if os.path.exists(out): continue
        if "src" in s and src_info(s["src"]).get("missing"): missing = True; continue
        post = "hqdn3d=2:1.5:4:4,scale=1920:1080:flags=lanczos,unsharp=5:5:0.5,eq=contrast=1.05:saturation=1.08,vignette=PI/5,format=yuv420p"
        nfr = int(round(s["dur"] * FPS))
        if "card" in s:
            cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=0x07090c:s=1920x1080:r={FPS}:d={s['dur']}", "-vf", "format=yuv420p"]
        elif "still" in s:  # photo de surveillance ou carte tactique, zoom lent
            img = os.path.join(B, "stills", s["still"] + ".jpg")
            look = "eq=gamma=1.6:saturation=0.55:contrast=1.1,colorbalance=bs=.12:gs=.04,drawgrid=w=96:h=96:t=1:c=white@0.10" if s.get("map") else "eq=saturation=0.4:contrast=1.15,colorbalance=rs=-.05:gs=.06:bs=.02,noise=alls=10:allf=t"
            cmd = ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", img, "-vf",
                   f"scale=3840:2160,zoompan=z='1+0.0009*on':d={nfr}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps={FPS},{look},vignette=PI/4,format=yuv420p", "-frames:v", str(nfr)]
        elif "compare" in s:  # avant / maintenant côte à côte
            c = s["compare"]; L = os.path.join(B, c["left"], "%05d.jpg"); R = os.path.join(B, c["right"], "%05d.jpg")
            cmd = ["ffmpeg", "-y", "-v", "error", "-framerate", str(c["left_fps"]), "-start_number", str(int(c["left_from"] * c["left_fps"]) + 1), "-i", L,
                   "-framerate", str(c["right_fps"]), "-start_number", str(int(c["right_from"] * c["right_fps"]) + 1), "-i", R,
                   "-f", "lavfi", "-i", f"color=c=0x07090c:s=1920x1080:r={FPS}:d={s['dur']}",
                   "-filter_complex", f"[0:v]scale=-2:1000,fps={FPS}[l];[1:v]hqdn3d=2:1.5:4:4,scale=-2:1000,fps={FPS}[r];[2:v][l]overlay=x=330:y=60:shortest=1[a];[a][r]overlay=x=1028:y=60:shortest=1,format=yuv420p", "-frames:v", str(nfr)]
        else:
            frames = os.path.join(B, s["src"], "w0", "%05d.jpg")
            vf = []
            if s["speed"] != 1.0: vf.append(f"setpts=PTS/{s['speed']}")
            if s["fps_s"] != FPS or s["speed"] != 1.0: vf.append(f"minterpolate=fps={FPS}:mi_mode=blend")
            vf.append(post)
            cmd = ["ffmpeg", "-y", "-v", "error", "-framerate", str(s["fps_s"]), "-start_number", str(s["f0"]), "-i", frames, "-frames:v", str(nfr), "-vf", ",".join(vf), "-r", str(FPS)]
        subprocess.run(cmd + ["-c:v", "libx264", "-preset", "veryfast", "-crf", "15", "-an", out], check=True)
        print(f"plan {i + 1}/{len(segs)} {s['id']} ({s['dur']:.1f} s)", flush=True)
    if missing: print("plans manquants : relancer quand tout est tourné"); sys.exit(0)
    with open(os.path.join(work, "list.txt"), "w") as f:
        for c in clips: f.write(f"file '{os.path.abspath(c)}'\n")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(work, "list.txt"), "-c", "copy", os.path.join(work, "master.mp4")], check=True)
    print("master.mp4 prêt")
    sys.exit(0)

# ------------------------------------------- étape 2 : son + textes (langue)
lang, out = step, sys.argv[4]
vdir = os.path.join(B, f"voice_long_{lang}")
N = int(DUR * S.SR) + S.SR
sfx, voice = np.zeros(N), np.zeros(N)
score = S.Score(DUR + 1)
MUSIC = {  # musique des séquences de jeu, calée sur les repères
    "long_base": [("tension", None, "alarm"), ("action", "alarm", "boom"), ("braam", "boom", None), ("calm", "boom", "heli"), ("resolve", "heli", None)],
    "long_port": [("tension", None, "barrel"), ("action", "barrel", "boat"), ("resolve", "boat", None)],
    "long_sniper": [("calm", None, "scope"), ("tension", "scope", "shot"), ("riser", "aim", "shot"), ("calm", "shot", "impact_done"), ("braam", "impact_done", None), ("resolve", "heli", None)],
    "long_tower": [("tension", None, "drive"), ("action", "drive", "boss"), ("tension", "boss", "bossdown"), ("braam", "bossdown", None), ("resolve", "roof", None)],
}
BEDS = {"long_base": [("rotor", "boom", None, 2.6)], "long_sniper": [("rotor", "heli", None, 0)], "long_tower": [("engine", "drive", "exit", 0), ("rotor", "roof", None, 0)], "long_port": [("engine", "boat", None, 0)]}
for s in segs:
    a, b = s["T"], s["T"] + s["dur"]
    kind = s.get("music", "calm")
    if kind == "braam": score.braam(a, d=3.6, g=.5); score.calm(a, b)
    elif kind == "game":
        info = src_info(s["src"]); mk = info["marks"]
        for k, m0, m1, *rest in [(x[0], x[1], x[2]) for x in MUSIC[s["src"]]]:
            t0 = a if m0 is None else to_video(s, mk.get(m0, -1)) or a
            t1 = b if m1 is None else (to_video(s, mk.get(m1, 1e9)) or b)
            if k == "braam": score.braam(t0, notes=(33, 45, 52, 57), d=4, g=.55)
            else: getattr(score, k)(t0, t1)
        for bed, m0, m1, delay in BEDS.get(s["src"], []):
            t0 = to_video(s, mk.get(m0, -1)); t1 = b if m1 is None else (to_video(s, mk.get(m1, 1e9)) or b)
            if t0 is None: continue
            t0 += delay; d = max(.1, t1 - t0)
            sig = S.rotor(d) if bed == "rotor" else S.engine(d, 1.3)
            S.add(sfx, sig * np.minimum(1, S.t_(d) / 2) * np.minimum(1, (d - S.t_(d)) / 1.5), t0, .8)
    else: getattr(score, kind)(a, b)
    if s.get("braam"): score.braam(a, d=2.4, g=.45)
    if "src" in s:
        for e in src_info(s["src"])["events"]:
            t = to_video(s, e["t"])
            if t is None: continue
            r = S.event_sound(e)
            if r: sig, g, off = r; S.add(sfx, sig, t + off / s["speed"], g * (.75 if s.get("replay") else 1))
sfx += S.filt(S.rng.uniform(-1, 1, N), "lowpass", 300) * .035

subs, chapters = [], []
CH = {"co1": ("Accroche", "Cold open"), "in1": ("Le réseau Vipère", "The Viper network"), "m1c": ("Mission 01 : Base Vipère", "Mission 01: Viper Base"), "m2c": ("Mission 02 : Le Port", "Mission 02: The Port"),
      "m3c": ("Mission 03 : Œil de Faucon", "Mission 03: Falcon's Eye"), "m4c": ("Mission 04 : La Tour", "Mission 04: The Tower"), "o1": ("Fin", "Ending")}
for s in segs:
    if s["id"] in CH: chapters.append((s["T"], CH[s["id"]][0 if lang == "fr" else 1]))
    for line in s.get("lines", []):
        at = line["at"]
        t = s["T"] + at if isinstance(at, (int, float)) else to_video(s, tval(at, s["src"]))
        if t is None: print("réplique hors plan :", line["id"]); continue
        path = os.path.join(vdir, line["id"] + ".mp3")
        S.add(voice, S.load_mp3(path), t)
        words = T.words_of(os.path.join(vdir, line["id"] + ".json"))
        gs = T.chunks(words, 8, 46)
        for k, g in enumerate(gs):
            a0, a1 = t + g[0][1], t + g[-1][2] + .25
            if k + 1 < len(gs): a1 = min(a1, t + gs[k + 1][0][1] - .02)
            subs.append(f"Dialogue: 1,{T.ts(a0)},{T.ts(a1)},Sub,,0,0,0,,{' '.join(w[0] for w in g)}")
    if "card" in s:
        c = s["card"]; subs.append(f"Dialogue: 2,{T.ts(s['T'] + .2)},{T.ts(s['T'] + s['dur'] - .2)},CardK,,0,0,0,,{{\\pos(960,450)\\fad(300,300)}}{c['k']}")
        subs.append(f"Dialogue: 2,{T.ts(s['T'] + .35)},{T.ts(s['T'] + s['dur'] - .2)},CardT,,0,0,0,,{{\\pos(960,560)\\fad(300,300)}}{c[lang]}")
    if s.get("title"):
        t1, t2 = ("OPÉRATION", "ÉCLIPSE") if lang == "fr" else ("OPERATION", "ECLIPSE")
        subs.append(f"Dialogue: 2,{T.ts(s['T'] + 3.2)},{T.ts(s['T'] + s['dur'])},CardT,,0,0,0,,{{\\pos(960,470)\\fad(500,300)}}{t1}")
        subs.append(f"Dialogue: 2,{T.ts(s['T'] + 3.4)},{T.ts(s['T'] + s['dur'])},CardTO,,0,0,0,,{{\\pos(960,610)\\fad(500,300)}}{t2}")
    if "still" in s:
        lab = s["label"][lang]
        if s.get("map"):
            subs.append(f"Dialogue: 2,{T.ts(s['T'] + .2)},{T.ts(s['T'] + s['dur'] - .1)},CapK,,0,0,0,,{{\\pos(110,90)\\fad(300,300)}}{'CARTE TACTIQUE' if lang == 'fr' else 'TACTICAL MAP'}")
            subs.append(f"Dialogue: 2,{T.ts(s['T'] + .4)},{T.ts(s['T'] + s['dur'] - .1)},MapLabel,,0,0,0,,{{\\pos(110,130)\\fad(300,300)}}{lab}")
        else:
            subs.append(f"Dialogue: 2,{T.ts(s['T'] + .2)},{T.ts(s['T'] + s['dur'] - .1)},CapK,,0,0,0,,{{\\pos(110,820)\\fad(300,300)}}{'DOSSIER CLASSIFIÉ' if lang == 'fr' else 'CLASSIFIED FILE'}")
            subs.append(f"Dialogue: 2,{T.ts(s['T'] + .4)},{T.ts(s['T'] + s['dur'] - .1)},MapLabel,,0,0,0,,{{\\pos(110,860)\\fad(300,300)}}{lab}")
    if "compare" in s:
        l1, l2 = s["labels"][lang]
        subs.append(f"Dialogue: 2,{T.ts(s['T'] + .2)},{T.ts(s['T'] + s['dur'])},CapK,,0,0,0,,{{\\an8\\pos(634,1010)\\fad(300,0)}}{l1}")
        subs.append(f"Dialogue: 2,{T.ts(s['T'] + .2)},{T.ts(s['T'] + s['dur'])},CapK,,0,0,0,,{{\\an8\\pos(1332,1010)\\fad(300,0)}}{l2}")
    if s.get("replay"):
        subs.append(f"Dialogue: 2,{T.ts(s['T'] + .1)},{T.ts(s['T'] + s['dur'] - .1)},Replay,,0,0,0,,{{\\pos(1820,70)\\fad(200,200)}}{{\\c{T.RED}}}●{{\\c{T.WHITE}}} {'RALENTI' if lang == 'fr' else 'REPLAY'}")
    if s.get("end"):
        cta = "ÉCRIS « FAUCON » EN COMMENTAIRE" if lang == "fr" else "COMMENT « FALCON » BELOW"
        sub2 = "ABONNE-TOI POUR LA SUITE" if lang == "fr" else "SUBSCRIBE FOR WHAT'S NEXT"
        subs.append(f"Dialogue: 0,{T.ts(s['T'])},{T.ts(s['T'] + s['dur'])},Shade,,0,0,0,,{{\\pos(0,0)\\fad(600,0)\\1a&H90&\\p1}}m 0 0 l 1920 0 l 1920 1080 l 0 1080{{\\p0}}")
        subs.append(f"Dialogue: 2,{T.ts(s['T'] + .5)},{T.ts(s['T'] + s['dur'])},CardT,,0,0,0,,{{\\pos(960,380)\\fad(400,0)}}{'OPÉRATION ÉCLIPSE' if lang == 'fr' else 'OPERATION ECLIPSE'}")
        subs.append(f"Dialogue: 2,{T.ts(s['T'] + 1.5)},{T.ts(s['T'] + s['dur'])},CTA,,0,0,0,,{{\\pos(960,540)\\fad(300,0)}}{cta}")
        subs.append(f"Dialogue: 2,{T.ts(s['T'] + 2.2)},{T.ts(s['T'] + s['dur'])},CardK,,0,0,0,,{{\\pos(960,640)\\fad(300,0)}}{sub2}")
    if "src" in s and not s.get("replay"):
        kinds = ("stamp", "alarm", "floor", "caption") + (("radio",) if s.get("radio") else ())
        for kind, t, d, txt in T.game_texts(src_info(s["src"])["events"], lambda x, s=s: to_video(s, x), lang, kinds):
            end = min(t + d, s["T"] + s["dur"])
            if kind == "stamp": subs.append(f"Dialogue: 3,{T.ts(t)},{T.ts(end)},Stamp,,0,0,0,,{{\\pos(960,330)\\fscx125\\fscy125\\t(0,120,\\fscx100\\fscy100)\\fad(0,250)}}{txt}")
            elif kind == "alarm": subs.append(f"Dialogue: 3,{T.ts(t)},{T.ts(end)},Alarm,,0,0,0,,{{\\pos(960,120)}}{txt}")
            elif kind == "floor": subs.append(f"Dialogue: 3,{T.ts(t)},{T.ts(end)},Floor,,0,0,0,,{{\\pos(960,90)\\fad(100,200)}}{txt}")
            elif kind == "caption":
                k, ti, p = txt
                subs.append(f"Dialogue: 3,{T.ts(t)},{T.ts(end)},CapK,,0,0,0,,{{\\pos(110,700)\\fad(400,400)}}{k}")
                subs.append(f"Dialogue: 3,{T.ts(t + .1)},{T.ts(end)},CapT,,0,0,0,,{{\\pos(110,800)\\fad(400,400)}}{ti}")
                subs.append(f"Dialogue: 3,{T.ts(t + .2)},{T.ts(end)},CapP,,0,0,0,,{{\\pos(110,870)\\fad(400,400)}}{p}")
            elif kind == "radio":
                who, text = txt; subs.append(f"Dialogue: 2,{T.ts(t)},{T.ts(end)},Radio,,0,0,0,,{{\\pos(80,160)\\fad(150,200)}}{{\\c{T.ORANGE}}}{who}  {{\\c{T.WHITE}}}{text}")

styles = """Style: Sub,Anton,50,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,1,0,1,4,2,2,120,120,64,1
Style: Radio,Anton,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&HB0000000,0,0,0,0,100,100,1,0,3,10,0,7,80,700,40,1
Style: Stamp,Saira Stencil One,62,&H001F8AFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,5,3,5,40,40,0,1
Style: Alarm,Saira Stencil One,44,&H003B3BFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,5,2,5,40,40,0,1
Style: Floor,Saira Stencil One,56,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,5,2,5,40,40,0,1
Style: CapK,Anton,30,&H001F8AFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,6,0,1,0,2,4,0,0,0,1
Style: CapT,Saira Stencil One,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,0,4,4,0,0,0,1
Style: CapP,Anton,32,&H008AB4C8,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,3,0,1,0,2,4,0,0,0,1
Style: CardK,Anton,40,&H001F8AFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,8,0,1,0,0,5,0,0,0,1
Style: CardT,Saira Stencil One,130,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,0,4,5,0,0,0,1
Style: CardTO,Saira Stencil One,130,&H001F8AFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,0,4,5,0,0,0,1
Style: MapLabel,Anton,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,3,0,3,14,0,4,0,0,0,1
Style: Replay,Anton,34,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,4,0,1,3,0,9,0,0,0,1
Style: Shade,Arial,20,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: CTA,Anton,64,&H00000B16,&H00FFFFFF,&H001F8AFF,&H00000000,0,0,0,0,100,100,1,0,3,20,0,5,40,40,0,1"""
assf = os.path.join(work, f"subs_{lang}.ass"); open(assf, "w", encoding="utf-8").write(T.header(1920, 1080, styles) + "\n".join(subs) + "\n")
wav = os.path.join(work, f"mix_{lang}.wav"); n = int(DUR * S.SR)
S.write_wav(wav, S.mix(n, score.render(n), sfx, voice, .5))
with open(os.path.splitext(out)[0] + "_chapitres.txt", "w", encoding="utf-8") as f:
    for t, name in chapters: f.write(f"{int(t // 60)}:{int(t % 60):02d} {name}\n")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-stats", "-i", os.path.join(work, "master.mp4"), "-i", wav,
  "-filter_complex", f"[0:v]subtitles={assf}:fontsdir={FONTS}[v];[1:a]loudnorm=I=-14:TP=-2:LRA=11,aresample=48000,alimiter=limit=0.56:attack=1:release=60:level=disabled[a]",
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-maxrate", "10M", "-bufsize", "20M", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  "-c:a", "aac", "-aac_coder", "twoloop", "-b:a", "256k", "-ar", "48000", "-t", f"{DUR:.3f}", out], check=True)
print("Vidéo prête :", out)
