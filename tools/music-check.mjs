// Dev check for the music player and its robot: node tools/music-check.mjs <outDir>
// Runs against the dev server (the robot exposes data-gaze / data-beats / data-open in dev builds only).
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const BASE = process.env.SHOOT_BASE || 'http://127.0.0.1:5173/'
const out = process.argv[2]
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const errors = []
const fails = []
const log = (...a) => console.log(...a)
const expect = (tag, ok, what, got) => {
  log(tag, ok ? 'ok  ' : 'FAIL', what, got === undefined ? '' : JSON.stringify(got))
  if (!ok) fails.push(`${tag} ${what} ${JSON.stringify(got)}`)
}
const active = (page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName)
const gaze = async (page) => (await page.locator('[data-robot]').getAttribute('data-gaze'))?.split(',').map(Number) ?? [NaN, NaN]

async function run(w, h, tag) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => errors.push(tag + ' ' + String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(tag + ' ' + m.text()))
  await page.goto(BASE + '#/', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('cognia-osb-music-open'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  expect(tag, (await page.locator('canvas').count()) === 0 || !(await page.locator('[data-robot]').count()), 'no three.js scene while folded')
  await page.screenshot({ path: `${out}/${tag}-1-chip.png` })

  // chip: robot face eyes follow the pointer
  const eye = page.locator('button[aria-label^="Open music player"] svg rect[width="5"]').first()
  await page.mouse.move(5, 5)
  await page.waitForTimeout(500)
  const ex1 = Number(await eye.getAttribute('x'))
  await page.mouse.move(w - 5, h - 5)
  await page.waitForTimeout(500)
  const ex2 = Number(await eye.getAttribute('x'))
  expect(tag, ex2 > ex1, 'chip eyes follow the pointer (x top-left < x bottom-right)', [ex1, ex2])

  await page.getByRole('button', { name: 'Play music' }).click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${out}/${tag}-2-chip-playing.png` })
  const md = await page.evaluate(() => navigator.mediaSession?.metadata?.title ?? null)
  expect(tag, !!md, 'media session title set on first play', md)

  // open with the keyboard: focus moves into the panel
  await page.getByRole('button', { name: /Open music player/ }).focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  expect(tag, (await active(page)) === 'Fold the player away', 'focus lands in the panel on open', await active(page))
  const P = page.getByRole('region', { name: 'Music player' })
  await page.waitForSelector('[data-robot] canvas', { timeout: 8000 })
  const cv = await page.evaluate(() => {
    const c = document.querySelector('[data-robot] canvas')
    return { w: c.width, cw: c.clientWidth, h: c.height, ch: c.clientHeight, dpr: Math.min(2, devicePixelRatio) }
  })
  expect(tag, Math.abs(cv.w - Math.round(cv.cw * cv.dpr)) <= 1 && Math.abs(cv.h - Math.round(cv.ch * cv.dpr)) <= 1, 'robot canvas backing store matches layout size x DPR', cv)
  await page.mouse.move(w * 0.4, h * 0.3)
  await page.waitForTimeout(250)
  await P.screenshot({ path: `${out}/${tag}-3-robot-awake.png` })

  // the four corners: pupils must move each way
  const corners = [['top-left', 2, 2], ['top-right', w - 2, 2], ['bottom-left', 2, h - 2], ['bottom-right', w - 2, h - 2]]
  const seen = {}
  for (const [name, x, y] of corners) {
    await page.mouse.move(x, y, { steps: 6 })
    await page.waitForTimeout(700)
    seen[name] = await gaze(page)
    await P.screenshot({ path: `${out}/${tag}-4-look-${name}.png` })
  }
  const [tl, tr, bl, br] = [seen['top-left'], seen['top-right'], seen['bottom-left'], seen['bottom-right']]
  expect(tag, tl[0] < tr[0] - 0.3 && bl[0] < br[0] - 0.3, 'pupils move left/right with the pointer', seen)
  expect(tag, tl[1] < bl[1] - 0.2 && tr[1] < br[1] - 0.2, 'pupils move up/down with the pointer', seen)

  // mid-song: seek to the middle, let it play
  const seek = P.getByRole('slider', { name: 'Seek' })
  const dur = Number((await seek.getAttribute('aria-valuemax')) ?? (await seek.getAttribute('max')))
  await seek.focus()
  for (let i = 0; i < Math.floor(dur / 30); i++) await page.keyboard.press('PageUp') // 15 s each
  log(tag, 'mid-song at', await seek.getAttribute('aria-valuetext'))
  await page.mouse.move(w * 0.3, h * 0.2, { steps: 4 })
  await page.waitForTimeout(3500)
  await P.screenshot({ path: `${out}/${tag}-5-robot-mid-song.png` })
  const beats = Number(await page.locator('[data-robot]').getAttribute('data-beats'))
  expect(tag, beats > 0, 'beats detected while playing', beats)

  // keyboard: arrows move 5 s, value text is readable
  const before = Number(await seek.getAttribute('aria-valuenow'))
  await seek.focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(250)
  const after = Number(await seek.getAttribute('aria-valuenow'))
  expect(tag, after - before >= 4 && after - before <= 7, 'ArrowRight on seek moves about 5 s', [before, after])
  const vt = await seek.getAttribute('aria-valuetext')
  expect(tag, / of \d+:\d\d$/.test(vt || ''), 'seek has aria-valuetext "m:ss of m:ss"', vt)
  const ring = await page.evaluate(() => {
    const thumb = document.activeElement?.closest('[data-slot=slider-thumb]')
    return thumb ? getComputedStyle(thumb).outlineStyle : 'no thumb'
  })
  expect(tag, ring === 'solid', 'focused slider thumb shows an outline', ring)
  const vol = P.getByRole('slider', { name: 'Volume' })
  const v0 = Number(await vol.getAttribute('aria-valuenow'))
  await vol.focus()
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(150)
  const v1 = Number(await vol.getAttribute('aria-valuenow'))
  expect(tag, v0 - v1 === 5, 'ArrowLeft on volume lowers it 5 points', [v0, v1, await vol.getAttribute('aria-valuetext')])
  await page.keyboard.press('ArrowRight')

  // controls
  const sh = P.getByRole('button', { name: /Shuffle is/ })
  await sh.click()
  expect(tag, (await sh.getAttribute('aria-pressed')) === 'true', 'shuffle toggles on')
  const lp = () => P.getByRole('button', { name: /Loop/ })
  const l0 = await lp().getAttribute('aria-label')
  await lp().click(); await lp().click(); await lp().click()
  expect(tag, (await lp().getAttribute('aria-label')) === l0, 'loop cycles through three modes', l0)
  await P.getByRole('button', { name: /Shuffle is/ }).click()
  await P.getByRole('button', { name: 'Next track' }).click()
  await page.waitForTimeout(1500)
  expect(tag, (await P.getByRole('button', { name: 'Pause', exact: true }).count()) === 1, 'next keeps playing')

  // the robot is a play/pause button: pause → it falls asleep
  await P.getByRole('button', { name: 'Robot: pause the music' }).click()
  await page.waitForTimeout(2600)
  expect(tag, (await P.getByRole('button', { name: 'Play', exact: true }).count()) === 1, 'clicking the robot pauses')
  const open = Number(await page.locator('[data-robot]').getAttribute('data-open'))
  expect(tag, open < 0.2, 'asleep when paused (eyes shut)', open)
  await P.screenshot({ path: `${out}/${tag}-6-robot-asleep.png` })
  // asleep, the head no longer turns to the pointer (the eyes are shut anyway)
  await page.mouse.move(2, 2, { steps: 4 })
  await page.waitForTimeout(1200)
  const look = Number(await page.locator('[data-robot]').getAttribute('data-look'))
  expect(tag, Math.abs(look) < 0.2, 'asleep head stays still when the pointer moves', look)
  // the title block keeps its height for a track with no artist, so the controls do not jump
  const titleH = await P.locator('div.truncate[title]').first().evaluate((n) => n.parentElement.getBoundingClientRect().height)
  expect(tag, titleH > 40, 'title block keeps two lines of height', titleH)
  await P.getByRole('button', { name: 'Robot: play the music' }).click()
  await page.waitForTimeout(400)
  await P.screenshot({ path: `${out}/${tag}-7-robot-waking.png` })
  expect(tag, (await P.getByText('z', { exact: true }).count()) === 0, 'the sleeping z is gone soon after waking')

  // fold with Escape from inside: focus returns to the bar, the scene is freed
  await P.getByRole('button', { name: 'Next track' }).focus()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1200)
  expect(tag, /^Open music player/.test((await active(page)) || ''), 'Escape folds and focus returns to the bar', await active(page))
  expect(tag, (await page.locator('[data-robot]').count()) === 0, 'three.js scene removed when folded')

  // navigate: music keeps playing
  await page.goto(BASE + '#/path', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  expect(tag, (await page.getByRole('button', { name: 'Pause music' }).count()) === 1, 'music keeps playing across pages')
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(tag, sw <= w + 1, 'no horizontal overflow', sw)
  await page.screenshot({ path: `${out}/${tag}-8-path-chip.png` })

  // light theme
  await page.getByRole('button', { name: /Open music player/ }).click()
  await page.evaluate(() => { document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light') })
  await page.mouse.move(w * 0.2, h * 0.25, { steps: 4 })
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${out}/${tag}-9-panel-light.png` })
  await page.getByRole('region', { name: 'Music player' }).getByRole('button', { name: 'Pause', exact: true }).click()
  await page.waitForTimeout(2500)
  await page.getByRole('region', { name: 'Music player' }).screenshot({ path: `${out}/${tag}-10-asleep-light.png` })
  // fold button returns focus too
  await page.getByRole('button', { name: 'Fold the player away' }).click()
  await page.waitForTimeout(1200)
  expect(tag, /^Open music player/.test((await active(page)) || ''), 'fold button returns focus to the bar', await active(page))
  await page.screenshot({ path: `${out}/${tag}-11-chip-light.png` })
  await page.close()
}

