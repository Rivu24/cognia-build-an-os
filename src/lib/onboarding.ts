/* Onboarding: on a full load of the home page the journey owns the whole screen (no sidebar, top bar or music chip).
   When it ends (or is skipped) the site arrives. In-app visits to home after that do not replay it; replay() does. */
import { useSyncExternalStore } from 'react'
import { canJourney, onHome } from '@/components/journey/capable'

let active = typeof window !== 'undefined' && onHome() && canJourney()
/** true once the site has arrived at least once (the shell animates in only then) */
let arrived = !active
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

if (active && 'scrollRestoration' in history) history.scrollRestoration = 'manual'

export const onboarding = {
  isActive: () => active,
  hasArrived: () => arrived,
  finish() {
    if (!active) return
    active = false
    arrived = true
    window.scrollTo(0, 0)
    emit()
    requestAnimationFrame(() => window.scrollTo(0, 0))
  },
  replay() {
    if (active || !canJourney()) return
    active = true
    window.scrollTo(0, 0)
    emit()
  },
}

export function useOnboarding() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => active,
    () => active,
  )
}
