/* Short-lived sounds: the Big Bang, the corona flare, the BRAAAM, the dive drop, and the small details (Earth's chorus
   chirps, Quindar tones, plasma whistlers, glass pings). Each one builds its own nodes and disconnects them when its
   sources end. */

import { R, tanhCurve } from './core'

export type Buffers = {
  white: AudioBuffer
  pink: AudioBuffer
  brown: AudioBuffer
  dust: AudioBuffer
  swell: AudioBuffer
  swellPeak: number
}

/** a one-shot voice: `input` feeds `dest` (dry) and `rev` (wet) */
export function voice(ac: BaseAudioContext, dest: AudioNode, rev: AudioNode | null, dry: number, wet: number, pan = 0) {
  const nodes: AudioNode[] = []
  let pending = 0
  const node = <T extends AudioNode>(n: T): T => {
    nodes.push(n)
    return n
  }
  const track = (s: AudioScheduledSourceNode) => {
    pending++
    s.onended = () => {
      if (--pending === 0) for (const n of nodes) n.disconnect()
    }
  }
  const input = node(ac.createGain())
  let tail: AudioNode = input
  if (pan) {
    const p = node(ac.createStereoPanner())
    p.pan.value = pan
    input.connect(p)
    tail = p
  }
  const d = node(ac.createGain())
  d.gain.value = dry
  tail.connect(d)
  d.connect(dest)
  if (rev && wet > 0) {
    const w = node(ac.createGain())
    w.gain.value = wet
    tail.connect(w)
    w.connect(rev)
  }
  const api = {
    input,
    gain(v = 0) {
      const g = node(ac.createGain())
      g.gain.value = v
      return g
    },
    filter(type: BiquadFilterType, f: number, q = 0.707) {
      const b = node(ac.createBiquadFilter())
      b.type = type
      b.frequency.value = f
      b.Q.value = q
      return b
    },
    shaper(c: Float32Array<ArrayBuffer>) {
      const s = node(ac.createWaveShaper())
      s.curve = c
      s.oversample = '2x'
      return s
    },
    delay(time: number, max = 1) {
      const dl = node(ac.createDelay(max))
      dl.delayTime.value = time
      return dl
    },
    panner(v: number) {
      const p = node(ac.createStereoPanner())
      p.pan.value = v
      return p
    },
    osc(type: OscillatorType, f: number, start: number, stop: number, detune = 0) {
      const o = node(ac.createOscillator())
      o.type = type
      o.frequency.value = f
      o.detune.value = detune
      track(o)
      o.start(start)
      o.stop(stop)
      return o
    },
    buffer(buf: AudioBuffer, start: number, stop: number, offset = R() * buf.duration * 0.8, loop = true) {
      const s = node(ac.createBufferSource())
      s.buffer = buf
      s.loop = loop
      track(s)
      s.start(start, offset)
      s.stop(stop)
      return s
    },
  }
  return api
}
export type Voice = ReturnType<typeof voice>

/** linear attack, hold, exponential release */
export function env(g: AudioParam, t: number, attack: number, peak: number, hold: number, release: number) {
  g.setValueAtTime(0, t)
  g.linearRampToValueAtTime(peak, t + attack)
  g.setTargetAtTime(0, t + attack + hold, release)
}

/** a sine/saw tone with an envelope, connected into `to` */
function tone(v: Voice, type: OscillatorType, f: number, t: number, stop: number, to: AudioNode, a: number, peak: number, hold: number, rel: number, detune = 0) {
  const g = v.gain()
  env(g.gain, t, a, peak, hold, rel)
  v.osc(type, f, t, stop, detune).connect(g)
  g.connect(to)
  return g
}

/* ---------- the Big Bang ---------- */

/** the inhale before the bang: a reversed swell that peaks after `dur` seconds, with a rising sub. Returns its gain
    so the impact can cut it. */
