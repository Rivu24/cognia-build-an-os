/* Small motion helpers for the home page. */
import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'motion/react'
import { intro, useIntroDone } from '@/lib/intro'

/** True once the hero may play its entrance: immediately when no intro runs, otherwise when the intro has left
    (with a safety timeout, so the hero never stays hidden if the intro is not mounted). */
export function useHeroReady(timeout = 9000) {
  const [playsIntro] = useState(() => !intro.isDone() && (forced() || (intro.shouldPlay() && !navigator.webdriver)))
  const introDone = useIntroDone()
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (!playsIntro) return
    const t = setTimeout(() => setTimedOut(true), timeout)
    return () => clearTimeout(t)
  }, [playsIntro, timeout])
  return !playsIntro || introDone || timedOut
}

/** mirrors the intro loader: "?intro" in the URL forces it to play */
function forced() {
  try {
    return /[?&]intro\b/.test(location.search + location.hash)
  } catch {
    return false
  }
}

/** A soft opacity pulse for "live" dots; still when motion is reduced. */
export function usePulse() {
  const reduce = useReducedMotion()
  return reduce ? {} : { animate: { opacity: [1, 0.25, 1] }, transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const } }
}

/** A step counter that advances every `ms` while the element is on screen; frozen at `still` when motion is reduced. */
export function useLoop<T extends Element>(count: number, ms: number, still = count - 1) {
  const ref = useRef<T>(null)
  const inView = useInView(ref, { margin: '-10% 0px' })
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (reduce || !inView) return
    const t = setInterval(() => setStep((s) => (s + 1) % count), ms)
    return () => clearInterval(t)
  }, [reduce, inView, count, ms])
  /** true while the loop is running: on screen and motion allowed */
  return { ref, step: reduce ? still : step, active: !reduce && inView }
}
