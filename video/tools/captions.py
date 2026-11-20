"""Construit les sous-titres animés (format ASS) d'un Short vertical 1080x1920.

- sous-titres mot à mot (le mot prononcé passe en orange), 3 mots maximum à l'écran
- titre d'accroche pendant les 3 premières secondes
- carte de fin avec le nom du jeu et l'appel à commenter

Usage : python3 captions.py <script.json> <dossier_build>
Lit <build>/timeline.json et <build>/voice/*.json, écrit <build>/subs.ass
"""
import json
import os
import re
import sys

script = json.load(open(sys.argv[1], encoding="utf-8"))
build = sys.argv[2]
timeline = json.load(open(os.path.join(build, "timeline.json"), encoding="utf-8"))
n_frames = len([f for f in os.listdir(os.path.join(build, "frames")) if f.endswith(".jpg")])
DUR = min(n_frames / 30, script.get("duration", 1e9))

ORANGE = "&H1F8AFF&"  # BGR de #FF8A1F
WHITE = "&HFFFFFF&"


def ts(t):
    t = max(0, t)
    h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def words_of(line):
    """Mots + heures de début/fin à partir de l'alignement caractère par caractère d'ElevenLabs."""
    al = json.load(open(os.path.join(build, "voice", line["id"] + ".json"), encoding="utf-8"))
    out, cur, t0, t1 = [], "", None, None
    for ch, a, b in zip(al["chars"], al["start"], al["end"]):
        if ch.isspace():
            if cur:
                out.append([cur, t0, t1])
            cur, t0 = "", None
            continue
        if t0 is None:
            t0 = a
        cur += ch
        t1 = b
    if cur:
        out.append([cur, t0, t1])
    # rattacher la ponctuation isolée (« : », « ? ») au mot précédent
    merged = []
    for w in out:
        if merged and re.fullmatch(r"[:;?!»«.,…]+", w[0]):
            merged[-1][0] += " " + w[0]
            merged[-1][2] = w[2]
        else:
            merged.append(w)
    return merged


def chunks(words, max_words=3, max_chars=18):
    groups, group = [], []
    for w in words:
        txt = " ".join(x[0] for x in group + [w])
        ends_sentence = group and group[-1][0][-1] in ".?!:"
        full = len(group) >= max_words and not (w[0][-1] in ".?!" and len(txt) <= max_chars)
        if group and (full or len(txt) > max_chars or ends_sentence):
            groups.append(group)
            group = []
        group.append(w)
    if group:
        groups.append(group)
    # pas de petit mot tout seul en fin de phrase (« LÀ. ») : on le rattache au groupe précédent
    for i in range(len(groups) - 1, 0, -1):
        g, prev = groups[i], groups[i - 1]
        if len(g) == 1 and len(g[0][0]) <= 4 and prev[-1][0][-1] not in ".?!:":
            prev.extend(g)
            del groups[i]
    return groups


events = []
for item, line in zip(timeline, script["lines"]):
    base = item["start"]
    groups = list(chunks(words_of(line)))
    for gi, g in enumerate(groups):
        g_end = g[-1][2] + 0.18
        if gi + 1 < len(groups):
            g_end = min(g_end + 0.25, groups[gi + 1][0][1])
        for wi, w in enumerate(g):
            a = w[1]
            b = g[wi + 1][1] if wi + 1 < len(g) else g_end
            parts = []
            for wj, x in enumerate(g):
                t = x[0].upper()
                if wj == wi:
                    parts.append("{\\c" + ORANGE + "\\fscx108\\fscy108}" + t + "{\\c" + WHITE + "\\fscx100\\fscy100}")
                else:
                    parts.append(t)
            pop = "{\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}" if wi == 0 else ""
            events.append(f"Dialogue: 1,{ts(base + a)},{ts(base + b)},Caption,,0,0,0,,{pop}{' '.join(parts)}")

# Accroche (0 → 3,2 s)
h1, h2 = script["hook"]
events.append(f"Dialogue: 2,{ts(0.15)},{ts(3.3)},Hook,,0,0,0,,{{\\pos(540,330)\\fscx130\\fscy130\\t(0,160,\\fscx100\\fscy100)\\fad(0,200)}}{h1}")
events.append(f"Dialogue: 2,{ts(0.45)},{ts(3.3)},Hook2,,0,0,0,,{{\\pos(540,470)\\fscx130\\fscy130\\t(0,160,\\fscx100\\fscy100)\\fad(0,200)}}{h2}")

# Carte de fin : à partir de la dernière réplique
end_start = timeline[-1]["start"] - 0.2
card = script["end_card"]
events.append(f"Dialogue: 0,{ts(end_start)},{ts(DUR)},Shade,,0,0,0,,{{\\pos(0,0)\\fad(400,0)\\1a&H70&\\p1}}m 0 0 l 1080 0 l 1080 1920 l 0 1920{{\\p0}}")
title = card["title"].split(" ", 1)
events.append(f"Dialogue: 2,{ts(end_start + 0.2)},{ts(DUR)},EndTitle,,0,0,0,,{{\\pos(540,560)\\fad(300,0)}}{title[0]}")
events.append(f"Dialogue: 2,{ts(end_start + 0.35)},{ts(DUR)},EndTitle,,0,0,0,,{{\\pos(540,720)\\fad(300,0)\\c{ORANGE}}}{title[1] if len(title) > 1 else ''}")
events.append(f"Dialogue: 2,{ts(end_start + 1.6)},{ts(DUR)},CTA,,0,0,0,,{{\\pos(540,880)\\fad(250,0)}}{card['cta']}")

header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Anton,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,1,0,1,7,3,2,60,60,700,1
Style: Hook,Saira Stencil One,118,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,7,4,5,40,40,0,1
Style: Hook2,Saira Stencil One,96,&H001F8AFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,7,4,5,40,40,0,1
Style: Shade,Arial,20,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: EndTitle,Saira Stencil One,150,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,6,4,5,40,40,0,1
Style: CTA,Anton,74,&H00000B16,&H00FFFFFF,&H001F8AFF,&H00000000,0,0,0,0,100,100,1,0,3,18,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
open(os.path.join(build, "subs.ass"), "w", encoding="utf-8").write(header + "\n".join(events) + "\n")
print(f"subs.ass : {len(events)} événements")
