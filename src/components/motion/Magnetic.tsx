/* Primary buttons that lean toward the cursor a little and spring back when it leaves. */
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react'
import { motion, useSpring } from 'motion/react'
import { useReduced } from './arrive'
import { cn } from '@/lib/utils'
import { SPRING_FOLLOW } from './tokens'

export type MagneticProps = {
  children: ReactNode
  className?: string
  /** share of the cursor's offset from the centre to follow (default 0.22) */
  strength?: number
  /** most it moves, in px (default 7) */
  max?: number
}

function useFinePointer() {
  const q = '(hover: hover) and (pointer: fine)'
  const [fine, setFine] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const m = matchMedia(q)
    const f = () => setFine(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return fine
}

/** Wrap one primary action (a Link or button). An inline-block wrapper leans toward the pointer (a few px at most)
    on a heavy spring and settles back when it leaves. Only on fine pointers with motion allowed; otherwise it renders
    a plain wrapper. Use it on one or two primary buttons per screen, not on every link. */
export function Magnetic({ children, className, strength = 0.22, max = 7 }: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReduced()
  const fine = useFinePointer()
  const x = useSpring(0, SPRING_FOLLOW)
  const y = useSpring(0, SPRING_FOLLOW)
  const on = fine && !reduce

  const move = (e: PointerEvent) => {
    const el = ref.current
    if (!on || !el || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    const clamp = (v: number) => Math.max(-max, Math.min(max, v))
    x.set(clamp((e.clientX - (r.left + r.width / 2)) * strength))
    y.set(clamp((e.clientY - (r.top + r.height / 2)) * strength * 1.4))
  }
  const leave = () => {
    x.set(0)
    y.set(0)
  }

  if (!on) return <span className={cn('inline-block', className)}>{children}</span>
  return (
    <motion.span ref={ref} className={cn('inline-block', className)} style={{ x, y }} onPointerMove={move} onPointerLeave={leave} onBlur={leave}>
      {children}
    </motion.span>
  )
}
