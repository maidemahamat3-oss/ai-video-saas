"""Sous-titres ASS : narration mot à mot, textes du jeu traduits (FR/EN), titres et cartes."""
import json
import os
import re

ORANGE, WHITE, RED = "&H1F8AFF&", "&HFFFFFF&", "&H3B3BFF&"

# Textes affichés par le jeu → anglais
EN = {
    "ÉLIMINATION SILENCIEUSE": "SILENT TAKEDOWN", "TIR À LA TÊTE": "HEADSHOT", "CHARGE POSÉE": "CHARGE SET", "CIBLE DÉTRUITE": "TARGET DESTROYED",
    "ENTRÉE FORCÉE": "GATE BREACHED", "INFORMATEUR LIBÉRÉ": "INFORMANT RESCUED", "CIBLE PRINCIPALE ÉLIMINÉE": "PRIMARY TARGET DOWN",
    "BASE VIPÈRE": "VIPER BASE", "LE PORT": "THE PORT", "ŒIL DE FAUCON": "FALCON'S EYE", "LA TOUR": "THE TOWER",
    "DÉSERT DU NORD · 02 H 40": "NORTHERN DESERT · 2:40 AM", "PORT DE SALVA · 01 H 10": "PORT OF SALVA · 1:10 AM",
    "MONTS KARAS · 05 H 52": "KARAS MOUNTAINS · 5:52 AM", "CAPITALE · 23 H 15": "THE CAPITAL · 11:15 PM",
    "ALERTE GÉNÉRALE": "GENERAL ALERT", "TOIT": "ROOF", "QG": "HQ", "FAUCON": "FALCON",
    "Faucon, ici le QG. L'antenne de la Base Vipère doit tomber. Discrétion maximale.": "Falcon, this is HQ. The Viper Base antenna has to go down. Stay invisible.",
    "Ils t'ont repéré ! Toute la base est en alerte, fonce !": "They've spotted you! The whole base is on alert, move!",
    "Tu es dans la base. L'antenne radar est au nord-est. Pose la charge sur la console.": "You're inside. The radar antenna is to the northeast. Set the charge on the console.",
    "Charge posée ! Dégage de là, huit secondes !": "Charge set! Get out of there, eight seconds!",
    "Charge posée ! Dégage de là, quinze secondes !": "Charge set! Get out of there, fifteen seconds!",
    "Cible détruite ! Corbeau-1 arrive sur l'héliport, cours !": "Target destroyed! Raven-1 is inbound to the helipad, run!",
    "Faucon, notre informateur est retenu sur les quais. Ramène-le vivant.": "Falcon, our informant is being held on the docks. Bring him back alive.",
    "Tu es repéré ! Ils vont essayer de reprendre l’informateur.": "You've been spotted! They'll try to take the informant back.",
    "Je l'ai. On rejoint la vedette !": "I've got him. Heading for the boat!",
    "Faucon, le colonel Varga quitte sa villa dans quelques minutes. Tu n'auras qu'une seule chance.": "Falcon, Colonel Varga leaves his villa in a few minutes. You'll only get one chance.",
    "Il sort ! Le colonel marche vers sa voiture.": "He's coming out! The colonel is walking to his car.",
    "Cible neutralisée. Corbeau-1 arrive sur la crête, prépare-toi.": "Target down. Raven-1 is coming to the ridge, get ready.",
    "Le voilà. Le Serpent.": "There he is. The Serpent.",
    "Le Serpent est mort ! Prends l'ascenseur jusqu'au toit, Corbeau-1 arrive.": "The Serpent is dead! Take the elevator to the roof, Raven-1 is inbound.",
    "Faucon, le Serpent est dans son bureau, au 14e étage. Fonce, on ne pourra pas te couvrir longtemps.": "Falcon, the Serpent is in his office on the 14th floor. Move fast, we can't cover you for long.",
}


def tr(text, lang):
    if lang == "fr" or not text: return text
    if text in EN: return EN[text]
    m = re.fullmatch(r"TIR À (\d[\d\s]*) M", text)
    if m: return f"SHOT AT {m.group(1)} M"
    m = re.fullmatch(r"ÉTAGE (\d+)", text)
    if m: return f"FLOOR {m.group(1)}"
    return text


