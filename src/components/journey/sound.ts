/* The home journey's sound design. Pure Web Audio, no files.

   The spine is music (sound/music.ts): four chords that loop in real time as high unison tones behind a steep low
   cut, with a separate bass on the chord roots below it. How the loop is voiced tells the story: one faint note in
   the void, born from the Big Bang, widening through the galaxy, swelling brightest at the corona, warm at Earth,
   thin and radio-filtered at the station and the probe, at full width with brass and a Shepard riser at COGNIA, and
   dissolving to one note after the dive.

   Around it: a space-air bed, a speed rush, a scroll whoosh, the Sun's plasma (comb-tuned to the chord root), and the
   objects placed around the listener with HRTF panners from the camera-space positions the scene publishes.

   createJourneySound() makes its AudioContext in start() (call it from a click). renderJourney() renders the whole
   thing into an OfflineAudioContext for checking without a user gesture. */

import { CH, CORONA, span, type JourneyFrame, type JourneyObjects } from './story'
import {
  CEIL_RANGE, R, ceilingCurve, chatterBuffer, clamp, clamp01, curve, dustBuffer, glassBuffer, holdAt, impulse,
  makeSetter, midi, noiseBuffer, smooth, swellBuffer, tanhCurve, type Keys, type Setter,
} from './sound/core'
import { createMusic, type MusicLevels } from './sound/music'
import * as V from './sound/voices'

export interface JourneySound {
  /** must be called from a user gesture (click): creates/resumes the AudioContext and fades in */
  start(): Promise<void>
  /** called every animation frame by the scene */
  update(f: JourneyFrame): void
  /** fade out (true) / back in (false) without destroying, for the on/off toggle */
  setMuted(muted: boolean): void
  isRunning(): boolean
  dispose(): void
}

export type JourneySoundOptions = {
  /** render into this context instead of creating a live one (an OfflineAudioContext for checks) */
  context?: BaseAudioContext
}

/** the sub drop at the end of the dive */
const DROP = 0.985
const MASTER = 0.16

/* ---------- how the sound evolves along the scroll ---------- */

const K = {
  // the chord loop
  m0: [[0, 0], [0.03, 0], [0.042, 1], [DROP, 1], [0.997, 0]],
  m1: [[0, 0], [0.03, 0], [0.04, 1], [DROP, 1], [0.995, 0]],
  m3: [[0, 0], [0.03, 0], [0.038, 1], [DROP, 1], [0.993, 0]],
  fund: [[0, 0.5], [0.029, 0.42], [0.036, 1], [0.28, 1], [CORONA, 1.25], [0.53, 1], [0.57, 0.95], [0.66, 0.6], [0.73, 0.55], [0.8, 0.9], [0.9, 1.25], [DROP, 1.25], [1, 0.75]],
  oct: [[0, 0.12], [0.03, 0.08], [0.06, 0.45], [0.16, 0.85], [0.28, 0.8], [CORONA, 1.25], [0.53, 0.8], [0.57, 0.45], [0.66, 0.3], [0.73, 0.28], [0.8, 0.8], [0.9, 1.25], [DROP, 1.2], [1, 0.1]],
  spark: [[0, 0], [0.05, 0], [0.12, 0.35], [0.16, 0.75], [0.24, 0.6], [0.28, 0.3], [0.36, 0.5], [CORONA, 1], [0.53, 0.4], [0.57, 0.15], [0.66, 0.35], [0.73, 0.45], [0.8, 0.5], [0.9, 1], [DROP, 1], [1, 0]],
  chordLvl: [[0, 0.6], [0.026, 0.45], [0.031, 0.15], [0.034, 0.9], [0.16, 1], [0.28, 1], [CORONA, 1.3], [0.53, 1], [0.57, 0.95], [0.66, 0.8], [0.73, 0.75], [0.8, 1], [0.9, 1.3], [DROP, 1.25], [1, 0.85]],
  bright: [[0, 2200], [0.03, 2400], [0.045, 6000], [0.16, 7500], [0.28, 4500], [CORONA, 10000], [0.53, 5000], [0.57, 3000], [0.66, 2600], [0.73, 2300], [0.8, 5000], [0.9, 11000], [DROP, 9000], [1, 2600]],
  lowCut: [[0, 280], [0.6, 270], [0.645, 280], [0.67, 560], [0.735, 700], [0.79, 420], [0.81, 280], [1, 300]],
  width: [[0, 0.3], [0.04, 0.8], [0.16, 1], [CORONA, 1.3], [0.57, 0.85], [0.66, 0.5], [0.73, 0.4], [0.8, 1], [0.9, 1.45], [DROP, 1.45], [1, 0.5]],
  choir: [[0.53, 0], [0.575, 0.9], [0.645, 0.9], [0.675, 0.12], [0.73, 0]],
  chordRev: [[0, 0.6], [0.05, 0.75], [0.36, 0.6], [0.57, 0.5], [0.66, 0.8], [0.73, 0.95], [0.8, 0.8], [1, 1.2]],
  // bass
  sub: [[0, 0.14], [0.028, 0.08], [0.034, 1], [0.06, 0.6], [0.16, 0.45], [0.28, 0.75], [CORONA, 1], [0.53, 0.6], [0.57, 0.55], [0.66, 0.35], [0.73, 0.3], [0.8, 0.8], [0.9, 1], [DROP, 1], [1, 0.35]],
  body: [[0, 0.15], [0.03, 0.1], [0.04, 0.9], [0.16, 0.5], [0.28, 0.7], [CORONA, 1], [0.53, 0.6], [0.57, 0.7], [0.66, 0.35], [0.73, 0.3], [0.8, 0.8], [0.9, 1], [DROP, 0.9], [1, 0.2]],
  grit: [[0, 0], [0.03, 0], [0.04, 0.8], [0.16, 0.3], [0.28, 0.6], [CORONA, 1], [0.53, 0.4], [0.57, 0.35], [0.66, 0.15], [0.73, 0.1], [0.8, 0.6], [0.9, 1], [DROP, 0.8], [1, 0.05]],
  // beds
  air: [[0, 0.3], [0.03, 0.25], [0.045, 1], [0.16, 0.85], [0.28, 0.55], [CORONA, 0.4], [0.57, 0.6], [0.66, 0.7], [0.73, 1], [0.8, 0.7], [0.925, 0.6], [DROP, 0.3], [1, 0.45]],
  airCut: [[0, 1500], [0.045, 5000], [0.16, 6000], [0.36, 2800], [0.57, 3800], [0.73, 2600], [0.8, 4500], [1, 1800]],
  deep: [[0, 0.25], [0.03, 0.2], [0.05, 1], [0.28, 0.7], [CORONA, 0.9], [0.57, 0.5], [0.73, 0.6], [0.8, 0.8], [1, 0.6]],
  sheen: [[0, 0.2], [0.03, 0.2], [0.045, 1], [0.16, 0.8], [0.28, 0.3], [CORONA, 0.6], [0.57, 0.3], [0.66, 0.5], [0.73, 0.7], [0.8, 0.6], [0.9, 1], [DROP, 0.8], [1, 0.2]],
  glass: [[0, 0], [0.06, 0], [0.12, 0.4], [0.16, 1], [0.26, 0.7], [0.3, 0.1], [CORONA, 0.25], [0.53, 0.1], [0.66, 0.2], [0.73, 0.35], [0.8, 0.4], [0.9, 0.9], [DROP, 0.6], [1, 0.15]],
  bed: [[0, 1], [0.97, 1], [DROP, 0.7], [1, 0.6]],
  shep: [[0, 0], [CH.cognia, 0], [CH.cognia + 0.03, 0.35], [CH.dive, 0.7], [DROP, 1]],
} satisfies Record<string, Keys>

