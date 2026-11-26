/* Shared intro state. The intro loader plays on every full page load (or reload); route transitions and the home
   hero wait until it is finished so the first page does not get a transition on top of the intro. Nothing is
   remembered between loads: a fresh load always starts with done = false. */
import { useSyncExternalStore } from 'react'

let done = false
const subs = new Set<() => void>()

export const intro = {
  /** should the intro play on this load? (true for every fresh load until the intro has finished) */
  shouldPlay: () => !done,
  isDone: () => done,
  /** call when the intro has fully left the screen (or is under way far enough for the page to enter) */
  finish() {
    if (done) return
    done = true
    subs.forEach((f) => f())
  },
}

export function useIntroDone() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => done,
    () => done,
  )
}

/* The static boot screen from index.html. Normally the intro loader removes it at once; on the home page the scroll
   journey holds it until its 3D scene is ready (so the visitor never sees an empty stage), then fades it out. */
let held = false
export const bootScreen = {
  hold() {
    held = true
  },
  isHeld: () => held,
  release() {
    held = false
    const l = (window as unknown as { cogniaLoader?: { finish(): Promise<void> } }).cogniaLoader
    if (l) return void l.finish() // the COGNIA loader plays its exit and removes itself
    const b = document.getElementById('intro-boot')
    if (!b || b.dataset.leaving != null) return
    b.dataset.leaving = ''
    b.style.transition = 'opacity .9s cubic-bezier(.4,0,.2,1)'
    b.style.opacity = '0'
    b.style.pointerEvents = 'none'
    setTimeout(() => b.remove(), 950)
  },
}
