/* Hairline rules that draw themselves across (or down) when they arrive. */
import { useRef, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import { useArrive, useReduced, type ArriveOptions } from './arrive'
import { cn } from '@/lib/utils'
import { DUR, EASE_WEIGHT } from './tokens'

export type DrawLineProps = ArriveOptions & {
  className?: string
  style?: CSSProperties
  /** draw downwards instead of across */
  vertical?: boolean
  /** draw from the far end (right, or bottom) */
  reverse?: boolean
  delay?: number
  /** seconds to draw (default 1.4) */
  duration?: number
}

/** A 1px rule in the line colour by default (pass a bg-* class to change it, or h-* / w-* for size). Decorative:
    hidden from assistive technology. Reduced motion: drawn already. */
export function DrawLine({ className, style, vertical, reverse, delay = 0, duration = DUR.slower, amount = 0.5, ...arrive }: DrawLineProps) {
  const ref = useRef<HTMLDivElement>(null)
  const go = useArrive(ref, { amount, sound: 'line', ...arrive })
  const reduce = useReduced()
  const axis = vertical ? 'scaleY' : 'scaleX'
  const origin = vertical ? (reverse ? '50% 100%' : '50% 0%') : reverse ? '100% 50%' : '0% 50%'
  return (
    <motion.div
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none bg-line', vertical ? 'h-full w-px' : 'h-px w-full', className)}
      style={{ transformOrigin: origin, ...style }}
      initial={reduce ? false : { [axis]: 0 }}
      animate={reduce || go ? { [axis]: 1 } : { [axis]: 0 }}
      transition={{ duration, delay, ease: EASE_WEIGHT }}
    />
  )
}
