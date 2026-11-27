// Dropouts of the journey sound in a real browser: node tools/journey-sound-live.mjs
// Opens the dev server's home page in a visible Chrome (real GPU, real audio output), turns the sound on, scrolls the
// journey from P0 to P1 in SECS seconds and prints, every 5 s: scroll progress, frame rate, the context's sample rate
// and buffer, and the output underruns so far (AudioContext.playbackStats). An offline render cannot show these: they
// come from the audio thread being held up, not from the graph's average cost. Run it a few times; a busy machine
// gives very different numbers from run to run.
import { chromium } from 'playwright-core'
const URL_ = process.env.URL || 'http://127.0.0.1:5173/'
const P0 = +(process.env.P0 || 0), P1 = +(process.env.P1 || 1), SECS = +(process.env.SECS || 60)
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1400,900'] })
const page = await browser.newPage({ viewport: null })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.addInitScript(() => {
  const AC = window.AudioContext
  window.__acs = []
  window.AudioContext = class extends AC { constructor(o) { super(o); window.__acs.push(this) } }
  window.__frames = []
  let last = performance.now()
  const tick = () => { const n = performance.now(); window.__frames.push(n - last); last = n; requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
})
await page.goto(URL_, { waitUntil: 'load' })
const btn = page.getByRole('button', { name: 'Sound on', exact: true })
await btn.waitFor({ timeout: 180000 })
await page.waitForTimeout(2000)
await btn.click()
await page.waitForTimeout(1500)
const H = await page.evaluate(() => document.querySelector('section[aria-label^="The journey"]').offsetHeight - innerHeight)
const snap = () => page.evaluate(() => {
  const f = window.__frames.splice(0).sort((a, b) => a - b)
  const a = window.__acs[window.__acs.length - 1] // the journey's context is the last one made
  const s = a.playbackStats
  return { p: document.querySelector('section[aria-label^="The journey"]').dataset.p, fps: Math.round(1000 / (f[f.length >> 1] || 1)), sr: a.sampleRate, st: a.state, baseMs: Math.round(a.baseLatency * 1000), under: s.underrunEvents, underMs: Math.round(s.underrunDuration * 1000) }
})
const t0 = Date.now()
let next = 5000
while (Date.now() - t0 < SECS * 1000) {
  const k = (Date.now() - t0) / (SECS * 1000)
  await page.evaluate((y) => window.scrollTo(0, y), H * (P0 + (P1 - P0) * k))
  await page.waitForTimeout(150)
  if (Date.now() - t0 > next) { next += 5000; console.log(JSON.stringify(await snap())) }
}
console.log('errors', JSON.stringify(errors.slice(0, 5)))
await browser.close()
