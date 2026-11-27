/* Small DSP helpers for the journey sound: curves, procedural buffers (noise, grains, a wordless radio voice, the
   reverb impulse) and waveshaper curves. Everything is generated, so the sound needs no audio files. The buffer
   makers are plain functions of a sample rate (no AudioContext), so they also run in a worker (buffers.worker.ts). */

export const R = Math.random
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

export type Keys = readonly (readonly [number, number])[]

/** eased piecewise curve over p */
export function curve(keys: Keys, p: number): number {
  if (p <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [p1, v1] = keys[i]
    if (p <= p1) {
      const [p0, v0] = keys[i - 1]
      const t = (p - p0) / (p1 - p0)
      return v0 + (v1 - v0) * t * t * (3 - 2 * t)
    }
  }
  return keys[keys.length - 1][1]
}

/** setTargetAtTime that skips targets that have not really changed (keeps the event lists short) */
export function makeSetter() {
  const sent = new WeakMap<AudioParam, number>()
  return (param: AudioParam, v: number, t: number, tau: number) => {
    const prev = sent.get(param)
    if (prev !== undefined && Math.abs(v - prev) <= Math.max(1e-5, Math.abs(prev) * 0.004)) return
    sent.set(param, v)
    param.setTargetAtTime(v, t, tau)
  }
}
export type Setter = ReturnType<typeof makeSetter>

/** freeze a param at its current value from t (so a new ramp starts without a jump) */
export function holdAt(param: AudioParam, t: number) {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(t)
  else {
    const v = param.value
    param.cancelScheduledValues(t)
    param.setValueAtTime(v, t)
  }
}

/* ---------- buffers ---------- */

/** normalise to a peak, remove DC, and fold the tail onto the head so the buffer loops without a seam */
function finish(raw: Float32Array, out: Float32Array, peakTo: number, fade: number) {
  const n = out.length
  let mean = 0
  for (let i = 0; i < raw.length; i++) mean += raw[i]
  mean /= raw.length
  let peak = 1e-9
  for (let i = 0; i < raw.length; i++) {
    raw[i] -= mean
    peak = Math.max(peak, Math.abs(raw[i]))
  }
  const k = peakTo / peak
  for (let i = 0; i < n; i++) {
    let x = raw[i]
    if (i < fade && n + i < raw.length) {
      const w = i / fade
      x = raw[i] * w + raw[n + i] * (1 - w)
    }
    out[i] = x * k
  }
}

/** stereo loopable noise */
export function noiseBuffer(sr: number, seconds: number, kind: 'white' | 'pink' | 'brown'): Float32Array[] {
  const n = Math.floor(seconds * sr)
  const fade = Math.floor(0.25 * sr)
  const buf = [new Float32Array(n), new Float32Array(n)]
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(n + fade)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0
    for (let i = 0; i < raw.length; i++) {
      const w = R() * 2 - 1
      if (kind === 'white') raw[i] = w
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.969 * b2 + w * 0.153852
        b3 = 0.8665 * b3 + w * 0.3104856
        b4 = 0.55 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.016898
        raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
        b6 = w * 0.115926
      } else {
        br = (br + 0.02 * w) / 1.02
        raw[i] = br
      }
    }
    finish(raw, buf[ch], 0.9, fade)
  }
  return buf
}

/** crackle: sparse tiny impacts with a heavy-tailed size distribution (like dust hitting a probe's antenna) */
export function dustBuffer(sr: number, seconds: number, rate: number): Float32Array[] {
  const n = Math.floor(seconds * sr)
  const buf = [new Float32Array(n), new Float32Array(n)]
  for (let ch = 0; ch < 2; ch++) {
    const d = buf[ch]
    let at = 0
    while (true) {
      at += -Math.log(1 - R()) / rate
      const i0 = Math.floor(at * sr)
      if (i0 >= n) break
      const a = Math.pow(R(), 3) * (R() < 0.5 ? -1 : 1)
      const len = (0.0002 + R() * 0.0025) * sr
      const m = Math.min(n - i0, Math.floor(len * 6))
      for (let j = 0; j < m; j++) d[i0 + j] += a * Math.exp(-j / len) * (R() * 2 - 1)
    }
    let peak = 1e-9
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]))
    for (let i = 0; i < n; i++) d[i] *= 0.9 / peak
  }
  return buf
}

