import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, GraduationCap, Sparkles } from 'lucide-react'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { getIndex, getPath, type IndexEntry, type Path } from '@/lib/data'
import { CONCEPTS } from '@/viz/registry'
import { trunc } from '@/lib/utils'

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [index, setIndex] = useState<IndexEntry[]>([])
  const [path, setPath] = useState<Path>()
  useEffect(() => {
    if (open && !index.length) {
      getIndex().then(setIndex)
      getPath().then(setPath)
    }
  }, [open, index.length])

  const ql = q.trim().toLowerCase()
  const lessons = useMemo(() => {
    // the path, then the Prerequisites; a match in the title or code ranks above a match in the readings only
    const all = [...(path?.lessons || []), ...(path?.prereq?.lessons || [])]
    if (!ql) return all.slice(0, 6)
    const hit = all.filter((l) => (l.code + ' ' + l.title + ' ' + l.articles.join(' ')).toLowerCase().includes(ql))
    const strong = (l: (typeof all)[number]) => (l.code + ' ' + l.title).toLowerCase().includes(ql)
    return [...hit.filter(strong), ...hit.filter((l) => !strong(l))].slice(0, 12)
  }, [path, ql])
  const concepts = useMemo(() => CONCEPTS.filter((c) => !ql || (c.meta.title + ' ' + c.meta.summary).toLowerCase().includes(ql)).slice(0, ql ? 8 : 4), [ql])
  const arts = useMemo(() => {
    if (!ql) return []
    const terms = ql.split(/\s+/)
    return index
      .map((d) => {
        const t = d.t.toLowerCase()
        let s = 0
        for (const w of terms) {
          if (t === ql) s += 100
          if (t.startsWith(w)) s += 30
          else if (t.includes(w)) s += 18
          else if (d.h.toLowerCase().includes(w)) s += 6
          else if (d.sum.toLowerCase().includes(w)) s += 3
          else return null
        }
        return { d, s }
      })
      .filter((x): x is { d: IndexEntry; s: number } => !!x)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
      .map((x) => x.d)
  }, [index, ql])

  const go = (to: string) => {
    onOpenChange(false)
    setQ('')
    nav(to)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Search lessons, animations and articles" className="max-w-2xl">
      <Command shouldFilter={false}>
      <CommandInput placeholder="Search lessons, animations and 758 articles…" value={q} onValueChange={setQ} />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No match. Try a shorter word: paging, GDT, FAT.</CommandEmpty>
        {lessons.length > 0 && (
          <CommandGroup heading="Lessons">
            {lessons.map((l) => (
              <CommandItem key={l.id} value={'lesson ' + l.id + ' ' + l.title} onSelect={() => go(`/learn/${l.id}`)}>
                <GraduationCap /> <span className="w-[3.6em] shrink-0 font-mono text-[11px] text-faint">{l.code}</span> <span className="min-w-0">{l.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {concepts.length > 0 && (
          <CommandGroup heading="Animations">
            {concepts.map((c) => (
              <CommandItem key={c.meta.id} value={'viz ' + c.meta.id + ' ' + c.meta.title} onSelect={() => go(`/lab/${c.meta.id}`)}>
                <Sparkles /> {c.meta.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {arts.length > 0 && (
          <CommandGroup heading="Articles">
            {arts.map((d) => (
              <CommandItem key={d.s} value={'article ' + d.s + ' ' + d.t} onSelect={() => go(`/library/${d.s}`)}>
                <BookOpen />
                <span className="flex min-w-0 flex-col">
                  <span>{d.t}</span>
                  <span className="truncate text-xs text-muted-foreground">{trunc(d.sum, 110)}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
