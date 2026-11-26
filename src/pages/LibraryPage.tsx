import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Search, X, GraduationCap } from 'lucide-react'
import { useIndex } from '@/lib/data'
import { PageLoading, ErrorNote } from '@/components/layout/PageLoading'
import { Level } from '@/components/learn/bits'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn, trunc, LEVELS } from '@/lib/utils'
import { CountUp, DrawLine, Reveal, RevealText, Stagger, StaggerItem, STAGGER, scrollToId } from '@/components/motion'

export default function LibraryPage() {
  const { data: index, error } = useIndex()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [lv, setLv] = useState<number | null>(null)
  const [inPath, setInPath] = useState(false)
  const cat = params.get('cat')?.replace(/_/g, ' ') || ''

  const cats = useMemo(() => {
    const m = new Map<string, string[]>()
    index?.forEach((d) => d.c.forEach((c) => m.set(c, [...(m.get(c) || []), d.s])))
    return [...m.entries()].sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()))
  }, [index])
  const titles = useMemo(() => Object.fromEntries((index || []).map((d) => [d.s, d.t])), [index])

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return (index || []).filter((d) =>
      (!ql || (d.t + ' ' + d.c.join(' ') + ' ' + d.sum + ' ' + d.h).toLowerCase().includes(ql)) &&
      (!lv || d.r === lv) && (!inPath || d.l > 0) &&
      (!cat || d.c.some((c) => c.toLowerCase() === cat.toLowerCase())))
  }, [index, q, lv, inPath, cat])

  if (error) return <ErrorNote error={error} />
  if (!index) return <PageLoading />

  const groups: [string, typeof list][] = []
  list.forEach((d) => {
    const L = /[a-z]/i.test(d.t[0]) ? d.t[0].toUpperCase() : '#'
    if (!groups.length || groups[groups.length - 1][0] !== L) groups.push([L, []])
    groups[groups.length - 1][1].push(d)
  })

  return (
    <div className="px-6 py-12 sm:px-10 lg:px-14">
      <Reveal y={16} scale={1} blur={0} duration={0.9} className="eyebrow">
        Library · <CountUp value={index.length} delay={0.15} /> articles · <CountUp value={cats.length} delay={0.3} /> categories
      </Reveal>
      <RevealText as="h1" delay={0.05} className="mt-3 block text-[clamp(30px,4vw,48px)] leading-[1.06] font-semibold tracking-[-.025em]">The full OSDev Wiki, readable</RevealText>
      <Reveal y={24} scale={1} delay={0.35}>
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">Every article from the OSDev Wiki, set for reading. Use it as a reference while you follow the path, or browse by topic.</p>
      </Reveal>

      <Tabs defaultValue="az" className="mt-8">
        <Reveal y={20} scale={1} blur={0} delay={0.5} className="w-fit">
          <TabsList className="h-9 rounded-none border border-line bg-transparent p-0">
            <TabsTrigger value="az" className="rounded-none px-4 data-active:bg-foreground data-active:text-background">A–Z</TabsTrigger>
            <TabsTrigger value="cat" className="rounded-none px-4 data-active:bg-foreground data-active:text-background">By category</TabsTrigger>
          </TabsList>
        </Reveal>

        <TabsContent value="az" className="mt-5">
          <Reveal y={20} scale={1} blur={0} delay={0.6} className="flex flex-wrap items-center gap-2">
            <label className="relative flex h-10 w-full max-w-md items-center border border-line-strong focus-within:border-foreground">
              <Search className="ml-3 size-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter: paging, AHCI, FAT…" aria-label="Filter articles"
                className="h-full flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-faint" />
            </label>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} onClick={() => setLv(lv === n ? null : n)}
                  className={cn('h-10 cursor-pointer border px-3 font-mono text-[11.5px] transition-colors', lv === n ? 'border-foreground bg-foreground text-background' : 'border-line text-muted-foreground hover:border-foreground')}>
                  {LEVELS[n]}
                </button>
              ))}
              <button onClick={() => setInPath(!inPath)}
                className={cn('inline-flex h-10 cursor-pointer items-center gap-1.5 border px-3 font-mono text-[11.5px] transition-colors', inPath ? 'border-foreground bg-foreground text-background' : 'border-line text-muted-foreground hover:border-foreground')}>
                <GraduationCap className="size-3.5" /> In the path
              </button>
            </div>
            {cat && (
              <button onClick={() => setParams({})} className="inline-flex h-10 items-center gap-1.5 border border-foreground px-3 font-mono text-[11.5px]">
                {cat} <X className="size-3.5" />
              </button>
            )}
            <span className="font-mono text-[12px] text-muted-foreground">{list.length} articles</span>
          </Reveal>
          <Stagger delay={0.7} stagger={STAGGER.dense} className="mt-3 flex flex-wrap gap-1">
            {groups.map(([L]) => (
              <StaggerItem key={L} y={12} blur={0}>
                <a href={`#l-${L}`} onClick={(e) => { e.preventDefault(); scrollToId(`l-${L}`) }}
                  className="block border border-line px-2 py-1 font-mono text-[12px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">{L}</a>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="mt-4">
            {groups.map(([L, items]) => (
              <div key={L} id={`l-${L}`} className="scroll-mt-20">
                <DrawLine className="mt-6" />
                <Reveal y={14} scale={1} blur={0} duration={0.9} amount={1} className="pt-2 font-mono text-[12px] tracking-[.1em] text-muted-foreground">{L}</Reveal>
                <Reveal as="ul" y={36} scale={1} blur={0} amount={0.01} margin="0px 0px -6% 0px" className="columns-1 gap-8 [overflow-wrap:anywhere] md:columns-2">
                  {items.map((d) => (
                    <li key={d.s} className="break-inside-avoid border-b border-line py-2">
                      <Link to={`/library/${d.s}`} className="group block">
                        <span className="text-[14.5px] font-medium [overflow-wrap:anywhere] group-hover:underline">{d.t}</span>
                        {d.r ? <Level n={d.r} className="ml-2" /> : null}
                        {d.l > 0 && <GraduationCap className="ml-1.5 inline size-3.5 text-muted-foreground" aria-label="used in the learning path" />}
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{trunc(d.sum, 150)}</span>
                      </Link>
                    </li>
                  ))}
                </Reveal>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cat" className="mt-5">
          <div className="columns-1 gap-7 sm:columns-2 xl:columns-3">
            {cats.map(([c, slugs], i) => (
              <Reveal key={c} y={30} scale={1} blur={0} delay={(i % 3) * 0.06} amount={0.3} className="mb-5 break-inside-avoid">
                <button onClick={() => setParams({ cat: c })} className="mb-1.5 flex w-full cursor-pointer justify-between gap-2 border-b border-line pb-1 text-left text-[13px] font-semibold tracking-[.02em] hover:underline">
                  {c}<span className="font-mono text-[11px] font-normal text-faint">{slugs.length}</span>
                </button>
                {slugs.slice(0, 12).map((s) => (
                  <Link key={s} to={`/library/${s}`} className="block py-0.5 text-[13.5px] text-muted-foreground hover:text-foreground">{titles[s]}</Link>
                ))}
                {slugs.length > 12 && <button onClick={() => setParams({ cat: c })} className="mt-1 cursor-pointer font-mono text-[11px] text-faint underline">+ {slugs.length - 12} more</button>}
              </Reveal>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
