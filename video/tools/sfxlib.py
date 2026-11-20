"""Bibliothèque son : bruitages et musique générés en code (aucun son sous droits d'auteur)."""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
rng = np.random.default_rng(42)


def t_(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.uniform(-1, 1, int(d * SR))


def filt(x, kind, f, order=2):
    f = np.clip(np.atleast_1d(f) / (SR / 2), 1e-4, .999)
    return sosfilt(butter(order, f if len(f) > 1 else f[0], btype=kind, output="sos"), x)


def expdec(d, tau, attack=.002):
    t = t_(d)
    return np.minimum(1, t / attack) * np.exp(-t / tau)


def sweep_sine(d, f0, f1):
    t = t_(d)
    return np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (t / d)) / SR)


def saw(f, d, detune=0.0):
    t = t_(d); out = np.zeros_like(t)
    for k, dt in enumerate((-detune, 0, detune)):
        out += 2 * ((t * f * (1 + dt) + k * .31) % 1) - 1
    return out / 3


def sweep_filter(x, kind, f0, f1, blocks=64):
    out = np.zeros_like(x); n = len(x); edges = np.linspace(0, n, blocks + 1).astype(int)
    for i in range(blocks):
        a, b = edges[i], edges[i + 1]; f = f0 * (f1 / f0) ** (i / blocks)
        if kind == "bandpass": f = [f * .7, min(f * 1.4, SR / 2 * .95)]
        pad = min(a, 2048); out[a:b] = filt(x[a - pad:b], kind, f)[pad:]
    return out


