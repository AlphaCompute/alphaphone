"""Builds timeline.js (scene timing from the voiceover) and soundtrack.wav (VO + synthesized music + SFX)."""
import json, os, numpy as np, soundfile as sf

D = os.path.dirname(os.path.abspath(__file__))
SR = 48000
LEAD = 0.3
TAIL = {"hook": .9, "boom": .5, "cloud": .6, "backlash": .6, "locked": .7, "gap": .9,
        "enforce": 1.1, "how": .6, "value": .6, "teams": .5, "market": .9, "close": 3.4}

script = json.load(open(f"{D}/script.json"))
scenes, t = [], 0.0
for sc in script:
    a, sr = sf.read(f"{D}/vo/{sc['id']}.wav", dtype="float32")
    if sr != SR:
        a = np.interp(np.arange(0, len(a), sr / SR), np.arange(len(a)), a).astype("float32")
    dur = len(a) / SR
    scenes.append({"id": sc["id"], "text": sc["text"], "start": round(t, 3), "vo": round(t + LEAD, 3),
                   "voDur": round(dur, 3), "dur": round(LEAD + dur + TAIL[sc["id"]], 3), "_pcm": a})
    t += LEAD + dur + TAIL[sc["id"]]
TOTAL = round(t, 3)
open(f"{D}/timeline.js", "w").write("window.TL=" + json.dumps(
    {"total": TOTAL, "scenes": [{k: v for k, v in s.items() if k != "_pcm"} for s in scenes]}, indent=1) + ";\n")
print("total", TOTAL)

N = int((TOTAL + 0.5) * SR)
tt = np.arange(N) / SR
vo = np.zeros(N, "float32")
for s in scenes:
    i = int(s["vo"] * SR); vo[i:i + len(s["_pcm"])] += s["_pcm"]
vo *= 0.92 / max(1e-6, np.abs(vo).max())

# ---- music: 118 BPM, A minor-ish pop progression ----
BPM = 118; beat = 60 / BPM
rng = np.random.default_rng(7)
music = np.zeros(N, "float32")
def add(sig, at, gain=1.0):
    i = int(at * SR)
    if i >= N: return
    j = min(N, i + len(sig)); music[i:j] += gain * sig[:j - i]
def env(n, a=0.002, d=0.2):
    x = np.arange(n) / SR
    return np.minimum(1, x / a) * np.exp(-x / d)
def kick():
    n = int(.45 * SR); x = np.arange(n) / SR
    f = 50 + 120 * np.exp(-x * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 7)).astype("float32")
def hat(d=.04):
    n = int(.12 * SR); s = rng.standard_normal(n).astype("float32")
    s = np.diff(np.concatenate([[0], s]))  # crude high-pass
    return s * env(n, .001, d) * .5
def clap():
    n = int(.3 * SR); s = rng.standard_normal(n).astype("float32")
    e = env(n, .001, .09)
    for k in (0.0, .012, .024): e += 0.6 * env(n, .001, .01) * (np.arange(n) / SR > k)
    return s * e * .35
def note(freq, d, kind="saw", a=.005, dec=.25):
    n = int(d * SR); x = np.arange(n) / SR
    if kind == "saw":
        s = sum(np.sin(2 * np.pi * freq * k * x) / k for k in range(1, 9)) * .5
    elif kind == "sq":
        s = sum(np.sin(2 * np.pi * freq * k * x) / k for k in range(1, 12, 2)) * .6
    else:
        s = np.sin(2 * np.pi * freq * x)
    return (s * env(n, a, dec)).astype("float32")
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
bars = int(TOTAL / (4 * beat)) + 2
end_music = TOTAL - 2.6  # final hit before outro ring
for b in range(bars):
    t0 = b * 4 * beat
    if t0 > end_music: break
    ch = prog[b % 4]
    intro = t0 < 2 * 4 * beat - 1e-6
    for q in range(4):
        tb = t0 + q * beat
        if tb > end_music: break
        if not intro or q in (0, 2): add(kick(), tb, .9)
        if not intro: add(hat(), tb + beat / 2, .55)
        if q in (1, 3) and not intro: add(clap(), tb, .8)
        for e8 in (0, .25, .5, .75):  # 16th hats
            if not intro and b % 2: add(hat(.015), tb + e8 * beat, .18)
        # bass: 8th notes on root
        for e in (0, .5):
            add(note(hz(ch[0] - 24), beat * .45, "sq", dec=.12), tb + e * beat, .22)
    # pluck arpeggio, 16ths
    arp = [ch[0], ch[1], ch[2], ch[1] + 12, ch[2], ch[1], ch[0] + 12, ch[2]]
    for k in range(16):
        tk = t0 + k * beat / 4
        if tk > end_music: break
        add(note(hz(arp[k % 8] + 12), beat * .3, "saw", dec=.07), tk, .05)
    # pad
    for m in ch:
        p = note(hz(m), 4 * beat, "saw", a=.4, dec=3.0)
        add(p, t0, .025)
# outro: big chord ring
for m in [45, 57, 60, 64, 69]:
    add(note(hz(m), 3.5, "saw", a=.01, dec=1.4), end_music, .08)
add(kick(), end_music, 1.0)

# simple low-pass smoothing on music to tame harshness
k = np.ones(3, "float32") / 3; music = np.convolve(music, k, "same")

# ---- SFX: whoosh into every scene, impacts on stamps ----
sfx = np.zeros(N, "float32")
def whoosh(at, d=.5, gain=.25):
    n = int(d * SR); s = rng.standard_normal(n).astype("float32")
    x = np.linspace(0, 1, n)
    # moving-average band sweep
    out = np.zeros(n, "float32"); w = (60 - 55 * x).astype(int)
    cs = np.cumsum(np.concatenate([[0], s]))
    idx = np.arange(n); lo = np.maximum(0, idx - w)
    out = (cs[idx + 1] - cs[lo]) / np.maximum(1, idx + 1 - lo)
    out *= np.sin(np.pi * x) ** 2
    i = int(max(0, at - d * .7) * SR); j = min(N, i + n); sfx[i:j] += gain * 4 * out[:j - i]
def thump(at, gain=.7):
    add_s = kick() * 1.0; i = int(at * SR); j = min(N, i + len(add_s)); sfx[i:j] += gain * add_s[:j - i]
for s in scenes[1:]: whoosh(s["start"] + .2)
def cue(sid, phrase):
    sc = next(x for x in scenes if x["id"] == sid)
    return sc["vo"] + sc["voDur"] * sc["text"].index(phrase) / len(sc["text"])
for sid, ph in [("backlash", "Wiretap"), ("backlash", "Biometric"), ("backlash", "IT teams"),
                ("locked", "are locked"), ("gap", "Nobody"), ("enforce", "A phone"),
                ("teams", "And IT"), ("market", "A twenty"), ("close", "AlphaPhone")]:
    thump(cue(sid, ph) + .05)

# ---- duck music under VO ----
envv = np.abs(vo); win = int(.12 * SR)
envv = np.convolve(envv, np.ones(win) / win, "same")
duck = 1 - .55 * np.clip(envv / .04, 0, 1)
mix = music * .5 * duck + sfx * .5 + vo
fade = np.ones(N, "float32"); fl = int(.4 * SR); fade[-fl:] = np.linspace(1, 0, fl)
mix *= fade
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= .95 / np.abs(mix).max()
sf.write(f"{D}/soundtrack.wav", mix.astype("float32"), SR)
print("wrote soundtrack", round(N / SR, 2), "s")
