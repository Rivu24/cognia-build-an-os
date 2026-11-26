/* The lesson's readings: one article on screen at a time, a compact switcher when there are several,
   and a clear "what next" at the end of each one. The per-article OSDev credit (SourceBar) always stays. */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowRight, Check } from 'lucide-react'
import type { Article } from '@/lib/data'
import { WikiArticle, SourceBar } from '@/components/article/WikiArticle'
import { PageLoading } from '@/components/layout/PageLoading'
import { cn } from '@/lib/utils'
import { scrollToId } from './steps'

export const readMins = (a: Pick<Article, 'words'>) => Math.max(1, Math.round((a.words || 0) / 220))

export function Readings({
  arts,
  titles,
  current,
  seen,
  onPick,
  nextStepLabel,
  nextStepId,
}: {
  arts: Article[] | null
  /** titles from the curriculum, shown while the articles load */
  titles: string[]
  current: number
  seen: Set<number>
  onPick: (i: number) => void
  nextStepLabel: string
  nextStepId: string
}) {
  const many = titles.length > 1
  const a = arts?.[current]
  const last = current >= titles.length - 1

  const go = (i: number) => {
    onPick(i)
    requestAnimationFrame(() => scrollToId('readings'))
  }

  // tabs pattern: arrow keys / Home / End move between readings and take focus with them
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const n = titles.length
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (current + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (current - 1 + n) % n
      : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (to < 0) return
    e.preventDefault()
    onPick(to)
    requestAnimationFrame(() => document.getElementById(`reading-tab-${to}`)?.focus())
  }

  return (
    <div id="readings" className="scroll-mt-[120px] lg:scroll-mt-[68px]">
      {many && (
        <div role="tablist" aria-label="Readings" onKeyDown={onKey} className={cn('mb-8 grid max-w-[760px] border-t border-l border-line', titles.length % 3 === 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
          {titles.map((t, i) => {
            const on = i === current
            const art = arts?.[i]
            return (
              <button
                key={t}
                id={`reading-tab-${i}`}
                role="tab"
                aria-selected={on}
                aria-controls={on && a ? `read-${i + 1}` : undefined}
                tabIndex={on ? 0 : -1}
                type="button"
                onClick={() => go(i)}
                className={cn(
                  'group relative flex cursor-pointer items-start gap-3 border-r border-b border-line px-4 py-3 text-left transition-colors',
                  on ? 'bg-soft-2' : 'hover:bg-soft',
                )}
              >
                {on && <motion.span layoutId="reading-tab" className="absolute inset-x-0 top-0 h-[2px] bg-foreground" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center border font-mono text-[10px]', on ? 'border-foreground bg-foreground text-background' : seen.has(i) ? 'border-foreground' : 'border-line-strong text-muted-foreground')}>
                  {seen.has(i) && !on ? <Check className="size-3" strokeWidth={2.5} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase">Reading {i + 1} of {titles.length}{art ? ` · ${readMins(art)} min` : ''}</span>
                  <span className={cn('block text-[14.5px] leading-snug font-medium', on ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>{t}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!arts || !a ? (
        <PageLoading label="Loading the reading" />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={a.slug} id={`read-${current + 1}`} role={many ? 'tabpanel' : undefined} aria-labelledby={many ? `reading-tab-${current}` : undefined}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
            <div className="eyebrow mb-2">{many ? `Reading ${current + 1} of ${arts.length}` : 'The reading'} · about {readMins(a)} min</div>
            <h3 className="mb-4 max-w-[760px] text-[clamp(22px,2.6vw,32px)] leading-tight font-semibold tracking-[-.02em]">{a.title}</h3>
            <SourceBar article={a} />
            <WikiArticle article={a} idPrefix={arts.length > 1 ? `r${current + 1}-` : ''} />
          </motion.div>
        </AnimatePresence>
      )}

      {arts && (
        <div className="mt-12 max-w-[760px] border-t border-line pt-6">
          {!last ? (
            <button type="button" onClick={() => go(current + 1)}
              className="group flex w-full cursor-pointer items-center justify-between gap-4 border border-foreground px-5 py-4 text-left transition-colors hover:bg-foreground hover:text-background">
              <span className="min-w-0">
                <span className="block font-mono text-[10.5px] tracking-[.08em] uppercase opacity-70">Next · reading {current + 2} of {titles.length}</span>
                <span className="block truncate text-[17px] font-medium">{titles[current + 1]}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
            </button>
          ) : (
            <button type="button" onClick={() => scrollToId(nextStepId)}
              className="group flex w-full cursor-pointer items-center justify-between gap-4 border border-line px-5 py-4 text-left transition-colors hover:border-foreground">
              <span>
                <span className="block font-mono text-[10.5px] tracking-[.08em] text-muted-foreground uppercase">Reading done</span>
                <span className="block text-[17px] font-medium">{nextStepLabel}</span>
              </span>
              <ArrowDown className="size-5 shrink-0 transition-transform group-hover:translate-y-0.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