def ts(t):
    t = max(0, t); return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def words_of(path):
    al = json.load(open(path, encoding="utf-8"))
    out, cur, t0, t1 = [], "", None, None
    for ch, a, b in zip(al["chars"], al["start"], al["end"]):
        if ch.isspace():
            if cur: out.append([cur, t0, t1])
            cur, t0 = "", None; continue
        if t0 is None: t0 = a
        cur += ch; t1 = b
    if cur: out.append([cur, t0, t1])
    merged = []
    for w in out:
        if merged and re.fullmatch(r"[:;?!»«.,…]+", w[0]): merged[-1][0] += " " + w[0]; merged[-1][2] = w[2]
        else: merged.append(w)
    return merged


def chunks(words, max_words=3, max_chars=18):
    groups, group = [], []
    for w in words:
        txt = " ".join(x[0] for x in group + [w])
        ends = group and group[-1][0][-1] in ".?!:…"
        full = len(group) >= max_words and not (w[0][-1] in ".?!" and len(txt) <= max_chars)
        if group and (full or len(txt) > max_chars or ends): groups.append(group); group = []
        group.append(w)
    if group: groups.append(group)
    for i in range(len(groups) - 1, 0, -1):
        if len(groups[i]) == 1 and len(groups[i][0][0]) <= 4 and groups[i - 1][-1][0][-1] not in ".?!:": groups[i - 1].extend(groups[i]); del groups[i]
    return groups


def karaoke(words, base, style, max_words=3, max_chars=18, upper=True, pop=True):
    ev = []; groups = chunks(words, max_words, max_chars)
    for gi, g in enumerate(groups):
        g_end = g[-1][2] + .18
        if gi + 1 < len(groups): g_end = min(g_end + .25, groups[gi + 1][0][1])
        for wi, w in enumerate(g):
            a = w[1]; b = g[wi + 1][1] if wi + 1 < len(g) else g_end
            parts = []
            for wj, x in enumerate(g):
                t = x[0].upper() if upper else x[0]
                parts.append("{\\c" + ORANGE + "}" + t + "{\\c" + WHITE + "}" if wj == wi else t)
            fx = "{\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}" if (wi == 0 and pop) else ""
            ev.append(f"Dialogue: 1,{ts(base + a)},{ts(base + b)},{style},,0,0,0,,{fx}{' '.join(parts)}")
    return ev


def header(w, h, styles):
    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{styles}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def game_texts(events, t_map, lang, kinds=("stamp", "alarm", "floor", "caption", "radio")):
    """Textes du jeu à réafficher au montage. t_map(t_jeu) → t_vidéo ou None."""
    out = []
    far = [e for e in events if e["type"] == "impact" and e.get("d", 0) > 800]
    for e in events:
        if e["type"] not in kinds: continue
        if e["type"] == "stamp" and e["text"] == "CIBLE PRINCIPALE ÉLIMINÉE":
            hit = [f for f in far if abs(f["t"] - e["t"]) < .3]
            if hit: e = {**e, "text": f"TIR À {round(hit[0]['d'])} M"}
        t = t_map(e["t"])
        if t is None: continue
        if e["type"] == "stamp": out.append(("stamp", t, 1.6, tr(e["text"], lang)))
        elif e["type"] == "alarm": out.append(("alarm", t, 3.5, tr("ALERTE GÉNÉRALE", lang)))
        elif e["type"] == "floor" and e.get("n", 0) > 0: out.append(("floor", t, 2.2, tr("TOIT", lang) if e["n"] == 15 else tr(f"ÉTAGE {e['n']}", lang)))
        elif e["type"] == "caption": out.append(("caption", t, e.get("dur", 4), (e["k"], tr(e["title"], lang), tr(e["p"], lang))))
        elif e["type"] == "radio": out.append(("radio", t, min(e.get("dur", 5), 5), (tr(e.get("who", "QG"), lang), tr(e["text"], lang))))
    return out
