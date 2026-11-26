import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { DUR, EASE_WEIGHT, SPRING_HEAVY, useArrive, useReduced } from '@/components/motion'
import { cn, LEVELS, mins } from '@/lib/utils'
import { actions, useStore } from '@/lib/progress'

/** Difficulty meter: dots carry meaning, not colour. */
export function Level({ n, className }: { n?: number | null; className?: string }) {
  if (!n) return null
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-[11px] whitespace-nowrap text-muted-foreground', className)} title={`Difficulty: ${LEVELS[n]}`}>
      <span className="inline-flex gap-[3px]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('size-1.5 rounded-full border border-current', i < n && 'border-foreground bg-foreground')} />
        ))}
      </span>
      {LEVELS[n]}
    </span>
  )
}

export function Minutes({ m }: { m?: number }) {
  return <span className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">{mins(m)}</span>
}

/** Thin progress bar. It fills from empty the first time it comes on screen (a heavy, slow fill), then follows
    the value. Reduced motion: drawn at its value. `fill` styles the filled part (e.g. bg-white on a dark hero). */
export function Bar({ value, className, fill, delay = 0 }: { value: number; className?: string; fill?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const go = useArrive(ref, { amount: 0.5 })
  const reduce = useReduced()
  const pct = `${Math.round(value * 100)}%`
  const [settled, setSettled] = useState(false)
  return (
    <div ref={ref} className={cn('relative h-[3px] w-full bg-soft-2', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cn('absolute inset-y-0 left-0 bg-foreground', fill)}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: reduce || go ? pct : 0 }}
        transition={reduce ? { duration: DUR.quick } : settled ? SPRING_HEAVY : { duration: DUR.slower, delay, ease: EASE_WEIGHT }}
        onAnimationComplete={() => go && !settled && setSettled(true)} />
    </div>
  )
}

export function CopyToggle() {
  const copy = useStore((s) => s.copy)
  return (
    <button type="button" onClick={() => actions.setCopy(!copy)} className="inline-flex h-7 cursor-pointer items-center border border-line px-2 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
      {copy ? 'Hide copy buttons' : 'Show copy buttons'}
    </button>
  )
}

export function SectionTitle({ eyebrow, children, className }: { eyebrow?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5', className)}>
      {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
      <h2 className="h-rule text-[clamp(21px,2.3vw,28px)] leading-tight font-semibold tracking-[-.02em] text-balance">{children}</h2>
    </div>
  )
}
