/* Every file in ./concepts is a motion graphic: `export const meta: VizMeta` + `export default function`.
   New concepts are picked up automatically; nothing else needs editing. */
import type { VizMeta, VizModule } from './core/types'

const mods = import.meta.glob<VizModule>('./concepts/*.tsx', { eager: true })

export const CONCEPTS: VizModule[] = Object.values(mods)
  .filter((m) => m && m.meta && typeof m.default === 'function')
  .sort((a, b) => a.meta.order - b.meta.order)

export const byId: Record<string, VizModule> = Object.fromEntries(CONCEPTS.map((m) => [m.meta.id, m]))

export function conceptsForLesson(lessonId: string): VizModule[] {
  return CONCEPTS.filter((m) => m.meta.lessons.includes(lessonId)).sort(
    (a, b) => Number(b.meta.lessons[0] === lessonId) - Number(a.meta.lessons[0] === lessonId),
  )
}

export function conceptsForArticle(title: string): VizModule[] {
  return CONCEPTS.filter((m) => m.meta.articles?.includes(title))
}

export const GROUPS: VizMeta['group'][] = ['Basics', 'Boot', 'Toolchain', 'CPU', 'Interrupts', 'Memory', 'Tasks', 'User space', 'Storage', 'Devices', 'Platform', 'Design']
