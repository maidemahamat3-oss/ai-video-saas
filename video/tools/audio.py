"""Crée toute la bande-son d'un Short : musique, bruitages calés sur le jeu, voix off, mixage.

Tout est synthétisé en code : aucune musique ni aucun son protégé par droits d'auteur.

Usage : python3 audio.py <script.json> <dossier_build>
Lit    : <build>/events.json, <build>/marks.json, <build>/voice/*.mp3, <build>/frames/
Écrit  : <build>/mix.wav et <build>/timeline.json (heure de début de chaque réplique)
"""
import json
import os
import subprocess
import sys

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
rng = np.random.default_rng(42)
script = json.load(open(sys.argv[1], encoding="utf-8"))
build = sys.argv[2]
events = json.load(open(os.path.join(build, "events.json")))
marks = json.load(open(os.path.join(build, "marks.json")))
fps = 30
n_frames = len([f for f in os.listdir(os.path.join(build, "frames")) if f.endswith(".jpg")])
DUR = min(n_frames / fps, script.get("duration", 1e9))
N = int(DUR * SR) + SR


# ------------------------------------------------------------------ outils DSP
def t_(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.uniform(-1, 1, int(d * SR))


def filt(x, kind, f, order=2):
    f = np.atleast_1d(f) / (SR / 2)
    f = np.clip(f, 1e-4, 0.999)
    return sosfilt(butter(order, f if len(f) > 1 else f[0], btype=kind, output="sos"), x)


def expdec(d, tau, attack=0.002):
    t = t_(d)
    return np.minimum(1, t / attack) * np.exp(-t / tau)


def sweep_sine(d, f0, f1, curve="exp"):
    t = t_(d)
    f = f0 * (f1 / f0) ** (t / d) if curve == "exp" else f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def saw(f, d, detune=0.0):
    t = t_(d)
    out = np.zeros_like(t)
    for k, dt in enumerate((-detune, 0, detune)):
        ph = (t * f * (1 + dt) + k * 0.31) % 1
        out += 2 * ph - 1
    return out / 3


def sweep_filter(x, kind, f0, f1, blocks=64):
    """Filtre dont la fréquence varie (traitement par blocs)."""
    out = np.zeros_like(x)
    n = len(x)
    edges = np.linspace(0, n, blocks + 1).astype(int)
    for i in range(blocks):
        a, b = edges[i], edges[i + 1]
        f = f0 * (f1 / f0) ** (i / blocks)
        if kind == "bandpass":
            f = [f * 0.7, min(f * 1.4, SR / 2 * 0.95)]
        pad = min(a, 2048)
        out[a:b] = filt(x[a - pad:b], kind, f)[pad:]
    return out


def add(bus, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(bus) or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(len(bus), i + len(sig))
    bus[i:j] += sig[: j - i] * gain


# --------------------------------------------------------------- bruitages
def snd_shot():
    crack = filt(noise(0.2), "highpass", 1800) * expdec(0.2, 0.018)
    body = filt(noise(0.25), "lowpass", 2600) * expdec(0.25, 0.05)
    thump = sweep_sine(0.18, 140, 42) * expdec(0.18, 0.06)
    tail = filt(noise(0.9), "lowpass", 900) * expdec(0.9, 0.28) * 0.35
    s = np.zeros(int(0.9 * SR))
    for part, g in ((crack, 0.9), (body, 0.9), (thump, 1.1), (tail, 1.0)):
        s[: len(part)] += part * g
    return np.tanh(s * 1.8) * 0.8


def snd_enemy(d):
    fc = max(500, 5200 * (1 - d / 90))
    s = filt(snd_shot(), "lowpass", fc)
    return s * (0.75 / (1 + d / 14))


def snd_knife():
    d = 0.3
    t = t_(d)
    bell = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    out = np.zeros(len(t))
    for i, (a, b) in enumerate(zip(np.linspace(0, len(t), 9)[:-1].astype(int), np.linspace(0, len(t), 9)[1:].astype(int))):
        fc = 600 * (5 ** (i / 8))
        out[a:b] = filt(noise((b - a) / SR + 0.01), "bandpass", [fc * 0.7, fc * 1.4])[: b - a]
    return out * bell * 0.9


def snd_stab():
    s = filt(noise(0.15), "lowpass", 500) * expdec(0.15, 0.04)
    s[: int(0.12 * SR)] += sweep_sine(0.12, 95, 55) * expdec(0.12, 0.05)
    return s * 0.9


def snd_click(f=2200, d=0.035, g=0.25):
    return filt(noise(d), "bandpass", [f * 0.7, f * 1.4]) * expdec(d, d / 4) * g


def snd_tone(f, d, g=0.2):
    t = t_(d)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(6 * np.pi * f * t)) * np.minimum(1, (d - t) / 0.01) * np.minimum(1, t / 0.004) * g


def snd_explosion():
    d = 5.0
    boom = sweep_filter(noise(d), "lowpass", 3500, 70) * expdec(d, 1.1, 0.005)
    sub = sweep_sine(2.0, 70, 24) * expdec(2.0, 0.7, 0.004)
    crack = filt(noise(0.4), "highpass", 1200) * expdec(0.4, 0.06)
    s = np.zeros(int(d * SR))
    s += boom * 1.2
    s[: len(sub)] += sub * 1.4
    s[: len(crack)] += crack * 0.8
    for _ in range(40):  # débris et crépitements
        at = rng.uniform(0.2, 3.5)
        c = snd_click(rng.uniform(800, 4000), rng.uniform(0.02, 0.07), rng.uniform(0.05, 0.25))
        add(s, c, at)
    return np.tanh(s * 1.3)


def snd_rotor(d):
    t = t_(d)
    chop = (0.5 + 0.5 * np.sin(2 * np.pi * 17 * t)) ** 4
    body = filt(noise(d), "lowpass", 380) * (0.35 + chop)
    whine = np.sin(2 * np.pi * 1180 * t) * 0.015
    return body * 0.6 + whine


def snd_siren(d):
    t = t_(d)
    f = 640 + 190 * np.sin(2 * np.pi * 0.55 * t)
    ph = np.cumsum(f) / SR % 1
    return filt(2 * ph - 1, "lowpass", 1500) * 0.06


SFX = {"shot": snd_shot(), "knife": snd_knife(), "stab": snd_stab(), "hit": snd_click(2600, 0.03, 0.18),
       "kill": snd_click(1700, 0.06, 0.25), "beep": snd_tone(1400, 0.09, 0.18), "plant": snd_tone(800, 0.16, 0.16),
       "empty": snd_click(3500, 0.03, 0.2), "explosion": snd_explosion()}

sfx = np.zeros(N)
alarm_t = None
boom_t = None
for e in events:
    t, k = e["t"], e["type"]
    if k == "enemyShot":
        add(sfx, snd_enemy(e.get("d", 30)), t + e.get("d", 30) / 343)
    elif k == "reload":
        for dt, f in ((0, 2200), (0.9, 1800), (1.5, 2600)):
            add(sfx, snd_click(f, 0.05, 0.3), t + dt)
    elif k == "alarm":
        alarm_t = alarm_t or t
    elif k in SFX:
        if k == "explosion":
            boom_t = t
        add(sfx, SFX[k], t, 1.0 if k != "explosion" else 1.25)
# sirène d'alarme : du déclenchement jusqu'à l'explosion
if alarm_t is not None:
    end = (boom_t or DUR) + 1.5
    s = snd_siren(end - alarm_t)
    s[-int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR))
    add(sfx, s, alarm_t)
