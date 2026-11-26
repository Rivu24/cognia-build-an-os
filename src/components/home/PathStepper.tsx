/* The nine core tracks as one numbered stepper, with the reader's place marked. */
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Check } from 'lucide-react'
import type { Path, PathLesson } from '@/lib/data'
import { useDone } from '@/lib/progress'
import { cn } from '@/lib/utils'
import { usePulse } from './hooks'
import { DrawLine, Magnetic, Reveal } from '@/components/motion'

function split(title: string) {
  const [head, ...rest] = title.split(/:\s*/)
  return { head, tail: rest.join(': ') }
}

export function PathStepper({ path, next, started }: { path: Path; next?: PathLesson; started: boolean }) {
  const done = useDone()
  const pulse = usePulse()
  const core = path.tracks.filter((t) => !t.elective)
  const electives = path.tracks.filter((t) => t.elective)
  const currentId = next && core.some((t) => t.id === next.track.id) ? next.track.id : undefined

  return (
    <div>
      <ol className="relative">
        {core.map((t, i) => {
          const n = t.lessons.filter((l) => done[l.id]).length
          const complete = n === t.lessons.length
          const current = t.id === currentId
          const { head, tail } = split(t.title)
          return (
            <Reveal as="li" key={t.id} className="relative" delay={(i % 3) * 0.07} y={44} scale={0.985} blur={3} amount={0.6}>
              {/* spine: drawn down to the next box once the row has landed */}
              {i < core.length - 1 && (
                <DrawLine vertical amount={0.6} delay={0.45 + (i % 3) * 0.07} duration={1.1}
                  className={cn('absolute top-10 bottom-0 left-[15px] h-auto', complete ? 'bg-foreground' : 'bg-line')} />
              )}
              <div className={cn('relative grid grid-cols-[32px_1fr] gap-x-5 pb-7 sm:gap-x-6', current && 'pb-9')}>
                <span className={cn('relative z-10 mt-0.5 inline-flex size-8 items-center justify-center font-mono text-[12px]',
                  current ? 'bg-foreground text-background' : complete ? 'border border-foreground bg-background text-foreground' : 'border border-line-strong bg-background text-muted-foreground')}>
                  {complete ? <Check className="size-4" /> : String(t.n).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  {current && (
                    <div className="eyebrow mb-1.5 flex items-center gap-2 text-foreground">
                      <motion.span className="dot size-1.5" {...pulse} />
                      {started ? 'You are here' : 'Start here'}
                    </div>
                  )}
                  <Link to={`/path#${t.id}`} className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <span className="min-w-0">
                      <span className={cn('text-[clamp(18px,1.7vw,22px)] leading-snug font-semibold tracking-[-.01em] group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4',
                        !current && !complete && 'text-foreground/85')}>{head}</span>
                      {tail && <span className="ml-2 text-[15px] text-muted-foreground max-sm:mt-0.5 max-sm:ml-0 max-sm:block">{tail}</span>}
                    </span>
                    <span className={cn('shrink-0 font-mono text-[12px] tabular-nums', n ? 'text-foreground' : 'text-faint')}>
                      {n} / {t.lessons.length}
                    </span>
                  </Link>
                  {current && next && <Magnetic className="mt-4 block max-w-[560px]" max={5}><NextButton next={next} started={started} /></Magnetic>}
                </div>
              </div>
            </Reveal>
          )
        })}
      </ol>

      <Reveal y={30} scale={1} blur={0} amount={0.5}>
        <Link to="/path#electives" className="group mt-2 grid grid-cols-[32px_1fr] gap-x-5 sm:gap-x-6">
          <span className="mt-1 inline-flex size-8 items-center justify-center border border-dashed border-line-strong font-mono text-[12px] text-faint">+{electives.length}</span>
          <span className="text-[15px] leading-relaxed text-muted-foreground transition-colors group-hover:text-foreground">
            Then {electives.length} electives, in any order: {electives.map((t) => shortElective(t.title)).join(', ')}.{' '}
            <ArrowRight className="inline size-3.5 -translate-y-px" />
          </span>
        </Link>
      </Reveal>
      {/* core finished, electives open: the next step lives here */}
      {next && !currentId && (
        <div className="grid grid-cols-[32px_1fr] gap-x-5 sm:gap-x-6">
          <span />
          <div className="mt-4"><NextButton next={next} started={started} /></div>
        </div>
      )}
    </div>
  )
}

function NextButton({ next, started }: { next: PathLesson; started: boolean }) {
  return (
    <Link to={`/learn/${next.id}`}
      className="flex max-w-[560px] items-center justify-between gap-4 bg-foreground py-3 pr-4 pl-5 text-background transition-opacity hover:opacity-85">
      <span className="min-w-0">
        <span className="block font-mono text-[11px] tracking-[.06em] uppercase opacity-70">{started ? 'Continue' : 'Start'} · {next.code}</span>
        <span className="block truncate text-[15px] font-medium">{next.title}</span>
      </span>
      <ArrowRight className="size-4 shrink-0" />
    </Link>
  )
}

function shortElective(title: string) {
  const t = title.replace(/^Elective:\s*/, '')
  const map: Record<string, string> = {
    'Drivers and Buses': 'drivers',
    'ACPI, APIC, Multicore and CPU Features': 'multicore',
    'Graphics, Sound and GUI': 'graphics and sound',
    Networking: 'networking',
    'Porting Software and Self-Hosting': 'self-hosting',
    'Beyond i686: 64-bit, UEFI, ARM and RISC-V': '64-bit and UEFI',
    'Design Revisited': 'design revisited',
  }
  return map[t] ?? t.split(/[:,]/)[0].toLowerCase()
}
