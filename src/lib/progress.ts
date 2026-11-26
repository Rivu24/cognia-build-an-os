/* Progress lives in this browser only (localStorage). No account, no tracking, no streaks. */
import { useSyncExternalStore } from 'react'

const KEY = 'cognia-osb-'
type Store = { done: Record<string, number>; copy: boolean; theme: 'dark' | 'light' }

function read<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(KEY + k)
    return v === null ? d : (JSON.parse(v) as T)
  } catch {
    return d
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(KEY + k, JSON.stringify(v))
  } catch {
    /* storage unavailable: progress simply is not kept */
  }
}

let state: Store = {
  done: read('done', {}),
  copy: read('copy', false),
  theme: read('theme', 'dark'),
}
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

export function useStore<T>(sel: (s: Store) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state))
}

export const actions = {
  toggleDone(id: string) {
    const done = { ...state.done }
    if (done[id]) delete done[id]
    else done[id] = Date.now()
    state = { ...state, done }
    write('done', done)
    emit()
  },
  setCopy(v: boolean) {
    state = { ...state, copy: v }
    write('copy', v)
    emit()
  },
  setTheme(t: 'dark' | 'light') {
    state = { ...state, theme: t }
    write('theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
    document.documentElement.classList.toggle('light', t === 'light')
    emit()
  },
  reset() {
    state = { ...state, done: {} }
    write('done', {})
    emit()
  },
}

export const useDone = () => useStore((s) => s.done)
