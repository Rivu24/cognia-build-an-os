/* Headlines that rise out of masks, line by line (or word by word), the first time they enter the viewport. */
import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { animate } from 'motion/react'
import { useArrive, useReduced, type ArriveOptions } from './arrive'
import { DUR, EASE_WEIGHT, STAGGER } from './tokens'

type Tag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div'

export type RevealTextProps = ArriveOptions & {
  /** plain text only (it is split into words) */
  children: string
  as?: Tag
  className?: string
  style?: CSSProperties
  id?: string
  /** 'line': lines rise in turn, words ripple slightly within a line (default). 'word': every word in turn. */
  by?: 'line' | 'word'
  /** seconds before the first line moves, after arriving */
  delay?: number
  /** seconds between lines (by="line") or words (by="word") */
  stagger?: number
  /** seconds for each word to rise (default 1.25) */
  duration?: number
  /** starting blur in px (default 6) */
  blur?: number
}

const HIDDEN: CSSProperties = { transform: 'translateY(115%)', opacity: 0 }

/** Splits the text into words, each inside its own clip mask (clip-path, so layout and text-wrap are untouched and
    textContent stays the plain sentence). On arrival it measures which line each word landed on and lifts the lines
    in turn. Remounts when the text changes, so a new title rises again. Reduced motion: shown at once. */
export function RevealText(props: RevealTextProps) {
  return <Split key={props.children} {...props} />
}

function Split({ children: text, as: Tag = 'span', className, style, id, by = 'line', delay = 0, stagger, duration = DUR.slow, blur = 6, amount = 0.4, ...arrive }: RevealTextProps) {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReduced()
  const go = useArrive(ref, { amount, sound: 'text', ...arrive })
  const [done, setDone] = useState(false)
  const words = text.split(/\s+/).filter(Boolean)

  useEffect(() => {
    const root = ref.current
    if (!go || reduce || done || !root) return
    const spans = [...root.querySelectorAll<HTMLElement>('[data-w]')]
    // which line did each word land on? (the masks are inline-blocks: same offsetTop, same line)
    const tops = spans.map((s) => (s.parentElement as HTMLElement).offsetTop)
    const lines = [...new Set(tops)].sort((a, b) => a - b)
    const seen = new Map<number, number>()
    const gap = stagger ?? (by === 'line' ? STAGGER.line : STAGGER.word * 1.6)
    const runs = spans.map((s, i) => {
      const line = lines.indexOf(tops[i])
      const inLine = seen.get(line) ?? 0
      seen.set(line, inLine + 1)
      const d = delay + (by === 'line' ? line * gap + inLine * STAGGER.word : i * gap)
      return animate(
        s,
        { transform: ['translateY(115%)', 'translateY(0%)'], opacity: [0, 1], filter: [`blur(${blur}px)`, 'blur(0px)'] },
        { duration, delay: d, ease: EASE_WEIGHT, opacity: { duration: duration * 0.5, delay: d, ease: 'linear' } },
      )
    })
    let alive = true
    Promise.all(runs.map((r) => r.finished)).then(() => {
      spans.forEach((s) => s.style.removeProperty('filter'))
      if (alive) setDone(true)
    }, () => {})
    return () => {
      alive = false
    }
  }, [go, reduce, done, by, delay, stagger, duration, blur])

  const still = reduce || done
  return (
    <Tag ref={ref as never} id={id} className={className} style={style}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="inline-block [clip-path:inset(-0.3em_-0.2em_-0.28em_-0.2em)]">
            <span data-w className="inline-block" style={still ? undefined : HIDDEN}>{w}</span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Tag>
  )
}
