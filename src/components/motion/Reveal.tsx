/* A block that settles into place with mass the first time it enters the viewport. */
import { useRef, type ReactNode, type CSSProperties } from 'react'
import { motion, type Variants } from 'motion/react'
import { useArrive, useReduced, type ArriveOptions } from './arrive'
import { DUR, EASE_WEIGHT } from './tokens'

export type MotionTag = 'div' | 'section' | 'header' | 'footer' | 'article' | 'aside' | 'nav' | 'ul' | 'ol' | 'li' | 'p' | 'span' | 'figure'

export type RevealProps = ArriveOptions & {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  id?: string
  as?: MotionTag
  /** seconds before it starts, after arriving */
  delay?: number
  /** seconds to settle (default 1.1) */
  duration?: number
  /** distance it falls from, in px (default 60) */
  y?: number
  /** starting scale (default 0.97) */
  scale?: number
  /** starting blur in px (default 6; use 0 for tall blocks, blur is costly on large areas) */
  blur?: number
  /** tilt back by this many degrees and settle flat (default 0: no tilt) */
  tilt?: number
  /** forwarded to the element (e.g. a nav landmark's name) */
  'aria-label'?: string
}

/** Settles in: y 60→0, scale .97→1, blur 6→0, opacity 0→1 (optionally a rotateX tilt), once. Reduced motion: a
    short fade. Transforms and filters are cleared afterwards, so sticky and fixed descendants behave normally. */
export function Reveal({ children, className, style, id, as = 'div', delay = 0, duration = DUR.base, y = 60, scale = 0.97, blur = 6, tilt = 0, 'aria-label': label, ...arrive }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const go = useArrive(ref, arrive)
  const reduce = useReduced()
  const M = motion[as] as typeof motion.div

  const variants: Variants = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: DUR.quick, delay: Math.min(delay, 0.2) } } }
    : {
        hidden: {
          opacity: 0,
          y,
          scale,
          ...(blur ? { filter: `blur(${blur}px)` } : {}),
          ...(tilt ? { rotateX: tilt, transformPerspective: 1100 } : {}),
        },
        shown: {
          opacity: 1,
          y: 0,
          scale: 1,
          ...(blur ? { filter: 'blur(0px)' } : {}),
          ...(tilt ? { rotateX: 0 } : {}),
          transition: {
            default: { duration, delay, ease: EASE_WEIGHT },
            // opacity lands well before the body has finished settling: the weight is in the movement
            opacity: { duration: duration * 0.55, delay, ease: 'linear' },
          },
          transitionEnd: { ...(blur ? { filter: 'none' } : {}), ...(tilt ? { transformPerspective: 0 } : {}) },
        },
      }

  return (
    <M ref={ref} id={id} aria-label={label} className={className} style={{ transformOrigin: '50% 0%', ...style }} initial="hidden" animate={go ? 'shown' : 'hidden'} variants={variants}>
      {children}
    </M>
  )
}
