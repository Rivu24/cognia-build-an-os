/* Side rail on /basics: the self-check, then the six modules with their progress. */
import { cn } from '@/lib/utils'
import { scrollToId } from '@/components/learn/steps'
import type { Answers, PrereqModule } from './selfcheck'

const jump = scrollToId

export function PrereqRail({ mods, done, answers, current }: { mods: PrereqModule[]; done: Record<string, number>; answers: Answers; current?: string }) {
  const marked = mods.filter((m) => answers[m.id]).length
  return (
    <div>
      <div className="label mt-2 mb-1.5 flex items-center gap-2 px-5"><span className="dot" /> On this page</div>
      <button type="button" onClick={() => jump('self-check')}
        className="ml-5 flex w-[calc(100%-1.25rem)] cursor-pointer items-baseline gap-2 border-l-2 border-line py-1 pr-4 pl-4 text-left text-[12.5px] leading-snug text-muted-foreground transition-colors hover:text-foreground">
        <span className="min-w-0 flex-1">Self-check</span>
        <span className="shrink-0 font-mono text-[10px] text-faint">{marked}/{mods.length}</span>
      </button>
      <div className="label mt-4 mb-1.5 flex items-center gap-2 px-5"><span className="dot" /> Modules</div>
      {mods.map((m) => {
        const n = m.lessons.filter((l) => done[l.id]).length
        const cur = m.id === current
        return (
          <button key={m.id} type="button" onClick={() => jump(`module-${m.id}`)}
            className={cn('ml-5 flex w-[calc(100%-1.25rem)] cursor-pointer gap-2 border-l-2 py-1 pr-4 pl-4 text-left text-[12.5px] leading-snug transition-colors',
              cur ? 'border-foreground text-foreground' : 'border-line text-muted-foreground hover:text-foreground')}>
            <span className="w-6 shrink-0 font-mono text-[10.5px] text-faint">{n === m.lessons.length ? '✓' : `P${m.n}`}</span>
            <span className="min-w-0 flex-1">{m.title}</span>
            <span className="shrink-0 font-mono text-[10px] text-faint">{n}/{m.lessons.length}</span>
          </button>
        )
      })}
    </div>
  )
}