def add(bus, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(bus) or i + len(sig) <= 0: return
    if i < 0: sig, i = sig[-i:], 0
    j = min(len(bus), i + len(sig)); bus[i:j] += sig[: j - i] * gain


# ------------------------------------------------------------ bruitages
def shot(heavy=1.0):
    crack = filt(noise(.2), "highpass", 1800) * expdec(.2, .018)
    body = filt(noise(.25), "lowpass", 2600) * expdec(.25, .05)
    thump = sweep_sine(.18, 140 / heavy, 42) * expdec(.18, .06 * heavy)
    tail = filt(noise(1.2 * heavy), "lowpass", 900) * expdec(1.2 * heavy, .3 * heavy) * .35
    s = np.zeros(int(1.2 * heavy * SR))
    for part, g in ((crack, .9), (body, .9), (thump, 1.1 * heavy), (tail, 1.0)): s[: len(part)] += part * g
    return np.tanh(s * 1.8) * .8


def enemy(d):
    return filt(shot(), "lowpass", max(500, 5200 * (1 - d / 90))) * (.75 / (1 + d / 14))


def whoosh(d=.3, f0=600, f1=3000):
    t = t_(d); bell = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return sweep_filter(noise(d), "bandpass", f0, f1, 16) * bell * .9


def stab():
    s = filt(noise(.15), "lowpass", 500) * expdec(.15, .04); s[: int(.12 * SR)] += sweep_sine(.12, 95, 55) * expdec(.12, .05); return s * .9


def click(f=2200, d=.035, g=.25):
    return filt(noise(d), "bandpass", [f * .7, f * 1.4]) * expdec(d, d / 4) * g


def tone(f, d, g=.2):
    t = t_(d); return (np.sin(2 * np.pi * f * t) + .3 * np.sin(6 * np.pi * f * t)) * np.minimum(1, (d - t) / .01) * np.minimum(1, t / .004) * g


def explosion(size=1.0):
    d = 5.0
    boom = sweep_filter(noise(d), "lowpass", 3500, 70) * expdec(d, 1.1 * size, .005)
    sub = sweep_sine(2.0, 70, 24) * expdec(2.0, .7, .004)
    crack = filt(noise(.4), "highpass", 1200) * expdec(.4, .06)
    s = np.zeros(int(d * SR)); s += boom * 1.2; s[: len(sub)] += sub * 1.4; s[: len(crack)] += crack * .8
    for _ in range(40): add(s, click(rng.uniform(800, 4000), rng.uniform(.02, .07), rng.uniform(.05, .25)), rng.uniform(.2, 3.5))
    return np.tanh(s * 1.3)


def crash():
    s = filt(noise(1.2), "highpass", 4000) * expdec(1.2, .35) * .5
    s[: int(.9 * SR)] += filt(noise(.9), "lowpass", 2500) * expdec(.9, .2)
    s[: int(.3 * SR)] += sweep_sine(.3, 90, 35) * expdec(.3, .1); return np.tanh(s * 1.5) * .9


def rotor(d):
    t = t_(d); chop = (.5 + .5 * np.sin(2 * np.pi * 17 * t)) ** 4
    return filt(noise(d), "lowpass", 380) * (.35 + chop) * .6 + np.sin(2 * np.pi * 1180 * t) * .015


def engine(d, rpm=1.0):
    t = t_(d); f = 38 * rpm
    return filt(saw(f, d, .01) + .5 * saw(f * 2, d, .02), "lowpass", 600) * .25 + filt(noise(d), "lowpass", 300) * .1


def siren(d):
    t = t_(d); ph = np.cumsum(640 + 190 * np.sin(2 * np.pi * .55 * t)) / SR % 1
    return filt(2 * ph - 1, "lowpass", 1500) * .06


def ding():
    return np.concatenate([tone(1320, .25, .14), tone(990, .9, .12)])


def sniper_shot():
    return np.tanh(shot(1.6) * 1.6) * .95


FIXED = None


def event_sound(e):
    """Renvoie (signal, gain, décalage) pour un événement du jeu, ou None."""
    global FIXED
    if FIXED is None:
        FIXED = {"shot": shot(), "knife": whoosh(), "stab": stab(), "hit": click(2600, .03, .16), "kill": click(1700, .06, .22), "beep": tone(1400, .09, .16),
                 "plant": tone(800, .16, .14), "empty": click(3500, .03, .2), "sniper": sniper_shot(), "impact": stab() * 1.3, "crash": crash(), "ding": ding(), "bolt": click(2400, .06, .3)}
    k = e["type"]
    if k == "enemyShot": d = e.get("d", 30); return enemy(d), 1.0, d / 343
    if k == "explosion": return explosion(e.get("size", 1)), 1.25, 0
    if k == "reload":
        s = np.zeros(int(1.7 * SR)); [add(s, click(f, .05, .3), dt) for dt, f in ((0, 2200), (.9, 1800), (1.5, 2600))]; return s, 1, 0
    if k in FIXED: return FIXED[k], 1.0, 0
    return None


# ---------------------------------------------------------------- musique
def note(n):
    return 440 * 2 ** ((n - 69) / 12)


class Score:
    """Musique d'ambiance par sections : calme, tension, action, final."""
    def __init__(self, dur, bpm=100):
        self.N = int(dur * SR) + SR; self.L = np.zeros(self.N); self.R = np.zeros(self.N); self.beat = 60 / bpm; self.dur = dur

    def add(self, sig, at, g=1.0, pan=0.0):
        add(self.L, sig * (1 - max(0, pan)), at, g); add(self.R, sig * (1 + min(0, pan)), at, g)

    def braam(self, at, notes=(45, 52, 57, 60), d=3.2, g=.5):
        for i, n in enumerate(notes): self.add(sweep_filter(saw(note(n), d, .004), "lowpass", 180, 1400, 32) * expdec(d, 1.3, .04), at, g / len(notes) * 2, -.3 if i % 2 else .3)
        self.add(sweep_sine(1.5, 55, 40) * expdec(1.5, .6, .01), at, g * .9)

    def kick(self, at, g=.6): self.add(sweep_sine(.35, 120, 40) * expdec(.35, .12), at, g)
    def hat(self, at, g=.06): self.add(filt(noise(.05), "highpass", 7000) * expdec(.05, .012), at, g, .25)
    def snare(self, at, g=.22): self.add(filt(noise(.2), "bandpass", [1200, 6000]) * expdec(.2, .06) + np.sin(2 * np.pi * 190 * t_(.2)) * expdec(.2, .04) * .5, at, g)
    def tom(self, at, g=.3): self.add(sweep_sine(.4, 95, 60) * expdec(.4, .15) + filt(noise(.4), "lowpass", 900) * expdec(.4, .05) * .3, at, g)

    def pad(self, at, notes, d, g=.08):
        env = np.minimum(1, t_(d) / 1.2) * np.minimum(1, (d - t_(d)) / 1.5)
        for i, n in enumerate(notes): self.add(filt(saw(note(n), d, .006), "lowpass", 900) * env, at, g, -.4 if i % 2 else .4)

    def calm(self, a, b, root=33):
        d = b - a
        if d <= .2: return
        dr = filt(saw(note(root), d, .003) + .6 * saw(note(root + 12), d, .005), "lowpass", 260) * np.minimum(1, t_(d) / 2.5) * np.minimum(1, (d - t_(d)) / 1.5)
        self.add(dr, a, .3)
        e = np.sin(2 * np.pi * note(root + 48) * t_(d)) * (.5 + .5 * np.sin(2 * np.pi * 3 * t_(d))) * np.minimum(1, t_(d) / 4) * np.minimum(1, (d - t_(d)) / 2)
        self.add(e, a, .015, .5)

    def tension(self, a, b, root=33):
        self.calm(a, b, root); t = a + 1
        while t < b - .5: self.kick(t, .3); self.kick(t + .22, .17); t += self.beat * 2

    def action(self, a, b, root=45):
        pat = [0, 0, 12, 0, 0, 10, 0, 3, 0, 0, 12, 0, 7, 0, 5, 3]; t = a; k = 0
        while t < b - .1:
            self.add(filt(saw(note(root + pat[k % 16] - 12), self.beat / 4, .003), "lowpass", 700) * expdec(self.beat / 4, .06), t, .3)
            if k % 4 == 0: self.kick(t, .5)
            if k % 8 == 4: self.snare(t)
            if k % 2 == 0: self.hat(t)
            if k % 16 in (6, 14): self.tom(t)
            t += self.beat / 4; k += 1

    def riser(self, a, b):
        d = b - a
        if d <= .3: return
        self.add(sweep_filter(noise(d), "bandpass", 300, 6000, 48) * np.linspace(0, 1, int(d * SR)) ** 2, a, .22)
        self.add(sweep_sine(d, 110, 440) * np.linspace(0, 1, int(d * SR)) ** 2, a, .05)

    def resolve(self, a, b):
        chords = [(57, 60, 64), (53, 57, 60), (48, 52, 55, 60), (55, 59, 62)]; t = a; i = 0
        while t < b - .5:
            d = min(self.beat * 4, b - t) + .8; self.pad(t, chords[i % 4], d); self.kick(t, .25); t += self.beat * 4; i += 1

    def render(self, n):
        return np.stack([self.L[:n], self.R[:n]])


def mix(n, music, sfx, voice, music_gain=.5):
    env = filt(np.abs(voice[:n]), "lowpass", 6)
    duck = 1 - .65 * np.clip(env / .08, 0, 1); duck_s = 1 - .35 * np.clip(env / .08, 0, 1)
    out = np.stack([music[0] * music_gain * duck + sfx[:n] * .85 * duck_s + voice[:n], music[1] * music_gain * duck + sfx[:n] * .85 * duck_s + voice[:n]])
    f = int(.8 * SR); out[:, -f:] *= np.linspace(1, 0, f)
    return np.tanh(out / (np.abs(out).max() + 1e-9) * 1.3) * .89


def write_wav(path, stereo):
    import wave
    pcm = (stereo.T * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def load_mp3(path):
    import subprocess
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    v = np.frombuffer(raw, dtype=np.float32).astype(np.float64); v = filt(v, "highpass", 90)
    return v / (np.abs(v).max() + 1e-9) * .95
