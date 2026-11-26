/* On the "Prerequisite self-check" lesson: the site has a whole section for what this lesson asks about. */
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import type { Path } from '@/lib/data'

export function PrereqCallout({ path, done }: { path: Path; done: Record<string, number> }) {
  const pr = path.prereq
  if (!pr) return null
  const n = pr.lessons.filter((l) => done[l.id]).length
  return (
    <Link to="/basics"
      className="group mt-8 flex max-w-[760px] items-center gap-5 border border-foreground px-5 py-4 transition-colors hover:bg-foreground hover:text-background sm:px-6">
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10.5px] tracking-[.1em] uppercase opacity-70">
          Prerequisites · {pr.modules.length} modules · {pr.lessons.length} lessons{n > 0 ? ` · ${n} done` : ''}
        </span>
        <span className="mt-1 block text-[16px] leading-snug font-medium sm:text-[17px]">
          Not sure where you stand? The Prerequisites page has a self-check that picks the modules you need and plans them for you.
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
    </Link>
  )
}
