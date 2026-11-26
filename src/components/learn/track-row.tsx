/* One track on the learning path: a tidy row (number, title, n / total, bar) that opens into its lessons.
   The square number boxes are joined by a short spine that turns solid once a track is done. */
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import type { Path } from '@/lib/data'
import { cn, mins } from '@/lib/utils'
import { Bar, Minutes } from './bits'
import { DrawLine, EASE_WEIGHT, Reveal } from '@/components/motion'

export type PathTrack = Path['tracks'][number]

export function trackNeeds(path: Path, t: PathTrack): string[] {
  const own = new Set(t.lessons.map((l) => l.id))
  return [...new Set(t.lessons.flatMap((l) => l.prereq).filter((p) => !own.has(p) && path.byId[p]))].sort((a, b) => path.byId[a].idx - path.byId[b].idx)
}

export function TrackRow({
  path,
  track: t,
  done,
  open,
  onToggle,
  nextId,
  isCurrent,
  last,
  elective,
  delay = 0,
}: {
  path: Path
  track: PathTrack
  done: Record<string, number>
  open: boolean
  onToggle: () => void
  nextId?: string
  isCurrent: boolean
  last: boolean
  elective?: boolean
  /** seconds before the row settles in, after it arrives (a small cascade between neighbours) */
  delay?: number
}) {
  const n = t.lessons.filter((l) => done[l.id]).length
  const total = t.lessons.length
  const complete = n === total
  const needs = elective ? trackNeeds(path, t) : []
  const left = needs.filter((x) => !done[x]).length
  const title = t.title.replace(/^Elective:\s*/, '')
  const status = complete ? 'Done' : isCurrent ? (n > 0 ? 'You are here' : 'Start here') : n > 0 ? 'In progress' : null
  const ready = elective && needs.length > 0 ? (left ? `${left} core lesson${left > 1 ? 's' : ''} to go` : 'Ready to start') : null
  const panel = `track-panel-${t.id}`

  return (
    <Reveal as="li" id={t.id} className="relative scroll-mt-[76px] lg:scroll-mt-6" delay={delay} y={46} scale={0.985} blur={3} amount={0.5}>
      {/* spine segment down to the next box, drawn once the row has landed */}
      {!last && (
        <DrawLine vertical amount={0.5} delay={delay + 0.4} duration={1.1}
          className={cn('absolute top-[52px] bottom-[-4px] left-[19px] h-auto sm:left-[21px]', complete ? 'bg-foreground' : 'bg-line')} />
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panel}
        className="group relative flex w-full cursor-pointer items-center gap-4 py-2 text-left sm:gap-5"
      >
        <span
          className={cn(
            'relative z-10 flex size-10 shrink-0 items-center justify-center border font-mono text-[12px] transition-colors sm:size-11',
            complete ? 'border-foreground bg-foreground text-background' : isCurrent ? 'border-foreground bg-background text-foreground' : 'border-line-strong bg-background text-muted-foreground group-hover:border-foreground group-hover:text-foreground',
          )}
          style={isCurrent && !complete ? { boxShadow: '0 0 22px var(--viz-glow)' } : undefined}
        >
          {complete ? <Check className="size-4" strokeWidth={2.5} /> : String(t.n).padStart(2, '0')}
        </span>

        <span className={cn('flex min-w-0 flex-1 items-center gap-5 border-b py-3 transition-colors', open ? 'border-transparent' : 'border-line group-hover:border-line-strong')}>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase">
              {elective ? 'Elective' : 'Track'} {String(t.n).padStart(2, '0')}
              {status && <span className={cn('ml-2', isCurrent && !complete && 'text-foreground')}>· {status}</span>}
              {ready && <span className={cn('ml-2', !left && 'text-foreground')}>· {ready}</span>}
            </span>
            <span className={cn('mt-0.5 block text-[16.5px] leading-snug font-semibold tracking-[-.01em] sm:text-[19px]', !isCurrent && !complete && !open && 'text-foreground/85')}>{title}</span>
            <span className="mt-1 block font-mono text-[11px] text-muted-foreground sm:hidden">{n} / {total} done</span>
          </span>
          <span className="hidden w-36 shrink-0 sm:block">
            <Bar value={n / total} />
            <span className="mt-1.5 block text-right font-mono text-[11px] text-muted-foreground">{n} / {total} done</span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:text-foreground', open && 'rotate-180')} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panel}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.7, ease: EASE_WEIGHT }, opacity: { duration: 0.45, ease: 'linear' } }}
            className="overflow-hidden"
          >
            <div className="pt-1 pb-10 pl-14 sm:pl-16">
              <p className="max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">{t.summary}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
                <span>{total} lessons</span><span>{mins(t.minutes)}</span>
              </div>
              {t.goal && (
                <p className="mt-3 max-w-2xl text-[14px] leading-relaxed">
                  <span className="mr-2 font-mono text-[10.5px] tracking-[.08em] text-muted-foreground">GOAL</span>{t.goal}
                </p>
              )}
              {needs.length > 0 && (
                <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed">
                  <span className="mr-2 font-mono text-[10.5px] tracking-[.08em] text-muted-foreground">BUILDS ON</span>
                  {needs.map((x, i) => (
                    <span key={x}>{i > 0 && ', '}<Link className={cn('font-mono text-[12px] underline underline-offset-2', done[x] ? 'text-muted-foreground' : 'text-foreground')} to={`/learn/${x}`}>{path.byId[x].code}</Link></span>
                  ))}
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">{left ? `· ${left} still to do` : '· all done, ready to start'}</span>
                </p>
              )}

              <div className="mt-6 grid gap-6">
                {t.modules.map((m) => (
                  <div key={m.id}>
                    <div className="mb-1.5 font-mono text-[10.5px] tracking-[.12em] text-muted-foreground uppercase">{m.title}</div>
                    <ol className="border-t border-line">
                      {m.lessons.map((l) => {
                        const pl = path.byId[l.id]
                        const isDone = !!done[l.id]
                        const isNext = l.id === nextId
                        return (
                          <li key={l.id} className="border-b border-line">
                            <Link to={`/learn/${l.id}`}
                              className={cn('group/l grid grid-cols-[14px_3.2em_minmax(0,1fr)] items-center gap-3 px-2 py-2.5 transition-colors hover:bg-soft sm:grid-cols-[14px_3.4em_minmax(0,1fr)_auto]', isNext && 'bg-soft-2 hover:bg-soft-2')}>
                              <span className="relative flex size-[14px] items-center justify-center">
                                {isNext && <motion.span className="absolute inset-0 rounded-full border border-foreground" animate={{ scale: [1, 1.9], opacity: [0.8, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />}
                                <span className={cn('size-2.5 rounded-full border transition-colors', isDone ? 'border-foreground bg-foreground' : isNext ? 'border-foreground' : 'border-line-strong')} />
                              </span>
                              <span className="font-mono text-[11px] text-faint">{pl.code}</span>
                              <span className={cn('text-[15px] leading-snug', isDone && !isNext && 'text-muted-foreground')}>
                                {l.title}
                                {isNext && <span className="ml-2 inline-block bg-foreground px-1.5 py-px align-[2px] font-mono text-[9.5px] tracking-[.08em] text-background uppercase">Up next</span>}
                              </span>
                              <span className="hidden sm:inline"><Minutes m={l.minutes} /></span>
                            </Link>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reveal>
  )
}
