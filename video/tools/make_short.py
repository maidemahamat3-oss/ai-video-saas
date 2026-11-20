"""Monte un Short vertical (1080x1920) à partir des plans tournés dans le jeu, dans une langue donnée.

Usage : python3 make_short.py <script.json> <dossier_build_v2> <fr|en> <sortie.mp4>
"""
import json
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import sfxlib as S
import subslib as T

script_path, B, lang, out = sys.argv[1:5]
sc = json.load(open(script_path, encoding="utf-8"))
fps = sc.get("fps", 30)
FONTS = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
tmp = os.path.join(B, f"_short_{lang}"); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp + "/frames")

# 1. plans → suite d'images + correspondance des temps
timeline, n, T0 = [], 0, 0.0
for seg in sc["segments"]:
    meta = json.load(open(os.path.join(B, seg["src"], "meta.json"))); w = meta["windows"][seg["w"]]
    a, b = int(round(seg["from"] * fps)) + 1, min(w["frames"], int(round(seg["to"] * fps)))
    for i in range(a, b + 1):
        n += 1; os.symlink(os.path.abspath(os.path.join(B, seg["src"], w["dir"], f"{i:05d}.jpg")), f"{tmp}/frames/{n:05d}.jpg")
    d = (b - a + 1) / fps
    timeline.append({**seg, "T": T0, "d": d, "wstart": w["start"], "events": json.load(open(os.path.join(B, seg["src"], "events.json")))}); T0 += d
DUR = n / fps
print(f"{len(timeline)} plans · {DUR:.1f} s")

def mapper(seg):
    def f(t):
        rel = t - seg["wstart"]
        return seg["T"] + rel - seg["from"] if seg["from"] <= rel < seg["from"] + seg["d"] else None
    return f

# 2. son : bruitages calés sur l'action, musique, voix
N = int(DUR * S.SR) + S.SR
sfx = np.zeros(N)
for seg in timeline:
    f = mapper(seg)
    for e in seg["events"]:
        t = f(e["t"])
        if t is None: continue
        r = S.event_sound(e)
        if r: sig, g, off = r; S.add(sfx, sig, t + off, g)
    if seg["src"] == "short_tower" and seg["w"] == 3: S.add(sfx, S.rotor(seg["d"]) * np.minimum(1, S.t_(seg["d"]) / 1.5), seg["T"], .9)
    if seg["src"] == "short_tower" and seg["w"] == 0: S.add(sfx, S.engine(1.6, 1.4), seg["T"], .8)
sfx += S.filt(S.rng.uniform(-1, 1, N), "lowpass", 350) * .04
score = S.Score(DUR + 1)
cut = [s["T"] for s in timeline] + [DUR]
bullet = timeline[7]
score.braam(0, d=4); score.tension(0, cut[2], 33)
score.braam(cut[2] - .05, notes=(45, 48, 52, 57), d=2.2, g=.45); score.action(cut[3], cut[7], 45)
score.riser(cut[7], bullet["T"] + 2.0)
score.calm(bullet["T"] + 2.0, bullet["T"] + 9.6, 33)
for k in range(8): score.kick(bullet["T"] + 2.2 + k * .9, .35)
score.braam(bullet["T"] + 9.7, notes=(33, 45, 52, 57), d=4, g=.6)
score.resolve(cut[8] - .3, DUR + .5)
voice = np.zeros(N); vdir = os.path.join(B, f"voice_short_{lang}")
for line in sc["lines"]: S.add(voice, S.load_mp3(os.path.join(vdir, line["id"] + ".mp3")), line["at"])
S.write_wav(f"{tmp}/mix.wav", S.mix(int(DUR * S.SR), score.render(int(DUR * S.SR)), sfx, voice, .55))

