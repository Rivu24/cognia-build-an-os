/* Shared SVG motion primitives. All scenes draw in a 800 x 450 viewBox (16:9) unless they pass another.
   Colours come only from CSS tokens: var(--viz-fg) (ink), var(--viz-dim) (secondary), var(--viz-faint) (hairline),
   var(--viz-glow) (highlight glow), var(--viz-bg) (canvas). Never hard-code colours: the brand is monochrome
   and light mode must still work. Emphasis = brightness, glow, stroke weight, fill, motion. */
import { motion, type Transition } from 'motion/react'
import type { ReactNode, SVGProps } from 'react'

export const spring: Transition = { type: 'spring', stiffness: 170, damping: 22 }
export const ease: Transition = { duration: 0.6, ease: [0.2, 0.75, 0.2, 1] }

/** The SVG canvas. Includes the glow filter and arrowhead markers used by the other primitives. */
export function Scene({ children, viewBox = '0 0 800 450', label }: { children: ReactNode; viewBox?: string; label?: string }) {
  return (
    <svg viewBox={viewBox} className="absolute inset-0 h-full w-full" role="img" aria-label={label} style={{ fontFamily: 'var(--font-sans)' }}>
      <defs>
        <filter id="viz-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="viz-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--viz-fg)" />
        </marker>
        <marker id="viz-arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--viz-dim)" />
        </marker>
        <pattern id="viz-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--viz-faint)" strokeWidth="2" />
        </pattern>
      </defs>
      {children}
    </svg>
  )
}

type BlockProps = {
  x: number
  y: number
  w: number
  h: number
  label?: ReactNode
  sub?: ReactNode
  /** 'on' = highlighted (bright stroke + glow), 'off' = normal, 'dim' = faded, 'fill' = solid ink with inverted text */
  state?: 'on' | 'off' | 'dim' | 'fill' | 'hatch'
  mono?: boolean
  align?: 'middle' | 'start'
  size?: number
}

/** A labelled box: a chip, a register, a table, a layer. Animates between states. */
export function Block({ x, y, w, h, label, sub, state = 'off', mono, align = 'middle', size = 14 }: BlockProps) {
  const fill = state === 'fill' ? 'var(--viz-fg)' : state === 'hatch' ? 'url(#viz-hatch)' : 'var(--viz-bg)'
  const stroke = state === 'dim' ? 'var(--viz-faint)' : 'var(--viz-fg)'
  const text = state === 'fill' ? 'var(--viz-bg)' : state === 'dim' ? 'var(--viz-dim)' : 'var(--viz-fg)'
  const tx = align === 'middle' ? x + w / 2 : x + 10
  return (
    <motion.g initial={false} animate={{ opacity: state === 'dim' ? 0.45 : 1 }} transition={ease}>
      <motion.rect
        x={x}
        y={y}
        width={w}
        height={h}
        initial={false}
        animate={{ fill, stroke, strokeWidth: state === 'on' ? 2.2 : 1 }}
        transition={ease}
        filter={state === 'on' ? 'url(#viz-glow)' : undefined}
      />
      {label !== undefined && (
        <motion.text
          x={tx}
          y={y + h / 2 + (sub ? -3 : 5)}
          textAnchor={align}
          initial={false}
          animate={{ fill: text }}
          style={{ fontSize: size, fontFamily: mono ? 'var(--font-mono)' : undefined, fontWeight: 500 }}
        >
          {label}
        </motion.text>
      )}
      {sub !== undefined && (
        <motion.text x={tx} y={y + h / 2 + 14} textAnchor={align} initial={false} animate={{ fill: state === 'fill' ? 'var(--viz-bg)' : 'var(--viz-dim)' }} style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {sub}
        </motion.text>
      )}
    </motion.g>
  )
}

/** A connection that draws itself (pathLength) when `on`. Pass a path `d` or two points. */
export function Wire({ d, from, to, on = true, dim, dashed, arrow = true, delay = 0, width = 1.6 }: {
  d?: string
  from?: [number, number]
  to?: [number, number]
  on?: boolean
  dim?: boolean
  dashed?: boolean
  arrow?: boolean
  delay?: number
  width?: number
}) {
  const path = d ?? `M${from![0]} ${from![1]} L${to![0]} ${to![1]}`
  return (
    <motion.path
      d={path}
      fill="none"
      stroke={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'}
      strokeWidth={width}
      strokeDasharray={dashed ? '5 5' : undefined}
      markerEnd={arrow ? (dim ? 'url(#viz-arrow-dim)' : 'url(#viz-arrow)') : undefined}
      initial={false}
      animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
      transition={{ ...ease, delay }}
    />
  )
}

/** A glowing dot travelling along straight segments through `points` while `on` (loops). */
export function Packet({ points, on = true, duration = 1.6, r = 5, delay = 0, repeat = true, label }: {
  points: [number, number][]
  on?: boolean
  duration?: number
  r?: number
  delay?: number
  repeat?: boolean
  label?: string
}) {
  if (!on) return null
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const loop = { repeat: repeat ? Infinity : 0, repeatDelay: 0.3 }
  return (
    <motion.g
      initial={{ x: xs[0], y: ys[0], opacity: 0 }}
      // opacity runs on its own timeline: fade in at the start, stay lit, fade out at the end (or stay, if not repeating)
      animate={{ x: xs, y: ys, opacity: repeat ? [0, 1, 1, 0] : [0, 1, 1, 1] }}
      transition={{
        x: { duration, delay, ease: 'easeInOut', ...loop },
        y: { duration, delay, ease: 'easeInOut', ...loop },
        opacity: { duration, delay, times: [0, 0.1, 0.9, 1], ease: 'linear', ...loop },
      }}
    >
      <circle r={r} fill="var(--viz-fg)" filter="url(#viz-glow)" />
      {label && (
        <text y={-r - 6} textAnchor="middle" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }} fill="var(--viz-fg)">
          {label}
        </text>
      )}
    </motion.g>
  )
}

