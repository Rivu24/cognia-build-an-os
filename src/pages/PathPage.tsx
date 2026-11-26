/* The learning path. One answer to "what do I read next?" at the top; the track that holds it is open;
   every other track is one tidy row until you open it. */
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowRight, Check } from 'lucide-react'
import { usePath, type Path, type PathLesson } from '@/lib/data'
import { useDone } from '@/lib/progress'
import { useNextLesson, usePrereqProgress } from '@/lib/next'
import { useRail } from '@/components/layout/AppShell'
import { PageLoading, ErrorNote } from '@/components/layout/PageLoading'
import { TrackRow } from '@/components/learn/track-row'
import { Bar } from '@/components/learn/bits'
import { cn, LEVELS, mins } from '@/lib/utils'
import { CountUp, DrawLine, Magnetic, Reveal, RevealText, scrollToElement } from '@/components/motion'

const pad = 'px-6 sm:px-10 lg:px-14'

export default function PathPage() {
  const { error } = usePath()
  const info = useNextLesson()
  const { path, next } = info
  const done = useDone()
  const { hash, key } = useLocation()
  // explicit open/closed choices; a track nobody touched is open only if it holds the next lesson
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const nextTrack = next?.track.id

  useRail(path ? <TrackRail path={path} done={done} current={nextTrack} /> : null, [path, done, nextTrack])

  // #t4 (from the rail, the home page or a lesson breadcrumb): open that track and bring it into view
  useEffect(() => {
    if (!path || !hash) return
    const id = decodeURIComponent(hash.slice(1))
    if (path.tracks.some((t) => t.id === id)) setOpen((o) => ({ ...o, [id]: true }))
    // measured from layout (a row still settling into place lands right) and with the site's glide
    const tm = window.setTimeout(() => scrollToElement(document.getElementById(id)), 120)
    return () => window.clearTimeout(tm)
  }, [path, hash, key])

  if (error) return <ErrorNote error={error} />
  if (!path) return <PageLoading />

  const core = path.tracks.filter((t) => !t.elective)
  const electives = path.tracks.filter((t) => t.elective)
  const isOpen = (id: string) => open[id] ?? id === nextTrack
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !isOpen(id) }))

  return (
    <div>
      {/* ── hero: progress + one big "up next" ── */}
      <section className={cn('fall relative overflow-hidden border-b border-white/15 pt-12 pb-12 sm:pt-14', pad)}>
        <div className="relative grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)] xl:items-end xl:gap-14">
          <div>
            <Reveal y={16} scale={1} blur={0} duration={0.9} className="font-mono text-[11.5px] tracking-[.08em] text-white/65 uppercase">
              Learning path · <CountUp value={path.lessons.length} /> lessons · about {Math.round(path.totalMinutes / 60)} hours
            </Reveal>
            <RevealText as="h1" delay={0.08}
              className="mt-4 block max-w-3xl text-[clamp(34px,5vw,60px)] leading-[1.02] font-semibold tracking-[-.03em] text-balance">
              From power-on to your own userland.
            </RevealText>
            <Reveal delay={0.4} y={24} scale={1} blur={3}>
              <p className="mt-4 max-w-xl text-[16.5px] leading-relaxed text-white/80">Nine core tracks build one kernel, in order. Electives come once the core runs.</p>
            </Reveal>

            <Reveal delay={0.55} y={24} scale={1} blur={0} className="mt-9 max-w-xl">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[15px] text-white"><b className="text-[26px] font-semibold tracking-[-.02em]"><CountUp value={info.coreDone} delay={0.7} /></b><span className="text-white/60"> / {info.coreTotal} core lessons done</span></span>
                <span className="font-mono text-[11px] text-white/55">All {info.allDone} / {info.allTotal}</span>
              </div>
              <Bar className="mt-3 bg-white/15" fill="bg-white" delay={0.7} value={info.coreDone / Math.max(1, info.coreTotal)} />
            </Reveal>
          </div>

          <UpNext next={next} started={info.started} />
        </div>
      </section>

      {/* ── core tracks ── */}
      <section className={cn('py-12 sm:py-14', pad)}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Reveal y={12} scale={1} blur={0} duration={0.9} className="eyebrow mb-2">Core path</Reveal>
            <RevealText as="h2" delay={0.06} className="h-rule block text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-.02em]">Take these in order</RevealText>
          </div>
          <Reveal delay={0.3} y={12} scale={1} blur={0} className="font-mono text-[11px] text-muted-foreground">Open any track to see its lessons</Reveal>
        </div>
        <Reveal y={40} blur={0} amount={0.5}>
          <PrereqRow />
        </Reveal>
        <ol className="max-w-[1000px]">
          {core.map((t, i) => (
            <TrackRow key={t.id} path={path} track={t} done={done} open={isOpen(t.id)} onToggle={() => toggle(t.id)}
              nextId={next?.id} isCurrent={t.id === nextTrack} last={i === core.length - 1} delay={(i % 3) * 0.07} />
          ))}
        </ol>
      </section>

      {/* ── electives ── */}
      <section id="electives" className={cn('relative scroll-mt-[76px] py-12 sm:py-14 lg:scroll-mt-6', pad)}>
        <DrawLine className="absolute inset-x-0 top-0" amount={0} />
        <Reveal y={12} scale={1} blur={0} duration={0.9} className="eyebrow mb-2">Electives · {electives.length} tracks</Reveal>
        <RevealText as="h2" delay={0.06} className="h-rule mb-3 block text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-.02em]">Pick by goal once the core runs</RevealText>
        <Reveal delay={0.25} y={16} scale={1} blur={0}>
          <p className="mb-8 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">Each elective names the core lessons it builds on and tells you when you have finished them.</p>
        </Reveal>
        <ol className="max-w-[1000px]">
          {electives.map((t, i) => (
            <TrackRow key={t.id} path={path} track={t} done={done} open={isOpen(t.id)} onToggle={() => toggle(t.id)}
              nextId={next?.id} isCurrent={t.id === nextTrack} last={i === electives.length - 1} elective delay={(i % 3) * 0.07} />
          ))}
        </ol>
      </section>
    </div>
  )
}

