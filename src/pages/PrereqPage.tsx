/* Prerequisites: everything a kernel lesson takes for granted. One button to start, a self-check that picks the
   modules you need, then the six modules in order. */
import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { usePath } from '@/lib/data'
import { useDone } from '@/lib/progress'
import { useNextLesson } from '@/lib/next'
import { WIKI } from '@/components/brand'
import { useRail } from '@/components/layout/AppShell'
import { PageLoading, ErrorNote } from '@/components/layout/PageLoading'
import { makePlan, prereqModules, useAnswers } from '@/components/prereq/selfcheck'
import { PlanCard, SelfCheckList } from '@/components/prereq/CheckList'
import { ModuleList } from '@/components/prereq/ModuleList'
import { scrollToId } from '@/components/learn/steps'
import { PrereqRail } from '@/components/prereq/PrereqRail'
import { Bar } from '@/components/learn/bits'
import { CountUp, DrawLine, Magnetic, Reveal, RevealText } from '@/components/motion'
import { cn, mins } from '@/lib/utils'
import NotFound from './NotFound'

const pad = 'px-6 sm:px-10 lg:px-14'

export default function PrereqPage() {
  const { data: path, error } = usePath()
  const done = useDone()
  const answers = useAnswers()
  const { next: coreNext } = useNextLesson()

  const mods = useMemo(() => (path ? prereqModules(path) : []), [path])
  const plan = useMemo(() => makePlan(mods, answers, done), [mods, answers, done])
  const lessons = path?.prereq?.lessons ?? []
  const nDone = lessons.filter((l) => done[l.id]).length
  const firstOpen = lessons.find((l) => !done[l.id])
  // the one primary action: the plan if there is one, else the next prerequisite in order; the path once nothing is left
  const allKnown = plan.marked === mods.length && mods.length > 0 && plan.modules.length === 0
  const planDone = plan.modules.length > 0 && !plan.first
  const target = plan.first ?? (allKnown || planDone ? coreNext : firstOpen) ?? coreNext
  const currentModule = target?.section === 'prereq' ? target.module.id : undefined

  useRail(mods.length ? <PrereqRail mods={mods} done={done} answers={answers} current={currentModule} /> : null, [mods, done, answers, currentModule])

  if (error) return <ErrorNote error={error} />
  if (!path) return <PageLoading />
  if (!path.prereq) return <NotFound />

  const total = lessons.length
  const verb = nDone > 0 ? 'Continue' : 'Start'
  const kicker = !target ? 'All done'
    : target.section !== 'prereq' ? `Go to the path · ${target.code}`
    : plan.first ? `${verb} your plan · ${target.code}`
    : `${verb} · ${target.code}`

  return (
    <div>
      {/* ── hero: what this is, how far you are, one button ── */}
      <section className={cn('fall relative overflow-hidden border-b border-white/15 pt-12 pb-12 sm:pt-14', pad)}>
        <Reveal y={16} scale={1} blur={0} duration={0.9} className="font-mono text-[11.5px] tracking-[.08em] text-white/65 uppercase">
          Prerequisites · <CountUp value={total} /> lessons · about {Math.round(path.prereq.minutes / 60)} hours · optional
        </Reveal>
        <RevealText as="h1" delay={0.08} by="word" stagger={0.1} duration={1.35}
          className="mt-4 block max-w-3xl text-[clamp(38px,5.6vw,68px)] leading-[1.0] font-semibold tracking-[-.035em] text-balance text-white">
          Before you start.
        </RevealText>
        <Reveal delay={0.4} y={24} scale={1} blur={3}>
          <p className="mt-5 max-w-[620px] text-[17px] leading-relaxed text-white/80">
            The numbers, C, assembly and tools that every kernel lesson takes for granted, in {mods.length} short modules. Take only the ones you need: the self-check below tells you which.
          </p>
        </Reveal>

        <div className="mt-9 grid max-w-[1000px] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
          <Reveal delay={0.7} y={24} scale={1} blur={0} className="order-2 lg:pb-[38px]">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[15px] text-white"><b className="text-[26px] font-semibold tracking-[-.02em]"><CountUp value={nDone} delay={0.8} /></b><span className="text-white/60"> / {total} prerequisites done</span></span>
              {plan.modules.length > 0 && <span className="font-mono text-[11px] text-white/55">Plan · {mins(plan.minutes)} left</span>}
            </div>
            <Bar className="mt-3 bg-white/15" fill="bg-white" delay={0.8} value={nDone / Math.max(1, total)} />
          </Reveal>

          <Reveal delay={0.55} y={40} blur={4} className="order-1 flex flex-col items-start gap-4">
            {target ? (
              <Magnetic className="w-full max-w-[460px]">
                <Link to={`/learn/${target.id}`}
                  className="group flex w-full items-center justify-between gap-6 bg-white py-4 pr-5 pl-6 text-black transition-opacity hover:opacity-90">
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] tracking-[.08em] text-black/60 uppercase">{kicker}</span>
                    <span className="mt-0.5 block text-[17px] leading-snug font-medium">{target.title}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
                </Link>
              </Magnetic>
            ) : (
              <Link to="/path" className="inline-flex h-12 items-center gap-2 bg-white px-5 text-[15px] font-medium text-black">Review the path <ArrowRight className="size-4" /></Link>
            )}
            <button type="button" onClick={() => scrollToId('self-check')}
              className="cursor-pointer text-[14px] text-white/65 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white">
              Not sure what you need? Take the self-check
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── self-check and plan ── */}
      <section id="self-check" className={cn('scroll-mt-[56px] py-12 sm:py-14 lg:scroll-mt-0', pad)}>
        <Reveal y={12} scale={1} blur={0} duration={0.9} className="eyebrow mb-2">Self-check · {mods.length} modules</Reveal>
        <RevealText as="h2" delay={0.06} className="h-rule block text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-.02em]">Which modules do you need?</RevealText>
        <Reveal delay={0.25} y={16} scale={1} blur={0}>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Read each list. If you could do all of it today, mark it "I know this". Anything else goes into your plan. Your answers stay in this browser.
          </p>
        </Reveal>
        <div className="mt-8 grid max-w-[1160px] gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-12">
          <SelfCheckList mods={mods} answers={answers} />
          <div className="xl:sticky xl:top-6 xl:self-start">
            <Reveal delay={0.2} y={60} tilt={5} blur={0} duration={1.3} amount={0.3}>
              <PlanCard plan={plan} total={mods.length} coreNext={coreNext} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── the modules ── */}
      <section className={cn('relative py-12 sm:py-14', pad)}>
        <DrawLine className="absolute inset-x-0 top-0" amount={0} />
        <Reveal y={12} scale={1} blur={0} duration={0.9} className="eyebrow mb-2">The modules · in order</Reveal>
        <RevealText as="h2" delay={0.06} className="h-rule block text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-.02em]">Everything before Lesson 1.1.1</RevealText>
        <Reveal delay={0.25} y={16} scale={1} blur={0}>
          <p className="mt-3 mb-8 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Each lesson works like the rest of the site: watch the idea move, read the wiki article, then prove it with a short task.
          </p>
        </Reveal>
        <div className="max-w-[1160px]">
          <ModuleList mods={mods} done={done} answers={answers} nextId={target?.section === 'prereq' ? target.id : undefined} />
        </div>
        <Reveal y={24} scale={1} blur={0} amount={0.5} className="mt-10 flex max-w-[1160px] flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <p className="max-w-[60ch] text-[14px] leading-relaxed text-muted-foreground">
            Every reading in this section is an <a className="text-foreground underline decoration-line-strong underline-offset-2 hover:decoration-foreground" href={WIKI} target="_blank" rel="noopener">OSDev Wiki</a> article, shown in full and unedited. The wiki community wrote them and released them under CC0. <Link className="text-foreground underline decoration-line-strong underline-offset-2 hover:decoration-foreground" to="/credits">Credits</Link>.
          </p>
          <Link to="/path" className="group inline-flex items-center gap-2 text-[15px] font-medium">
            <span className="underline decoration-line-strong underline-offset-[6px] transition-colors group-hover:decoration-foreground">Go to the learning path</span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>
    </div>
  )
}