/** Small text label (mono by default) that fades in when `on`. */
export function Label({ x, y, children, on = true, size = 12, mono = true, anchor = 'start', dim, weight = 400, delay = 0 }: {
  x: number
  y: number
  children: ReactNode
  on?: boolean
  size?: number
  mono?: boolean
  anchor?: 'start' | 'middle' | 'end'
  dim?: boolean
  weight?: number
  delay?: number
}) {
  return (
    <motion.text
      x={x}
      y={y}
      textAnchor={anchor}
      initial={false}
      animate={{ opacity: on ? 1 : 0 }}
      transition={{ ...ease, delay }}
      fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'}
      style={{ fontSize: size, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontWeight: weight }}
    >
      {children}
    </motion.text>
  )
}

/** A row of bits / bytes with optional highlighted field ranges (e.g. a virtual address split 10|10|12). */
export function BitField({ x, y, cellW = 18, h = 30, bits, fields = [], active, showIndex = true }: {
  x: number
  y: number
  cellW?: number
  h?: number
  /** most significant first, e.g. '0011...' or array of strings */
  bits: string | string[]
  /** [startIndexFromLeft, length, label] */
  fields?: [number, number, string][]
  /** index of the field to highlight */
  active?: number
  showIndex?: boolean
}) {
  const arr = typeof bits === 'string' ? bits.split('') : bits
  return (
    <g>
      {fields.map(([s, len, lab], i) => (
        <g key={i}>
          <motion.rect
            x={x + s * cellW}
            y={y - 4}
            width={len * cellW}
            height={h + 8}
            fill="none"
            initial={false}
            animate={{ stroke: active === i ? 'var(--viz-fg)' : 'var(--viz-faint)', strokeWidth: active === i ? 2 : 1 }}
            filter={active === i ? 'url(#viz-glow)' : undefined}
          />
          <Label x={x + (s + len / 2) * cellW} y={y + h + 22} anchor="middle" size={11} dim={active !== i}>
            {lab}
          </Label>
        </g>
      ))}
      {arr.map((b, i) => {
        const inActive = active !== undefined && fields[active] && i >= fields[active][0] && i < fields[active][0] + fields[active][1]
        return (
          <g key={i}>
            <motion.rect x={x + i * cellW} y={y} width={cellW} height={h} initial={false}
              animate={{ fill: inActive ? 'var(--viz-fg)' : 'var(--viz-bg)' }} stroke="var(--viz-faint)" />
            <motion.text x={x + i * cellW + cellW / 2} y={y + h / 2 + 4} textAnchor="middle" initial={false}
              animate={{ fill: inActive ? 'var(--viz-bg)' : 'var(--viz-fg)' }} style={{ fontSize: Math.min(13, cellW * 0.7), fontFamily: 'var(--font-mono)' }}>
              {b}
            </motion.text>
          </g>
        )
      })}
      {showIndex && (
        <>
          <Label x={x} y={y - 10} size={9.5} dim>{arr.length - 1}</Label>
          <Label x={x + arr.length * cellW} y={y - 10} size={9.5} dim anchor="end">0</Label>
        </>
      )}
    </g>
  )
}

/** A vertical memory map: list of regions (top = high address). Highlight one with `active`. */
export function MemoryMap({ x, y, w, rows, active, rowH = 30 }: {
  x: number
  y: number
  w: number
  rows: { label: string; addr?: string; h?: number; state?: BlockProps['state'] }[]
  active?: number
  rowH?: number
}) {
  let cy = y
  return (
    <g>
      {rows.map((r, i) => {
        const hh = r.h ?? rowH
        const el = (
          <g key={i}>
            <Block x={x} y={cy} w={w} h={hh} label={r.label} size={12} state={active === i ? 'on' : r.state ?? 'off'} />
            {r.addr && <Label x={x - 8} y={cy + 4} anchor="end" size={10} dim={active !== i}>{r.addr}</Label>}
          </g>
        )
        cy += hh
        return el
      })}
    </g>
  )
}

/** Pulsing ring to draw the eye to a point. */
export function Pulse({ x, y, on = true, r = 14 }: { x: number; y: number; on?: boolean; r?: number }) {
  if (!on) return null
  return (
    <motion.circle cx={x} cy={y} r={r} fill="none" stroke="var(--viz-fg)" strokeWidth={1.5}
      initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 1.8, opacity: 0 }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }} style={{ transformOrigin: `${x}px ${y}px`, transformBox: 'fill-box' }} />
  )
}

/** Fade/slide group helper for whole sub-scenes. */
export function Appear({ on, children, dx = 0, dy = 8, delay = 0, ...rest }: { on: boolean; children: ReactNode; dx?: number; dy?: number; delay?: number } & SVGProps<SVGGElement>) {
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0, x: on ? 0 : dx, y: on ? 0 : dy }} transition={{ ...ease, delay }} {...(rest as object)}>
      {children}
    </motion.g>
  )
}
