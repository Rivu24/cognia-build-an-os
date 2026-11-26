/* Children that cascade in, one after another, when their container arrives. */
import { useRef, type ReactNode, type CSSProperties } from 'react'
import { motion, stagger as staggerDelay, type Variants } from 'motion/react'
import { useArrive, useReduced, type ArriveOptions } from './arrive'
import { DUR, EASE_WEIGHT, STAGGER } from './tokens'
import type { MotionTag } from './Reveal'

export type StaggerProps = ArriveOptions & {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  id?: string
  as?: MotionTag
  /** seconds between children (default 0.08) */
  stagger?: number
  /** seconds before the first child, after arriving */
  delay?: number
  'aria-label'?: string
}

/** The container: watches the viewport once and releases its StaggerItems in order. */
export function Stagger({ children, className, style, id, as = 'div', stagger = STAGGER.item, delay = 0, ...rest }: StaggerProps) {
  const { amount, margin, gate, ...aria } = rest
  const ref = useRef<HTMLDivElement>(null)
  const go = useArrive(ref, { amount: amount ?? 0.15, margin, gate })
  const reduce = useReduced()
  const M = motion[as] as typeof motion.div
  const variants: Variants = {
    hidden: {},
    shown: { transition: { delayChildren: staggerDelay(reduce ? Math.min(stagger, 0.03) : stagger, { startDelay: delay }) } },
  }
  return (
    <M ref={ref} id={id} className={className} style={style} initial="hidden" animate={go ? 'shown' : 'hidden'} variants={variants} {...aria}>
      {children}
    </M>
  )
}

export type StaggerItemProps = {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  as?: MotionTag
  /** distance it rises from, in px (default 36) */
  y?: number
  /** starting blur in px (default 4) */
  blur?: number
  /** starting scale (default 1) */
  scale?: number
  /** seconds to settle (default 1.1) */
  duration?: number
}

/** One child of a Stagger: rises, sharpens and fades in. Reduced motion: a quick fade. */
export function StaggerItem({ children, className, style, as = 'div', y = 36, blur = 4, scale = 1, duration = DUR.base }: StaggerItemProps) {
  const reduce = useReduced()
  const M = motion[as] as typeof motion.div
  const variants: Variants = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: DUR.quick } } }
    : {
        hidden: { opacity: 0, y, scale, ...(blur ? { filter: `blur(${blur}px)` } : {}) },
        shown: {
          opacity: 1,
          y: 0,
          scale: 1,
          ...(blur ? { filter: 'blur(0px)' } : {}),
          transition: { default: { duration, ease: EASE_WEIGHT }, opacity: { duration: duration * 0.55, ease: 'linear' } },
          transitionEnd: blur ? { filter: 'none' } : undefined,
        },
      }
  return (
    <M className={className} style={style} variants={variants}>
      {children}
    </M>
  )
}
