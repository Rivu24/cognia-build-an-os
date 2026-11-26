/* Side rail on a lesson: where you are on this page, then the lessons of this module. Nothing else. */
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import type { PathLesson } from '@/lib/data'
import { useDone } from '@/lib/progress'
import { cn } from '@/lib/utils'
import { scrollToId, StepBox, stepState, type Step } from './steps'

const row = 'ml-5 flex items-center gap-2.5 border-l-2 py-1.5 pr-4 pl-3.5 text-[12.5px] leading-snug transition-colors'

export function LessonRail({
  lesson,
  steps,
  active,
  readings,
  reading,
  onReading,
}: {
  lesson: PathLesson
  steps: Step[]
  active: string
  readings: string[]
  reading: number
  onReading: (i: number) => void
}) {
  const done = useDone()
  const ai = Math.max(0, steps.findIndex((s) => s.id === active))
  const lessons = lesson.module.lessons
  const nDone = lessons.filter((l) => done[l.id]).length
  const isPrereq = lesson.section === 'prereq'
  return (
    <div>
      <div className="label mt-2 mb-1.5 flex items-center gap-2 px-5"><span className="dot" /> This lesson</div>
      {steps.map((s, i) => (
        <div key={s.id}>
          <a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); scrollToId(s.id) }}
            className={cn(row, i === ai ? 'border-foreground text-foreground' : 'border-line text-muted-foreground hover:text-foreground')}>
            <StepBox n={s.n} size="sm" state={stepState(s, i, ai, !!done[lesson.id])} check={s.id === 'done' && !!done[lesson.id]} />
            <span>{s.label}</span>
          </a>
          {s.id === 'read' && readings.length > 1 && readings.map((t, ri) => (
            <a key={t} href="#readings" onClick={(e) => { e.preventDefault(); onReading(ri); requestAnimationFrame(() => scrollToId('readings')) }}
              className={cn('ml-5 flex gap-2 border-l-2 border-line py-1 pr-4 pl-[46px] text-[12px] leading-snug transition-colors',
                ri === reading ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <span className="shrink-0 font-mono text-[10px] text-faint">{ri + 1}/{readings.length}</span>
              <span className="truncate">{t}</span>
            </a>
          ))}
        </div>
      ))}

      <div className="mt-6 mb-1.5 flex items-baseline justify-between gap-2 px-5">
        <span className="label flex min-w-0 items-center gap-2"><span className="dot" /> <span className="truncate">{lesson.module.title}</span></span>
        <span className="shrink-0 font-mono text-[10.5px] text-faint">{nDone}/{lessons.length}</span>
      </div>
      {lessons.map((l, i) => {
        const cur = l.id === lesson.id
        const code = isPrereq ? `P${lesson.moduleN}.${i + 1}` : `${lesson.trackN}.${lesson.moduleN}.${i + 1}`
        return (
          <Link key={l.id} to={`/learn/${l.id}`} aria-current={cur ? 'page' : undefined}
            className={cn(row, 'items-start', cur ? 'border-foreground text-foreground' : 'border-line text-muted-foreground hover:text-foreground')}>
            <span className="mt-[5px] flex size-[22px] shrink-0 justify-center">
              <span className={cn('size-2 rounded-full border', done[l.id] ? 'border-foreground bg-foreground' : cur ? 'border-foreground' : 'border-line-strong')} />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[10px] text-faint">{code}{cur ? ' · you are here' : done[l.id] ? ' · done' : ''}</span>
              <span className={cn('block', cur && 'font-medium')}>{l.title}</span>
            </span>
          </Link>
        )
      })}
      <Link to={isPrereq ? '/basics' : `/path#${lesson.track.id}`} className="mt-3 ml-5 flex items-center gap-1.5 py-1 pl-4 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground">
        {isPrereq ? 'All prerequisites' : `All of track ${lesson.trackN}`} <ArrowRight className="size-3" />
      </Link>
    </div>
  )
}