# 3. sous-titres : narration mot à mot, accroche, textes du jeu traduits, carte de fin
ev = []
for line in sc["lines"]: ev += T.karaoke(T.words_of(os.path.join(vdir, line["id"] + ".json")), line["at"], "Caption")
h1, h2 = sc["hook"][lang]
ev.append(f"Dialogue: 2,{T.ts(.15)},{T.ts(4.2)},Hook,,0,0,0,,{{\\pos(540,330)\\fscx130\\fscy130\\t(0,160,\\fscx100\\fscy100)\\fad(0,200)}}{h1}")
ev.append(f"Dialogue: 2,{T.ts(.45)},{T.ts(4.2)},Hook2,,0,0,0,,{{\\pos(540,480)\\fscx130\\fscy130\\t(0,160,\\fscx100\\fscy100)\\fad(0,200)}}{h2}")
for seg in timeline:
    for kind, t, d, txt in T.game_texts(seg["events"], mapper(seg), lang, ("stamp", "alarm", "floor")):
        d = min(d, seg["T"] + seg["d"] - t)
        if kind == "stamp": ev.append(f"Dialogue: 3,{T.ts(t)},{T.ts(t + d)},Stamp,,0,0,0,,{{\\pos(540,620)\\fscx125\\fscy125\\t(0,120,\\fscx100\\fscy100)\\fad(0,250)}}{txt}")
        elif kind == "alarm": ev.append(f"Dialogue: 3,{T.ts(t)},{T.ts(min(t + d, seg['T'] + seg['d']))},Alarm,,0,0,0,,{{\\pos(540,440)\\t(0,400,\\alpha&H60&)\\t(400,800,\\alpha&H00&)}}{txt}")
        elif kind == "floor": ev.append(f"Dialogue: 3,{T.ts(t)},{T.ts(t + d)},Floor,,0,0,0,,{{\\pos(540,250)\\fad(100,200)}}{txt}")
card = sc["end_card"][lang]; end0 = sc["lines"][-1]["at"] - .3
ev.append(f"Dialogue: 0,{T.ts(end0)},{T.ts(DUR)},Shade,,0,0,0,,{{\\pos(0,0)\\fad(400,0)\\1a&H78&\\p1}}m 0 0 l 1080 0 l 1080 1920 l 0 1920{{\\p0}}")
t1, t2 = card["title"].split(" ", 1)
ev.append(f"Dialogue: 2,{T.ts(end0 + .2)},{T.ts(DUR)},EndTitle,,0,0,0,,{{\\pos(540,560)\\fad(300,0)}}{t1}")
ev.append(f"Dialogue: 2,{T.ts(end0 + .35)},{T.ts(DUR)},EndTitle,,0,0,0,,{{\\pos(540,720)\\fad(300,0)\\c{T.ORANGE}}}{t2}")
ev.append(f"Dialogue: 2,{T.ts(end0 + 1.4)},{T.ts(DUR)},CTA,,0,0,0,,{{\\pos(540,880)\\fad(250,0)}}{card['cta']}")
styles = """Style: Caption,Anton,92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,1,0,1,7,3,2,60,60,640,1
Style: Hook,Saira Stencil One,140,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,8,4,5,40,40,0,1
Style: Hook2,Saira Stencil One,92,&H001F8AFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,7,4,5,40,40,0,1
Style: Stamp,Saira Stencil One,70,&H001F8AFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,6,3,5,40,40,0,1
Style: Alarm,Saira Stencil One,62,&H003B3BFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,6,3,5,40,40,0,1
Style: Floor,Saira Stencil One,80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,6,3,5,40,40,0,1
Style: Shade,Arial,20,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: EndTitle,Saira Stencil One,140,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,6,4,5,40,40,0,1
Style: CTA,Anton,66,&H00000B16,&H00FFFFFF,&H001F8AFF,&H00000000,0,0,0,0,100,100,1,0,3,18,0,5,40,40,0,1"""
open(f"{tmp}/subs.ass", "w", encoding="utf-8").write(T.header(1080, 1920, styles) + "\n".join(ev) + "\n")

# 4. montage final
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-stats", "-framerate", str(fps), "-i", f"{tmp}/frames/%05d.jpg", "-i", f"{tmp}/mix.wav",
  "-filter_complex", f"[0:v]hqdn3d=2:1.5:4:4,scale=1080:1920:flags=lanczos,unsharp=5:5:0.5,eq=contrast=1.05:saturation=1.1,vignette=PI/5,subtitles={tmp}/subs.ass:fontsdir={FONTS}[v];[1:a]loudnorm=I=-14:TP=-2:LRA=11,aresample=48000,alimiter=limit=0.56:attack=1:release=60:level=disabled[a]",
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "12M", "-bufsize", "24M", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  "-c:a", "aac", "-aac_coder", "twoloop", "-b:a", "256k", "-ar", "48000", "-t", f"{DUR:.3f}", out], check=True)
print("Short prêt :", out)
