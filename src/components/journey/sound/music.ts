/* The musical spine: four chords that loop through the whole journey in real time, voiced as high unison tones
   (the caller puts a steep low cut on them), with a separate bass that follows the chord roots below that cut.

   The progression is D Aeolian i - VI - III - VII: Dm(add9) - Bb(add#11) - Fmaj7 - C(add9). Every voice moves by a
   step or holds, so the loop turns without ever settling (VII leads straight back to i). Inside COGNIA chord one opens
   to Dsus2, and after the dive the loop stops on D major: the minor universe resolves into the major arrival.

   Two identical banks of oscillators take turns: the silent bank is retuned, then the two cross-fade with an
   equal-power curve, so chord changes never click or glide. */

import { fadeCurve, midi, type Setter } from './core'

/** seconds per chord (the loop is four of these) */
export const CHORD_SEC = 6.4
/** cross-fade length between chords */
export const FADE = 2.8

// voiced an octave lower than the names say: a warm, low pad
const E4 = midi(52), F4 = midi(53), Fs4 = midi(54), G4 = midi(55), A4 = midi(57), Bb4 = midi(58), C5 = midi(60), D5 = midi(62), E5 = midi(64)

export type Voicing = readonly [number, number, number, number]

/** the cosmos loop, four voices low to high */
export const LOOP: readonly Voicing[] = [
  [F4, A4, D5, E5], // Dm(add9)
  [F4, Bb4, D5, E5], // Bb(add#11), the Lydian colour
  [F4, A4, C5, E5], // Fmaj7
  [E4, G4, C5, D5], // C(add9)
]
/** chord one inside COGNIA: open, no third */
export const DSUS2: Voicing = [E4, A4, D5, E5]
/** where the dive lands */
export const ARRIVAL: Voicing = [Fs4, A4, D5, E5]
/** bass roots (octave 1: 29-44 Hz), D Bb F C */
export const ROOTS = [midi(26), midi(22), midi(29), midi(24)] as const
const ARRIVAL_ROOT = ROOTS[0]

/** organ-like timbre: strong octaves, a little twelfth */
function organWave(ac: BaseAudioContext) {
  const amps = [0, 1, 0.55, 0.16, 0.3, 0.05, 0.1, 0, 0.07, 0, 0, 0, 0.03]
  const real = new Float32Array(amps.length)
  const imag = new Float32Array(amps)
  return ac.createPeriodicWave(real, imag)
}

/** per-oscillator gain of each layer (the chord bus level sits on top) */
const BASE = { fund: 0.05, oct: 0.034, spark: 0.022 }

export type MusicLevels = {
  mask: readonly [number, number, number, number]
  fund: number
  oct: number
  spark: number
  sub: number
  body: number
  grit: number
}

export type Hold = 'void' | 'arrival' | null

