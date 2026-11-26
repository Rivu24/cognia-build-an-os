/* VizStage: the player every motion graphic runs in.
   - steps: ordered captions; the child render-prop receives the current step index and draws that state.
   - Autoplays (and loops) while at least 40% visible; pauses off-screen. Never autoplays with reduced motion.
   - Controls: play/pause, previous, next, restart, clickable step rail, keyboard arrows when focused. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { Pause, Play, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sfx } from '@/lib/sfx'
import type { VizMeta, VizStep } from './types'

export type VizStageProps = {
  meta: VizMeta
  steps: VizStep[]
  /** Draw the scene for a step. Keep everything mounted and animate between states for smooth motion. */
  children: (step: number) => ReactNode
  /** ms per step while playing (default 3200). A step may override with its own `ms`. */
  interval?: number
  /** SVG-ish aspect ratio of the stage area, e.g. '16/9' (default) or '4/3'. */
  aspect?: string
  className?: string
  /** compact: smaller chrome for inline use */
  compact?: boolean
}

export function VizStage({ meta, steps, children, interval = 3200, aspect = '16/9', className, compact }: VizStageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  // only draw the scene near the viewport: off-screen animations (looping packets) cost nothing
  const near = useInView(ref, { margin: '400px 0px 400px 0px' })
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(!reduce)
  const n = steps.length

  const go = useCallback((s: number) => setStep(((s % n) + n) % n), [n])

  useEffect(() => {
    if (!playing || !inView || reduce) return
    const ms = steps[step]?.ms ?? interval
    const id = window.setTimeout(() => go(step + 1), ms)
    return () => window.clearTimeout(id)
  }, [playing, inView, reduce, step, interval, steps, go])

  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) return void (firstStep.current = false)
    if (inView) sfx.step(step)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the step change itself sounds
  }, [step])

  const cur = steps[step]
  return (
    <figure
      ref={ref}
      tabIndex={0}
      aria-label={`Animation: ${meta.title}`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { setPlaying(false); go(step + 1) }
        if (e.key === 'ArrowLeft') { setPlaying(false); go(step - 1) }
        if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p) }
      }}
      className={cn('group/viz relative min-w-0 max-w-full border border-line bg-[var(--viz-bg)] text-[var(--viz-fg)] outline-none focus-visible:border-foreground', className)}
    >
      {!compact && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex size-2">
              <span className={cn('absolute inline-flex size-full rounded-full bg-foreground opacity-60', playing && inView && 'animate-ping')} />
              <span className="relative inline-flex size-2 rounded-full bg-foreground" />
            </span>
            <span className="truncate font-mono text-[11px] tracking-[.08em] text-muted-foreground uppercase">{meta.title}</span>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-faint">{String(step + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
        </div>
      )}

      {/* phones: keep labels readable by giving the scene a minimum width and letting it scroll sideways */}
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <div className="relative w-full min-w-[640px] overflow-hidden sm:min-w-0" style={{ aspectRatio: aspect }}>
          {near ? children(step) : null}
        </div>
      </div>
      <div className="border-t border-line px-4 py-1.5 font-mono text-[10.5px] text-faint sm:hidden">Scroll sideways to see the whole scene →</div>

      <figcaption className="border-t border-line">
        <div className="min-h-[76px] px-4 py-3 sm:px-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <p className="text-[15px] leading-snug font-medium text-foreground">{cur?.caption}</p>
              {cur?.detail && <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{cur.detail}</p>}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2 border-t border-line px-2 py-2 sm:px-3">
          <CtlButton label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </CtlButton>
          <CtlButton label="Previous step" onClick={() => { setPlaying(false); go(step - 1) }}>
            <ChevronLeft className="size-4" />
          </CtlButton>
          <CtlButton label="Next step" onClick={() => { setPlaying(false); go(step + 1) }}>
            <ChevronRight className="size-4" />
          </CtlButton>
          <div className="mx-1 flex flex-1 items-center gap-1" role="tablist" aria-label="Steps">
            {steps.map((s, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === step}
                title={s.caption}
                onClick={() => { setPlaying(false); go(i) }}
                className="group/dot relative h-6 flex-1 cursor-pointer"
              >
                <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-soft-2" />
                <motion.span
                  className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 bg-foreground"
                  initial={false}
                  animate={{ width: i < step ? '100%' : i === step ? '100%' : '0%', opacity: i <= step ? 1 : 0 }}
                  transition={{ duration: i === step && playing && inView ? 0.4 : 0.2 }}
                />
              </button>
            ))}
          </div>
          <CtlButton label="Restart" onClick={() => { go(0); setPlaying(true) }}>
            <RotateCcw className="size-3.5" />
          </CtlButton>
        </div>
      </figcaption>
    </figure>
  )
}

function CtlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center border border-line text-foreground transition-colors hover:border-foreground hover:bg-soft"
    >
      {children}
    </button>
  )
}
