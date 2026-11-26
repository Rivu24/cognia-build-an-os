// Dev check for the home journey: node tools/journey-check.mjs <outDir> [width] [height] [p,p,...]
// Scrolls to each progress point, waits for the scene's smoothed progress (data-p, dev only) to arrive, screenshots.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const BASE = process.env.SHOOT_BASE || 'http://127.0.0.1:5173/'
const [out, w = '1280', h = '800', list] = process.argv.slice(2)
const PS = (list || '0,0.02,0.04,0.1,0.2,0.26,0.31,0.4,0.465,0.52,0.6,0.64,0.7,0.76,0.83,0.9,0.95,0.975,0.995').split(',').map(Number)
fs.mkdirSync(out, { recursive: true })
const gpu = process.env.GPU !== '0'
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: gpu ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.type() + ': ' + m.text()))
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('section[aria-label^="The journey"] canvas', { timeout: 30000 })
const dlg = page.getByRole('dialog')
await dlg.waitFor({ timeout: 15000 }).catch(() => {})
await page.screenshot({ path: `${out}/00-prompt.png` })
await page.getByRole('button', { name: 'No sound' }).click().catch(() => {})
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2) }; requestAnimationFrame(f) }))
console.log('fps', fps, 'renderer', await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?' }))
for (const p of PS) {
  await page.evaluate((p) => {
    const s = document.querySelector('section[aria-label^="The journey"]')
    const st = s.firstElementChild
    const top = s.getBoundingClientRect().top + scrollY
    window.scrollTo({ top: top + p * (s.offsetHeight - st.clientHeight), behavior: 'instant' })
  }, p)
  const t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    const cur = await page.evaluate(() => +document.querySelector('section[aria-label^="The journey"]').dataset.p)
    if (Math.abs(cur - p) < 0.0015) break
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/p${String(p).replace('.', '_')}.png` })
  console.log('shot', p)
}
console.log('errors', errors.length ? errors : 'none')
await browser.close()