/* ---------- the persistent graph ---------- */

type Emit = { input: GainNode; lp: BiquadFilterNode; level: GainNode; panner: PannerNode; ref: number; d: number }

function build(ac: BaseAudioContext) {
  const t = ac.currentTime
  const gain = (v: number) => {
    const g = ac.createGain()
    g.gain.value = v
    return g
  }
  const filter = (type: BiquadFilterType, f: number, q = 0.707) => {
    const b = ac.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    return b
  }
  const osc = (type: OscillatorType, f: number, detune = 0) => {
    const o = ac.createOscillator()
    o.type = type
    o.frequency.value = f
    o.detune.value = detune
    o.start(t)
    return o
  }
  const lfo = (rate: number, depth: number, target: AudioParam | null) => {
    const o = osc('sine', rate)
    const g = gain(depth)
    o.connect(g)
    if (target) g.connect(target)
    return { osc: o, depth: g }
  }
  const loop = (buf: AudioBuffer, rate = 1) => {
    const s = ac.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.playbackRate.value = rate
    s.start(t, R() * buf.duration * 0.9)
    return s
  }
  const shaper = (drive: number) => {
    const s = ac.createWaveShaper()
    s.curve = tanhCurve(drive)
    s.oversample = '2x'
    return s
  }

  const B: V.Buffers = {
    white: noiseBuffer(ac, 4.3, 'white'),
    pink: noiseBuffer(ac, 6.7, 'pink'),
    brown: noiseBuffer(ac, 7.9, 'brown'),
    dust: dustBuffer(ac, 5.3, 70),
    swell: swellBuffer(ac, 2.6),
    swellPeak: 2.6,
  }
  // D minor pentatonic, two to three octaves up: sits over all four chords
  const glassBuf = glassBuffer(ac, 11, [74, 77, 79, 81, 84, 86, 89, 91, 93].map(midi), 7)
  const chatterBuf = chatterBuffer(ac, 13)

  // master: mix -> inside lowpass -> mute -> master -> glue -> limiter (peaks near -3 dBFS) -> soft ceiling (-1.5 dBFS) -> out
  const mix = gain(1)
  const insideLP = filter('lowpass', 20000, 0.6)
  const mute = gain(1)
  const master = gain(0)
  const glue = ac.createDynamicsCompressor()
  glue.threshold.value = -18
  glue.knee.value = 10
  glue.ratio.value = 2
  glue.attack.value = 0.03
  glue.release.value = 0.35
  const limiter = ac.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.0015
  limiter.release.value = 0.15
  const trim = gain(0.92 / CEIL_RANGE) // the compressors add their own make-up gain (about +9 dB)
  const ceiling = ac.createWaveShaper()
  ceiling.curve = ceilingCurve(0.6, 0.84)
  ceiling.oversample = '4x'
  const post = gain(CEIL_RANGE)
  // nothing above ~2.4 kHz anywhere: a steep low-pass on the whole mix
  const topA = filter('lowpass', 2400, 0.541)
  const topB = filter('lowpass', 2400, 1.307)
  mix.connect(topA).connect(topB).connect(insideLP).connect(mute).connect(master).connect(glue).connect(limiter).connect(trim).connect(ceiling).connect(post).connect(ac.destination)

  // reverb
  const revIn = gain(1)
  const conv = ac.createConvolver()
  conv.buffer = impulse(ac, 6, 5.2)
  const revHP = filter('highpass', 90)
  const revOut = gain(0.55)
  revIn.connect(revHP).connect(conv).connect(revOut).connect(mix)
  const fx = gain(1) // one-shot voices
  fx.connect(mix)

  // the bed, duckable by the impacts (a manual sidechain)
  const duck = gain(1)
  const bedLevel = gain(1)
  duck.connect(bedLevel).connect(mix)
  const bassDuck = gain(1)
  bassDuck.connect(bedLevel)

  // ----- music -----
  const chorus = lfo(0.13, 5, null)
  const chordIn = gain(1)
  const cleanIn = gain(1)
  const gritIn = gain(1)
  const music = createMusic(ac, { chord: chordIn, clean: cleanIn, grit: gritIn }, chorus.depth)
  // the low cut: 24 dB/octave Butterworth (two biquads)
  const hp1 = filter('highpass', 70, 0.541)
  const hp2 = filter('highpass', 70, 1.307)
  const bright = filter('lowpass', 3000, 0.5)
  const trem = gain(1)
  const tremLfo = lfo(0.09, 0.08, trem.gain)
  chordIn.connect(hp1).connect(hp2).connect(bright).connect(trem)
  // stereo width (mid/side)
  const split = ac.createChannelSplitter(2)
  const merge = ac.createChannelMerger(2)
  const wLL = gain(1), wRL = gain(0), wLR = gain(0), wRR = gain(1)
  trem.connect(split)
  split.connect(wLL, 0)
  split.connect(wLR, 0)
  split.connect(wRL, 1)
  split.connect(wRR, 1)
  wLL.connect(merge, 0, 0)
  wRL.connect(merge, 0, 0)
  wLR.connect(merge, 0, 1)
  wRR.connect(merge, 0, 1)
  const chordLvl = gain(0)
  const chordRev = gain(0.6)
  // no melody: the chords are a low, sustained film-score pad
  merge.connect(chordLvl).connect(duck)
  chordLvl.connect(chordRev).connect(revIn)
  // Earth's choir: the chord through vowel formants
  const choir = gain(0)
  for (const [f, q, a] of [[650, 7, 1], [1080, 8, 0.6], [2650, 10, 0.3]] as const) {
    const bp = filter('bandpass', f, q)
    const g = gain(a * 3.2)
    hp2.connect(bp).connect(g).connect(choir)
    lfo(0.07 + R() * 0.05, 90, bp.detune)
  }
  choir.connect(duck)
  choir.connect(chordRev)
  // bass
  const clean = gain(1)
  cleanIn.connect(clean).connect(bassDuck)
  const gritLP = filter('lowpass', 240, 0.8)
  const gritSat = shaper(3)
  const gritLP2 = filter('lowpass', 700, 0.6)
  const grit = gain(0.9)
  gritIn.connect(gritLP).connect(gritSat).connect(gritLP2).connect(grit).connect(bassDuck)
  const bassBreath = lfo(0.055, 0.12, bassDuck.gain)

  // ----- beds -----
  const white = loop(B.white)
  const pink = loop(B.pink)
  const brown = loop(B.brown)
  const airHP = filter('highpass', 150)
  const airLP = filter('lowpass', 2000, 0.5)
  const air = gain(0)
  pink.connect(airHP).connect(airLP).connect(air).connect(duck)
  lfo(0.053, 600, airLP.detune)
  lfo(0.031, 0.25, air.gain)
  const sheenHP = filter('highpass', 7000)
  const sheen = gain(0)
  white.connect(sheenHP).connect(sheen)
  lfo(0.041, 0.3, sheen.gain)
  const deepLP = filter('lowpass', 75, 0.7)
  const deep = gain(0)
  brown.connect(deepLP).connect(deep).connect(bassDuck)
  const glassHP = filter('highpass', 900)
  const glass = gain(0)
  loop(glassBuf).connect(glassHP).connect(glass)
  const glassRev = gain(1.2)
  glass.connect(glassRev).connect(revIn)
  // speed rush
  const rushBP = filter('bandpass', 200, 0.9)
  const rushBP2 = filter('bandpass', 600, 1.2)
  const rush = gain(0)
  brown.connect(rushBP).connect(rush)
  pink.connect(rushBP2).connect(rush)
  rush.connect(duck)
  // scroll whoosh
  const whooshBP = filter('bandpass', 300, 0.8)
  const whoosh = gain(0)
  const whooshPan = ac.createStereoPanner()
  white.connect(whooshBP).connect(whoosh).connect(whooshPan).connect(mix)
  // the Sun's low rumble (centred)
  const rumbleLP = filter('lowpass', 60, 0.8)
  const rumbleLP2 = filter('lowpass', 380)
  const rumble = gain(0)
  brown.connect(rumbleLP).connect(shaper(2)).connect(rumbleLP2).connect(rumble).connect(bassDuck)
  // the Shepard riser into the dive: octave-spaced sines gliding up forever, plus a rising noise band
  const shepBus = gain(0)
  const shepHP = filter('highpass', 110)
  const shepLP = filter('lowpass', 5000, 0.5)
  shepBus.connect(shepHP).connect(shepLP).connect(duck)
  const shepRev = gain(0.8)
  shepLP.connect(shepRev).connect(revIn)
  const shep = Array.from({ length: 7 }, (_, k) => {
    const o = osc(k % 2 ? 'triangle' : 'sine', midi(26) * Math.pow(2, k))
    const g = gain(0)
    o.connect(g).connect(shepBus)
    return { o, g, pos: k }
  })
  const riserBP = filter('bandpass', 200, 2)
  const riser = gain(0)
  white.connect(riserBP).connect(riser).connect(duck)

  // ----- emitters, placed with HRTF -----
  const world = gain(1)
  world.connect(mix)
  const worldRev = gain(0.5)
  world.connect(worldRev).connect(revIn)
  const emitter = (ref: number): Emit => {
    const input = gain(1)
    const lp = filter('lowpass', 18000, 0.5)
    const level = gain(0)
    const panner = ac.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 1
    panner.rolloffFactor = 0 // distance is handled by `level` and `lp`
    if (panner.positionZ) panner.positionZ.value = -1
    input.connect(lp).connect(level).connect(panner).connect(world)
    return { input, lp, level, panner, ref, d: 0 }
  }
  const E = {
    singularity: emitter(60),
    sun: emitter(28),
    earth: emitter(22),
    iss: emitter(3),
    voyager: emitter(4),
    wormhole: emitter(14),
  } satisfies Record<keyof JourneyObjects, Emit>

  // the singularity: a pulsing hum on D, with a thin high whine
  const singG = gain(0.3)
  lfo(0.75, 0.2, singG.gain)
  for (const [f, a] of [[146.83, 0.12], [293.66, 0.08], [1174.66, 0.012]] as const) osc('sine', f).connect(gain(a)).connect(singG)
  singG.connect(E.singularity.input)

  // the Sun's plasma: two combs tuned to the chord root, roiling band-passed noise, and crackle
  const combSrc = filter('bandpass', 500, 0.5)
  pink.connect(combSrc)
  const combs = [2, 3].map((m) => {
    const dl = ac.createDelay(0.1)
    dl.delayTime.value = 1 / (midi(26) * m)
    const fb = gain(m === 2 ? 0.94 : 0.9)
    const inG = gain(0.25)
    combSrc.connect(inG).connect(dl)
    dl.connect(fb).connect(dl)
    return { dl, m }
  })
  const combLP = filter('lowpass', 900, 0.6)
  const comb = gain(0)
  for (const c of combs) c.dl.connect(combLP)
  combLP.connect(comb).connect(E.sun.input)
  const plasmaBP1 = filter('bandpass', 400, 1.2)
  const plasmaBP2 = filter('bandpass', 1200, 2)
  const plasmaAM = gain(0.6)
  const plasma = gain(0)
  pink.connect(plasmaBP1).connect(plasmaAM)
  pink.connect(plasmaBP2).connect(plasmaAM)
  plasmaAM.connect(plasma).connect(E.sun.input)
  lfo(0.17, 700, plasmaBP1.detune)
  lfo(0.29, 900, plasmaBP2.detune)
  lfo(4.3, 0.18, plasmaAM.gain)
  lfo(0.21, 0.3, plasmaAM.gain)
  const crackleHP = filter('highpass', 1800)
  const crackle = gain(0)
  loop(B.dust).connect(crackleHP).connect(crackle).connect(E.sun.input)

  // Earth: thin air and the chorus chirps (scheduled)
  const earthAirBP = filter('bandpass', 700, 0.6)
  const earthAir = gain(0.05)
  pink.connect(earthAirBP).connect(earthAir).connect(E.earth.input)

  // the station: a wordless voice on the radio, static, a mechanical hum and fans; Doppler on the hum and the voice
  const chatter = loop(chatterBuf)
  const chatHP = filter('highpass', 380, 0.8)
  const chatLP = filter('lowpass', 2700, 0.9)
  const chatGate = gain(0)
  const chatSat = shaper(2.5)
  chatter.connect(chatHP).connect(chatLP).connect(chatSat).connect(chatGate).connect(gain(0.32)).connect(E.iss.input)
  const staticBP = filter('bandpass', 2100, 0.7)
  const staticGate = gain(0.15)
  white.connect(staticBP).connect(staticGate).connect(gain(0.1)).connect(E.iss.input)
  const humLP = filter('lowpass', 420, 1)
  const humG = gain(0.06)
  const hum = [osc('sawtooth', 100), osc('sine', 200, 3)]
  for (const o of hum) o.connect(humLP)
  humLP.connect(humG).connect(E.iss.input)
  const fanBP = filter('bandpass', 950, 2.5)
  pink.connect(fanBP).connect(gain(0.08)).connect(E.iss.input)

  // the probe: the interstellar emission (a narrow band of hiss that rises), a faint carrier, dust ticks
  const hissBP = filter('bandpass', 2000, 6)
  const hiss = gain(0.5)
  white.connect(hissBP).connect(hiss).connect(E.voyager.input)
  lfo(0.11, 0.25, hiss.gain)
  const carrier = gain(0.01)
  osc('sine', 1760).connect(carrier)
  osc('sine', 1762.3).connect(carrier)
  carrier.connect(E.voyager.input)
  const vDustHP = filter('highpass', 3000)
  loop(B.dust, 0.7).connect(vDustHP).connect(gain(0.05)).connect(E.voyager.input)

  // the wormhole: noise swirling through two sweeping bands, turning
  const swBP1 = filter('bandpass', 500, 3)
  const swBP2 = filter('bandpass', 1400, 4)
  const swAM = gain(0.6)
  const swirl = gain(0.5)
  pink.connect(swBP1).connect(swAM)
  pink.connect(swBP2).connect(swAM)
  swAM.connect(swirl).connect(E.wormhole.input)
  lfo(0.23, 900, swBP1.detune)
  lfo(0.37, 1100, swBP2.detune)
  const swRot = lfo(1.6, 0.4, swAM.gain)

  return {
    B, mix, insideLP, mute, master, revIn, fx, duck, bassDuck, bedLevel,
    music, hp1, hp2, bright, tremLfo, wLL, wRL, wLR, wRR, chordLvl, chordRev, choir, clean, grit, bassBreath,
    air, airLP, sheen, deep, glass, rush, rushBP, rushBP2, whoosh, whooshBP, whooshPan, rumble, rumbleLP,
    shepBus, shepLP, shep, riser, riserBP,
    E, comb, combs, combLP, plasma, plasmaBP1, plasmaBP2, crackle, chatter, chatGate, staticGate, hum, humG,
    hiss, hissBP, swirl, swRot, world,
  }
}
type Graph = ReturnType<typeof build>

