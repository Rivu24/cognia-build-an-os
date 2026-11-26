/* Route geometry for screen transitions: which section a path belongs to, which paths count as "the same page",
   and what the shutter says about a destination. */
import { getIndex, getPath, type IndexEntry, type Path } from '@/lib/data'
import { byId as concepts } from '@/viz/registry'

/** First path segment: '' (Start), 'basics' (Prerequisites), 'path', 'learn', 'lab', 'library', 'method', 'credits', or anything else. */
export const sectionOf = (pathname: string) => pathname.split('/')[1] ?? ''

/** Paths that show the same page. /library/:slug/:anchor is the article itself; only the scroll position differs. */
export function identityOf(pathname: string) {
  const p = pathname.replace(/\/+$/, '') || '/'
  const m = p.match(/^\/library\/([^/]+)\/[^/]+$/)
  return m ? `/library/${m[1]}` : p
}

/* Order of the sections in the rail: moving down the list sweeps forward, moving up sweeps back. */
const ORDER: Record<string, number> = { '': 0, basics: 0.5, path: 1, learn: 1.5, lab: 2, library: 3, method: 4, credits: 5 }
export const sectionRank = (pathname: string) => ORDER[sectionOf(pathname)] ?? 6

export type Dest = { eyebrow: string; title: string }

/* The lesson and article titles come from data that is cached after the first fetch; keep a synchronous copy. */
let path: Path | undefined
let index: Map<string, IndexEntry> | undefined
function warmPath() {
  return getPath().then((p) => (path = p))
}
function warmIndex() {
  return getIndex().then((list) => (index = new Map(list.map((e) => [e.s, e]))))
}

/** Order of a lesson for slide direction: prerequisites (whose idx counts within their section) come before the path. */
export const lessonIdx = (id: string) => {
  const l = path?.byId[id]
  return l ? (l.section === 'prereq' ? l.idx - 100000 : l.idx) : undefined
}

/** Best label available right now, without waiting. */
export function destNow(pathname: string): Dest {
  const [, sec = '', a, b] = pathname.split('/')
  switch (sec) {
    case '':
      return { eyebrow: 'Start', title: 'Build an OS' }
    case 'basics':
      return { eyebrow: 'Before you start', title: 'Prerequisites' }
    case 'path':
      return { eyebrow: 'Learning path', title: 'Take these in order' }
    case 'learn': {
      const l = a ? path?.byId[a] : undefined
      if (!l) return { eyebrow: 'Learning path', title: 'Lesson' }
      return { eyebrow: l.section === 'prereq' ? `Prerequisite ${l.code}` : `Lesson ${l.code}`, title: l.title }
    }
    case 'lab': {
      const c = a ? concepts[a] : undefined
      return { eyebrow: 'Concept Lab', title: c ? c.meta.title : 'See the machine move' }
    }
    case 'library': {
      if (!a) return { eyebrow: 'Library', title: 'The full OSDev Wiki' }
      const slug = decodeURIComponent(a)
      const t = index?.get(slug)?.t ?? slug.replace(/_/g, ' ')
      return { eyebrow: b ? 'Library · Article · Section' : 'Library · Article', title: t }
    }
    case 'method':
      return { eyebrow: 'How we teach', title: 'How a lesson works' }
    case 'credits':
      return { eyebrow: 'Credits and licence', title: 'Credit where it is due' }
    default:
      return { eyebrow: 'Not found', title: 'Nothing here' }
  }
}

/** The label once the data it needs has arrived (lesson code and title, article title). Never rejects. */
export function destLater(pathname: string): Promise<Dest> {
  const sec = sectionOf(pathname)
  const need = sec === 'learn' && !path ? warmPath() : sec === 'library' && pathname.split('/')[2] && !index ? warmIndex() : null
  if (!need) return Promise.resolve(destNow(pathname))
  return need.then(
    () => destNow(pathname),
    () => destNow(pathname),
  )
}

/** Start fetching the path early so lesson labels and lesson order are ready by the first transition. */
export function warmLabels() {
  warmPath().catch(() => {})
}
