// Visual check helper (dev only). Uses the locally installed Chrome through playwright-core.
//   node tools/shoot.mjs page  <route> <out.png> [width] [height]   e.g. node tools/shoot.mjs page path out.png  (route without #/)
//   node tools/shoot.mjs viz   <concept-id> <outDir>  [width]              one PNG per animation step (+ light theme step 0)
// Base URL: env SHOOT_BASE (default http://127.0.0.1:5173/). Animations are allowed to settle before each capture.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const BASE = process.env.SHOOT_BASE || 'http://127.0.0.1:5173/'
const [mode, rawTarget, out, w = '1440', h = '1000'] = process.argv.slice(2)
// Git Bash rewrites "#/x" into "#C:/Program Files/Git/x"; accept bare routes ("path", "learn/t6m2l1") too.
const target = mode === 'page' ? '#/' + rawTarget.replace(/^#?([A-Za-z]:\/Program Files\/Git)?\/?/, '') : rawTarget
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

if (mode === 'page') {
  await page.goto(BASE + target, { waitUntil: 'networkidle' })
  if (process.env.THEME === 'light') await page.evaluate(() => { document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light') })
  await page.waitForTimeout(1800)
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  if (sw > +w + 1) console.log('HORIZONTAL OVERFLOW: scrollWidth ' + sw + ' > ' + w)
  await page.screenshot({ path: out, fullPage: process.env.FULL === '1' })
  console.log('saved', out)
} else if (mode === 'viz') {
  fs.mkdirSync(out, { recursive: true })
  await page.goto(BASE + '#/lab/' + target, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const fig = page.locator(`#viz-${target} figure`).first()
  if (!(await fig.count())) { console.error('concept not found in Concept Lab: ' + target); process.exit(2) }
  await fig.scrollIntoViewIfNeeded()
  await fig.locator('button[aria-label="Pause"]').click().catch(() => {})
  const tabs = fig.locator('[role=tab]')
  const n = await tabs.count()
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click()
    await page.waitForTimeout(1400)
    const file = path.join(out, `${target}-step${String(i + 1).padStart(2, '0')}.png`)
    await fig.screenshot({ path: file })
    console.log('saved', file)
  }
  await page.evaluate(() => { document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light') })
  await tabs.nth(n - 1).click(); await page.waitForTimeout(1200)
  await fig.screenshot({ path: path.join(out, `${target}-light-last.png`) })
  console.log('steps', n)
}
if (errors.length) { console.log('BROWSER ERRORS:\n' + errors.join('\n')) }
await browser.close()