/* ---------- the sound ---------- */

export function createJourneySound(opts: JourneySoundOptions = {}): JourneySound {
  const offline = !!opts.context
  let ctx: BaseAudioContext | null = null
  let G: Graph | null = null
  let started = false
  let disposed = false
  let userMuted = false
  let pageHidden = !offline && typeof document !== 'undefined' && document.hidden
  let frameVisible = true
  let audibleTarget = -1
  let suspendTimer = 0
  let lastUpd = -1
  let prevP = -1
  let whooshLvl = 0
  let swellGain: GainNode | null = null
  let shepPhase = 0
  let issD = -1
  let issVr = 0
  let nextChirp = 0
  let nextTx = 0
  let nextWhistle = 0
  let cur: JourneyFrame | null = null
  const set: Setter = makeSetter()

  const audible = () => !!ctx && started && !disposed && !userMuted && !pageHidden && frameVisible

  function applyAudible() {
    const ac = ctx
    const g = G
    if (!ac || !g || disposed) return
    const on = offline ? started : audible()
    const target = on ? 1 : 0
    if (target === audibleTarget) return
    audibleTarget = target
    if (offline || !(ac instanceof AudioContext)) {
      g.mute.gain.setTargetAtTime(target, ac.currentTime, 0.2)
      return
    }
    clearTimeout(suspendTimer)
    if (on) {
      const fadeIn = () => {
        if (ctx === ac && audibleTarget === 1) g.mute.gain.setTargetAtTime(1, ac.currentTime, 0.2)
      }
      if (ac.state !== 'running') ac.resume().then(fadeIn, () => {})
      else fadeIn()
    } else {
      g.mute.gain.setTargetAtTime(0, ac.currentTime, 0.2)
      // once faded, stop the audio thread to save CPU
      suspendTimer = window.setTimeout(() => {
        if (ctx === ac && !audible() && ac.state === 'running') ac.suspend().catch(() => {})
      }, 2000)
    }
  }

  const onVisibility = () => {
    pageHidden = document.hidden
    applyAudible()
  }

  /** duck the bed under an impact and let it bloom back */
  function duckBed(g: Graph, t: number, depth: number, hold: number, back: number) {
    for (const [p, d] of [[g.duck.gain, depth], [g.bassDuck.gain, Math.min(1, depth * 1.5)]] as const) {
      holdAt(p, t)
      p.setTargetAtTime(d, t, 0.012)
      p.setTargetAtTime(1, t + hold, back)
    }
  }

  /* events: fired once when p crosses `at` going forward, re-armed when p drops below `rearm` */
  type Ev = { at: number; rearm: number; armed: boolean; fire: (ac: BaseAudioContext, g: Graph, t: number, f: JourneyFrame) => void }
  const events: Ev[] = [
    {
      at: CH.bang - 0.012, rearm: 0.006, armed: false,
      fire(ac, g, t, f) {
        // sized so the swell peaks roughly when the scroll reaches the bang
        const dur = clamp((CH.bang - f.p) / Math.max(f.v, 0.004), 0.6, 2.4)
        // the universe inhales, then a breath of silence just before the impact
        const gap = t + Math.max(0.3, dur - 0.14)
        for (const [p, d] of [[g.duck.gain, 0.12], [g.bassDuck.gain, 0.25]] as const) {
          holdAt(p, t)
          p.setTargetAtTime(d, t, dur * 0.3)
          p.setTargetAtTime(0.015, gap, 0.02)
        }
        swellGain = V.leadIn(ac, g.B, g.fx, g.revIn, t, dur)
      },
    },
    {
      at: CH.bang, rearm: 0.012, armed: false,
      fire(ac, g, t) {
        if (swellGain) {
          holdAt(swellGain.gain, t)
          swellGain.gain.setTargetAtTime(0, t, 0.01)
          swellGain = null
        }
        duckBed(g, t, 0.1, 0.5, 2.2)
        V.bigBang(ac, g.B, g.fx, g.revIn, t)
        g.music.birth(t)
      },
    },
    { at: CH.galaxy + 0.012, rearm: CH.galaxy - 0.03, armed: false, fire: (ac, g, t) => V.shimmer(ac, g.fx, g.revIn, t, g.music.voicing()) },
    { at: CH.sun + 0.004, rearm: CH.sun - 0.03, armed: false, fire: (ac, g, t) => V.ignite(ac, g.B, g.fx, g.revIn, t, g.music.root()) },
    { at: CORONA - 0.012, rearm: CORONA - 0.06, armed: false, fire: (ac, g, t) => V.flare(ac, g.B, g.fx, g.E.sun.input, g.revIn, t, g.music.root()) },
    {
      at: CH.earth + 0.008, rearm: CH.earth - 0.04, armed: false,
      fire(ac, g, t) {
        V.earthBloom(ac, g.fx, g.revIn, t, g.music.root())
        nextChirp = t + 1.2
      },
    },
    {
      at: CH.iss + 0.004, rearm: CH.iss - 0.03, armed: false,
      fire(ac, g, t) {
        V.squelch(ac, g.B, g.E.iss.input, t, 0.25)
        nextTx = t + 0.4
      },
    },
    {
      at: CH.voyager + 0.004, rearm: CH.voyager - 0.03, armed: false,
      fire(ac, g, t) {
        V.whistler(ac, g.E.voyager.input, g.revIn, t + 0.3, 0.09)
        nextWhistle = t + 3
      },
    },
    {
      at: CH.cognia + 0.004, rearm: CH.cognia - 0.04, armed: false,
      fire(ac, g, t) {
        duckBed(g, t + 1.6, 0.55, 0.3, 1.2)
        V.braaam(ac, g.fx, g.revIn, t, g.music.root(), 0.55, 2)
      },
    },
    {
      at: DROP, rearm: CH.dive, armed: false,
      fire(ac, g, t) {
        duckBed(g, t, 0.04, 2.2, 2.6)
        V.drop(ac, g.B, g.fx, g.revIn, t)
      },
    },
  ]

  function onChord(_idx: number, root: number, t: number) {
    const f = cur
    const ac = ctx
    const g = G
    if (!f || !ac || !g) return
    // in COGNIA every chord change gets a BRAAAM on its root
    if (f.p >= CH.cognia + 0.01 && f.p < DROP - 0.004) V.braaam(ac, g.fx, g.revIn, t - 0.4, root, 0.36, 1.4)
  }

  function place(g: Graph, f: JourneyFrame, t: number, dt: number) {
    for (const k of Object.keys(g.E) as (keyof JourneyObjects)[]) {
      const e = g.E[k]
      const o = f.objs[k]
      const d = Math.max(1e-3, o.d)
      const near = clamp(Math.pow(e.ref / d, 0.55), 0.2, 1.25)
      const after = k === 'wormhole' ? 1 - 0.85 * smooth(DROP, 0.995, f.p) : 1 // quiet once through the throat
      set(e.level.gain, clamp01(o.on) * near * after, t, 0.08)
      set(e.lp.frequency, 700 + 17000 * clamp01(e.ref / d), t, 0.1)
      if (o.on > 0.001) {
        const x = o.x / d, y = o.y / d, z = o.z / d
        const p = e.panner
        if (p.positionX) {
          set(p.positionX, x, t, 0.05)
          set(p.positionY, y, t, 0.05)
          set(p.positionZ, d < 1e-2 ? -1 : z, t, 0.05)
        } else p.setPosition(x, y, z)
      }
    }
    // Doppler on the station as the camera passes it
    const di = f.objs.iss.d
    if (issD >= 0 && dt > 0) issVr += ((di - issD) / dt - issVr) * 0.3
    issD = di
    const shift = clamp(-issVr * 0.025, -0.1, 0.1)
    set(g.chatter.playbackRate, 1 + shift, t, 0.08)
    for (const o of g.hum) set(o.detune, 1200 * Math.log2(1 + shift), t, 0.08)
  }

  function params(ac: BaseAudioContext, g: Graph, f: JourneyFrame, p: number, t: number, dt: number) {
    const m = g.music
    const cognia = p >= CH.cognia && p < DROP
    m.tick(t, p < CH.bang ? 'void' : p >= DROP ? 'arrival' : null, cognia)
    const L: MusicLevels = {
      mask: [curve(K.m0, p), curve(K.m1, p), 1, curve(K.m3, p)],
      fund: curve(K.fund, p),
      oct: curve(K.oct, p),
      spark: curve(K.spark, p),
      sub: curve(K.sub, p),
      body: curve(K.body, p),
      grit: curve(K.grit, p),
    }
    m.levels(set, t, L)
    const s = clamp01(f.sun)
    set(g.chordLvl.gain, curve(K.chordLvl, p) * (1 + 0.15 * s), t, 0.3)
    set(g.bright.frequency, curve(K.bright, p) * Math.pow(2, f.my * 0.35), t, 0.3)
    const lc = curve(K.lowCut, p)
    set(g.hp1.frequency, lc, t, 0.3)
    set(g.hp2.frequency, lc, t, 0.3)
    const w = clamp(curve(K.width, p) * (1 + Math.abs(f.mx) * 0.2), 0, 1.6)
    set(g.wLL.gain, (1 + w) / 2, t, 0.3)
    set(g.wRR.gain, (1 + w) / 2, t, 0.3)
    set(g.wRL.gain, (1 - w) / 2, t, 0.3)
    set(g.wLR.gain, (1 - w) / 2, t, 0.3)
    set(g.choir.gain, curve(K.choir, p), t, 0.5)
    set(g.chordRev.gain, curve(K.chordRev, p), t, 0.5)

    // beds
    set(g.air.gain, 0.16 * curve(K.air, p), t, 0.4)
    set(g.airLP.frequency, curve(K.airCut, p) * Math.pow(2, f.my * 0.3), t, 0.5)
    set(g.sheen.gain, 0.03 * curve(K.sheen, p), t, 0.5)
    set(g.deep.gain, 0.5 * curve(K.deep, p), t, 0.5)
    set(g.glass.gain, 0.05 * curve(K.glass, p), t, 0.5)
    set(g.bedLevel.gain, curve(K.bed, p), t, 0.3)
    set(g.insideLP.frequency, 20000 * Math.pow(0.12, clamp01(f.inside) * smooth(0.93, 0.975, p) * (1 - smooth(DROP, 1, p))), t, 0.2)

    // speed rush (log-scaled camera speed) and scroll whoosh
    const sp = clamp01(Math.log10(1 + Math.max(0, f.speed)) / 5)
    set(g.rush.gain, 0.22 * Math.pow(sp, 1.6), t, 0.25)
    set(g.rushBP.frequency, 90 * Math.pow(2, sp * 3.2), t, 0.25)
    set(g.rushBP2.frequency, 300 * Math.pow(2, sp * 3.6), t, 0.25)
    const a = clamp01((Math.abs(f.v) - 0.003) / 0.06)
    const wl = 0.22 * Math.pow(a, 1.3)
    set(g.whoosh.gain, wl, t, wl > whooshLvl ? 0.08 : 0.4)
    whooshLvl = wl
    set(g.whooshBP.frequency, 220 * Math.pow(2, a * 3.3) * (f.v < 0 ? 0.75 : 1), t, 0.15)
    set(g.whooshPan.pan, f.mx * 0.4, t, 0.2)

    // the Sun
    set(g.rumble.gain, 0.6 * smooth(0.02, 1, s), t, 0.3)
    set(g.rumbleLP.frequency, 45 + 240 * s, t, 0.3)
    set(g.comb.gain, 0.5 * smooth(0.1, 1, s), t, 0.3)
    set(g.combLP.frequency, 500 + 2200 * s, t, 0.3)
    for (const c of g.combs) set(c.dl.delayTime, 1 / (m.root() * c.m), t, 0.35)
    set(g.plasma.gain, 0.35 * smooth(0.4, 1, s), t, 0.3)
    set(g.plasmaBP1.frequency, 350 + 600 * s, t, 0.4)
    set(g.plasmaBP2.frequency, 1100 + 1600 * s, t, 0.4)
    set(g.crackle.gain, 0.12 * smooth(0.5, 1, s), t, 0.3)

    // the probe's emission rises through its chapter (denser plasma beyond the heliopause)
    set(g.hissBP.frequency, 1800 + 1200 * span(CH.voyager, CH.cognia, p), t, 0.5)

    // the Shepard riser and the noise riser, cut at the drop
    const d = span(CH.cognia, DROP, p)
    const live = p < DROP ? 1 : 0
    const shepLvl = curve(K.shep, p) * live
    set(g.shepBus.gain, 0.05 * shepLvl, t, live ? 0.3 : 0.03)
    set(g.shepLP.frequency, 1500 + 6000 * d, t, 0.3)
    if (shepLvl > 0.001 || g.shep.some((x) => x.g.gain.value > 1e-4)) {
      shepPhase += dt * (0.035 + 0.3 * d * d + 2 * Math.max(0, f.v))
      for (let k = 0; k < g.shep.length; k++) {
        const x = g.shep[k]
        const pos = (k + shepPhase) % 7
        const fr = midi(26) * Math.pow(2, pos)
        if (pos < x.pos) {
          x.o.frequency.cancelScheduledValues(t)
          x.o.frequency.setValueAtTime(fr, t)
        } else x.o.frequency.setTargetAtTime(fr, t, 0.03)
        x.pos = pos
        set(x.g.gain, Math.exp(-0.5 * Math.pow((pos - 3.8) / 1.05, 2)), t, 0.03)
      }
    }
    set(g.riser.gain, 0.1 * Math.pow(span(CH.dive, DROP, p), 1.6) * live, t, live ? 0.12 : 0.03)
    set(g.riserBP.frequency, 200 * Math.pow(2, d * 5), t, 0.12)

    // scheduled details while their objects are present
    const o = f.objs
    if (o.earth.on > 0.35 && p < CH.iss && t >= nextChirp) {
      V.chirps(ac, g.E.earth.input, g.revIn, t + 0.05, 2 + Math.floor(R() * 5), 0.05)
      nextChirp = t + 1.2 + R() * 3
    }
    if (o.iss.on > 0.35 && t >= nextTx) {
      const len = 1.4 + R() * 2.6
      V.quindar(ac, g.E.iss.input, g.revIn, t + 0.05, true, 0.05)
      V.squelch(ac, g.B, g.E.iss.input, t + 0.3, 0.2)
      g.chatGate.gain.setTargetAtTime(1, t + 0.32, 0.02)
      g.staticGate.gain.setTargetAtTime(0.7, t + 0.3, 0.02)
      g.chatGate.gain.setTargetAtTime(0, t + 0.32 + len, 0.03)
      g.staticGate.gain.setTargetAtTime(0.15, t + 0.34 + len, 0.03)
      V.squelch(ac, g.B, g.E.iss.input, t + 0.34 + len, 0.16)
      V.quindar(ac, g.E.iss.input, g.revIn, t + 0.4 + len, false, 0.045)
      nextTx = t + len + 1.6 + R() * 2.8
    }
    if (o.voyager.on > 0.3 && t >= nextWhistle) {
      V.whistler(ac, g.E.voyager.input, g.revIn, t + 0.05, 0.05 + R() * 0.04)
      nextWhistle = t + 2.2 + R() * 4
    }
  }

  function boot(ac: BaseAudioContext) {
    ctx = ac
    G = build(ac)
    G.music.onChord(onChord)
    prevP = -1
  }

  return {
    async start() {
      if (disposed) return
      userMuted = false
      if (!ctx) {
        if (opts.context) boot(opts.context)
        else {
          const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          if (!AC) return
          boot(new AC({ latencyHint: 'playback' }))
          document.addEventListener('visibilitychange', onVisibility)
        }
      }
      const ac = ctx
      if (!ac) return
      if (ac instanceof AudioContext && ac.state !== 'running') {
        try {
          await ac.resume()
        } catch {
          /* resumed later by applyAudible */
        }
      }
      if (disposed || !ctx || !G) return
      if (!started) {
        started = true
        G.master.gain.setTargetAtTime(MASTER, ctx.currentTime, offline ? 0.05 : 0.8)
      }
      audibleTarget = -1
      applyAudible()
    },

    update(f) {
      const ac = ctx
      const g = G
      if (!ac || !g || !started || disposed) return
      if (f.visible !== frameVisible) {
        frameVisible = f.visible
        applyAudible()
      }
      const t = ac.currentTime
      if (!offline && lastUpd >= 0 && t - lastUpd < 0.032) return
      const dt = lastUpd < 0 ? 0 : Math.min(0.25, t - lastUpd)
      lastUpd = t
      cur = f

      const p = clamp01(f.p)
      if (prevP < 0) {
        prevP = p
        for (const e of events) e.armed = p < e.at
      }
      const live = offline || (audible() && ac instanceof AudioContext && ac.state === 'running')
      const jump = Math.abs(p - prevP) > 0.08
      for (const e of events) {
        if (p < e.rearm) e.armed = true
        else if (e.armed && prevP < e.at && p >= e.at) {
          e.armed = false
          if (live && !jump) e.fire(ac, g, t, f)
        }
      }
      prevP = p
      if (live) {
        params(ac, g, f, p, t, dt)
        place(g, f, t, dt)
      }
    },

    setMuted(muted) {
      userMuted = muted
      applyAudible()
    },

    isRunning() {
      return !!ctx && started && !disposed && (offline || (ctx instanceof AudioContext && ctx.state !== 'closed'))
    },

    dispose() {
      if (disposed) return
      disposed = true
      clearTimeout(suspendTimer)
      if (!offline) {
        document.removeEventListener('visibilitychange', onVisibility)
        if (ctx instanceof AudioContext) ctx.close().catch(() => {})
      }
      ctx = null
      G = null
      swellGain = null
    },
  }
}

/** Render the whole journey offline: `frameAt(time)` supplies the scene state, sampled at `fps`. Resolves with the
    rendered buffer. */
export async function renderJourney(ctx: OfflineAudioContext, frameAt: (time: number) => JourneyFrame, fps = 30): Promise<AudioBuffer> {
  const s = createJourneySound({ context: ctx })
  await s.start()
  const step = 1 / fps
  const end = ctx.length / ctx.sampleRate
  let n = 0
  const tick = () => {
    s.update(frameAt(ctx.currentTime))
    n++
    const next = n * step
    if (next < end - step) ctx.suspend(next).then(tick).finally(() => ctx.resume())
  }
  // the first frame at t = 0, then one every step
  s.update(frameAt(0))
  n = 1
  ctx.suspend(step).then(tick).finally(() => ctx.resume())
  const buf = await ctx.startRendering()
  s.dispose()
  return buf
}
