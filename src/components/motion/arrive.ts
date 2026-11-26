/* When may an element play its entrance? When it is on screen AND the screen is actually visible: the intro loader
   has left and no route transition is covering the page. Elements that enter while covered wait (one shared
   frame loop, only while something is waiting), so the reader sees the arrival instead of its last frames. */
import { useEffect, useState, type RefObject } from 'react'
import { useInView, useReducedMotion, type UseInViewOptions } from 'motion/react'
import { intro } from '@/lib/intro'
import { VIEW_AMOUNT } from './tokens'
import { sfx, type ArriveSound } from '@/lib/sfx'

type Waiter = { el: Element | null; resolve: () => void; until: number }
const waiting = new Set<Waiter>()
let looping = false

/** the route view (see RouteTransition) is near-transparent while the shutter covers it or a slide swaps it */
function covered(el: Element | null) {
  const view = el?.closest<HTMLElement>('[data-route-view]')
  if (!view) return false
  const o = view.style.opacity
  return o !== '' && parseFloat(o) < 0.05
}

function tick() {
  const now = performance.now()
  const introDone = intro.isDone()
  for (const w of waiting) {
    if (now > w.until || (introDone && !covered(w.el))) {
      waiting.delete(w)
      w.resolve()
    }
  }
  if (waiting.size) requestAnimationFrame(tick)
  else looping = false
}

/** Resolves once the stage is clear for `el` (gives up waiting after `maxWait` ms, so nothing stays hidden). */
export function whenStageClear(el: Element | null, maxWait = 9000): Promise<void> {
  if (intro.isDone() && !covered(el)) return Promise.resolve()
  return new Promise((resolve) => {
    waiting.add({ el, resolve, until: performance.now() + maxWait })
    if (!looping) {
      looping = true
      requestAnimationFrame(tick)
    }
  })
}

export type ArriveOptions = {
  /** fraction of the element on screen before it arrives (default 0.25) */
  amount?: number
  /** IntersectionObserver root margin for the "top has passed 80% of the screen" trigger, for very tall elements */
  margin?: UseInViewOptions['margin']
  /** wait for the intro and route transitions (default true) */
  gate?: boolean
  /** the sound of the entrance (default 'reveal'; 'none' for silence) */
  sound?: ArriveSound
}

/** True once (and forever after) the element has entered the viewport and the stage is clear.
    Off-screen elements do no work: one IntersectionObserver each, disconnected after the first entry. */
export function useArrive(ref: RefObject<Element | null>, { amount = VIEW_AMOUNT, margin = '0px 0px -20% 0px', gate = true, sound = 'reveal' }: ArriveOptions = {}) {
  // two triggers: a share of the element is visible (small things), or its top has passed 80% of the screen
  // (things taller than the viewport can never be 25% visible)
  const seen = useInView(ref, { once: true, amount })
  const passed = useInView(ref, { once: true, margin })
  const inView = seen || passed
  const [go, setGo] = useState(false)
  useEffect(() => {
    if (!inView || go) return
    if (!gate) return setGo(true)
    let alive = true
    whenStageClear(ref.current).then(() => alive && setGo(true))
    return () => {
      alive = false
    }
  }, [inView, go, gate, ref])
  useEffect(() => {
    if (go) sfx.arrive(sound)
  }, [go, sound])
  return go
}

/** Reduced motion, as a boolean (motion's hook returns null before it knows). */
export function useReduced() {
  return !!useReducedMotion()
}
