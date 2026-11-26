/* "What do I read next?": one answer, used everywhere (rail, home, path, lesson end).
   Next = the first core lesson not yet done, in path order; once the core is finished, the first open elective lesson. */
import { useMemo } from 'react'
import { usePath, type Path, type PathLesson } from '@/lib/data'
import { useDone } from '@/lib/progress'

export type NextInfo = {
  path?: Path
  /** the lesson to do now; undefined while loading or when everything is done */
  next?: PathLesson
  /** true once at least one lesson is done */
  started: boolean
  coreDone: number
  coreTotal: number
  allDone: number
  allTotal: number
}

export function nextLesson(path: Path, done: Record<string, number>, after?: string): PathLesson | undefined {
  const core = path.tracks.filter((t) => !t.elective).flatMap((t) => t.lessons)
  const electives = path.tracks.filter((t) => t.elective).flatMap((t) => t.lessons)
  const order = [...core, ...electives]
  const start = after ? order.findIndex((l) => l.id === after) + 1 : 0
  return order.slice(start).find((l) => !done[l.id]) ?? order.find((l) => !done[l.id])
}

export function useNextLesson(): NextInfo {
  const { data: path } = usePath()
  const done = useDone()
  return useMemo(() => {
    if (!path) return { started: false, coreDone: 0, coreTotal: 0, allDone: 0, allTotal: 0 }
    const core = path.tracks.filter((t) => !t.elective).flatMap((t) => t.lessons)
    return {
      path,
      next: nextLesson(path, done),
      // started = at least one lesson of the numbered path done (prerequisites don't count as starting the path)
      started: path.lessons.some((l) => done[l.id]),
      coreDone: core.filter((l) => done[l.id]).length,
      coreTotal: core.length,
      allDone: path.lessons.filter((l) => done[l.id]).length,
      allTotal: path.lessons.length,
    }
  }, [path, done])
}

/** The next lesson after `afterId`, staying inside its section: within Prerequisites, the next open prerequisite
    (then the first open core lesson after the last one); elsewhere, the same as nextLesson(path, done, afterId). */
export function nextAfter(path: Path, done: Record<string, number>, afterId: string): PathLesson | undefined {
  const cur = path.byId[afterId]
  if (cur?.section === 'prereq' && path.prereq) {
    const list = path.prereq.lessons
    const i = list.findIndex((l) => l.id === afterId)
    // keep going forward through the prerequisites, then on to the path; never wrap back to an earlier one
    return list.slice(i + 1).find((l) => !done[l.id]) ?? nextLesson(path, done)
  }
  return nextLesson(path, done, afterId)
}

/** Progress through the Prerequisites section. */
export function usePrereqProgress() {
  const { data: path } = usePath()
  const done = useDone()
  return useMemo(() => {
    const list = path?.prereq?.lessons ?? []
    return { path, lessons: list, done: list.filter((l) => done[l.id]).length, total: list.length, next: list.find((l) => !done[l.id]) }
  }, [path, done])
}