# hélicoptère : approche puis présence continue
heli_start = boom_t if boom_t else None
if heli_start:
    d = DUR - heli_start
    r = snd_rotor(d)
    r *= np.clip(t_(d) / 4.5, 0, 1) ** 1.5 * 0.8
    add(sfx, r, heli_start)
# vent
sfx += filt(rng.uniform(-1, 1, N), "lowpass", 350) * 0.05


# ------------------------------------------------------------------- musique
def note(n):  # MIDI -> Hz
    return 440 * 2 ** ((n - 69) / 12)


BEAT = 60 / 100
music = np.zeros((2, N))


def madd(sig, at, gain=1.0, pan=0.0):
    add(music[0], sig * (1 - max(0, pan)), at, gain)
    add(music[1], sig * (1 + min(0, pan)), at, gain)


def braam(at, notes=(45, 52, 57, 60), d=3.2, g=0.5):
    for i, n in enumerate(notes):
        s = saw(note(n), d, 0.004)
        s = sweep_filter(s, "lowpass", 180, 1400, 32) * expdec(d, 1.3, 0.04)
        madd(s, at, g / len(notes) * 2, pan=(-0.3 if i % 2 else 0.3))
    madd(sweep_sine(1.5, 55, 40) * expdec(1.5, 0.6, 0.01), at, g * 0.9)


def kick(at, g=0.6):
    madd(sweep_sine(0.35, 120, 40) * expdec(0.35, 0.12, 0.002), at, g)


def tom(at, g=0.35):
    madd(sweep_sine(0.4, 95, 60) * expdec(0.4, 0.15) + filt(noise(0.4), "lowpass", 900) * expdec(0.4, 0.05) * 0.3, at, g)


def hat(at, g=0.07):
    madd(filt(noise(0.05), "highpass", 7000) * expdec(0.05, 0.012), at, g, pan=0.25)


def snare(at, g=0.25):
    madd(filt(noise(0.2), "bandpass", [1200, 6000]) * expdec(0.2, 0.06) + np.sin(2 * np.pi * 190 * t_(0.2)) * expdec(0.2, 0.04) * 0.5, at, g)


