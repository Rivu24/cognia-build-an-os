/* Turns the analyser into a few numbers the robots can use: log-spaced band levels, a bass level and a beat flag.
   Beat detection is plain energy tracking on the low bins: a beat is low-band energy well above its recent average. */
import { getAnalyser } from '@/lib/music'

export type Levels = {
  /** 0..1 per band, low to high, eased (fast attack, slow release) */
  bands: Float32Array
  /** 0..1 low-frequency level, eased */
  bass: number
  /** 0..1 overall level */
  energy: number
  /** true on the frame a beat lands */
  beat: boolean
  /** seconds since the last beat */
  sinceBeat: number
}

export function createLevels(count: number) {
  const L: Levels = { bands: new Float32Array(count), bass: 0, energy: 0, beat: false, sinceBeat: 99 }
  let data: Uint8Array<ArrayBuffer> | null = null
  let avg = 0
  let ranges: [number, number][] = []
  let bins = 0

  const layout = (n: number) => {
    bins = n
    // from ~60 Hz to ~11 kHz on a log scale, at whatever resolution the analyser has
    const lo = Math.max(1, Math.round(n / 256))
    const hi = Math.round(n * 0.5)
    ranges = Array.from({ length: count }, (_, i) => {
      const a = Math.floor(lo * Math.pow(hi / lo, i / count))
      const b = Math.max(a + 1, Math.floor(lo * Math.pow(hi / lo, (i + 1) / count)))
      return [a, b]
    })
  }

  /** Read one frame. `live` false lets everything fall back to silence. `dt` in seconds. */
  function sample(live: boolean, dt: number): Levels {
    const an = live ? getAnalyser() : null
    L.beat = false
    L.sinceBeat += dt
    const k = Math.min(1, dt * 60)
    if (!an) {
      for (let i = 0; i < count; i++) L.bands[i] += (0 - L.bands[i]) * 0.1 * k
      L.bass += (0 - L.bass) * 0.1 * k
      L.energy += (0 - L.energy) * 0.1 * k
      return L
    }
    if (!data || data.length !== an.frequencyBinCount) data = new Uint8Array(an.frequencyBinCount)
    if (bins !== data.length) layout(data.length)
    an.getByteFrequencyData(data)
    let total = 0
    for (let i = 0; i < count; i++) {
      const [a, b] = ranges[i]
      let s = 0
      for (let j = a; j < b && j < data.length; j++) s += data[j]
      const v = Math.min(1, Math.pow(s / Math.max(1, b - a) / 255, 1.4) * (0.85 + (i / count) * 0.6))
      L.bands[i] += (v - L.bands[i]) * (v > L.bands[i] ? 0.6 : 0.16) * k
      total += v
    }
    // low band: roughly 40 to 260 Hz
    const per = an.context.sampleRate / 2 / data.length // Hz per bin (44.1 or 48 kHz devices)
    const b0 = Math.max(1, Math.floor(40 / per))
    const b1 = Math.max(b0 + 1, Math.ceil(260 / per))
    let low = 0
    for (let j = b0; j < b1; j++) low += data[j]
    low = low / (b1 - b0) / 255
    L.bass += (low - L.bass) * (low > L.bass ? 0.7 : 0.14) * k
    L.energy += (total / count - L.energy) * 0.2 * k
    avg += (low - avg) * Math.min(1, dt * 2.2)
    if (low > 0.28 && low > avg * 1.08 + 0.025 && L.sinceBeat > 0.26) {
      L.beat = true
      L.sinceBeat = 0
    }
    return L
  }

  return { L, sample }
}
