/* Screen transitions between routes.

   Section change (first path segment differs): the shutter closes over the whole screen, the route swaps and the
   window scrolls to the top while covered, then the shutter lifts and the new page rises in.
   Same section (lesson to lesson, article to article, lab to a concept): the content slides out and the next slides
   in, following the lesson order, with a hairline sweep across the top.
   Hash, search and /library/:slug/:anchor changes swap instantly. No transition before the intro has finished,
   and a plain crossfade when the reader prefers reduced motion.

   The routes render from a "shown" location that trails the real one, so the old page stays on screen until it is
   covered (or slid out). Pages read that location through the router as usual. */
import { sfx } from '@/lib/sfx'
import { createContext, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigationType, type Location } from 'react-router'
import { animate } from 'motion/react'
import { useIntroDone } from '@/lib/intro'
import { Shutter, type ShutterApi } from './Shutter'
import { destLater, destNow, identityOf, lessonIdx, sectionOf, sectionRank, warmLabels } from './routes'

const ShownLocation = createContext<Location | null>(null)

/** The location the routes are currently showing (it trails useLocation() while a transition is covering). */
export function useShownLocation(): Location {
  const live = useLocation()
  return useContext(ShownLocation) ?? live
}

type Stage = 'idle' | 'cover' | 'reveal' | 'out' | 'in' | 'fade'

const EASE_OUT = [0.22, 1, 0.36, 1] as const
const EASE_IN = [0.55, 0, 1, 0.45] as const
const EASE_COVER = [0.76, 0, 0.24, 1] as const

/** hold the cover at most this long after the new page has rendered */
const HOLD_AFTER_RENDER = 450
/** reveal at the earliest this long after the shutter started, so the destination name can be read */
const MIN_COVER = 560
/** stop waiting for a lazy route after this long */
const RENDER_CAP = 1200

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const race = (p: Promise<unknown>, ms: number) => Promise.race([p, sleep(ms)])
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* The page has content to show: it has a heading, or it no longer shows a loading status. */
async function pageReady(el: HTMLElement | null, within: number) {
  const until = performance.now() + within
  const ok = () => !el || !!el.querySelector('h1') || !el.querySelector('[role="status"]')
  while (!ok() && performance.now() < until) await frame()
  // two frames: one to lay out and paint the page, so the first paint of a heavy page is not part of the motion
  await frame()
  await frame()
}

function CommitSignal({ id, onCommit }: { id: number; onCommit: (id: number) => void }) {
  useLayoutEffect(() => onCommit(id), [id, onCommit])
  return null
}

type Props = {
  /** the route table, rendered for the shown location */
  routes: (location: Location) => ReactNode
  /** Suspense fallback for lazy routes */
  fallback: ReactNode
  /** start loading the code for a pathname (called as soon as a transition begins) */
  preload?: (pathname: string) => void
  /** rendered outside the Suspense boundary, inside the shown-location context (e.g. scroll handling) */
  children?: ReactNode
}

