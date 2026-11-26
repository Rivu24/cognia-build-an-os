import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { useArticle } from '@/lib/data'
import { useRail } from '@/components/layout/AppShell'
import { PageLoading } from '@/components/layout/PageLoading'
import { WikiArticle, SourceBar } from '@/components/article/WikiArticle'
import { Level, CopyToggle, SectionTitle } from '@/components/learn/bits'
import { conceptsForArticle } from '@/viz/registry'
import { DrawLine, Reveal, RevealText, Stagger, StaggerItem, STAGGER, scrollToId } from '@/components/motion'
import NotFound from './NotFound'

export default function ArticlePage() {
  const { slug = '', anchor } = useParams()
  const { data: a, error } = useArticle(slug)

  useEffect(() => {
    if (a && anchor) setTimeout(() => scrollToId(anchor, { immediate: true }), 60)
  }, [a, anchor])

  useRail(
    a && a.toc.length ? (
      <div>
        <div className="label mt-2 mb-1.5 flex items-center gap-2 px-5"><span className="dot" /> On this page</div>
        {a.toc.slice(0, 60).map((x) => (
          <a key={x.id} href={`#${x.id}`} onClick={(e) => { e.preventDefault(); scrollToId(x.id) }}
            className={`ml-5 block border-l-2 border-line py-1 pr-4 text-[12.5px] leading-snug text-muted-foreground hover:text-foreground ${x.level === 3 ? 'pl-7' : 'pl-4'}`}>
            {x.text}
          </a>
        ))}
      </div>
    ) : null,
    [a?.slug],
  )

  if (error) return <NotFound what="article" />
  if (!a) return <PageLoading />
  const viz = conceptsForArticle(a.title)

  return (
    <article key={a.slug}>
      {/* chrome arrives with weight; the article text itself is on screen at once */}
      <header className="relative px-6 pt-10 pb-8 sm:px-10 lg:px-14">
        <Reveal as="nav" y={14} scale={1} blur={0} duration={0.9} className="eyebrow flex flex-wrap gap-2"><Link className="hover:text-foreground" to="/library">Library</Link><span>/</span>
          {a.categories[0] ? <Link className="hover:text-foreground" to={`/library?cat=${encodeURIComponent(a.categories[0])}`}>{a.categories[0]}</Link> : <span>Article</span>}</Reveal>
        <RevealText as="h1" delay={0.05} className="mt-4 block max-w-4xl text-[clamp(30px,4vw,48px)] leading-[1.06] font-semibold tracking-[-.025em] text-balance">{a.title}</RevealText>
        <Reveal y={18} scale={1} blur={0} delay={0.3} duration={1} className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11.5px] text-muted-foreground">
          <Level n={a.rating} />
          <span>{Math.max(1, Math.round(a.words / 220))} min read</span>
          <span>{a.words.toLocaleString()} words</span>
          {a.flags.includes('stub') && <span>stub</span>}
          {a.flags.includes('inprogress') && <span>in progress</span>}
          <CopyToggle />
        </Reveal>
        {a.categories.length > 0 && (
          <Stagger delay={0.4} stagger={0.04} className="mt-4 flex flex-wrap gap-1.5">
            {a.categories.map((c) => (
              <StaggerItem key={c} y={12} blur={0}>
                <Link to={`/library?cat=${encodeURIComponent(c)}`} className="block border border-line px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">{c}</Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
        {a.lessons.length > 0 && (
          <Reveal y={16} scale={1} blur={0} delay={0.5} duration={1} className="mt-4">
            <div className="eyebrow mb-1.5">In the learning path</div>
            <div className="flex flex-wrap gap-1.5">
              {a.lessons.map((l) => <Link key={l.id + l.kind} to={`/learn/${l.id}`} className="border border-line px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">{l.title}{l.kind === 'further' ? ' · further' : ''}</Link>)}
            </div>
          </Reveal>
        )}
        <DrawLine className="absolute inset-x-0 bottom-0" delay={0.2} />
      </header>
      {viz.length > 0 && (
        <section className="relative px-6 py-10 sm:px-10 lg:px-14">
          <Reveal y={20} scale={1} blur={0} duration={0.9}><SectionTitle eyebrow="See it move">Animated</SectionTitle></Reveal>
          <div className="grid max-w-[1000px] gap-6">{viz.map((c) => <Reveal key={c.meta.id} className="min-w-0" tilt={5} amount={0.2}><c.default /></Reveal>)}</div>
          <DrawLine className="absolute inset-x-0 bottom-0" />
        </section>
      )}
      <section className="border-b border-line px-6 py-10 sm:px-10 lg:px-14">
        <Reveal y={12} scale={1} blur={0} duration={0.8} amount={0.5}><SourceBar article={a} /></Reveal>
        <WikiArticle article={a} />
      </section>
      <section className="px-6 py-10 sm:px-10 lg:px-14">
        <div className="max-w-[760px]">
          <Reveal y={36} scale={1} blur={4}>
            <SectionTitle>Credit</SectionTitle>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Reproduced from the <a className="underline" href={a.url} target="_blank" rel="noopener">OSDev Wiki</a> (CC0 1.0), as it stood on {a.updated}.
              Recent editors recorded in our copy: {a.authors.join(', ') || 'not recorded'}. Every author is listed in the page's <a className="underline" href={a.history} target="_blank" rel="noopener">full history on the OSDev Wiki</a>.
            </p>
          </Reveal>
          {a.backlinks.length > 0 && (
            <>
              <Reveal y={24} scale={1} blur={0} className="mt-8"><SectionTitle>Pages that link here</SectionTitle></Reveal>
              <Stagger stagger={STAGGER.dense} className="flex flex-wrap gap-1.5">
                {a.backlinks.slice(0, 40).map((b) => (
                  <StaggerItem key={b.s} y={12} blur={0}>
                    <Link to={`/library/${b.s}`} className="block border border-line px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">{b.t}</Link>
                  </StaggerItem>
                ))}
              </Stagger>
            </>
          )}
        </div>
      </section>
    </article>
  )
}
