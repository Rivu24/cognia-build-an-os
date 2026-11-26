/* The six prerequisite modules: what each covers, its lessons, and how far you are. */
import { Link } from 'react-router'
import { Play } from 'lucide-react'
import { conceptsForLesson } from '@/viz/registry'
import { Bar } from '@/components/learn/bits'
import { DrawLine, Reveal, Stagger, StaggerItem } from '@/components/motion'
import { cn, mins } from '@/lib/utils'
import type { Answers, PrereqModule } from './selfcheck'

const TAG: Record<string, string> = { know: 'You know this', unsure: 'In your plan', new: 'In your plan' }

export function ModuleList({ mods, done, answers, nextId }: { mods: PrereqModule[]; done: Record<string, number>; answers: Answers; nextId?: string }) {
  return (
    <div className="relative">
      <DrawLine className="absolute inset-x-0 top-0" amount={0} />
      {mods.map((m) => {
        const n = m.lessons.filter((l) => done[l.id]).length
        const anim = new Set(m.lessons.flatMap((l) => conceptsForLesson(l.id).map((c) => c.meta.id))).size
        const tag = answers[m.id] ? TAG[answers[m.id]] : null
        return (
          <Reveal as="article" key={m.id} id={`module-${m.id}`} y={64} tilt={4} blur={3} duration={1.25} amount={0.2}
            className="relative grid scroll-mt-[76px] gap-6 py-9 lg:scroll-mt-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-12">
            <DrawLine className="absolute inset-x-0 bottom-0" amount={0} delay={0.3} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">
                <span>Module {String(m.n).padStart(2, '0')}</span>
                {n === m.lessons.length && <span className="text-foreground">· Done</span>}
                {tag && n < m.lessons.length && <span className={cn(answers[m.id] !== 'know' && 'text-foreground')}>· {tag}</span>}
              </div>
              <h3 className="mt-2 text-[clamp(22px,2.3vw,28px)] leading-tight font-semibold tracking-[-.02em] text-balance">{m.title}</h3>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">{m.summary}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
                <span>{m.lessons.length} lessons</span>
                <span>{mins(m.minutes)}</span>
                {anim > 0 && <span>{anim} animation{anim > 1 ? 's' : ''}</span>}
              </div>
              <div className="mt-5 max-w-[320px]">
                <Bar value={n / m.lessons.length} />
                <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">{n} / {m.lessons.length} done</div>
              </div>
            </div>

            <Stagger as="ol" delay={0.25} stagger={0.06} amount={0.2} className="min-w-0 self-start border-t border-line">
              {m.lessons.map((l) => {
                const isDone = !!done[l.id]
                const isNext = l.id === nextId
                const a = conceptsForLesson(l.id).length
                return (
                  <StaggerItem as="li" key={l.id} y={18} blur={0} duration={0.9} className="border-b border-line">
                    <Link to={`/learn/${l.id}`}
                      className={cn('grid grid-cols-[14px_2.8em_minmax(0,1fr)] items-start gap-3 px-2 py-2.5 transition-colors hover:bg-soft sm:grid-cols-[14px_2.8em_minmax(0,1fr)_auto]', isNext && 'bg-soft-2 hover:bg-soft-2')}>
                      <span className="flex h-[21px] w-[14px] items-center justify-center">
                        <span className={cn('size-2.5 rounded-full border', isDone ? 'border-foreground bg-foreground' : isNext ? 'border-foreground' : 'border-line-strong')} />
                      </span>
                      <span className="font-mono text-[11px] leading-[21px] text-faint">{l.code}</span>
                      <span className={cn('min-w-0 text-[15px] leading-[21px]', isDone && !isNext && 'text-muted-foreground')}>
                        {l.title}
                        {isNext && <span className="ml-2 inline-block bg-foreground px-1.5 py-px align-[2px] font-mono text-[9.5px] tracking-[.08em] text-background uppercase">Up next</span>}
                        <span className="mt-0.5 block font-mono text-[10.5px] text-muted-foreground sm:hidden">{mins(l.minutes)}{a > 0 && ` · ${a} animation${a > 1 ? 's' : ''}`}{isDone && ' · done'}</span>
                      </span>
                      <span className="hidden h-[21px] items-center gap-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground sm:flex">
                        {a > 0 && <span className="inline-flex items-center gap-1" title={`${a} animation${a > 1 ? 's' : ''}`}><Play className="size-3" /> {a}</span>}
                        <span>{mins(l.minutes)}</span>
                      </span>
                    </Link>
                  </StaggerItem>
                )
              })}
            </Stagger>
          </Reveal>
        )
      })}
    </div>
  )
}