/* The optional Prerequisites section, one slim row above Track 1. */
function PrereqRow() {
  const { done, total, path } = usePrereqProgress()
  if (!path?.prereq || !total) return null
  const complete = done === total
  return (
    <Link to="/basics" className="group mb-6 flex max-w-[1000px] items-center gap-4 border border-dashed border-line-strong py-3 pr-4 pl-3 transition-colors hover:border-foreground sm:gap-5">
      <span className="flex size-10 shrink-0 items-center justify-center border border-line-strong font-mono text-[12px] text-muted-foreground transition-colors group-hover:border-foreground group-hover:text-foreground sm:size-11">
        {complete ? <Check className="size-4" strokeWidth={2.5} /> : 'P'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase">Prerequisites · {total} lessons · optional</span>
        <span className="mt-0.5 block text-[15px] leading-snug sm:text-[16px]">New to C, assembly or the command line? Start here.</span>
        <span className="mt-1 block font-mono text-[11px] text-muted-foreground sm:hidden">{done} / {total} done</span>
      </span>
      <span className="hidden w-36 shrink-0 sm:block">
        <Bar value={done / total} />
        <span className="mt-1.5 block text-right font-mono text-[11px] text-muted-foreground">{done} / {total} done</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  )
}

function UpNext({ next, started }: { next?: PathLesson; started: boolean }) {
  if (!next) {
    return (
      <Reveal delay={0.3} y={70} tilt={6} blur={0} duration={1.3} className="border border-white/25 bg-black/35 p-6 backdrop-blur-sm sm:p-8">
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-[.1em] text-white/60 uppercase"><Check className="size-3.5" /> All done</div>
        <div className="mt-3 text-[24px] leading-tight font-semibold tracking-[-.02em] text-white">Every lesson in the path is done.</div>
        <p className="mt-2 text-[14.5px] text-white/70">The library keeps every wiki article for anything you want to revisit.</p>
        <Link to="/library" className="mt-6 inline-flex h-11 items-center gap-2 bg-white px-5 text-sm font-medium text-black transition-opacity hover:opacity-90">Open the library <ArrowRight className="size-4" /></Link>
      </Reveal>
    )
  }
  return (
    <Reveal delay={0.3} y={70} tilt={6} blur={0} duration={1.3}
      className="relative border border-white/30 bg-black/40 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-white/15 px-6 py-3 sm:px-7">
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[.1em] text-white uppercase"><span className="dot" /> {started ? 'Up next' : 'Start here'}</span>
        <span className="font-mono text-[11px] text-white/55">Lesson {next.code}</span>
      </div>
      <div className="px-6 pt-5 pb-6 sm:px-7">
        <div className="font-mono text-[11px] tracking-[.04em] text-white/60">Track {next.trackN} · {next.track.title.replace(/^Elective:\s*/, '')}</div>
        <div className="mt-2 text-[clamp(22px,2.4vw,28px)] leading-[1.15] font-semibold tracking-[-.02em] text-balance text-white">{next.title}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-white/70">
          <span>{mins(next.minutes)}</span>
          {next.level > 0 && (
            <span className="inline-flex items-center gap-1.5" title={`Difficulty: ${LEVELS[next.level]}`}>
              <span className="inline-flex gap-[3px]">
                {[0, 1, 2, 3].map((i) => <span key={i} className={cn('size-1.5 rounded-full border border-white/60', i < next.level && 'border-white bg-white')} />)}
              </span>
              {LEVELS[next.level]}
            </span>
          )}
        </div>
        <Magnetic className="mt-6 block w-full" max={5}>
          <Link to={`/learn/${next.id}`}
            className="group flex h-12 w-full items-center justify-between bg-white px-5 text-[15px] font-medium text-black transition-opacity hover:opacity-90">
            {started ? 'Continue' : 'Start'} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Magnetic>
      </div>
    </Reveal>
  )
}

function TrackRail({ path, done, current }: { path: Path; done: Record<string, number>; current?: string }) {
  const group = (label: string, tracks: Path['tracks']) => (
    <>
      <div className="label mt-4 mb-1.5 flex items-center gap-2 px-5 first:mt-2"><span className="dot" /> {label}</div>
      {tracks.map((t) => {
        const n = t.lessons.filter((l) => done[l.id]).length
        const cur = t.id === current
        return (
          <Link key={t.id} to={{ pathname: '/path', hash: t.id }}
            className={cn('ml-5 flex gap-2 border-l-2 py-1 pr-4 pl-4 text-[12.5px] leading-snug transition-colors',
              cur ? 'border-foreground text-foreground' : 'border-line text-muted-foreground hover:text-foreground')}>
            <span className="w-6 shrink-0 font-mono text-[10.5px] text-faint">{n === t.lessons.length ? '✓' : String(t.n).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1">{t.title.replace(/^Elective:\s*/, '')}</span>
            <span className="shrink-0 font-mono text-[10px] text-faint">{n}/{t.lessons.length}</span>
          </Link>
        )
      })}
    </>
  )
  const pre = path.prereq?.lessons ?? []
  const preDone = pre.filter((l) => done[l.id]).length
  return (
    <div>
      {pre.length > 0 && (
        <>
          <div className="label mt-2 mb-1.5 flex items-center gap-2 px-5"><span className="dot" /> Optional</div>
          <Link to="/basics" className="ml-5 flex gap-2 border-l-2 border-line py-1 pr-4 pl-4 text-[12.5px] leading-snug text-muted-foreground transition-colors hover:text-foreground">
            <span className="w-6 shrink-0 font-mono text-[10.5px] text-faint">{preDone === pre.length ? '✓' : 'P'}</span>
            <span className="min-w-0 flex-1">Prerequisites</span>
            <span className="shrink-0 font-mono text-[10px] text-faint">{preDone}/{pre.length}</span>
          </Link>
        </>
      )}
      {group('Core tracks', path.tracks.filter((t) => !t.elective))}
      {group('Electives', path.tracks.filter((t) => t.elective))}
    </div>
  )
}