async function reduced() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  page.on('pageerror', (e) => errors.push('reduced ' + String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push('reduced ' + m.text()))
  await page.goto(BASE + '#/', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.setItem('cognia-osb-music-open', '1'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('[data-robot] canvas', { timeout: 8000 })
  expect('reduced', (await active(page)) !== 'Fold the player away', 'restored-open panel does not steal focus', await active(page))
  await page.waitForTimeout(1000)
  const P = page.getByRole('region', { name: 'Music player' })
  expect('reduced', (await P.getByText('z', { exact: true }).count()) === 0, 'no drifting z with reduced motion')
  await P.getByRole('button', { name: 'Play', exact: true }).click()
  await page.mouse.move(2, 2, { steps: 4 })
  await page.waitForTimeout(800)
  const g1 = await gaze(page)
  await page.mouse.move(1438, 898, { steps: 4 })
  await page.waitForTimeout(800)
  const g2 = await gaze(page)
  expect('reduced', g1[0] < g2[0] - 0.3, 'eyes still follow with reduced motion', [g1, g2])
  await P.screenshot({ path: `${out}/reduced-robot.png` })
  await page.close()
}

await run(1440, 900, 'desk')
await run(390, 844, 'phone')
await reduced()
log('FAILS', fails.length, fails.join('\n'))
log('ERRORS', errors.length, errors.join('\n'))
await browser.close()
process.exit(fails.length || errors.length ? 1 : 0)
