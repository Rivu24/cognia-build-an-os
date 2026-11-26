/* Elements that drift against the scroll, so foreground and background read as separate, heavy layers. */
import { useRef, type ReactNode, type CSSProperties } from 'react'
import { motion, useInView, useScroll, useSpring, useTransform } from 'motion/react'
import { useReduced } from './arrive'
import { SPRING_DRIFT } from './tokens'

export type ParallaxProps = {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  /** Drift strength. Positive values lag behind the scroll (background), negative values run ahead (foreground).
      0.2 moves the element about 20% of the viewport height over its whole pass through the screen. */
  speed?: number
  /** also scale slightly while passing (e.g. 0.06 grows from 1 to 1.06); default 0 */
  zoom?: number
  /** smooth the drift with a heavy spring (default true) */
  lag?: boolean
  'aria-hidden'?: boolean
}

/** Scroll-linked drift, measured over the element's pass through the viewport. Off screen it only listens; under
    reduced motion it is a plain box. Keep parallax on decoration (hero art, big numerals), never on text you read. */
export function Parallax({ children, className, style, speed = 0.2, zoom = 0, lag = true, ...rest }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReduced()
  const near = useInView(ref, { margin: '25% 0px 25% 0px' })
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const range = typeof window === 'undefined' ? 800 : window.innerHeight
  const raw = useTransform(scrollYProgress, [0, 1], [speed * range * 0.5, -speed * range * 0.5])
  const smooth = useSpring(raw, SPRING_DRIFT)
  const y = lag ? smooth : raw
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1 + zoom * 0.5, 1 + zoom])

  if (reduce) return <div ref={ref} className={className} style={style} {...rest}>{children}</div>
  return (
    <motion.div ref={ref} className={className} style={{ ...style, ...(near ? { y, scale: zoom ? scale : 1 } : {}), willChange: near ? 'transform' : undefined }} {...rest}>
      {children}
    </motion.div>
  )
}