export function leadIn(ac: BaseAudioContext, B: Buffers, dest: AudioNode, rev: AudioNode, t: number, dur: number) {
  const v = voice(ac, dest, rev, 0.6, 0.9)
  const g = v.gain(1)
  g.connect(v.input)
  // cut just before the predicted impact: the suck-out
  g.gain.setValueAtTime(1, t + Math.max(0.3, dur - 0.14))
  g.gain.setTargetAtTime(0, t + Math.max(0.3, dur - 0.14), 0.02)
  const lp = v.filter('lowpass', 200, 1.2)
  lp.frequency.setValueAtTime(200, t)
  lp.frequency.exponentialRampToValueAtTime(9000, t + dur)
  lp.connect(g)
  const sw = v.gain(0.3)
  v.buffer(B.swell, t, t + dur + 1.2, Math.max(0, B.swellPeak - dur), false).connect(sw)
  sw.connect(lp)
  // the rising pitch underneath (sucked toward the point)
  const s = v.osc('sine', 30, t, t + dur + 1.2)
  s.frequency.setValueAtTime(30, t)
  s.frequency.exponentialRampToValueAtTime(110, t + dur)
  const sg = v.gain()
  sg.gain.setValueAtTime(0, t)
  sg.gain.linearRampToValueAtTime(0.22, t + dur)
  s.connect(sg)
  const sat = v.shaper(tanhCurve(2))
  sg.connect(sat)
  sat.connect(g)
  return g
}

/** the impact: sub drop, distorted punch, noise blast, crack, a long dark tail, and the expansion roar whose pitch
    falls as space stretches (after John Cramer's Big Bang sonification) */
export function bigBang(ac: BaseAudioContext, B: Buffers, dest: AudioNode, rev: AudioNode, t: number) {
  const v = voice(ac, dest, rev, 1, 0.7)
  // sub drop 95 -> 24 Hz, lightly saturated so it is felt on small speakers too
  const body = v.osc('sine', 95, t, t + 9)
  body.frequency.setValueAtTime(95, t)
  body.frequency.exponentialRampToValueAtTime(24, t + 2.4)
  const bg = v.gain()
  bg.gain.setValueAtTime(0, t)
  bg.gain.linearRampToValueAtTime(1, t + 0.004)
  bg.gain.setTargetAtTime(0, t + 0.15, 1.5)
  const sat = v.shaper(tanhCurve(1.6))
  const satLP = v.filter('lowpass', 700)
  body.connect(bg).connect(sat).connect(satLP).connect(v.input)
  // mid punch: a distorted saw pair falling an octave
  const pLP = v.filter('lowpass', 3000, 1.2)
  pLP.frequency.setValueAtTime(3000, t)
  pLP.frequency.exponentialRampToValueAtTime(250, t + 0.6)
  const pg = v.gain()
  pg.gain.setValueAtTime(0, t)
  pg.gain.linearRampToValueAtTime(0.5, t + 0.003)
  pg.gain.setTargetAtTime(0, t + 0.04, 0.2)
  const pSat = v.shaper(tanhCurve(4))
  for (const d of [-12, 12]) {
    const o = v.osc('sawtooth', 110, t, t + 2, d)
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(55, t + 0.35)
    o.connect(pSat)
  }
  pSat.connect(pLP).connect(pg).connect(v.input)
  // noise blast closing down
  const nlp = v.filter('lowpass', 9000, 0.7)
  nlp.frequency.setValueAtTime(9000, t)
  nlp.frequency.exponentialRampToValueAtTime(90, t + 3.2)
  const ng = v.gain()
  ng.gain.setValueAtTime(0, t)
  ng.gain.linearRampToValueAtTime(0.55, t + 0.004)
  ng.gain.setTargetAtTime(0, t + 0.05, 0.8)
  v.buffer(B.white, t, t + 7).connect(nlp)
  nlp.connect(ng).connect(v.input)
  // the crack of the flash
  const chp = v.filter('highpass', 1800)
  const cg = v.gain()
  cg.gain.setValueAtTime(0, t)
  cg.gain.linearRampToValueAtTime(0.35, t + 0.0015)
  cg.gain.setTargetAtTime(0, t + 0.004, 0.035)
  v.buffer(B.white, t, t + 0.6).connect(chp)
  chp.connect(cg).connect(v.input)
  // the long dark tail
  const tl = v.filter('lowpass', 240, 0.8)
  tl.frequency.setValueAtTime(240, t)
  tl.frequency.exponentialRampToValueAtTime(45, t + 11)
  const tg = v.gain()
  tg.gain.setValueAtTime(0, t)
  tg.gain.linearRampToValueAtTime(0.7, t + 0.35)
  tg.gain.setTargetAtTime(0, t + 0.6, 3.5)
  v.buffer(B.brown, t, t + 16).connect(tl)
  tl.connect(tg).connect(v.input)
  // the expansion roar: noise through a comb whose pitch falls two octaves (D3 -> D1)
  roar(v, B, t, 146.83, 36.71, 9, 0.22)
}