/** a cloud of soft glassy grains on the given pitches, panned across the stereo field */
export function glassBuffer(sr: number, seconds: number, freqs: readonly number[], perSecond: number): Float32Array[] {
  const n = Math.floor(seconds * sr)
  const L = new Float32Array(n)
  const Rr = new Float32Array(n)
  const count = Math.floor(seconds * perSecond)
  for (let g = 0; g < count; g++) {
    const f = freqs[Math.floor(R() * freqs.length)] * (1 + (R() - 0.5) * 0.002)
    const dur = 0.25 + R() * 1.4
    const len = Math.floor(dur * sr)
    const i0 = Math.floor(R() * n)
    const pan = R()
    const amp = 0.3 + R() * 0.7
    const att = 0.05 + R() * 0.3
    const w = (2 * Math.PI * f) / sr
    for (let j = 0; j < len; j++) {
      const u = j / len
      const e = u < att ? Math.sin((u / att) * Math.PI * 0.5) : Math.pow(1 - (u - att) / (1 - att), 2)
      const s = (Math.sin(w * j) + 0.18 * Math.sin(2.003 * w * j)) * e * amp
      const k = (i0 + j) % n // wraps, so the buffer loops seamlessly
      L[k] += s * Math.sqrt(1 - pan)
      Rr[k] += s * Math.sqrt(pan)
    }
  }
  let peak = 1e-9
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i]))
  for (let i = 0; i < n; i++) {
    L[i] *= 0.9 / peak
    Rr[i] *= 0.9 / peak
  }
  return [L, Rr]
}

/** a wordless "voice on the radio": a glottal pulse with phrase intonation through moving vowel formants,
    in phrases of syllables with pauses between them. Mono. */
export function chatterBuffer(sr: number, seconds: number): Float32Array[] {
  const n = Math.floor(seconds * sr)
  const out = new Float32Array(n)
  const vowels = [[730, 1090, 2440], [530, 1840, 2480], [300, 2200, 3000], [570, 840, 2410], [440, 1020, 2240], [660, 1700, 2400]]
  // plan syllables
  type Syl = { a: number; b: number; f0: number; v: number[]; burst: boolean }
  const syl: Syl[] = []
  let t = 0.15
  while (t < seconds - 0.4) {
    const phrase = 0.9 + R() * 2.2
    const end = Math.min(seconds - 0.3, t + phrase)
    const base = 105 + R() * 35
    let s = t
    while (s < end) {
      const d = 0.09 + R() * 0.17
      const u = (s - t) / phrase
      syl.push({ a: s, b: s + d, f0: base * (1.12 - 0.22 * u) * (1 + (R() - 0.5) * 0.12), v: vowels[Math.floor(R() * vowels.length)], burst: R() < 0.45 })
      s += d + (R() < 0.15 ? 0.06 + R() * 0.12 : 0.01 + R() * 0.03)
    }
    t = end + 0.35 + R() * 1.1
  }
  // render
  const F = [0, 0, 0]
  const low = [0, 0, 0]
  const band = [0, 0, 0]
  const gains = [1, 0.55, 0.28]
  let phase = 0
  let f0 = 120
  let env = 0
  let si = 0
  let cur = vowels[0]
  for (let i = 0; i < n; i++) {
    const tt = i / sr
    while (si < syl.length && tt > syl[si].b) si++
    const s = si < syl.length ? syl[si] : null
    const on = s && tt >= s.a ? 1 : 0
    if (s && on) {
      cur = s.v
      f0 += (s.f0 - f0) * 0.002
    }
    env += (on - env) * (on ? 0.004 : 0.0015)
    for (let k = 0; k < 3; k++) F[k] += (cur[k] - F[k]) * 0.0015
    phase += f0 / sr
    if (phase >= 1) phase -= 1
    const src = (1 - 2 * phase) * 0.7 + (R() * 2 - 1) * 0.12
    let y = 0
    for (let k = 0; k < 3; k++) {
      const fc = 2 * Math.sin((Math.PI * Math.max(80, F[k])) / sr)
      const q = 0.12
      low[k] += fc * band[k]
      const high = src - low[k] - q * band[k]
      band[k] += fc * high
      y += band[k] * gains[k]
    }
    let burst = 0
    if (s && s.burst && tt >= s.a && tt < s.a + 0.025) burst = (R() * 2 - 1) * 0.6 * (1 - (tt - s.a) / 0.025)
    out[i] = y * env + burst
  }
  let peak = 1e-9
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]))
  for (let i = 0; i < n; i++) out[i] *= 0.9 / peak
  return [out]
}

/** stereo reverb impulse: a long, darkening space with a few early reflections */
export function impulse(sr: number, seconds: number, rt60: number): Float32Array[] {
  const n = Math.floor(seconds * sr)
  const pre = Math.floor(0.025 * sr)
  const buf = [new Float32Array(n), new Float32Array(n)]
  for (let ch = 0; ch < 2; ch++) {
    const d = buf[ch]
    let y = 0
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr
      const e = Math.exp((-6.9 * t) / rt60) * Math.min(1, t / 0.06)
      const k = 0.8 - 0.7 * Math.min(1, i / n)
      y += k * (R() * 2 - 1 - y)
      d[i] = y * e
    }
    for (let r = 0; r < 14; r++) {
      const at = pre + Math.floor((0.006 + R() * 0.11) * sr)
      if (at < n) d[at] += (R() * 2 - 1) * 0.5 * (1 - r / 14)
    }
  }
  return buf
}

