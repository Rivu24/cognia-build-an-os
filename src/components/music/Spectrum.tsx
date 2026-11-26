/* Live frequency bars drawn from the audio analyser. Monochrome: colours come from the theme tokens.
   Paused, the bars settle to a flat line and the loop stops, so an idle player costs nothing. */
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { getAnalyser, useMusic } from '@/lib/music'

export function Spectrum({ bars = 48, variant = 'full', className }: { bars?: number; variant?: 'full' | 'mini'; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const playing = useMusic((s) => s.playing)
  const reduce = !!useReducedMotion()
  const live = useRef(playing)
  const still = useRef(reduce)
  const kick = useRef<() => void>(() => {})
  live.current = playing
  still.current = reduce
  // start the draw loop again when playback resumes (it stops itself once the bars have settled)
  useEffect(() => kick.current(), [playing, reduce])

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const g0 = cv.getContext('2d')
    if (!g0) return
    const g: CanvasRenderingContext2D = g0
    const levels = new Float32Array(bars)
    const peaks = new Float32Array(bars)
    let data: Uint8Array<ArrayBuffer> | null = null
    let raf = 0
    let frame = 0
    let fg = '#ececea'
    let dim = '#8c8c8a'
    let w = 0
    let h = 0

    const colours = () => {
      const cs = getComputedStyle(cv)
      fg = cs.getPropertyValue('--viz-fg').trim() || fg
      dim = cs.getPropertyValue('--viz-dim').trim() || dim
    }
    const size = () => {
      // layout size, not getBoundingClientRect (which includes the panel's opening scale)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = Math.max(1, cv.clientWidth)
      h = Math.max(1, cv.clientHeight)
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw()
    }

    // log-spaced bands, low bins weighted so bass reads as movement, not a wall
    const band = (i: number, n: number) => {
      const lo = 1
      const hi = Math.round(n * (variant === 'mini' ? 0.47 : 0.78))
      const a = Math.floor(lo * Math.pow(hi / lo, i / bars))
      const b = Math.max(a + 1, Math.floor(lo * Math.pow(hi / lo, (i + 1) / bars)))
      return [a, b] as const
    }

    function sample() {
      const an = getAnalyser()
      if (!an || !live.current) {
        for (let i = 0; i < bars; i++) levels[i] += (0 - levels[i]) * 0.12
        return
      }
      if (!data || data.length !== an.frequencyBinCount) data = new Uint8Array(an.frequencyBinCount)
      an.getByteFrequencyData(data)
      // reduced motion: a few samples a second, set directly, no easing
      const rm = still.current
      if (rm && frame % 15 !== 0) return
      for (let i = 0; i < bars; i++) {
        const [a, b] = band(i, data.length)
        let s = 0
        for (let k = a; k < b && k < data.length; k++) s += data[k]
        const v = Math.pow(s / Math.max(1, b - a) / 255, 1.35) * (0.8 + (i / bars) * 0.5)
        levels[i] = rm ? Math.min(1, v) : levels[i] + (Math.min(1, v) - levels[i]) * (v > levels[i] ? 0.55 : 0.18)
      }
    }

    function draw() {
      g.clearRect(0, 0, w, h)
      if (variant === 'mini') {
        const gap = 2
        const bw = (w - gap * (bars - 1)) / bars
        g.fillStyle = fg
        for (let i = 0; i < bars; i++) {
          const bh = Math.max(2, levels[i] * h)
          g.fillRect(i * (bw + gap), h - bh, bw, bh)
        }
        return
      }
      const gap = 3
      const bw = (w - gap * (bars - 1)) / bars
      const mid = h * 0.7
      // baseline hairline
      g.globalAlpha = 0.35
      g.fillStyle = dim
      g.fillRect(0, mid, w, 1)
      for (let i = 0; i < bars; i++) {
        const x = i * (bw + gap)
        const bh = Math.max(1.5, levels[i] * (mid - 10))
        peaks[i] = Math.max(peaks[i] - 0.006, levels[i])
        // bar
        g.globalAlpha = 0.35 + levels[i] * 0.65
        g.fillStyle = fg
        g.fillRect(x, mid - bh, bw, bh)
        // falling peak cap
        g.globalAlpha = 0.9
        g.fillRect(x, mid - Math.max(1.5, peaks[i] * (mid - 10)) - 4, bw, 2)
        // reflection
        g.globalAlpha = 0.16
        g.fillRect(x, mid + 3, bw, bh * 0.42)
      }
      g.globalAlpha = 1
    }

    function loop() {
      sample()
      draw()
      if (++frame % 30 === 0) colours()
      const settled = !live.current && levels.every((v) => v < 0.002) && peaks.every((v) => v < 0.004)
      raf = settled ? 0 : requestAnimationFrame(loop)
    }

    colours()
    size()
    const ro = new ResizeObserver(size)
    ro.observe(cv)
    window.addEventListener('resize', size) // a DPR change (zoom, another monitor)
    // theme switch: repaint in the new ink
    const mo = new MutationObserver(() => {
      colours()
      draw()
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    kick.current = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      kick.current = () => {}
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', size)
    }
  }, [bars, variant])

  return <canvas ref={ref} aria-hidden className={className} style={{ display: 'block', width: '100%', height: '100%' }} />
}
