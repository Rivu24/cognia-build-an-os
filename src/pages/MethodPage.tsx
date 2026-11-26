import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { getMethod } from '@/lib/data'
import { useRail } from '@/components/layout/AppShell'
import { PageLoading } from '@/components/layout/PageLoading'
import { Mark } from '@/components/brand'
import { DrawLine, Magnetic, Parallax, Reveal, RevealText, Stagger, StaggerItem, scrollToId } from '@/components/motion'

const JOURNEY = ['Ready', 'Equipped', 'Booted', 'Unafraid', 'Responsive', 'Addressed', 'Concurrent', 'Multi-program', 'Persistent', 'Your direction']

export default function MethodPage() {
  const [html, setHtml] = useState<string>()
  const ref = useRef<HTMLDivElement>(null)
  const [toc, setToc] = useState<{ id: string; text: string }[]>([])
  useEffect(() => { getMethod().then(setHtml) }, [])
  useEffect(() => {
    if (!html || !ref.current) return
    setToc([...ref.current.querySelectorAll('h2')].map((h) => ({ id: h.id, text: h.textContent || '' })))
  }, [html])
  useRail(
    toc.length ? (
      <div>
        <div className="label mt-2 mb-1.5 flex items-center gap-2 px-5"><span className="dot" /> On this page</div>
        {toc.map((t) => (
          <a key={t.id} href={`#${t.id}`} onClick={(e) => { e.preventDefault(); scrollToId(t.id) }}
            className="ml-5 block border-l-2 border-line py-1 pr-4 pl-4 text-[12.5px] text-muted-foreground hover:text-foreground">{t.text}</a>
        ))}
      </div>
    ) : null,
    [toc],
  )
  if (!html) return <PageLoading />
  const body = html.replace(/<h1[^>]*>.*?<\/h1>/s, '')
  const title = (html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1] || 'How we teach').replace(/<[^>]+>/g, '')
  return (
    <div>
      <section className="fall relative overflow-hidden border-b border-white/15 px-6 pt-12 pb-10 sm:px-10 lg:px-14">
        <Parallax speed={0.4} aria-hidden className="pointer-events-none absolute top-8 -right-12 text-white/[.06] sm:right-6">
          <Mark className="size-[clamp(180px,26vw,360px)] [stroke-width:0.9]!" />
        </Parallax>
        <Reveal y={16} scale={1} blur={0} duration={0.9} className="relative font-mono text-[11.5px] tracking-[.08em] text-white/70 uppercase">How we teach</Reveal>
        <RevealText as="h1" delay={0.1} className="relative mt-4 block max-w-3xl text-[clamp(32px,5vw,58px)] leading-[1.02] font-semibold tracking-[-.03em]">{title}</RevealText>
        <Stagger delay={0.45} stagger={0.07} className="relative mt-10 flex flex-wrap gap-y-3" aria-label="Learner journey">
          {JOURNEY.map((j, i) => (
            <StaggerItem key={j} y={16} blur={3} className="flex items-center">
              <span className="border border-white/40 px-2.5 py-1 font-mono text-[11px] text-white/85">{String(i + 1).padStart(2, '0')} {j}</span>
              {i < JOURNEY.length - 1 && <DrawLine className="mx-1 w-5 bg-white/50" amount={0} delay={0.75 + i * 0.07} duration={0.9} />}
            </StaggerItem>
          ))}
        </Stagger>
      </section>
      <section className="px-6 py-12 sm:px-10 lg:px-14">
        {/* the method itself is reading content: on screen at once */}
        <div ref={ref} className="prose-wiki method" dangerouslySetInnerHTML={{ __html: body }} />
        <Reveal y={30} scale={1} blur={0} className="mt-10" amount={0.6}>
          <Magnetic>
            <Link to="/path" className="inline-flex h-11 items-center bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90">See the learning path</Link>
          </Magnetic>
        </Reveal>
      </section>
    </div>
  )
}