/** pink noise through a feedback comb tuned to f0 that glides to f1 over `dur`: a pitched roar */
function roar(v: Voice, B: Buffers, t: number, f0: number, f1: number, dur: number, peak: number) {
  const src = v.buffer(B.pink, t, t + dur + 4)
  const bp = v.filter('bandpass', 400, 0.5)
  const inG = v.gain(0.35)
  const dl = v.delay(1 / f0, 0.1)
  dl.delayTime.setValueAtTime(1 / f0, t)
  dl.delayTime.exponentialRampToValueAtTime(1 / f1, t + dur)
  const fb = v.gain(0.93)
  const lp = v.filter('lowpass', 1800, 0.7)
  lp.frequency.setValueAtTime(1800, t)
  lp.frequency.exponentialRampToValueAtTime(380, t + dur)
  const g = v.gain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + 1.3)
  g.gain.setTargetAtTime(0, t + 1.6, dur * 0.3)
  src.connect(bp).connect(inG).connect(dl)
  dl.connect(fb).connect(dl)
  dl.connect(lp).connect(g).connect(v.input)
}

/* ---------- moments ---------- */

/** the galaxy: glassy pings on the current chord, two and four octaves up */
export function shimmer(ac: BaseAudioContext, dest: AudioNode, rev: AudioNode, t: number, chord: readonly number[]) {
  const notes = [...chord.map((f) => f * 2), ...chord.map((f) => f * 4)]
  notes.forEach((f, i) => {
    const ts = t + i * 0.16 + R() * 0.22
    const v = voice(ac, dest, rev, 0.35, 1.2, (R() - 0.5) * 1.6)
    const peak = 0.014 + R() * 0.01
    tone(v, 'sine', f * (1 + (R() - 0.5) * 0.002), ts, ts + 9, v.input, 0.01 + R() * 0.05, peak, 0.1, 1.2 + R() * 1.2)
    tone(v, 'sine', f * 3.01, ts, ts + 5, v.input, 0.005, peak * 0.12, 0, 0.3)
  })
}

/** the Sun ignites: a slow low swell on the root */
export function ignite(ac: BaseAudioContext, B: Buffers, dest: AudioNode, rev: AudioNode, t: number, root: number) {
  const v = voice(ac, dest, rev, 0.9, 0.6)
  const lp = v.filter('lowpass', 120, 0.8)
  lp.frequency.setValueAtTime(120, t)
  lp.frequency.exponentialRampToValueAtTime(700, t + 2.5)
  lp.frequency.setTargetAtTime(150, t + 3, 2)
  lp.connect(v.input)
  tone(v, 'sawtooth', root * 2, t, t + 12, lp, 2.4, 0.16, 0.6, 2.2, -6)
  tone(v, 'sawtooth', root * 3, t, t + 12, lp, 2.8, 0.09, 0.4, 2.2, 6)
  tone(v, 'sine', root, t, t + 12, v.input, 2, 0.4, 0.8, 2.2)
  const ng = v.gain()
  env(ng.gain, t, 2.2, 0.35, 0.3, 1.8)
  v.buffer(B.brown, t, t + 10).connect(ng)
  ng.connect(lp)
}

/** the closest pass through the corona: a plasma eruption sweeping open, a sub swell, crackle and a pitched roar */
export function flare(ac: BaseAudioContext, B: Buffers, dest: AudioNode, spatial: AudioNode, rev: AudioNode, t: number, root: number) {
  const v = voice(ac, spatial, rev, 0.9, 0.5)
  const bp = v.filter('bandpass', 180, 1.1)
  bp.frequency.setValueAtTime(180, t)
  bp.frequency.exponentialRampToValueAtTime(2400, t + 1.9)
  bp.frequency.exponentialRampToValueAtTime(260, t + 5)
  const g = v.gain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.75, t + 1.9)
  g.gain.setTargetAtTime(0, t + 2.1, 1.1)
  v.buffer(B.pink, t, t + 9).connect(bp)
  bp.connect(g).connect(v.input)
  const ch = v.filter('highpass', 2200)
  const cg = v.gain()
  env(cg.gain, t + 0.8, 1.2, 0.5, 0.3, 0.9)
  v.buffer(B.dust, t, t + 8).connect(ch)
  ch.connect(cg).connect(v.input)
  roar(v, B, t + 0.3, root * 4, root * 2, 6, 0.3)

  // the low end stays centred (no HRTF on sub)
  const s = voice(ac, dest, rev, 1, 0.3)
  tone(s, 'sine', root, t, t + 10, s.input, 1.9, 0.55, 0.3, 1.6)
  const sl = s.filter('lowpass', 260)
  const sat = s.shaper(tanhCurve(2.2))
  sat.connect(sl).connect(s.input)
  tone(s, 'sine', root * 2, t, t + 10, sat, 1.9, 0.5, 0.3, 1.4)
}

