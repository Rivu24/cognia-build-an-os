/* The prerequisites self-check: one answer per module, kept in this browser only. From it, a personal plan. */
import { useSyncExternalStore } from 'react'
import type { Path, PathLesson } from '@/lib/data'
import { nextLesson } from '@/lib/next'

export type Answer = 'know' | 'unsure' | 'new'
export type Answers = Record<string, Answer>

export const ANSWERS: { id: Answer; label: string }[] = [
  { id: 'know', label: 'I know this' },
  { id: 'unsure', label: 'Not sure' },
  { id: 'new', label: 'New to me' },
]

const KEY = 'cognia-osb-selfcheck'

function read(): Answers {
  try {
    const v = localStorage.getItem(KEY)
    const o = v ? JSON.parse(v) : {}
    return o && typeof o === 'object' ? (o as Answers) : {}
  } catch {
    return {}
  }
}

let answers: Answers = read()
const subs = new Set<() => void>()
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

export const useAnswers = () => useSyncExternalStore(subscribe, () => answers, () => answers)

export function setAnswer(moduleId: string, a: Answer | null) {
  const next = { ...answers }
  if (a) next[moduleId] = a
  else delete next[moduleId]
  answers = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable: the answers last for this visit only */
  }
  subs.forEach((f) => f())
}

export function clearAnswers() {
  answers = {}
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
  subs.forEach((f) => f())
}

export type PrereqModule = { id: string; n: number; title: string; summary: string; lessons: PathLesson[]; minutes: number }

/** The prerequisite modules with their path lessons (codes P1.1 ...). */
export function prereqModules(path: Path): PrereqModule[] {
  const pr = path.prereq
  if (!pr) return []
  return pr.modules.map((m, i) => {
    const lessons = pr.lessons.filter((l) => l.module.id === m.id)
    return { id: m.id, n: i + 1, title: m.title, summary: m.summary, lessons, minutes: lessons.reduce((s, l) => s + (l.minutes || 0), 0) }
  })
}

export type Plan = {
  /** modules marked so far */
  marked: number
  /** modules marked "Not sure" or "New to me", in order */
  modules: PrereqModule[]
  /** open (not done) lessons of those modules */
  open: PathLesson[]
  minutes: number
  /** the first open lesson of the plan */
  first?: PathLesson
}

export function makePlan(mods: PrereqModule[], answers: Answers, done: Record<string, number>): Plan {
  const modules = mods.filter((m) => answers[m.id] === 'unsure' || answers[m.id] === 'new')
  const open = modules.flatMap((m) => m.lessons.filter((l) => !done[l.id]))
  return {
    marked: mods.filter((m) => answers[m.id]).length,
    modules,
    open,
    minutes: open.reduce((s, l) => s + (l.minutes || 0), 0),
    first: open[0],
  }
}

/** "3", "3 and 4", "3, 4 and 6" */
export function andList(xs: (string | number)[]) {
  if (xs.length < 2) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/** "After this lesson you can list the skill areas." -> "List the skill areas" */
export function statement(o: string) {
  const t = o.replace(/^After this lesson,? you can /i, '').replace(/\.$/, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** What comes after prerequisite `afterId`, following the self-check: the next open lesson of the same module or of a
    module in the plan (with no plan, any later open prerequisite). Past the last one it goes on to the core path rather
    than back to modules the learner skipped or said they know. Outside Prerequisites: the usual next lesson. */
export function prereqNextAfter(path: Path, done: Record<string, number>, answers: Answers, afterId: string): PathLesson | undefined {
  const cur = path.byId[afterId]
  if (cur?.section !== 'prereq' || !path.prereq) return nextLesson(path, done, afterId)
  const mods = prereqModules(path)
  const planned = new Set(mods.filter((m) => answers[m.id] === 'unsure' || answers[m.id] === 'new').map((m) => m.id))
  const allKnown = mods.length > 0 && mods.every((m) => answers[m.id] === 'know')
  const take = (l: PathLesson) => l.module.id === cur.module.id || (planned.size ? planned.has(l.module.id) : !allKnown)
  const list = path.prereq.lessons
  const i = list.findIndex((l) => l.id === afterId)
  return list.slice(i + 1).find((l) => !done[l.id] && take(l)) ?? nextLesson(path, done)
}