export function RouteTransition({ routes, fallback, preload, children }: Props) {
  const location = useLocation()
  const navType = useNavigationType()
  const introDone = useIntroDone()
  /* n counts swaps: location.key is not unique (a typed or assigned hash gives every entry the key "default") */
  const [{ loc: shown, n: swaps }, setShown] = useState({ loc: location, n: 0 })

  const shownRef = useRef(location)
  const handled = useRef(location)
  const target = useRef(location)
  const wrap = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const shutter = useRef<ShutterApi>(null)
  const gen = useRef(0)
  const sweeps = useRef(0)
  const stage = useRef<Stage>('idle')
  /** shutter is closed (or closing) and has not started to lift */
  const covered = useRef(false)
  const swapCount = useRef(0)
  const committed = useRef(0)
  const waiters = useRef(new Set<() => void>())
  const announcer = useRef<HTMLDivElement>(null)

  const swap = (to: Location) => {
    if (to === shownRef.current) return Promise.resolve()
    const n = ++swapCount.current
    const done = new Promise<void>((res) => {
      const f = () => {
        if (committed.current < n) return
        waiters.current.delete(f)
        res()
      }
      waiters.current.add(f)
    })
    shownRef.current = to
    setShown({ loc: to, n })
    return done
  }
  const onCommit = useCallback((n: number) => {
    committed.current = n
    ;[...waiters.current].forEach((f) => f())
  }, [])

  const settle = (el: HTMLElement | null) => {
    if (el) {
      el.style.transform = ''
      el.style.opacity = ''
      el.style.minHeight = ''
    }
    stage.current = 'idle'
  }

  /* The new page is on screen: tell screen readers where they are, and move keyboard focus to the content when it
     was on a link inside the old page (that link has gone, or now belongs to a different page). Focus in the rail
     or the menu stays where it is. */
  const arrived = (el: HTMLElement | null, to: Location) => {
    const say = announcer.current
    if (say) say.textContent = el?.querySelector('h1')?.textContent?.trim() || destNow(to.pathname).title
    const a = document.activeElement
    if (!a || a === document.body || !a.isConnected || (el && el.contains(a))) {
      document.getElementById('main')?.focus({ preventScroll: true })
    }
  }

  useEffect(() => {
    warmLabels()
    // the shutter scrolls to the top while covered; the browser must not restore scroll on its own first
    const prev = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const g = gen
    return () => {
      history.scrollRestoration = prev
      g.current++
    }
  }, [])

  useLayoutEffect(() => {
    if (location === handled.current) return
    handled.current = location
    target.current = location
    const to = location
    const el = wrap.current
    const cur = shownRef.current

    /* ---- section change: the shutter ---- */
    const shutterRun = async () => {
      const g = ++gen.current
      stage.current = 'cover'
      sfx.cover()
      covered.current = true
      const dir: 1 | -1 = sectionRank(to.pathname) >= sectionRank(cur.pathname) ? 1 : -1
      preload?.(to.pathname)
      destLater(to.pathname).then((d) => {
        if (g === gen.current && covered.current) shutter.current?.label(d)
      })
      const t0 = performance.now()
      if (el) animate(el, { x: 0, y: -28, opacity: 0.3 }, { duration: 0.5, ease: EASE_COVER })
      await shutter.current?.cover(destNow(to.pathname), dir)
      if (g !== gen.current) return

      // covered: swap the route (ScrollTop scrolls to the top in the same commit)
      stage.current = 'reveal'
      const dest = target.current
      const tSwap = performance.now()
      if (el) {
        animate(el, { x: 0, y: 24, opacity: 0.01 }, { duration: 0 }) // not 0: the new page is painted while still covered
        el.style.minHeight = '100vh' // the footer stays below the fold while the new page loads
      }
      await race(swap(dest), RENDER_CAP)
      await pageReady(el, RENDER_CAP - (performance.now() - tSwap))
      if (g !== gen.current) return
      arrived(el, dest)
      if (el) el.style.minHeight = ''
      await sleep(Math.min(HOLD_AFTER_RENDER, Math.max(40, t0 + MIN_COVER - performance.now())))
      if (g !== gen.current) return

      covered.current = false
      sfx.reveal()
      void shutter.current?.reveal(dir)
      await sleep(90)
      if (g !== gen.current) return
      if (el) await animate(el, { y: 0, opacity: 1 }, { duration: 0.45, ease: EASE_OUT })
      if (g === gen.current) settle(el)
    }

    /* ---- same section: slide ---- */
    const slideRun = async () => {
      const g = ++gen.current
      stage.current = 'out'
      sfx.slide()
      const a = sectionOf(cur.pathname) === 'learn' ? lessonIdx(cur.pathname.split('/')[2]) : undefined
      const b = sectionOf(to.pathname) === 'learn' ? lessonIdx(to.pathname.split('/')[2]) : undefined
      const dir = a !== undefined && b !== undefined ? (b >= a ? 1 : -1) : navType === 'POP' ? -1 : 1
      preload?.(to.pathname)
      const line = bar.current
      if (line) {
        const sweep = ++sweeps.current
        animate(line, { scaleX: [0, 1], opacity: [1, 1] }, { duration: 0.34, ease: [0.65, 0, 0.35, 1] }).then(() => {
          if (sweep === sweeps.current) animate(line, { opacity: 0 }, { duration: 0.22 })
        })
      }
      if (el) await animate(el, { x: -dir * 28, y: 0, opacity: 0 }, { duration: 0.12, ease: EASE_IN })
      if (g !== gen.current) return
      stage.current = 'in'
      const tSwap = performance.now()
      if (el) {
        animate(el, { x: dir * 28, opacity: 0.01 }, { duration: 0 })
        el.style.minHeight = '100vh'
      }
      const dest = target.current
      await race(swap(dest), 600)
      await pageReady(el, 600 - (performance.now() - tSwap))
      if (g !== gen.current) return
      arrived(el, dest)
      if (el) el.style.minHeight = ''
      if (el) await animate(el, { x: 0, opacity: 1 }, { duration: 0.2, ease: EASE_OUT })
      if (g === gen.current) settle(el)
    }

    /* ---- reduced motion: crossfade ---- */
    const fadeRun = async () => {
      const g = ++gen.current
      stage.current = 'fade'
      covered.current = false
      shutter.current?.hide()
      preload?.(to.pathname)
      if (el) await animate(el, { opacity: 0 }, { duration: 0.07 })
      if (g !== gen.current) return
      if (el) animate(el, { x: 0, y: 0, opacity: 0.01 }, { duration: 0 })
      const tSwap = performance.now()
      const dest = target.current
      await race(swap(dest), 500)
      await pageReady(el, 500 - (performance.now() - tSwap))
      if (g !== gen.current) return
      arrived(el, dest)
      if (el) await animate(el, { opacity: 1 }, { duration: 0.15 })
      if (g === gen.current) settle(el)
    }

    if (covered.current) {
      // the screen is already covered: keep the cover and head for the new destination
      void shutterRun()
      return
    }
    if (identityOf(cur.pathname) === identityOf(to.pathname)) {
      // same page (hash, search or article anchor): show it as is, and undo a slide that had started
      if (stage.current === 'out' || stage.current === 'fade') {
        ++gen.current
        if (el) animate(el, { x: 0, y: 0, opacity: 1 }, { duration: 0.16 }).then(() => stage.current === 'idle' && settle(el))
        stage.current = 'idle'
      }
      void swap(to)
      return
    }
    if (!introDone) {
      ++gen.current
      shutter.current?.hide()
      settle(el)
      void swap(to)
      return
    }
    if (reducedMotion()) void fadeRun()
    else if (sectionOf(cur.pathname) !== sectionOf(to.pathname)) void shutterRun()
    else void slideRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  return (
    <ShownLocation.Provider value={shown}>
      {children}
      <div ref={wrap} data-route-view>
        <Suspense fallback={fallback}>
          {routes(shown)}
          <CommitSignal key={swaps} id={swaps} onCommit={onCommit} />
        </Suspense>
      </div>
      <div ref={bar} data-route-sweep aria-hidden="true"
        className="pointer-events-none fixed top-0 right-0 left-0 z-[90] h-px origin-left bg-foreground opacity-0 shadow-[0_0_10px_var(--viz-glow)] lg:left-[280px]" />
      <Shutter ref={shutter} />
      <div ref={announcer} className="sr-only" aria-live="polite" aria-atomic="true" />
    </ShownLocation.Provider>
  )
}