export function createMusic(ac: BaseAudioContext, out: { chord: AudioNode; clean: AudioNode; grit: AudioNode }, chorusDetune: AudioNode) {
  const t0 = ac.currentTime
  const wave = organWave(ac)

  const bank = (on: number) => {
    const chordXf = ac.createGain()
    chordXf.gain.value = on
    chordXf.connect(out.chord)
    const cleanXf = ac.createGain()
    cleanXf.gain.value = on
    cleanXf.connect(out.clean)
    const gritXf = ac.createGain()
    gritXf.gain.value = on
    gritXf.connect(out.grit)
    const panL = ac.createStereoPanner()
    panL.pan.value = -0.85
    panL.connect(chordXf)
    const panR = ac.createStereoPanner()
    panR.pan.value = 0.85
    panR.connect(chordXf)

    // per voice: a detuned unison pair split hard left/right, a triangle an octave up, a sine two octaves up
    const gains = { fundL: [] as GainNode[], fundR: [] as GainNode[], oct: [] as GainNode[], spark: [] as GainNode[] }
    const oscs: { o: OscillatorNode; v: number; mul: number }[] = []
    const voiceOsc = (v: number, type: OscillatorType | 'organ', mul: number, detune: number, chorus: boolean, dest: AudioNode) => {
      const g = ac.createGain()
      g.gain.value = 0
      g.connect(dest)
      const o = ac.createOscillator()
      if (type === 'organ') o.setPeriodicWave(wave)
      else o.type = type
      o.frequency.value = LOOP[0][v] * mul
      o.detune.value = detune
      if (chorus) chorusDetune.connect(o.detune)
      o.connect(g)
      o.start(t0)
      oscs.push({ o, v, mul })
      return g
    }
    for (let v = 0; v < 4; v++) {
      gains.fundL.push(voiceOsc(v, 'organ', 1, -6 - v, false, panL))
      gains.fundR.push(voiceOsc(v, 'organ', 1, 6 + v, true, panR))
      gains.oct.push(voiceOsc(v, 'triangle', 2, v % 2 ? 4 : -4, v % 2 === 1, v % 2 ? panR : panL))
      gains.spark.push(voiceOsc(v, 'sine', 4, v % 2 ? -3 : 3, v % 2 === 0, v % 2 ? panL : panR))
    }

    // bass: sub sine on the root, a sine an octave up, and a detuned saw pair for the saturated harmonics
    const sub = ac.createOscillator()
    sub.frequency.value = ROOTS[0]
    const subG = ac.createGain()
    subG.gain.value = 0
    sub.connect(subG).connect(cleanXf)
    const body = ac.createOscillator()
    body.frequency.value = ROOTS[0] * 2
    const bodyG = ac.createGain()
    bodyG.gain.value = 0
    body.connect(bodyG).connect(cleanXf)
    const gritG = ac.createGain()
    gritG.gain.value = 0
    gritG.connect(gritXf)
    const saws = [-7, 7].map((d) => {
      const o = ac.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = ROOTS[0] * 2
      o.detune.value = d
      o.connect(gritG)
      return o
    })
    for (const o of [sub, body, ...saws]) o.start(t0)
    return { chordXf, cleanXf, gritXf, gains, oscs, sub, body, saws, subG, bodyG, gritG }
  }

  const banks = [bank(1), bank(0)]
  let active = 0
  let fadeEnd = t0
  let idx = 0
  let key = 'loop0'
  let nextAt = Infinity
  let lastHold: Hold = 'void'
  let root = ROOTS[0]
  let voicing: Voicing = LOOP[0]
  let onChord: ((idx: number, root: number, t: number) => void) | null = null

  function tune(b: (typeof banks)[number], v: Voicing, r: number, at: number) {
    for (const { o, v: vi, mul } of b.oscs) o.frequency.setValueAtTime(v[vi] * mul, at)
    b.sub.frequency.setValueAtTime(r, at)
    b.body.frequency.setValueAtTime(r * 2, at)
    for (const o of b.saws) o.frequency.setValueAtTime(r * 2, at)
  }

  function change(t: number, v: Voicing, r: number, k: string) {
    const ts = Math.max(t + 0.06, fadeEnd + 0.06)
    const inc = banks[1 - active]
    const outB = banks[active]
    tune(inc, v, r, ts - 0.04)
    for (const g of [inc.chordXf, inc.cleanXf, inc.gritXf]) g.gain.setValueCurveAtTime(fadeCurve(true), ts, FADE)
    for (const g of [outB.chordXf, outB.cleanXf, outB.gritXf]) g.gain.setValueCurveAtTime(fadeCurve(false), ts, FADE)
    active = 1 - active
    fadeEnd = ts + FADE
    key = k
    root = r
    voicing = v
    return ts
  }

  return {
    /** the loop is born (the Big Bang): restart the clock on chord one */
    birth(t: number) {
      if (key !== 'loop0') change(t, LOOP[0], ROOTS[0], 'loop0')
      idx = 0
      nextAt = t + CHORD_SEC
    },

    /** advance the clock; `hold` freezes it (before the bang, after the dive) */
    tick(t: number, hold: Hold, cognia: boolean) {
      if (hold) {
        nextAt = Infinity
        lastHold = hold
        const want = hold === 'void' ? 'loop0' : 'arrival'
        if (key !== want && t >= fadeEnd) {
          if (hold === 'void') change(t, LOOP[0], ROOTS[0], 'loop0')
          else change(t, ARRIVAL, ARRIVAL_ROOT, 'arrival')
          idx = 0
        }
        return
      }
      if (nextAt === Infinity) {
        // released from a hold without a bang (scrolling back up from the arrival, or a jump)
        if (lastHold === 'arrival' || key !== 'loop0') change(t, LOOP[0], ROOTS[0], 'loop0')
        idx = 0
        nextAt = t + CHORD_SEC
        lastHold = null
        return
      }
      if (t >= nextAt - FADE * 0.5 && t >= fadeEnd) {
        idx = (idx + 1) % 4
        const v = idx === 0 && cognia ? DSUS2 : LOOP[idx]
        const ts = change(t, v, ROOTS[idx], 'loop' + idx)
        nextAt = Math.max(nextAt + CHORD_SEC, t + CHORD_SEC * 0.5)
        onChord?.(idx, ROOTS[idx], ts)
      }
    },

    /** layer levels, both banks alike (the cross-fade sits on top) */
    levels(set: Setter, t: number, L: MusicLevels) {
      for (const b of banks) {
        for (let v = 0; v < 4; v++) {
          const m = L.mask[v]
          const f = BASE.fund * L.fund * m
          set(b.gains.fundL[v].gain, f, t, 0.25)
          set(b.gains.fundR[v].gain, f, t, 0.25)
          set(b.gains.oct[v].gain, BASE.oct * L.oct * m, t, 0.3)
          set(b.gains.spark[v].gain, BASE.spark * L.spark * m, t, 0.35)
        }
        set(b.subG.gain, 0.34 * L.sub, t, 0.25)
        set(b.bodyG.gain, 0.12 * L.body, t, 0.25)
        set(b.gritG.gain, 0.16 * L.grit, t, 0.25)
      }
    },

    onChord(fn: (idx: number, root: number, t: number) => void) {
      onChord = fn
    },
    root: () => root,
    voicing: () => voicing,
    index: () => idx,
  }
}
export type Music = ReturnType<typeof createMusic>
