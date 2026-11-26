/* Data layer: everything comes from public/data (exported by tools/export.py from the OSDev Wiki dump). */
import { useEffect, useState } from 'react'

export type Lesson = {
  id: string
  title: string
  level: number
  minutes: number
  articles: string[]
  further: string[]
  why: string
  objectives: string[]
  checkpoint: string
  prereq: string[]
}
export type Module = { id: string; title: string; summary: string; lessons: Lesson[] }
export type Track = { id: string; title: string; summary: string; goal?: string; modules: Module[] }
export type Curriculum = { name: string; tracks: Track[]; prereqs?: Track & { kind?: string } }

/** A lesson enriched with its position in the path. */
export type PathLesson = Lesson & {
  code: string
  idx: number
  track: Track
  trackN: number
  module: Module
  moduleN: number
  /** which part of the site the lesson belongs to: the Prerequisites section, the core path, or an elective */
  section: 'prereq' | 'core' | 'elective'
}
export type Path = {
  name: string
  tracks: (Track & { n: number; lessons: PathLesson[]; elective: boolean; minutes: number })[]
  lessons: PathLesson[]
  /** includes the Prerequisites lessons, so /learn/<id> resolves them too */
  byId: Record<string, PathLesson>
  totalMinutes: number
  /** the Prerequisites section: separate from the numbered path (not in tracks, lessons or the counts) */
  prereq?: Track & { lessons: PathLesson[]; minutes: number }
}

export type IndexEntry = { t: string; s: string; sum: string; c: string[]; r: number | null; w: number; h: string; f: string[]; l: number }
export type TocItem = { id: string; text: string; level: number }
export type Article = {
  title: string
  slug: string
  html: string
  toc: TocItem[]
  categories: string[]
  rating: number | null
  flags: string[]
  words: number
  summary: string
  updated: string
  authors: string[]
  url: string
  history: string
  backlinks: { t: string; s: string }[]
  lessons: { id: string; title: string; kind: 'primary' | 'further' }[]
}
export type Meta = { articles: number; categories: string[]; contributors: string[]; dump: string; dumpDate: string; wiki: string }

const BASE = import.meta.env.BASE_URL + 'data/'
const cache = new Map<string, Promise<unknown>>()

function load<T>(path: string, kind: 'json' | 'text' = 'json'): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(BASE + path).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${path}`)
        return kind === 'json' ? r.json() : r.text()
      }),
    )
  }
  return cache.get(path) as Promise<T>
}

export function slugify(t: string) {
  return t.replace(/\+/g, '_plus').replace(/#/g, '_sharp').replace(/--$/, '_minus_minus').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function buildPath(c: Curriculum): Path {
  const lessons: PathLesson[] = []
  const tracks = c.tracks.map((t, ti) => {
    const tl: PathLesson[] = []
    t.modules.forEach((m, mi) =>
      m.lessons.forEach((l, li) => {
        const pl: PathLesson = { ...l, code: `${ti + 1}.${mi + 1}.${li + 1}`, idx: lessons.length, track: t, trackN: ti + 1, module: m, moduleN: mi + 1, section: /^elective/i.test(t.title) ? 'elective' : 'core' }
        lessons.push(pl)
        tl.push(pl)
      }),
    )
    return { ...t, n: ti + 1, lessons: tl, elective: /^elective/i.test(t.title), minutes: tl.reduce((s, l) => s + (l.minutes || 0), 0) }
  })
  // Prerequisites: codes P1.1, P1.2 ... ; idx counts within the section (prev/next stay inside it)
  let prereq: Path['prereq']
  if (c.prereqs) {
    const pt = c.prereqs
    const pl: PathLesson[] = []
    pt.modules.forEach((m, mi) =>
      m.lessons.forEach((l, li) => pl.push({ ...l, code: `P${mi + 1}.${li + 1}`, idx: pl.length, track: pt, trackN: 0, module: m, moduleN: mi + 1, section: 'prereq' })),
    )
    prereq = { ...pt, lessons: pl, minutes: pl.reduce((s, l) => s + (l.minutes || 0), 0) }
  }
  return {
    name: c.name,
    tracks,
    lessons,
    prereq,
    byId: Object.fromEntries([...lessons, ...(prereq?.lessons ?? [])].map((l) => [l.id, l])),
    totalMinutes: lessons.reduce((s, l) => s + (l.minutes || 0), 0),
  }
}

let pathPromise: Promise<Path> | null = null
export const getPath = () => (pathPromise ??= load<Curriculum>('curriculum.json').then(buildPath))
export const getIndex = () => load<IndexEntry[]>('index.json')
export const getMeta = () => load<Meta>('meta.json')
export const getMethod = () => load<string>('method.html', 'text')
export const getArticle = (slug: string) => load<Article>(`a/${slug}.json`)

/** Minimal async hook: returns undefined while loading, throws nothing (error kept separately). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data?: T; error?: Error } {
  const [state, setState] = useState<{ data?: T; error?: Error }>({})
  useEffect(() => {
    let live = true
    setState({})
    fn().then(
      (data) => live && setState({ data }),
      (error) => live && setState({ error }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

export const usePath = () => useAsync(getPath, [])
export const useIndex = () => useAsync(getIndex, [])
export const useMeta = () => useAsync(getMeta, [])
export const useArticle = (slug: string) => useAsync(() => getArticle(slug), [slug])
