/* The lesson player. Four numbered steps, always in the same order: Watch, Read, Build, Done.
   A sticky bar shows where you are and what comes next; everything optional is folded away. */
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, Hammer, LifeBuoy, ListChecks, PenLine, Plus, Terminal } from 'lucide-react'
import { getArticle, slugify, usePath, type Article } from '@/lib/data'
import { useDone } from '@/lib/progress'
import { prereqNextAfter, useAnswers } from '@/components/prereq/selfcheck'
import { useRail } from '@/components/layout/AppShell'
import { PageLoading, ErrorNote } from '@/components/layout/PageLoading'
import { Level, Minutes, CopyToggle } from '@/components/learn/bits'
import { Disclosure } from '@/components/learn/disclosure'
import { lessonSteps, StepBar, StepHead, useActiveStep, type Step } from '@/components/learn/steps'
import { Readings, readMins } from '@/components/learn/readings'
import { DoneCard } from '@/components/learn/done-card'
import { LessonRail } from '@/components/learn/lesson-rail'
import { PrereqCallout } from '@/components/learn/prereq-callout'
import { conceptsForLesson } from '@/viz/registry'
import { Reveal, RevealText } from '@/components/motion'
import { cn, trunc } from '@/lib/utils'
import NotFound from './NotFound'

const STUCK = ['Troubleshooting', 'Triple Fault', 'Kernel Debugging', "I Can't Get Interrupts Working", 'My Bootloader Does Not Work',
  "James Molloy's Tutorial Known Bugs", "Bran's Kernel Development Tutorial Known Bugs", "Brokenthorn's Known Bugs", 'Posting Checklist']

/** at most this many animations are on screen before "show more" */
const WATCH_MAX = 2

const pad = 'px-6 sm:px-10 lg:px-14'
const section = cn('scroll-mt-[116px] border-b border-line py-12 sm:py-14 lg:scroll-mt-[60px]', pad)
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
/** where the checkpoint happens: only 40 of 132 run in QEMU; the early ones are notes, sums and host tools */
const where = (c: string) =>
  /\bqemu\b/i.test(c) ? 'In QEMU'
  : /\b(notes|by hand|draw|write down|score yourself|write your|write five|decisions\.md)\b/i.test(c) ? 'On paper'
  : 'On your machine'
/** keeps compiler flags such as -O2 on one line ("fails at -" / "O2" otherwise) */
const keepFlags = (t: string) => t.split(/((?<=^|\s)-[A-Za-z][\w=-]*)/).map((p, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{p}</span> : p))
const objective = (o: string) => cap(o.replace(/^After this lesson,? you can /i, '').replace(/\.$/, ''))

