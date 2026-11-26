export type VizMeta = {
  /** kebab-case, equals the file name in viz/concepts (without .tsx) */
  id: string
  /** short plain title, e.g. "Paging: virtual to physical" */
  title: string
  /** one sentence: what the animation shows */
  summary: string
  /** lesson ids from public/data/curriculum.json where this animation appears (first = main lesson) */
  lessons: string[]
  /** wiki article titles this animation illustrates (exact titles) */
  articles?: string[]
  /** grouping for the Concept Lab gallery */
  group: 'Basics' | 'Boot' | 'Toolchain' | 'CPU' | 'Interrupts' | 'Memory' | 'Tasks' | 'User space' | 'Storage' | 'Devices' | 'Platform' | 'Design'
  /** order within the path, used to sort the gallery (track number * 100 + n is fine) */
  order: number
}

export type VizStep = {
  caption: string
  detail?: string
  /** optional per-step duration while playing (ms) */
  ms?: number
}

export type VizModule = { meta: VizMeta; default: () => JSX.Element }
import type { JSX } from 'react'