/** Earth: a warm low swell */
export function earthBloom(ac: BaseAudioContext, dest: AudioNode, rev: AudioNode, t: number, root: number) {
  const v = voice(ac, dest, rev, 0.8, 0.7)
  const lp = v.filter('lowpass', 300, 0.6)
  lp.frequency.setValueAtTime(300, t)
  lp.frequency.exponentialRampToValueAtTime(900, t + 3)
  lp.frequency.setTargetAtTime(400, t + 4, 3)
  lp.connect(v.input)
  tone(v, 'triangle', root * 4, t, t + 14, lp, 2.6, 0.12, 1.8, 2.5, -5)
  tone(v, 'triangle', root * 6, t, t + 14, lp, 3, 0.07, 1.4, 2.5, 5)
  tone(v, 'sine', root * 2, t, t + 14, v.input, 2.4, 0.22, 1.8, 2.5)
}

/** one of Earth's chorus chirps (VLF plasma waves in the radiation belts): a fast rising whistle, often in a run */
export function chirps(ac: BaseAudioContext, dest: AudioNode, rev: AudioNode, t: number, count: number, level: number) {
  let ts = t
  for (let i = 0; i < count; i++) {
    const f0 = 1100 + R() * 1100
    const d = 0.1 + R() * 0.25
    const v = voice(ac, dest, rev, 1, 0.5)
    const g = v.gain()
    g.gain.setValueAtTime(0, ts)
    g.gain.linearRampToValueAtTime(level * (0.5 + R() * 0.5), ts + d * 0.3)
    g.gain.linearRampToValueAtTime(0, ts + d)
    const o = v.osc('sine', f0, ts, ts + d + 0.05)
    o.frequency.setValueAtTime(f0, ts)
    o.frequency.exponentialRampToValueAtTime(f0 * (1.5 + R()), ts + d)
    o.connect(g).connect(v.input)
    ts += d * (0.5 + R() * 1.2)
  }
}

/** the Apollo-era Quindar tone: 2525 Hz opens a transmission, 2475 Hz closes it */
export function quindar(ac: BaseAudioContext, dest: AudioNode, rev: AudioNode, t: number, open: boolean, level: number) {
  const v = voice(ac, dest, rev, 1, 0.2)
  const bp = v.filter('bandpass', 2500, 2)
  bp.connect(v.input)
  const g = v.gain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(level, t + 0.006)
  g.gain.setValueAtTime(level, t + 0.244)
  g.gain.linearRampToValueAtTime(0, t + 0.25)
  v.osc('sine', open ? 2525 : 2475, t, t + 0.3).connect(g)
  g.connect(bp)
}

/** a squelch burst of static */
export function squelch(ac: BaseAudioContext, B: Buffers, dest: AudioNode, t: number, level: number) {
  const v = voice(ac, dest, null, 1, 0)
  const bp = v.filter('bandpass', 1900, 0.8)
  const g = v.gain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(level, t + 0.004)
  g.gain.setTargetAtTime(0, t + 0.05, 0.04)
  v.buffer(B.white, t, t + 0.5).connect(bp)
  bp.connect(g).connect(v.input)
}

/** a plasma whistler (like Voyager's and Parker's plasma wave recordings): a falling, dispersed tone */
export function whistler(ac: BaseAudioContext, dest: AudioNode, rev: AudioNode, t: number, level: number) {
  const v = voice(ac, dest, rev, 1, 0.8)
  const f0 = 4500 + R() * 2500
  const f1 = 700 + R() * 600
  const d = 1.2 + R() * 1.6
  const g = v.gain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(level, t + 0.08)
  g.gain.setTargetAtTime(0, t + d * 0.45, d * 0.25)
  for (const [m, a] of [[1, 1], [1.004, 0.6], [2, 0.12]] as const) {
    const o = v.osc('sine', f0 * m, t, t + d + 1)
    o.frequency.setValueAtTime(f0 * m, t)
    o.frequency.setTargetAtTime(f1 * m, t, d * 0.28) // fast at first, then slower: the dispersion shape
    const og = v.gain(a)
    o.connect(og).connect(g)
  }
  g.connect(v.input)
}

