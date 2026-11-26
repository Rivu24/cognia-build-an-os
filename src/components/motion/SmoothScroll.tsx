/* Inertial page scrolling with Lenis. The page still scrolls natively underneath (Lenis eases window.scrollTo), so
   position: sticky, scroll events, motion's useScroll, the reading-progress bar and IntersectionObserver all keep
   working unchanged.

   Off when the reader prefers reduced motion and on touch / coarse pointers (native momentum is better there).
   Paused while the page is scroll-locked: a Base UI dialog or Sheet ([data-base-ui-scroll-locked] on <html>, or
   [data-base-ui-inert] together with aria-hidden on the page, which only modal popups set), an inline
   overflow: hidden on <html> or <body>, or the class `scroll-locked` on <html>. Code can pause it too with
   smoothScroll.stop() / smoothScroll.start() (counted) or useSmoothScrollLock().
   Mount: <SmoothScroll /> once inside the router (App or AppShell); it renders its children unchanged.

   Interop:
   - window.scrollTo / scrollIntoView from elsewhere (ScrollTop in App.tsx, TOC and anchor links) win: an outside
     jump during a glide cancels the glide instead of being dragged back.
   - A click, tap or key press stops a glide in progress, so a native smooth scroll it starts is not fought.
   - Inner scroll areas (music panel, search list, rail, wiki code blocks) scroll natively: nested scrollables are
     detected (allowNestedScroll), and anything inside [data-lenis-prevent] or a dialog is left alone.
   - Lenis' own anchor handling is off: with the hash router every "#/route" link would look like an anchor.
     Use scrollToElement() from this module for in-page links to get the same glide. */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import './smooth-scroll.css'

let lenis: Lenis | null = null
let holds = 0
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())

function pageLocked() {
  const html = document.documentElement
  const body = document.body
  if (html.hasAttribute('data-base-ui-scroll-locked') || html.classList.contains('scroll-locked')) return true
  const hidden = (s: CSSStyleDeclaration) => /hidden|clip/.test(`${s.overflow} ${s.overflowY}`)
  if (hidden(html.style) || hidden(body.style)) return true
  // a modal Base UI popup marks the rest of the page inert AND aria-hidden (non-modal popups only mark it)
  return !!document.querySelector('body > [data-base-ui-inert][aria-hidden="true"]')
}

function sync() {
  if (!lenis) return
  const locked = holds > 0 || pageLocked()
  if (locked && !lenis.isStopped) lenis.stop()
  else if (!locked && lenis.isStopped) lenis.start()
}

/* the site's EASE_WEIGHT, cubic-bezier(.16, 1, .3, 1), as an exponential settle (Lenis takes an easing function) */
const easeWeight = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/** Control the smooth scroller from anywhere. All calls are safe when it is not mounted or is disabled. */
export const smoothScroll = {
  /** the live Lenis instance, or null (not mounted, reduced motion, touch) */
  get: () => lenis,
  /** pause inertial scrolling and lock the page (counted: pair every stop with a start) */
  stop() {
    holds++
    sync()
  },
  start() {
    holds = Math.max(0, holds - 1)
    sync()
  },
  /** scroll to a y position with the site's glide (native smooth scroll when Lenis is off) */
  to(top: number, { immediate = false, duration = 1.2, onComplete }: { immediate?: boolean; duration?: number; onComplete?: () => void } = {}) {
    if (lenis && !lenis.isStopped) {
      // Lenis clamps to a page height it re-measures only 250 ms after the content stops resizing: a page that has
      // just loaded (a deep link such as /path#t4) or just opened a panel would clamp the glide short
      lenis.dimensions.resize()
      // the page may have moved natively since Lenis last looked (focus, the browser, a test driver) and its scroll
      // event is still queued: start from where the page is, or the glide would begin from a stale position and the
      // late event would read as an outside jump and cancel it
      if (lenis.isScrolling !== 'smooth' && Math.abs(lenis.actualScroll - lenis.animatedScroll) > 1) lenis.scrollTo(lenis.actualScroll, { immediate: true, force: true })
      lenis.scrollTo(top, { immediate, duration, easing: easeWeight, force: true, onComplete: onComplete && (() => onComplete()) })
      return
    }
    // reduced motion: jump (an explicit 'smooth' would override the reader's preference)
    if (!immediate && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) immediate = true
    window.scrollTo({ top, behavior: immediate ? ('instant' as ScrollBehavior) : 'smooth' })
    if (!onComplete) return
    if (immediate) return void requestAnimationFrame(() => onComplete())
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.removeEventListener('scrollend', finish)
      clearTimeout(t)
      onComplete()
    }
    window.addEventListener('scrollend', finish)
    const t = setTimeout(finish, 1600)
  },
}

