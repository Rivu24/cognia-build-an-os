/* Numbers that count up to their value when they arrive. */
import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'
import { useArrive, useReduced, type ArriveOptions } from './arrive'
import { cn } from '@/lib/utils'
import { DUR, EASE_WEIGHT } from './tokens'

export type CountUpProps = ArriveOptions & {
  value: number
  /** count from (default 0) */
  from?: number
  className?: string
  /** seconds to count (default 1.4) */
  duration?: number
  delay?: number
  /** formatter (default: locale grouping, e.g. 1,204) */
  format?: (n: number) => string
}

const fmt = (n: number) => Math.round(n).toLocaleString()

/** Writes straight to the DOM while counting (no re-renders). Tabular figures keep the width steady. Screen readers
    get the final value only. Reduced motion: the final value, at once. If the value changes later it counts from
    the number on screen to the new one. */
export function CountUp({ value, from = 0, className, duration = DUR.slower, delay = 0, format = fmt, amount = 0.6, ...arrive }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)
  const go = useArrive(ref, { amount, sound: 'count', ...arrive })
  const reduce = useReduced()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      shown.current = value
      el.textContent = format(value)
      return
    }
    if (!go) return
    const start = shown.current ?? from
    if (start === value) {
      el.textContent = format(value)
      return
    }
    const run = animate(start, value, {
      duration: shown.current === null ? duration : Math.min(duration, 0.8),
      delay: shown.current === null ? delay : 0,
      ease: EASE_WEIGHT,
      onUpdate: (n) => {
        shown.current = n
        el.textContent = format(n)
      },
    })
    return () => run.stop()
  }, [go, reduce, value, from, duration, delay, format])

  return (
    <span className={cn('tabular-nums', className)}>
      <span ref={ref} aria-hidden>{format(reduce ? value : from)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}
