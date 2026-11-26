/* The small robot in the folded bar: an SVG face whose eyes follow the pointer and whose head bounces with the music.
   Drawn in currentColor, so it takes the theme ink. The frame loop only runs while there is something to animate:
   music playing, the pointer moving, or a blink. Idle, it costs nothing. */
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { useMusic } from '@/lib/music'
import { cursor, gazeFrom, watchCursor } from '@/components/music/cursor'
import { createLevels } from '@/components/music/levels'
import { cn } from '@/lib/utils'

const EYE = 5 // eye square size in viewBox units
const EYES = [9.5, 20.5] // eye centres (x)
const EYE_Y = 12

export function RobotFace({ className }: { className?: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const head = useRef<SVGGElement>(null)
  const eyes = useRef<(SVGRectElement | null)[]>([])
  const mouth = useRef<(SVGRectElement | null)[]>([])
  const light = useRef<SVGCircleElement>(null)
  const playing = useMusic((s) => s.playing)
  const reduce = !!useReducedMotion()
  const live = useRef({ playing, reduce })
  live.current = { playing, reduce }
  const kick = useRef<() => void>(() => {})
  useEffect(() => kick.current(), [playing, reduce])

  useEffect(() => {
    const el = svg.current
    if (!el) return
    const { L, sample } = createLevels(3)
    const gaze = { x: 0, y: 0 }
    const g = { x: 0, y: 0 } // eased gaze
    let open = playing ? 1 : 0 // 1 = eyes open, 0 = asleep (a line)
    let bob = 0
    let blinkAt = -1 // performance.now() a blink started, -1 = none
    let raf = 0
    let last = 0
    let rect = el.getBoundingClientRect()
    let rectAt = 0
    let blinkTimer = 0

    const scheduleBlink = () => {
      window.clearTimeout(blinkTimer)
      blinkTimer = window.setTimeout(() => {
        if (live.current.playing && document.visibilityState === 'visible') {
          blinkAt = performance.now()
          kick.current()
        }
        scheduleBlink()
      }, 2400 + Math.random() * 4200)
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016)
      last = now
      const { playing: on, reduce: rm } = live.current
      if (now - rectAt > 500) {
        rect = el.getBoundingClientRect()
        rectAt = now
      }
      gazeFrom(rect.left + rect.width / 2, rect.top + rect.height / 2, gaze)
      const ease = rm ? 1 : 1 - Math.exp(-dt * 16)
      g.x += (gaze.x - g.x) * ease
      g.y += (gaze.y - g.y) * ease
      open += ((on ? 1 : 0) - open) * (rm ? 1 : 1 - Math.exp(-dt * 10))
      const lv = sample(on, dt)
      if (lv.beat && !rm) bob = 1
      bob *= Math.exp(-dt * 9)

      let blink = 1
      if (blinkAt >= 0) {
        const p = (now - blinkAt) / 160
        if (p >= 1) blinkAt = -1
        else blink = Math.abs(p * 2 - 1)
      }
      const o = Math.max(0.12, Math.min(open, blink))
      const h = EYE * o
      eyes.current.forEach((r, i) => {
        if (!r) return
        const cx = EYES[i] + g.x * 1.6
        const cy = EYE_Y + g.y * 1.4
        r.setAttribute('x', String(cx - EYE / 2))
        r.setAttribute('y', String(cy - h / 2))
        r.setAttribute('height', String(h))
      })
      const mid = [L.bands[1], L.bands[0], L.bands[2]]
      mouth.current.forEach((r, i) => {
        if (!r) return
        const mh = 1 + (on ? mid[i] * 3.2 : 0)
        r.setAttribute('y', String(20 - mh / 2))
        r.setAttribute('height', String(mh))
      })
      head.current?.setAttribute('transform', `translate(0 ${(-bob * 1.6).toFixed(2)})`)
      if (light.current) light.current.style.opacity = String(on ? 0.45 + L.bass * 0.55 : 0.35)

      const moving = now - cursor.at < 1200
      const settled = Math.abs(gaze.x - g.x) < 0.002 && Math.abs(gaze.y - g.y) < 0.002 && Math.abs(open - (on ? 1 : 0)) < 0.002
      const busy = on || moving || blinkAt >= 0 || !settled || bob > 0.01 || L.energy > 0.002
      raf = busy && document.visibilityState === 'visible' ? requestAnimationFrame(frame) : 0
      if (!raf) last = 0
    }

    kick.current = () => {
      if (!raf && document.visibilityState === 'visible') raf = requestAnimationFrame(frame)
    }
    const stop = watchCursor(() => kick.current())
    const vis = () => kick.current()
    document.addEventListener('visibilitychange', vis)
    scheduleBlink()
    raf = requestAnimationFrame(frame)
    return () => {
      kick.current = () => {}
      cancelAnimationFrame(raf)
      window.clearTimeout(blinkTimer)
      document.removeEventListener('visibilitychange', vis)
      stop()
    }
    // the loop reads live values through refs; it is set up once
  }, [])

  return (
    <svg ref={svg} viewBox="0 0 30 26" aria-hidden className={cn('block overflow-visible', className)} fill="currentColor">
      <g ref={head}>
        {/* antenna */}
        <line x1="15" y1="2.6" x2="15" y2="5.5" stroke="currentColor" strokeWidth="1.2" />
        <circle ref={light} cx="15" cy="2" r="1.6" style={{ opacity: 0.35 }} />
        {/* head */}
        <rect x="3.6" y="5.6" width="22.8" height="18" fill="none" stroke="currentColor" strokeWidth="1.3" />
        {/* ears */}
        <rect x="1" y="11" width="2" height="6" />
        <rect x="27" y="11" width="2" height="6" />
        {EYES.map((x, i) => (
          <rect key={i} ref={(r) => { eyes.current[i] = r }} x={x - EYE / 2} y={EYE_Y - 0.3} width={EYE} height={0.6} />
        ))}
        {[12, 15, 18].map((x, i) => (
          <rect key={x} ref={(r) => { mouth.current[i] = r }} x={x - 0.8} y={19.5} width={1.6} height={1} />
        ))}
      </g>
    </svg>
  )
}
