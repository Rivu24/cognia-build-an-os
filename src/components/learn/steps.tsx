/* The lesson's four steps (Watch, Read, Build, Done): one sticky bar, one hook that knows where the reader is. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion, useScroll, useSpring } from 'motion/react'
import { ArrowRight, Check } from 'lucide-react'
import type { PathLesson } from '@/lib/data'
import { Reveal, scrollToElement } from '@/components/motion'
import { cn } from '@/lib/utils'

export type StepId = 'watch' | 'read' | 'build' | 'done'
export type Step = { id: StepId; n: number; label: string }

const LABEL: Record<StepId, string> = { watch: 'Watch', read: 'Read', build: 'Build', done: 'Done' }

/** Lessons without an animation skip "Watch"; the numbers always run 1, 2, 3... */
export function lessonSteps(hasWatch: boolean): Step[] {
  const ids: StepId[] = hasWatch ? ['watch', 'read', 'build', 'done'] : ['read', 'build', 'done']
  return ids.map((id, i) => ({ id, n: i + 1, label: LABEL[id] }))
}

/** In-page jump with the site's glide (Lenis when it runs, native smooth scroll otherwise, a jump under reduced
    motion). Measured from layout, so a target that is still settling into place lands correctly. */
export function scrollToId(id: string) {
  scrollToElement(document.getElementById(id))
}

/** The step whose section has crossed 40% of the viewport; the last one once the page bottom is reached. */
export function useActiveStep(ids: string[], dep: unknown): string {
  const [active, setActive] = useState(ids[0])
  const key = ids.join(',')
  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const line = window.innerHeight * 0.4
      let cur = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) cur = id
      }
      // only once the reader has scrolled: a page still loading its reading is short, and would light up "Done" at the top
      const atBottom = window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom) cur = ids[ids.length - 1]
      setActive(cur)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dep])
  return active
}

export type BoxState = 'active' | 'past' | 'todo' | 'done'

/** State of a step marker. A finished lesson shows a tick on "Done", filled only while it is the current step,
    so the bar never shows two filled boxes at once. */
export function stepState(s: Step, i: number, ai: number, lessonDone: boolean): BoxState {
  if (s.id === 'done' && lessonDone) return i === ai ? 'done' : 'past'
  return i === ai ? 'active' : i < ai ? 'past' : 'todo'
}

/** Square numbered marker, shared by the step bar, the section heads and the rail. */
export function StepBox({ n, state, size = 'md', check }: { n: number; state: BoxState; size?: 'sm' | 'md' | 'lg'; check?: boolean }) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center border font-mono transition-colors duration-300',
        size === 'sm' && 'size-[22px] text-[10.5px]',
        size === 'md' && 'size-6 text-[11px]',
        size === 'lg' && 'size-10 text-[14px]',
        state === 'active' && 'border-foreground bg-foreground text-background',
        state === 'done' && 'border-foreground bg-foreground text-background',
        state === 'past' && 'border-foreground text-foreground',
        state === 'todo' && 'border-line-strong text-muted-foreground',
      )}
    >
      {state === 'done' || check ? <Check className={size === 'lg' ? 'size-4' : 'size-3'} strokeWidth={2.5} /> : n}
    </span>
  )
}

export function StepBar({ steps, active, lessonDone, next }: { steps: Step[]; active: string; lessonDone: boolean; next?: PathLesson }) {
  const ai = Math.max(0, steps.findIndex((s) => s.id === active))
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26 })
  return (
    <div className="sticky top-14 z-30 border-b border-line bg-background/90 backdrop-blur-md lg:top-0">
      <div className="flex h-[52px] items-center gap-4 px-4 sm:px-10 lg:px-14">
        <nav aria-label="Lesson steps" className="min-w-0">
          <ol className="flex items-center">
            {steps.map((s, i) => {
              const state = stepState(s, i, ai, lessonDone)
              const tick = s.id === 'done' && lessonDone
              return (
                <li key={s.id} className="flex items-center">
                  {i > 0 && <span aria-hidden className={cn('mx-1.5 h-px w-3 transition-colors duration-300 sm:mx-2.5 sm:w-6', i <= ai ? 'bg-foreground' : 'bg-line-strong')} />}
                  <button
                    type="button"
                    onClick={() => scrollToId(s.id)}
                    aria-current={i === ai ? 'step' : undefined}
                    aria-label={`Step ${s.n}: ${s.label}${tick ? ' (lesson done)' : ''}`}
                    className="group flex cursor-pointer items-center gap-2 py-2"
                  >
                    <StepBox n={s.n} state={state} check={tick} />
                    <span className={cn('text-[13px] font-medium transition-colors', i === ai ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>{s.label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
        {next && (
          <Link
            to={`/learn/${next.id}`}
            className="group ml-auto hidden min-w-0 items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground md:flex"
            title={`Next lesson: ${next.code} ${next.title}`}
          >
            <span className="shrink-0 font-mono text-[11px] tracking-[.08em] uppercase">Next</span>
            <span className="truncate text-foreground">{next.title}</span>
            <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      <motion.div aria-hidden className="absolute right-0 -bottom-px left-0 h-px origin-left bg-foreground" style={{ scaleX }} />
    </div>
  )
}

/** Heading for one step of the lesson: the same numbered box as the bar, then a plain title. */
export function StepHead({ step, title, aside, done }: { step: Step; title: React.ReactNode; aside?: React.ReactNode; done?: boolean }) {
  return (
    <Reveal y={22} scale={1} blur={0} duration={0.9} amount={0.6} className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex items-center gap-4">
        <StepBox n={step.n} state="past" check={done} size="lg" />
        <div>
          <div className="eyebrow">Step {step.n} · {step.label}</div>
          <h2 className="mt-0.5 text-[clamp(22px,2.4vw,30px)] leading-tight font-semibold tracking-[-.02em] text-balance">{title}</h2>
        </div>
      </div>
      {aside}
    </Reveal>
  )
}