/** BRAAAM: a massive low brass chord (root, octave, fifth) swelling open, saturated, with a sub underneath */
export function braaam(ac: BaseAudioContext, dest: AudioNode, rev: AudioNode, t: number, root: number, level: number, attack = 1.1) {
  const v = voice(ac, dest, rev, 1, 0.65)
  const stop = t + attack + 7
  const lp = v.filter('lowpass', 110, 2.2)
  lp.frequency.setValueAtTime(110, t)
  lp.frequency.exponentialRampToValueAtTime(1500, t + attack)
  lp.frequency.setTargetAtTime(520, t + attack + 0.3, 1.6)
  const sat = v.shaper(tanhCurve(2.6))
  const formant = v.filter('peaking', 480, 1.4)
  formant.gain.value = 7
  const top = v.filter('lowpass', 3200)
  const hp = v.filter('highpass', 38)
  const g = v.gain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(level * 0.6, t + attack * 0.7)
  g.gain.linearRampToValueAtTime(level, t + attack)
  g.gain.setTargetAtTime(level * 0.55, t + attack, 1.2)
  g.gain.setTargetAtTime(0, t + attack + 2.6, 1.3)
  lp.connect(sat).connect(formant).connect(top).connect(hp).connect(g).connect(v.input)
  // root an octave up from the sub register, its octave and fifth; detuned pairs
  for (const [m, a] of [[2, 1], [4, 0.75], [6, 0.55], [8, 0.3]] as const) {
    const pg = v.gain(0.22 * a)
    pg.connect(lp)
    for (const d of [-9, 9]) {
      const o = v.osc('sawtooth', root * m, t, stop, d + (R() - 0.5) * 4)
      // a little upward scoop into the note, like a brass attack
      o.frequency.setValueAtTime(root * m * 0.97, t)
      o.frequency.exponentialRampToValueAtTime(root * m, t + attack * 0.6)
      o.connect(pg)
    }
  }
  const sub = v.gain()
  sub.gain.setValueAtTime(0, t)
  sub.gain.linearRampToValueAtTime(level * 0.9, t + attack)
  sub.gain.setTargetAtTime(0, t + attack + 1.5, 1.6)
  v.osc('sine', root, t, stop).connect(sub)
  sub.connect(v.input)
}

/** the dive's end: a sub drop, a passing whoosh, and a high fifth left hanging in the reverb */
export function drop(ac: BaseAudioContext, B: Buffers, dest: AudioNode, rev: AudioNode, t: number) {
  const v = voice(ac, dest, rev, 1, 0.8)
  const body = v.osc('sine', 75, t, t + 10)
  body.frequency.setValueAtTime(75, t)
  body.frequency.exponentialRampToValueAtTime(21, t + 3.2)
  const bg = v.gain()
  bg.gain.setValueAtTime(0, t)
  bg.gain.linearRampToValueAtTime(1, t + 0.01)
  bg.gain.setTargetAtTime(0, t + 0.2, 1.8)
  const sat = v.shaper(tanhCurve(1.8))
  const lp = v.filter('lowpass', 600)
  body.connect(bg).connect(sat).connect(lp).connect(v.input)
  // the whoosh flies past, left to right
  const bp = v.filter('bandpass', 4500, 1.4)
  bp.frequency.setValueAtTime(4500, t)
  bp.frequency.exponentialRampToValueAtTime(140, t + 1.8)
  const pn = v.panner(-0.9)
  pn.pan.setValueAtTime(-0.9, t)
  pn.pan.linearRampToValueAtTime(0.9, t + 1.4)
  const wg = v.gain()
  wg.gain.setValueAtTime(0, t)
  wg.gain.linearRampToValueAtTime(0.5, t + 0.05)
  wg.gain.setTargetAtTime(0, t + 0.3, 0.5)
  v.buffer(B.white, t, t + 4).connect(bp)
  bp.connect(wg).connect(pn).connect(v.input)
  const nlp = v.filter('lowpass', 1500, 0.7)
  nlp.frequency.setValueAtTime(1500, t)
  nlp.frequency.exponentialRampToValueAtTime(50, t + 2)
  const ng = v.gain()
  ng.gain.setValueAtTime(0, t)
  ng.gain.linearRampToValueAtTime(0.35, t + 0.005)
  ng.gain.setTargetAtTime(0, t + 0.05, 0.5)
  v.buffer(B.brown, t, t + 5).connect(nlp)
  nlp.connect(ng).connect(v.input)
}
