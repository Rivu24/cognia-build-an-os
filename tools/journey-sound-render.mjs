// Offline render of the journey sound: node tools/journey-sound-render.mjs [out.wav]
// Loads src/components/journey/sound.ts from the Vite dev server in headless Chrome, plays a scripted ~110 s scroll
// through the story into an OfflineAudioContext, writes a 48 kHz 16-bit stereo WAV and prints per-chapter stats
// (peak, RMS, band energies) and the cost (build ms on the main thread, render ms per second of audio).
// SR=24000 renders at another sample rate.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const BASE = process.env.SHOOT_BASE || 'http://127.0.0.1:5173/'
const out = process.argv[2] || 'journey.wav'
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.type() + ': ' + m.text()))
await page.goto(BASE + 'src/components/journey/story.ts', { waitUntil: 'load' })

const t0 = Date.now()
const res = await page.evaluate(async (SR) => {
  const { renderJourney, createJourneySound } = await import('/src/components/journey/sound.ts')
  const { CH, CORONA, chapterAt } = await import('/src/components/journey/story.ts')
  const DUR = 110
  // the scripted scroll: [time, p] with holds; eased between keys
  const KEYS = [
    [0, 0], [5, 0], [8, 0.026], [9.2, 0.05], [13, 0.055], [19, 0.16], [27, 0.27], [30, 0.275], [36, 0.36], [46, CORONA], [50, CORONA + 0.003],
    [56, 0.57], [62, 0.64], [66, 0.645], [71, 0.7], [75, 0.705], [80, 0.76], [84, 0.765], [92, 0.87], [95, 0.875], [101, 0.95], [104, 0.99], [107, 1], [DUR, 1],
  ]
  const pAt = (t) => {
    if (t <= 0) return 0
    for (let i = 1; i < KEYS.length; i++) {
      const [t1, p1] = KEYS[i]
      if (t <= t1) {
        const [ta, pa] = KEYS[i - 1]
        const u = (t - ta) / (t1 - ta)
        return pa + (p1 - pa) * u * u * (3 - 2 * u)
      }
    }
    return 1
  }
  const sm = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u) }
  const span = (a, b, p) => Math.min(1, Math.max(0, (p - a) / (b - a)))
  const em = (x, y, z, on) => ({ x, y, z, d: Math.hypot(x, y, z), on })
  const frameAt = (t) => {
    const p = pAt(t)
    const v = (pAt(t + 0.05) - pAt(t - 0.05)) / 0.1
    const near = p > CH.sun ? Math.exp(-Math.pow((p - CORONA) / 0.055, 2)) : 0
    const sunOn = sm(CH.galaxy + 0.08, CH.sun, p) * (1 - sm(CH.earth, CH.iss, p))
    const th = 2 * Math.PI * span(CH.orbit, CH.earth, p)
    const sd = 12 + 70 * (1 - near) + (p < CH.orbit ? 200 * (1 - span(CH.sun, CH.orbit, p)) : 0)
    const scale = p < CH.sun ? 4e5 : 600
    const ie = span(CH.iss, CH.voyager, p)
    return {
      p, v, t, dt: 1 / 30, chapter: chapterAt(p), sun: near, flash: Math.max(0, 1 - Math.abs(p - CH.bang) / 0.01),
      mx: 0.3 * Math.sin(t * 0.21), my: 0.2 * Math.sin(t * 0.13), visible: true, speed: Math.abs(v) * scale,
      inside: p > 0.95 ? 1 : 0,
      objs: {
        singularity: em(0, 0, -60, 1 - sm(CH.expansion, CH.galaxy, p)),
        sun: em(Math.sin(th) * sd, 2, -Math.cos(th) * sd, sunOn),
        earth: em(-6, -3, -25 + 10 * span(CH.earth, CH.iss, p), sm(CH.orbit + 0.12, CH.earth, p) * (1 - sm(CH.voyager, CH.cognia, p))),
        iss: em(8 - 16 * ie, 1, -10 + 14 * ie, sm(CH.earth + 0.04, CH.iss, p) * (1 - sm(CH.voyager, CH.voyager + 0.03, p))),
        voyager: em(-3, 1, -8 + 6 * span(CH.voyager, CH.cognia, p), sm(CH.iss + 0.03, CH.voyager, p) * (1 - sm(CH.cognia, CH.cognia + 0.04, p))),
        wormhole: em(0.5, 0.3, -40 * (1 - span(CH.cognia, 1, p)) - 0.5, sm(CH.voyager + 0.02, CH.cognia, p)),
      },
    }
  }
  // cost: the graph alone (what the "Sound on" click pays), then the whole render
  const probe = createJourneySound({ context: new OfflineAudioContext(2, SR, SR) })
  const tb = performance.now()
  await probe.start()
  const buildMs = Math.round(performance.now() - tb)
  probe.dispose()
  const ctx = new OfflineAudioContext(2, SR * DUR, SR)
  const tr = performance.now()
  const buf = await renderJourney(ctx, frameAt, 30)
  const msPerSec = Math.round((performance.now() - tr - buildMs) / DUR)
  const L = buf.getChannelData(0)
  const R = buf.getChannelData(1)

  // band-split by rendering the result through filter cascades
  const bands = [['20-60', 20, 60], ['60-250', 60, 250], ['250-2k', 250, 2000], ['2k-8k', 2000, 8000], ['8k+', 8000, 0]]
  const bandData = []
  for (const [, lo, hi] of bands) {
    const oc = new OfflineAudioContext(2, buf.length, SR)
    const src = oc.createBufferSource()
    src.buffer = buf
    let node = src
    for (let i = 0; i < 2; i++) {
      const h = oc.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = lo; h.Q.value = i ? 1.307 : 0.541; node.connect(h); node = h
      if (hi) { const l = oc.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = hi; l.Q.value = i ? 1.307 : 0.541; node.connect(l); node = l }
    }
    node.connect(oc.destination)
    src.start()
    const b = await oc.startRendering()
    bandData.push([b.getChannelData(0), b.getChannelData(1)])
  }
  // chapter windows from the script
  const win = []
  let curC = null
  for (let t = 0; t < DUR; t += 0.1) {
    const c = chapterAt(pAt(t))
    if (c !== curC) { win.push({ c, a: t, b: DUR }); if (win.length > 1) win[win.length - 2].b = t; curC = c }
  }
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -200)
  const stats = win.map(({ c, a, b }) => {
    const i0 = Math.floor(a * SR), i1 = Math.floor(b * SR)
    let pk = 0, ss = 0, minWin = Infinity
    const W = SR / 2
    for (let i = i0; i < i1; i++) { const x = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (x > pk) pk = x; ss += L[i] * L[i] + R[i] * R[i] }
    for (let j = i0; j + W <= i1; j += W) { let s = 0; for (let i = j; i < j + W; i++) s += L[i] * L[i] + R[i] * R[i]; minWin = Math.min(minWin, Math.sqrt(s / (2 * W))) }
    const n = 2 * (i1 - i0)
    const bandsDb = bandData.map(([bl, br]) => { let s = 0; for (let i = i0; i < i1; i++) s += bl[i] * bl[i] + br[i] * br[i]; return +db(Math.sqrt(s / n)).toFixed(1) })
    return { chapter: c, from: +a.toFixed(1), to: +b.toFixed(1), peak: +db(pk).toFixed(1), rms: +db(Math.sqrt(ss / n)).toFixed(1), minRms05s: +db(minWin).toFixed(1), bands: bandsDb }
  })
  // transient check: biggest 10 ms RMS jump at the bang and the drop
  const jump = (at) => {
    const i = Math.floor(at * SR), w = 480
    let best = 0, before = 0
    for (let j = i - SR; j < i - w; j += w) { let s = 0; for (let k = j; k < j + w; k++) s += L[k] * L[k]; before = Math.max(before, Math.sqrt(s / w)) }
    for (let j = i - SR; j < i + SR; j += w) { let s = 0; for (let k = j; k < j + w; k++) s += L[k] * L[k]; best = Math.max(best, Math.sqrt(s / w)) }
    return { maxRms10ms: +db(best).toFixed(1), quietestBefore: +db(before).toFixed(1) }
  }
  const tAt = (pp) => { for (let t = 0; t < DUR; t += 0.01) if (pAt(t) >= pp) return t; return DUR }
  let clips = 0
  for (let i = 0; i < L.length; i++) if (Math.abs(L[i]) >= 0.999 || Math.abs(R[i]) >= 0.999) clips++
  // 16-bit WAV
  const nS = buf.length
  const wav = new DataView(new ArrayBuffer(44 + nS * 4))
  const w4 = (o, s) => { for (let i = 0; i < 4; i++) wav.setUint8(o + i, s.charCodeAt(i)) }
  w4(0, 'RIFF'); wav.setUint32(4, 36 + nS * 4, true); w4(8, 'WAVE'); w4(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true)
  wav.setUint32(24, SR, true); wav.setUint32(28, SR * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); w4(36, 'data'); wav.setUint32(40, nS * 4, true)
  for (let i = 0; i < nS; i++) {
    wav.setInt16(44 + i * 4, Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), true)
    wav.setInt16(46 + i * 4, Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), true)
  }
  const bytes = new Uint8Array(wav.buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return { buildMs, msPerSec, stats, clips, bang: jump(tAt(CH.bang)), drop: jump(tAt(0.985)), wav: btoa(bin), bands: bands.map((b) => b[0]) }
}, +(process.env.SR || 48000))
fs.writeFileSync(out, Buffer.from(res.wav, 'base64'))
console.log(`rendered in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${out} | build ${res.buildMs} ms | ${res.msPerSec} ms per audio second`)
console.log(['chapter'.padEnd(10), 'from', '  to', ' peak', '  rms', ' minRms', ...res.bands.map((b) => b.padStart(7))].join(' '))
for (const s of res.stats) console.log([s.chapter.padEnd(10), String(s.from).padStart(4), String(s.to).padStart(4), String(s.peak).padStart(5), String(s.rms).padStart(5), String(s.minRms05s).padStart(7), ...s.bands.map((b) => String(b).padStart(7))].join(' '))
console.log('samples at full scale:', res.clips, '| bang transient', JSON.stringify(res.bang), '| drop transient', JSON.stringify(res.drop))
console.log('errors', errors.length ? errors : 'none')
await browser.close()
