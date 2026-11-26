import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { CONCEPTS, GROUPS, byId } from '@/viz/registry'
import { usePath } from '@/lib/data'
import { useRail } from '@/components/layout/AppShell'
import { SectionTitle } from '@/components/learn/bits'
import { CountUp, DrawLine, Parallax, Reveal, RevealText, Stagger, StaggerItem, scrollToId } from '@/components/motion'

export default function ConceptLab() {
  const { id } = useParams()
  const { data: path } = usePath()
  const groups = GROUPS.map((g) => [g, CONCEPTS.filter((c) => c.meta.group === g)] as const).filter(([, l]) => l.length)

  useEffect(() => {
    if (id) setTimeout(() => scrollToId(`viz-${id}`, { immediate: true }), 80)
  }, [id])

  useRail(
    <div>
      <div className="label mt-2 mb-1.5 flex items-center gap-2 px-5"><span className="dot" /> Concepts</div>
      {groups.map(([g, l]) => (
        <a key={g} href={`#g-${g}`} onClick={(e) => { e.preventDefault(); scrollToId(`g-${g}`) }}
          className="ml-5 flex justify-between gap-2 border-l-2 border-line py-1 pr-4 pl-4 text-[12.5px] text-muted-foreground hover:text-foreground">
          <span>{g}</span><span className="font-mono text-[10.5px] text-faint">{l.length}</span>
        </a>
      ))}
    </div>,
    [CONCEPTS.length],
  )

  return (
    <div>
      <section className="fall relative overflow-hidden border-b border-white/15 px-6 pt-12 pb-10 sm:px-10 lg:px-14">
        <Parallax speed={0.45} aria-hidden className="pointer-events-none absolute -right-4 -bottom-[0.12em] text-[clamp(140px,24vw,340px)] leading-none font-semibold tracking-[-.07em] text-white/[.055] select-none sm:right-6">
          {String(CONCEPTS.length).padStart(2, '0')}
        </Parallax>
        <Reveal y={16} scale={1} blur={0} duration={0.9} className="relative font-mono text-[11.5px] tracking-[.08em] text-white/70 uppercase">
          Concept Lab · <CountUp value={CONCEPTS.length} delay={0.2} /> animations
        </Reveal>
        <RevealText as="h1" delay={0.1} className="relative mt-4 block max-w-3xl text-[clamp(32px,5vw,58px)] leading-[1.02] font-semibold tracking-[-.03em]">See the machine move.</RevealText>
        <Reveal y={28} scale={1} delay={0.45} className="relative">
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/85">Every core mechanism of an operating system as a step-by-step motion graphic: play it, pause it, step backwards. Each one sits inside the lesson where you need it.</p>
        </Reveal>
        <Stagger delay={0.6} stagger={0.05} className="relative mt-6 flex flex-wrap gap-1.5">
          {groups.map(([g, l]) => (
            <StaggerItem key={g} y={14} blur={0}>
              <a href={`#g-${g}`} onClick={(e) => { e.preventDefault(); scrollToId(`g-${g}`) }}
                className="block border border-white/30 px-2.5 py-1 font-mono text-[11px] text-white/80 transition-colors hover:border-white">{g} · {l.length}</a>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
      {groups.map(([g, list], gi) => (
        <section key={g} id={`g-${g}`} className="relative scroll-mt-16 px-6 py-12 sm:px-10 lg:px-14">
          {gi > 0 && <DrawLine className="absolute inset-x-0 top-0" />}
          <SectionTitle eyebrow={`${list.length} animation${list.length > 1 ? 's' : ''}`}><RevealText by="word">{g}</RevealText></SectionTitle>
          <div className="grid gap-10 2xl:grid-cols-2">
            {list.map((c) => {
              const lessons = c.meta.lessons.map((l) => path?.byId[l]).filter(Boolean)
              return (
                <Reveal key={c.meta.id} id={`viz-${c.meta.id}`} className="min-w-0 scroll-mt-20" tilt={5} amount={0.2}>
                  <c.default />
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <p className="text-[13.5px] text-muted-foreground">{c.meta.summary}</p>
                    {lessons.map((l) => (
                      <Link key={l!.id} to={`/learn/${l!.id}`} className="inline-flex items-center gap-1 font-mono text-[11px] underline">{l!.code} {l!.title} <ArrowRight className="size-3" /></Link>
                    ))}
                  </div>
                </Reveal>
              )
            })}
          </div>
        </section>
      ))}
      {id && !byId[id] && <p className="p-10 text-muted-foreground">No animation called “{id}”.</p>}
    </div>
  )
}
