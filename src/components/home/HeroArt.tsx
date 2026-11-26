/* Hero art: the operating system as a stack of plates, assembling from the hardware up.
   A signal then climbs the stack, one layer at a time, and the point of the COGNIA mark rests on top. */
import { useEffect, useId, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { sfx } from '@/lib/sfx'

const LAYERS = ['Hardware', 'Boot', 'Kernel core', 'Interrupts', 'Memory', 'Tasks', 'User space', 'Storage']

const CX = 190
const HW = 150 // half width of a plate
const HH = 75 // half height (2:1 isometric)
const T = 9 // plate thickness
const GAP = 40
const BASE = 410

/** `labelClass` styles the layer labels (e.g. hide them where the art is only a backdrop). */
export function HeroArt({ play, className, labelClass }: { play: boolean; className?: string; labelClass?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const glow = `hero-glow-${uid}`
  const topFill = `hero-top-${uid}`
  const [lit, setLit] = useState(-1)
  const assembled = 0.5 + LAYERS.length * 0.11 + 0.4
  const live = play && !reduce && inView
  const ran = useRef(false)
  const heard = useRef(false)
  const climbed = useRef(false)

  /* the assembly, heard: one thud per plate as it lands, the spine, then the mark */
  useEffect(() => {
    if (!play || reduce || heard.current) return
    heard.current = true
    const ids = LAYERS.map((_, i) => window.setTimeout(() => sfx.plate(i), (0.5 + i * 0.11 + 0.3) * 1000))
    ids.push(window.setTimeout(() => sfx.arrive('line'), 150))
    ids.push(window.setTimeout(() => sfx.arrive('text'), (assembled + 0.25) * 1000))
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [play, reduce, assembled])

  /* the climbing light runs only while the art is on screen */
  useEffect(() => {
    if (!live) return
    let i = -1
    let t: ReturnType<typeof setTimeout>
    const tick = () => {
      i = i + 1 > LAYERS.length ? -1 : i + 1
      setLit(i < LAYERS.length ? i : -1)
      if (!climbed.current && i >= 0 && i < LAYERS.length) { sfx.step(i); if (i === LAYERS.length - 1) climbed.current = true } // the first climb only: a loop of blips would tire the ear
      t = setTimeout(tick, i === -1 ? 1400 : i === LAYERS.length - 1 ? 900 : 520)
    }
    t = setTimeout(tick, ran.current ? 400 : assembled * 1000)
    ran.current = true
    return () => {
      clearTimeout(t)
      setLit(-1)
    }
  }, [live, assembled])

  return (
    <svg ref={ref} viewBox="0 0 520 500" className={cn('h-auto w-full overflow-visible', className)} aria-hidden>
      <defs>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <linearGradient id={topFill} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#262626" />
          <stop offset="1" stopColor="#0c0c0c" />
        </linearGradient>
      </defs>

      {/* axis */}
      <motion.line x1={CX} x2={CX} y1={BASE + HH + 40} y2={BASE - (LAYERS.length - 1) * GAP - HH - 70}
        stroke="rgba(255,255,255,.18)" strokeDasharray="2 6"
        initial={{ pathLength: 0 }} animate={play ? { pathLength: 1 } : {}} transition={{ duration: 1.4, ease: 'easeInOut' }} />

      {LAYERS.map((name, i) => {
        const cy = BASE - i * GAP
        const on = lit === i
        const below = lit > i
        const top = `${CX},${cy - HH} ${CX + HW},${cy} ${CX},${cy + HH} ${CX - HW},${cy}`
        const left = `${CX - HW},${cy} ${CX},${cy + HH} ${CX},${cy + HH + T} ${CX - HW},${cy + T}`
        const right = `${CX + HW},${cy} ${CX},${cy + HH} ${CX},${cy + HH + T} ${CX + HW},${cy + T}`
        return (
          <motion.g key={name}
            initial={{ opacity: 0, y: -70 }} animate={play ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.5 + i * 0.11, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
            {on && <polygon points={top} fill="rgba(255,255,255,.35)" filter={`url(#${glow})`} />}
            <polygon points={left} fill="#050505" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
            <polygon points={right} fill="#000" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
            <motion.polygon points={top} fill={`url(#${topFill})`} strokeWidth="1"
              initial={false} animate={{ stroke: on ? 'rgba(255,255,255,1)' : below ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.28)' }} transition={{ duration: 0.35 }} />
            <motion.polygon points={top} fill="#fff" initial={false} animate={{ opacity: on ? 0.16 : below ? 0.04 : 0 }} transition={{ duration: 0.35 }} />
            {/* leader + label */}
            <motion.g className={labelClass} initial={false} animate={{ opacity: on ? 1 : below ? 0.75 : 0.45 }} transition={{ duration: 0.35 }}>
              <line x1={CX + HW + 8} x2={CX + HW + 34} y1={cy} y2={cy} stroke="#fff" strokeWidth="1" />
              <text x={CX + HW + 44} y={cy + 4} fill="#fff" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em' }}>
                {String(i).padStart(2, '0')}
              </text>
              <text x={CX + HW + 72} y={cy + 4.5} fill="#fff" style={{ fontSize: 14, fontWeight: 500 }}>{name}</text>
            </motion.g>
          </motion.g>
        )
      })}

      {/* the point of the mark, resting on the finished stack */}
      <motion.g initial={{ opacity: 0, y: -20 }} animate={play ? { opacity: 1, y: 0 } : {}} transition={{ delay: assembled, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
        <motion.g animate={live ? { y: [0, -8, 0] } : { y: 0 }}
          transition={live ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 }}>
          <circle cx={CX} cy={BASE - (LAYERS.length - 1) * GAP - 52} r="14" fill="#fff" opacity=".35" filter={`url(#${glow})`} />
          <circle cx={CX} cy={BASE - (LAYERS.length - 1) * GAP - 52} r="6" fill="none" stroke="#fff" strokeWidth="2.4" />
        </motion.g>
      </motion.g>
    </svg>
  )
}