export default function LessonPage() {
  const { id = '' } = useParams()
  const { data: path, error } = usePath()
  const done = useDone()
  const lesson = path?.byId[id]
  const [arts, setArts] = useState<Article[] | null>(null)
  const [further, setFurther] = useState<Article[]>([])
  const [reading, setReading] = useState(0)
  const [seen, setSeen] = useState<Set<number>>(() => new Set())
  const [moreViz, setMoreViz] = useState(false)

  useEffect(() => {
    setArts(null)
    setFurther([])
    setReading(0)
    setSeen(new Set())
    setMoreViz(false)
    if (!lesson) return
    let live = true
    Promise.all(lesson.articles.map((t) => getArticle(slugify(t)))).then((a) => live && setArts(a))
    Promise.all(lesson.further.map((t) => getArticle(slugify(t)).catch(() => null))).then((a) => live && setFurther(a.filter(Boolean) as Article[]))
    return () => { live = false }
  }, [lesson])

  const concepts = useMemo(() => (lesson ? conceptsForLesson(lesson.id) : []), [lesson])
  const steps = useMemo(() => lessonSteps(concepts.length > 0), [concepts.length])
  const active = useActiveStep(steps.map((s) => s.id), `${lesson?.id}-${!!arts}-${reading}-${moreViz}`)
  const step = (sid: Step['id']) => steps.find((s) => s.id === sid)!

  // the lesson the final button leads to: the next open lesson after this one, counting this one as done
  // (inside Prerequisites it follows the self-check plan, then goes on to the core path)
  const answers = useAnswers()
  const upNext = useMemo(() => (path && lesson ? prereqNextAfter(path, { ...done, [lesson.id]: 1 }, answers, lesson.id) : undefined), [path, lesson, done, answers])

  const pick = (i: number) => {
    setSeen((s) => new Set(s).add(reading))
    setReading(i)
  }

  useRail(
    lesson && path ? <LessonRail lesson={lesson} steps={steps} active={active} readings={lesson.articles} reading={reading} onReading={pick} /> : null,
    [lesson?.id, steps, active, done, reading],
  )

  if (error) return <ErrorNote error={error} />
  if (!path) return <PageLoading />
  if (!lesson) return <NotFound />

  // idx counts within the lesson's own list: the Prerequisites section has its own order
  const isPrereq = lesson.section === 'prereq'
  const order = isPrereq ? (path.prereq?.lessons ?? []) : path.lessons
  const prev = order[lesson.idx - 1]
  const after = order[lesson.idx + 1]
  const isDone = !!done[lesson.id]
  const prereqs = lesson.prereq.map((p) => path.byId[p]).filter(Boolean)
  const recall = lesson.prereq.slice(0, 3).map((p) => path.byId[p]).filter((p) => p?.objectives?.length)
  const shown = moreViz ? concepts : concepts.slice(0, WATCH_MAX)
  const readTotal = arts ? arts.reduce((s, a) => s + readMins(a), 0) : 0

  return (
    <article className="[&_.prose-wiki_[id]]:scroll-mt-[124px] lg:[&_.prose-wiki_[id]]:scroll-mt-[72px]">
      {/* ── header ── */}
      <header className={cn('pt-10 pb-9 sm:pt-12', pad)}>
        <Reveal key={`${lesson.id}-crumb`} as="nav" aria-label="Breadcrumb" y={12} scale={1} blur={0} duration={0.8} className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
          {isPrereq
            ? <Link className="transition-colors hover:text-foreground" to="/basics">Prerequisites</Link>
            : <Link className="transition-colors hover:text-foreground" to={`/path#${lesson.track.id}`} title={lesson.track.title}>Track {lesson.trackN}</Link>}
          <span aria-hidden>·</span>
          <span>{lesson.module.title}</span>
        </Reveal>
        {/* the header settles in (short delays: the reading below is on screen at once) */}
        <RevealText as="h1" delay={0.05} duration={1.15}
          className="mt-4 block max-w-4xl text-[clamp(32px,4.4vw,54px)] leading-[1.04] font-semibold tracking-[-.03em] text-balance">
          {lesson.title}
        </RevealText>
        <Reveal key={`${lesson.id}-why`} delay={0.25} y={20} scale={1} blur={3} duration={1}>
          <p className="mt-4 max-w-[680px] text-[17px] leading-relaxed text-muted-foreground">
            {keepFlags(lesson.why)}
          </p>
        </Reveal>
        <Reveal key={`${lesson.id}-meta`} delay={0.38} y={14} scale={1} blur={0} duration={0.9} className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-mono text-[11px] text-muted-foreground">{isPrereq ? 'Prerequisite' : 'Lesson'} {lesson.code}</span>
          <Minutes m={lesson.minutes} />
          <Level n={lesson.level} />
          {isDone && <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-foreground"><Check className="size-3.5" strokeWidth={2.5} /> Done</span>}
        </Reveal>
        {lesson.id === 't1m1l2' && path.prereq && <PrereqCallout path={path} done={done} />}
      </header>

      <StepBar steps={steps} active={active} lessonDone={isDone} next={upNext} />

      {/* ── 1 watch ── */}
      {concepts.length > 0 && (
        <section id="watch" className={section}>
          <StepHead step={step('watch')} title="See the idea move" />
          <div className="grid max-w-[1000px] grid-cols-[minmax(0,1fr)] gap-8">
            <AnimatePresence initial={false}>
              {shown.map((c) => (
                <motion.div key={c.meta.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="min-w-0">
                  <Reveal key={`${lesson.id}-${c.meta.id}`} y={56} tilt={4} blur={0} duration={1.25} amount={0.15}>
                    <c.default />
                  </Reveal>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="mt-5 flex max-w-[1000px] flex-wrap items-center justify-between gap-3">
            <p className="text-[13.5px] text-muted-foreground">Step through with the arrows, or let it play. The numbers are worked examples you can check against the reading.</p>
            {concepts.length > WATCH_MAX && (
              <button type="button" onClick={() => setMoreViz((v) => !v)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 border border-line px-3 font-mono text-[11.5px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
                <Plus className={cn('size-3.5 transition-transform', moreViz && 'rotate-45')} />
                {moreViz ? 'Show fewer' : `${concepts.length - WATCH_MAX} more animation${concepts.length - WATCH_MAX > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── 2 read ── */}
      <section id="read" className={section}>
        <StepHead step={step('read')}
          title={lesson.articles.length > 1 ? `Read ${lesson.articles.length} wiki articles` : 'Read the wiki article'}
          aside={<div className="flex items-center gap-4">{readTotal > 0 && <span className="font-mono text-[11px] text-muted-foreground">about {readTotal} min</span>}<CopyToggle /></div>} />

        {/* goals first, then the optional warm-up */}
        <div className="mb-10 grid max-w-[760px] gap-3">
          <div className="border border-line px-5 py-4 sm:px-6">
            <div className="mb-3 flex items-center gap-2 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase"><ListChecks className="size-3.5" /> After this lesson you can</div>
            <ul className="space-y-2 text-[15.5px] leading-relaxed">
              {lesson.objectives.map((o, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-[9px] h-px w-3 shrink-0 bg-foreground" />
                  <span>{objective(o)}</span>
                </li>
              ))}
            </ul>
          </div>
          {prereqs.length > 0 && (
            <Disclosure title="Before you start"
              hint={[recall.length && `${recall.length} recall question${recall.length > 1 ? 's' : ''}`, `${prereqs.length} earlier lesson${prereqs.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}>
              {recall.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">Recall first (no score)</div>
                  <ul className="space-y-2 text-[14.5px] leading-relaxed">
                    {recall.map((p) => {
                      const q = p.objectives[0].replace(/^(After this lesson,? )?you can /i, '').replace(/\.$/, '')
                      return (
                        <li key={p.id} className="flex gap-2.5">
                          <span className={cn('mt-[8px] size-1.5 shrink-0 rounded-full border border-foreground', done[p.id] && 'bg-foreground')} />
                          <span>Can you still {q.charAt(0).toLowerCase() + q.slice(1)}?</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              <div className="mb-2 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">Builds on</div>
              <ul className="border-t border-line">
                {prereqs.map((p) => (
                  <li key={p.id} className="border-b border-line">
                    <Link to={`/learn/${p.id}`} className="group flex items-center gap-3 px-1 py-2.5 text-[14.5px] transition-colors hover:bg-soft">
                      <span className="w-[3.4em] shrink-0 font-mono text-[11px] text-faint">{p.code}</span>
                      <span className="min-w-0 flex-1">{p.title}</span>
                      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">{done[p.id] ? 'done' : 'not done'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </div>

        <Readings arts={arts} titles={lesson.articles} current={reading} seen={seen} onPick={pick}
          nextStepId="build" nextStepLabel={`Go to step ${step('build').n}: Build`} />
      </section>

      {/* ── 3 build ── */}
      <section id="build" className={section}>
        <StepHead step={step('build')} title="Prove it works" />
        <Reveal key={`${lesson.id}-task`} y={48} tilt={4} blur={0} duration={1.2} amount={0.35}
          className="max-w-[760px] border border-foreground">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
            <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase"><Hammer className="size-3.5" /> Checkpoint · your task</span>
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[.06em] text-muted-foreground uppercase">{where(lesson.checkpoint) === 'On paper' ? <PenLine className="size-3.5" /> : <Terminal className="size-3.5" />} {where(lesson.checkpoint)}</span>
          </div>
          <p className="px-5 py-6 text-[18px] leading-relaxed sm:px-6 sm:text-[19px]">{lesson.checkpoint}</p>
        </Reveal>
        <p className="mt-4 max-w-[760px] text-[14px] leading-relaxed text-muted-foreground">
          Do this before you move on. When it works, go to step {step('done').n}. If it does not, open "Stuck" under step {step('done').n}: it lists the pages that cover the usual causes.
        </p>
      </section>

      {/* ── 4 done ── */}
      <section id="done" className={cn('scroll-mt-[116px] pt-12 pb-16 sm:pt-14 lg:scroll-mt-[60px]', pad)}>
        <DoneCard key={lesson.id} step={step('done')} lesson={lesson} isDone={isDone} next={upNext} />

        <Disclosure className="mt-4 max-w-[920px]" icon={<LifeBuoy className="size-4" />} title="Stuck, or want to go further?"
          hint={further.length ? `${STUCK.length + 1} help pages · ${further.length} optional reading${further.length > 1 ? 's' : ''}` : `${STUCK.length + 1} help pages`}>
          <div className="mb-2 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">Stuck?</div>
          <div className="flex flex-wrap gap-1.5">
            {STUCK.map((t) => (
              <Link key={t} to={`/library/${slugify(t)}`} className="border border-line px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">{t}</Link>
            ))}
            <a href="https://forum.osdev.org/" target="_blank" rel="noopener" className="border border-line px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">OSDev forum ↗</a>
          </div>
          {further.length > 0 && (
            <>
              <div className="mt-6 mb-2 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">Go deeper (optional)</div>
              <ul className="border-t border-line">
                {further.map((a) => (
                  <li key={a.slug} className="border-b border-line">
                    <Link to={`/library/${a.slug}`} className="block px-1 py-3 transition-colors hover:bg-soft">
                      <b className="block text-[14.5px] font-medium">{a.title}</b>
                      <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{trunc(a.summary, 170)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Disclosure>

        {/* prev / next in path order: quiet */}
        <nav aria-label="Lesson order" className="mt-10 flex max-w-[920px] flex-wrap items-start justify-between gap-x-8 gap-y-3 text-[13px]">
          {prev ? (
            <Link to={`/learn/${prev.id}`} className="group flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="size-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
              <span className="font-mono text-[11px] text-faint">{prev.code}</span><span className="truncate">{prev.title}</span>
            </Link>
          ) : <span />}
          {after && (
            <Link to={`/learn/${after.id}`} className="group ml-auto flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
              <span className="font-mono text-[11px] text-faint">{after.code}</span><span className="truncate">{after.title}</span>
              <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </nav>
      </section>
    </article>
  )
}