/** Document y of an element from layout (offsetTop chain), ignoring transforms: an element mid-Reveal is still
    translated down, which would throw getBoundingClientRect-based scrolling off by its offset. */
function layoutTop(el: HTMLElement) {
  let y = 0
  let n: HTMLElement | null = el
  while (n) {
    y += n.offsetTop
    n = n.offsetParent as HTMLElement | null
  }
  return y
}

/** Scroll an element to the top of the screen (respecting its scroll-margin-top) with the site's glide. Use it for
    in-page links: TOCs, letter jumps, group links. If content above it changes height on the way (lazy figures,
    images), it corrects once the glide ends. */
export function scrollToElement(el: Element | null | undefined, { immediate = false } = {}) {
  if (!(el instanceof HTMLElement)) return
  const target = () => Math.max(0, Math.min(layoutTop(el) - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0), document.documentElement.scrollHeight - innerHeight))
  let tries = 0
  const go = (imm: boolean, duration?: number) =>
    smoothScroll.to(target(), {
      immediate: imm,
      duration,
      onComplete: () => {
        if (tries++ < 3 && Math.abs(target() - scrollY) > 2) go(imm, 0.6)
      },
    })
  go(immediate)
}
/** scrollToElement by id */
export const scrollToId = (id: string, opts?: { immediate?: boolean }) => scrollToElement(document.getElementById(id), opts)

/** The live Lenis instance (re-renders when it is created or destroyed). */
export function useLenis() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => lenis,
    () => null,
  )
}

/** Pause smooth scrolling while `active` is true (e.g. a custom overlay that is not a Base UI dialog). */
export function useSmoothScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    smoothScroll.stop()
    return () => smoothScroll.start()
  }, [active])
}

export type SmoothScrollProps = {
  children?: ReactNode
  /** interpolation per frame: lower is heavier (default 0.09) */
  lerp?: number
  /** wheel distance multiplier (default 1) */
  wheelMultiplier?: number
}

/** Mount once, high in the tree (App or AppShell). Renders its children unchanged. */
export function SmoothScroll({ children, lerp = 0.09, wheelMultiplier = 1 }: SmoothScrollProps) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof matchMedia !== 'function') return
    const mqReduce = matchMedia('(prefers-reduced-motion: reduce)')
    const mqCoarse = matchMedia('(pointer: coarse), (hover: none)')
    let mine: Lenis | null = null
    let observers: MutationObserver[] = []

    /* someone else moved the page during a glide (window.scrollTo, scrollIntoView, the browser): let them win */
    const onScroll = () => {
      if (!mine || mine.isScrolling !== 'smooth') return
      if (Math.abs(mine.actualScroll - mine.animatedScroll) > 8) mine.scrollTo(mine.actualScroll, { immediate: true, force: true })
    }
    /* a click, tap or key stops a glide, so whatever it triggers starts from rest */
    const halt = (e: Event) => {
      if (!mine || mine.isScrolling !== 'smooth') return
      if (e instanceof KeyboardEvent && /^(Shift|Control|Alt|Meta)$/.test(e.key)) return
      mine.scrollTo(mine.actualScroll, { immediate: true, force: true })
    }

    const create = () => {
      mine = new Lenis({
        lerp,
        wheelMultiplier,
        smoothWheel: true,
        syncTouch: false,
        anchors: false,
        autoRaf: true,
        allowNestedScroll: true,
        prevent: (node) => node.closest?.('[data-lenis-prevent], [role="dialog"], [role="listbox"]') != null,
      })
      lenis = mine
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('pointerdown', halt, { capture: true, passive: true })
      window.addEventListener('keydown', halt, { capture: true, passive: true })
      const mo = new MutationObserver(sync)
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-base-ui-scroll-locked'] })
      mo.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] })
      const inert = new MutationObserver(sync)
      inert.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-base-ui-inert', 'aria-hidden'] })
      observers = [mo, inert]
      sync()
      notify()
    }
    const destroy = () => {
      if (!mine) return
      observers.forEach((o) => o.disconnect())
      observers = []
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointerdown', halt, { capture: true })
      window.removeEventListener('keydown', halt, { capture: true })
      mine.destroy()
      if (lenis === mine) lenis = null
      mine = null
      notify()
    }
    const apply = () => {
      const want = !mqReduce.matches && !mqCoarse.matches
      if (want && !mine) create()
      else if (!want && mine) destroy()
    }
    apply()
    mqReduce.addEventListener('change', apply)
    mqCoarse.addEventListener('change', apply)
    return () => {
      mqReduce.removeEventListener('change', apply)
      mqCoarse.removeEventListener('change', apply)
      destroy()
    }
  }, [lerp, wheelMultiplier])

  return <>{children}</>
}
