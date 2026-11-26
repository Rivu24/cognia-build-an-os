/* Initial loader: the site boots like an operating system, on every full page load.
   0. index.html paints a static boot screen at once (no blank flash while the JS loads); it is removed here.
   1. plain DOM boot log, percentage tied to real readiness (fonts, curriculum data, renderer, minimum time)
   2. Three.js (loaded on demand): bits from deep space condense into the solid 3D COGNIA mark; its circle becomes a
      wormhole (accretion disc, event horizon, lensing, a tunnel behind it); the wordmark fades in
   3. the camera dives into the wormhole and rides the tunnel; the site opens as an iris through the tunnel's exit
   Forced by "intro" in the query (?intro, ?intro=svg for the SVG fallback), skipped under automation unless forced.
   Reduced motion: the lockup fades in and out (~700 ms), no 3D.
   intro.finish() is called midway through the plunge (or on skip), so the page's own entrance plays inside the opening;
   the page stays inert and unscrollable until the overlay has unmounted. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { bootScreen, intro } from '@/lib/intro'
import { canJourney, onHome } from '@/components/journey/capable'
import { getPath } from '@/lib/data'
import { Lockup, PRODUCT } from '@/components/brand'
import { BOOT, SLOW, T, easeInOut, layout, smooth, type Engine, type Iris } from './timeline'
import { createFallback } from './fallback'
import './intro.css'

type Mode = 'off' | 'full' | 'reduced'

function query() {
  try {
    return location.search + location.hash
  } catch {
    return ''
  }
}
const forced = () => /[?&]intro\b/.test(query())

function decide(): Mode {
  if (typeof window === 'undefined') return 'off'
  const force = forced()
  if (!force && (navigator.webdriver || !intro.shouldPlay())) return 'off'
  // the COGNIA loader covers the load on every route; the home journey (or readiness below) finishes it
  if (!force) {
    bootScreen.hold()
    return 'off'
  }
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full'
}

/** the scene needs WebGL 2 (three r181); without it the SVG fallback plays */
function hasWebGL() {
  if (/[?&]intro=svg\b/.test(query())) return false
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

const cornerDist = (i: Iris, w: number, h: number) => Math.max(Math.hypot(i.x, i.y), Math.hypot(w - i.x, i.y), Math.hypot(i.x, h - i.y), Math.hypot(w - i.x, h - i.y))

/** While the intro covers the page: no scrolling, the page is inert; afterwards focus goes back to the page. */
function useCover() {
  useLayoutEffect(() => {
    const html = document.documentElement
    const root = document.getElementById('root')
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    if (root) root.inert = true
    return () => {
      html.style.overflow = prev
      if (root) root.inert = false
      const target = document.getElementById('main') ?? root
      if (!target) return
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1')
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
      }
      target.focus({ preventScroll: true })
    }
  }, [])
}

/** the static boot screen from index.html: it only covers the moment before this script runs */
function removeBootScreen() {
  document.getElementById('intro-boot')?.remove()
}

export default function IntroLoader() {
  const [mode, setMode] = useState<Mode>(decide)
  // before the first paint of the intro (or of the page, when the intro is off), so nothing flashes in between
  useLayoutEffect(() => {
    if (!bootScreen.isHeld()) return removeBootScreen()
    const release = () => bootScreen.release()
    // the home journey releases it when its scene is ready; elsewhere: when fonts and the curriculum are in
    if (!(onHome() && canJourney())) Promise.all([document.fonts?.ready, getPath()]).then(release, release)
    const t = window.setTimeout(release, 12000) // never outlive a failure
    return () => window.clearTimeout(t)
  }, [])
  useEffect(() => {
    if (mode === 'off') intro.finish() // the overlay is gone (or never showed): route transitions may run
  }, [mode])
  if (mode === 'off') return null
  const done = () => setMode('off')
  return createPortal(mode === 'full' ? <Cinematic onDone={done} /> : <Calm onDone={done} />, document.body)
}