/** noise that swells to a peak at `peak` seconds and then dies quickly: a reversed tail */
export function swellBuffer(sr: number, peak: number): Float32Array[] {
  const n = Math.floor((peak + 0.7) * sr)
  const buf = [new Float32Array(n), new Float32Array(n)]
  for (let ch = 0; ch < 2; ch++) {
    const d = buf[ch]
    let y = 0
    for (let i = 0; i < n; i++) {
      const t = i / sr
      const e = t < peak ? Math.exp((t - peak) / 0.55) : Math.exp(-(t - peak) / 0.08)
      const k = 0.15 + 0.75 * Math.min(1, t / peak) // brightens toward the peak
      y += k * (R() * 2 - 1 - y)
      d[i] = y * e * 1.3
    }
  }
  return buf
}

/** half the sample rate: a windowed-sinc low-pass at a quarter of the rate, then every second sample. It wraps round
    the ends, so a loopable buffer stays loopable. */
export function halve(x: Float32Array): Float32Array {
  const T = 15
  // a half-band filter: besides the centre, only the odd taps are not zero
  const taps: [number, number][] = [[0, 0.5]]
  for (let k = 1; k <= T; k += 2) {
    const h = (Math.sin((Math.PI * k) / 2) / (Math.PI * k)) * (0.5 + 0.5 * Math.cos((Math.PI * k) / (T + 1)))
    taps.push([k, h], [-k, h])
  }
  const sum = taps.reduce((a, [, h]) => a + h, 0)
  const len = x.length
  const n = len >> 1
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let y = 0
    for (const [k, h] of taps) {
      let j = 2 * i + k
      if (j < 0) j += len
      else if (j >= len) j -= len
      y += h * x[j]
    }
    out[i] = y / sum
  }
  return out
}

/** the sample rate the buffers are designed at */
export const REF_SR = 48000
/** where the lead-in swell peaks, in seconds */
export const SWELL_PEAK = 2.6

/** every generated buffer, as plain channel data at `sr` */
export type Raw = { sr: number } & Record<'white' | 'pink' | 'brown' | 'dust' | 'swell' | 'glass' | 'chatter' | 'impulse', Float32Array[]>

/** Make all the buffers for a context running at `sr`. At half the design rate they are made at the design rate and
    halved, so they sound the same; at any other rate they are made directly. */
export function makeRaw(sr: number): Raw {
  const half = sr * 2 === REF_SR
  const g = half ? REF_SR : sr
  const raw: Raw = {
    sr,
    white: noiseBuffer(g, 4.3, 'white'),
    pink: noiseBuffer(g, 6.7, 'pink'),
    brown: noiseBuffer(g, 7.9, 'brown'),
    dust: dustBuffer(g, 5.3, 70),
    swell: swellBuffer(g, SWELL_PEAK),
    // D minor pentatonic, two to three octaves up: sits over all four chords
    glass: glassBuffer(g, 11, [74, 77, 79, 81, 84, 86, 89, 91, 93].map(midi), 7),
    chatter: chatterBuffer(g, 13),
    impulse: impulse(g, 6, 5.2),
  }
  if (half) for (const k of Object.keys(raw) as (keyof Raw)[]) if (k !== 'sr') raw[k] = raw[k].map(halve)
  return raw
}

/** channel data into an AudioBuffer of the context */
export function toBuffer(ac: BaseAudioContext, chans: Float32Array[]): AudioBuffer {
  const buf = ac.createBuffer(chans.length, chans[0].length, ac.sampleRate)
  chans.forEach((c, i) => buf.getChannelData(i).set(c))
  return buf
}

/* ---------- curves ---------- */

/** normalised tanh saturation */
export function tanhCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 2048
  const c = new Float32Array(n)
  const norm = Math.tanh(drive)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    c[i] = Math.tanh(drive * x) / norm
  }
  return c
}

/** the last stage: linear up to `knee`, then a tanh shoulder that never passes `ceil`. The curve covers inputs up to
    ±CEIL_RANGE, so feed it through a gain of 1/CEIL_RANGE and follow it with a gain of CEIL_RANGE. */
export const CEIL_RANGE = 1.6
export function ceilingCurve(knee: number, ceil: number): Float32Array<ArrayBuffer> {
  const n = 4096
  const c = new Float32Array(n)
  const room = ceil - knee
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * CEIL_RANGE
    const a = Math.abs(x)
    c[i] = (a <= knee ? x : Math.sign(x) * (knee + room * Math.tanh((a - knee) / room))) / CEIL_RANGE
  }
  return c
}

/** equal-power fade shapes for setValueCurveAtTime */
export function fadeCurve(up: boolean, from = up ? 0 : 1): Float32Array<ArrayBuffer> {
  const n = 64
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1)
    c[i] = up ? from + (1 - from) * Math.sin((u * Math.PI) / 2) : from * Math.cos((u * Math.PI) / 2)
  }
  return c
}