def pad(at, notes, d, g=0.12):
    for i, n in enumerate(notes):
        s = filt(saw(note(n), d, 0.006), "lowpass", 900)
        env = np.minimum(1, t_(d) / 0.8) * np.minimum(1, (d - t_(d)) / 1.0)
        madd(s * env, at, g, pan=(-0.4 if i % 2 else 0.4))


T_alarm = marks.get("alarm", 13.6)
T_boom = boom_t or marks.get("boom", 38)
T_heli = marks.get("heli", T_boom + 2.6)
T_sneak = marks.get("sneak", 7)

# A. infiltration : nappe grave + battement de cœur
braam(0.0, d=4.5, g=0.55)
drone_d = T_alarm
dr = filt(saw(note(33), drone_d, 0.003) + 0.6 * saw(note(45), drone_d, 0.005), "lowpass", 260)
dr *= np.minimum(1, t_(drone_d) / 2.5) * np.minimum(1, (drone_d - t_(drone_d)) / 0.3)
madd(dr, 0, 0.32)
eerie = np.sin(2 * np.pi * note(81) * t_(drone_d)) * (0.5 + 0.5 * np.sin(2 * np.pi * 3 * t_(drone_d))) * np.minimum(1, t_(drone_d) / 4)
madd(eerie, 0, 0.018, pan=0.5)
b = T_sneak
while b < T_alarm - 0.3:
    kick(b, 0.32); kick(b + 0.22, 0.18)
    b += BEAT * 2

# B. action : basse en doubles croches, percussions, montée avant l'explosion
braam(T_alarm, notes=(45, 48, 52, 57), d=2.4, g=0.55)
pattern = [45, 45, 57, 45, 45, 55, 45, 48, 45, 45, 57, 45, 52, 45, 50, 48]
t = T_alarm + 0.4
k = 0
while t < T_boom - 0.15:
    s = filt(saw(note(pattern[k % 16] - 12), BEAT / 4, 0.003), "lowpass", 700) * expdec(BEAT / 4, 0.06)
    madd(s, t, 0.32)
    if k % 4 == 0:
        kick(t, 0.55)
    if k % 8 == 4:
        snare(t, 0.22)
    if k % 2 == 0:
        hat(t)
    if k % 16 in (6, 14):
        tom(t, 0.3)
    t += BEAT / 4
    k += 1
rise_d = min(6.0, T_boom - marks.get("flee", T_boom - 6))
riser = sweep_filter(noise(rise_d), "bandpass", 300, 6000, 48) * np.linspace(0, 1, int(rise_d * SR)) ** 2
madd(riser, T_boom - rise_d, 0.25)
madd(sweep_sine(rise_d, 110, 440) * np.linspace(0, 1, int(rise_d * SR)) ** 2, T_boom - rise_d, 0.06)

# C. explosion puis extraction : accords qui se résolvent
braam(T_boom + 0.35, notes=(33, 45, 52, 57), d=4.0, g=0.6)
chords = [(57, 60, 64), (53, 57, 60), (48, 52, 55, 60), (55, 59, 62)]
t = T_heli - 0.3
i = 0
while t < DUR:
    d = min(BEAT * 4, DUR - t + 1.2)
    pad(t, chords[i % 4], d + 0.6, 0.075)
    kick(t, 0.3)
    t += BEAT * 4
    i += 1

# --------------------------------------------------------------- voix off
voice = np.zeros(N)
timeline = []
for line in script["lines"]:
    start = marks.get(line["at"], 0) + line.get("offset", 0)
    wav = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(build, "voice", line["id"] + ".mp3"), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    v = np.frombuffer(wav, dtype=np.float32).astype(np.float64)
    v = filt(v, "highpass", 90)
    add(voice, v / (np.abs(v).max() + 1e-9) * 0.95, start)
    timeline.append({"id": line["id"], "start": round(start, 3), "end": round(start + len(v) / SR, 3), "text": line["text"]})

# ------------------------------------------------------------------ mixage
env = np.abs(voice)
env = filt(env, "lowpass", 6)
duck = 1 - 0.65 * np.clip(env / 0.08, 0, 1)
duck_sfx = 1 - 0.35 * np.clip(env / 0.08, 0, 1)
L = music[0] * 0.55 * duck + sfx * 0.85 * duck_sfx + voice * 1.0
R = music[1] * 0.55 * duck + sfx * 0.85 * duck_sfx + voice * 1.0
mix = np.stack([L, R])[:, : int(DUR * SR)]
fade = int(0.8 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade)
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.3) * 0.89
pcm = (mix.T * 32767).astype(np.int16)

import wave

with wave.open(os.path.join(build, "mix.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
json.dump(timeline, open(os.path.join(build, "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"mix.wav : {DUR:.1f} s · {len(events)} bruitages · {len(timeline)} répliques")