/** prefers-reduced-motion: the lockup fades in and out, about 700 ms. */
function Calm({ onDone }: { onDone: () => void }) {
  useCover()
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => {
    const id = window.setTimeout(() => doneRef.current(), 760)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') doneRef.current()
    }
    window.addEventListener('keydown', key)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', key)
    }
  }, [])
  return (
    <div className="intro-calm" role="status" aria-label="Build an OS is starting">
      <Lockup size="lg" className="intro-calm-lockup" />
    </div>
  )
}

function Cinematic({ onDone }: { onDone: () => void }) {
  useCover()
  const stage = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const pct = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const lines = useRef<(HTMLDivElement | null)[]>([])
  const skipBtn = useRef<HTMLButtonElement>(null)
  const skip = useRef<() => void>(() => {})
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const [live, setLive] = useState('')
  const L = layout(size.w, size.h)

  useEffect(() => {
    const st = stage.current!
    const hostEl = host.current!
    const ringEl = ring.current!
    // focused so Enter/Space and screen readers land on it; the ring appears only once the keyboard is used (Tab)
    skipBtn.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions)
    setLive('Starting Build an OS.')

    let cancelled = false
    let finished = false
    let raf = 0
    let clock = 0
    let last = performance.now()
    let w = window.innerWidth
    let h = window.innerHeight
    let engine: Engine | null = null
    const ready = { fonts: -1, path: -1, engine: -1 }
    let S = -1 // scene start
    let P = -1 // plunge start
    let kernelAt = -1
    let exitAt = -1
    let exitFrom: Iris = { x: w / 2, y: h / 2, r: 0 }
    let lastIris: Iris | null = null
    let irisAt = -1
    let disp = 0
    // pointer (−1..1, y up): the mark and the camera lean towards it
    let pxT = 0
    let pyT = 0
    let pxS = 0
    let pyS = 0
    const onPointer = (e: PointerEvent) => {
      pxT = (e.clientX / w) * 2 - 1
      pyT = 1 - (e.clientY / h) * 2
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    let shownPct = ''

    const at = (k: keyof typeof ready) => () => {
      if (ready[k] < 0) ready[k] = clock
    }
    ;(document.fonts?.ready ?? Promise.resolve()).then(at('fonts'), at('fonts'))
    getPath().then(at('path'), at('path')) // a failed load is handled by the page itself; do not hold the intro

    const fallback = () => {
      if (cancelled || engine || exitAt >= 0) return
      engine = createFallback(hostEl, w, h)
      ready.engine = clock
    }
    if (hasWebGL()) {
      let cw = 0
      let ch = 0
      import('./scene')
        .then((m) => (cancelled || engine ? null : m.createScene(hostEl, (cw = w), (ch = h))))
        .then((e) => {
          if (!e) return
          // too late (skipped, unmounted or the fallback took over): drop it
          if (cancelled || engine || exitAt >= 0) return e.dispose()
          if (w !== cw || h !== ch) e.resize(w, h) // resized while it compiled
          engine = e
          ready.engine = clock
        })
        .catch(fallback)
    } else fallback()

    // ── boot log, typed imperatively (no React renders per frame) ──
    const typed = BOOT.map(() => -1)
    let active = -1
    const CPS = 120
    function typeLog() {
      BOOT.forEach((b, i) => {
        const el = lines.current[i]
        const t0 = b.at >= 0 ? b.at : kernelAt
        if (!el || t0 < 0 || clock < t0) return
        if (typed[i] < 0) {
          el.dataset.on = ''
          el.querySelector('.ts')!.textContent = `[${clock.toFixed(3).padStart(7)}]`
          if (active >= 0) delete lines.current[active]?.dataset.active
          active = i
          el.dataset.active = ''
          if (b.at < 0) setLive('Ready. Opening Build an OS.')
        }
        const n = Math.min(b.text.length, Math.floor((clock - t0) * CPS))
        if (n !== typed[i]) {
          typed[i] = n
          el.querySelector('.tx')!.textContent = b.text.slice(0, n)
        }
        if (b.at >= 0 && n === b.text.length && clock > t0 + b.text.length / CPS + 0.09) el.dataset.ok = ''
      })
    }

    function applyIris(i: Iris | null) {
      if (!i) {
        st.style.removeProperty('mask-image')
        st.style.removeProperty('-webkit-mask-image')
        ringEl.style.opacity = '0'
        return
      }
      const r = Math.max(0, i.r)
      const m = `radial-gradient(circle at ${i.x.toFixed(1)}px ${i.y.toFixed(1)}px, transparent ${r.toFixed(1)}px, #000 ${(r + 1.2).toFixed(1)}px)`
      st.style.setProperty('mask-image', m)
      st.style.setProperty('-webkit-mask-image', m)
      const reach = cornerDist(i, w, h)
      ringEl.style.width = ringEl.style.height = `${(2 * r).toFixed(1)}px`
      ringEl.style.transform = `translate(${(i.x - r).toFixed(1)}px, ${(i.y - r).toFixed(1)}px)`
      ringEl.style.opacity = r > 1 ? String(1 - smooth(0.45, 0.95, r / reach)) : '0'
    }

    function finish() {
      if (finished) return
      finished = true
      cancelAnimationFrame(raf)
      engine?.dispose()
      engine = null
      doneRef.current()
    }

    skip.current = () => {
      if (exitAt >= 0 || finished) return
      exitAt = clock
      exitFrom = lastIris ?? { x: w / 2, y: h / 2, r: 0 }
      st.dataset.exit = ''
      setLive('Intro skipped.')
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      // a stalled frame pauses the sequence instead of jumping it forward
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (document.hidden || finished) return
      clock += dt

      if (!engine && clock > T.rendererTimeout) fallback()
      // on a reload Chrome can leave the captured fonts.ready promise pending although every face has loaded:
      // trust the live status too (fonts only affect the wordmark, so never hold the sequence for long)
      if (ready.fonts < 0 && clock > 0.15 && (document.fonts?.status !== 'loading' || clock > 2.5)) ready.fonts = clock
      if (S < 0 && engine && clock >= T.sceneMin) {
        S = clock
        st.dataset.scene = ''
      }
      const allReady = ready.fonts >= 0 && ready.path >= 0 && S >= 0
      if (P < 0 && S >= 0 && (allReady || clock > T.maxWait)) {
        P = Math.max(S + T.hold * SLOW, clock + T.kernelLead)
        kernelAt = P - T.kernelLead
      }

      typeLog()

      // percentage: real readiness plus a minimum time
      const estKernel = kernelAt > 0 ? kernelAt : Math.max(S >= 0 ? S + T.hold * SLOW - T.kernelLead : 0, 2.9)
      let target = (ready.fonts >= 0 ? 15 : 0) + (ready.path >= 0 ? 25 : 0) + (ready.engine >= 0 ? 30 : 0) + 30 * Math.min(1, clock / estKernel)
      target = kernelAt >= 0 && clock >= kernelAt ? 100 : Math.min(target, 99)
      disp += (target - disp) * (1 - Math.exp(-dt * 7))
      if (target === 100 && disp > 99.4) disp = 100
      const p = String(Math.floor(disp)).padStart(3, '0')
      if (p !== shownPct) {
        shownPct = p
        pct.current!.textContent = p
        bar.current!.style.transform = `scaleX(${(disp / 100).toFixed(3)})`
      }

      if (S >= 0 && clock >= S + T.wordIn * SLOW) st.dataset.word = ''
      const plunge = P >= 0 && clock >= P ? clock - P : -1
      if (plunge >= 0) st.dataset.plunge = ''

      let iris: Iris | null = null
      if (engine && S >= 0) {
        try {
          pxS += (pxT - pxS) * (1 - Math.exp(-dt * 2.5))
          pyS += (pyT - pyS) * (1 - Math.exp(-dt * 2.5))
          iris = engine.frame({ t: (clock - S) / SLOW, plunge: plunge >= 0 ? plunge / SLOW : -1, dt: dt / SLOW, px: pxS, py: pyS })
        } catch {
          // a renderer failure mid-sequence must never trap the visitor: drop the scene and open at once
          const dead = engine
          engine = null
          ready.engine = clock
          try {
            dead.dispose()
          } catch {
            /* already broken */
          }
          skip.current()
        }
      }
      // the page's own entrance (home hero) starts during the tunnel ride, so the exit opens on a page that is
      // assembling rather than an empty one; the covered page stays inert until the overlay is gone
      if (exitAt >= 0 || (iris && iris.r > 0) || plunge >= T.plunge * SLOW * 0.5) intro.finish()
      if (exitAt >= 0) {
        const u = (clock - exitAt) / T.exit
        const reach = cornerDist(exitFrom, w, h)
        iris = { x: exitFrom.x, y: exitFrom.y, r: exitFrom.r + (reach - exitFrom.r) * smooth(0, 1, u) }
        if (u >= 1) return finish()
      } else if (iris) {
        // the site opens at an even pace inside the light (the scene's exit grows faster than that at the end of
        // the ride, which would make the opening a burst)
        if (irisAt < 0) irisAt = clock
        const reach = cornerDist(iris, w, h)
        iris = { ...iris, r: Math.min(iris.r, reach * easeInOut((clock - irisAt) / (T.iris * 1.5))) }
        lastIris = iris
        if (clock - irisAt >= T.iris * 1.5 || iris.r >= reach - 0.5 || plunge >= T.plunge * SLOW + 0.9) return finish()
      } else if (plunge > T.plunge * SLOW + 0.9) return finish()
      applyIris(iris)
    }
    raf = requestAnimationFrame(tick)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        skip.current()
      } else if (e.key === 'Tab') {
        // the page underneath is inert: keep focus on the only control (now with its keyboard focus ring)
        e.preventDefault()
        skipBtn.current?.blur() // re-focusing an already focused element would not switch its ring on
        skipBtn.current?.focus({ preventScroll: true, focusVisible: true } as FocusOptions)
      }
    }
    const onResize = () => {
      w = window.innerWidth
      h = window.innerHeight
      engine?.resize(w, h)
      setSize({ w, h })
    }
    const onVis = () => {
      last = performance.now()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      engine?.dispose()
      engine = null
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-label="Build an OS is starting">
      <div ref={stage} className="intro-stage">
        <div ref={host} className="intro-host" />
        <div className="intro-word" style={{ top: L.textTop }} aria-hidden="true">
          <div className="intro-wordmark wordmark">
            {'COGNIA'.split('').map((c, i) => (
              <span key={i} style={{ transitionDelay: `${i * 60}ms` }}>
                {c}
              </span>
            ))}
          </div>
          <div className="intro-product">{PRODUCT}</div>
        </div>
        <div className="intro-log" aria-hidden="true">
          {BOOT.map((b, i) => (
            <div key={b.text} ref={(e) => void (lines.current[i] = e)} className="intro-line">
              <span className="ts" /> <span className="tx" />
              <span className="cur" />
              <span className="ok">ok</span>
            </div>
          ))}
        </div>
        <div className="intro-pct" aria-hidden="true">
          <span className="lbl">Loading</span>
          <span ref={pct} className="num">
            000
          </span>
          <span className="unit">%</span>
        </div>
        <div className="intro-bar" aria-hidden="true">
          <div ref={bar} />
        </div>
        <button ref={skipBtn} type="button" className="intro-skip" onClick={() => skip.current()} aria-label="Skip intro">
          Skip intro <kbd aria-hidden="true">Esc</kbd>
        </button>
      </div>
      <div ref={ring} className="intro-ring" aria-hidden="true" />
      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>
    </div>
  )
}
