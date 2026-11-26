/* Interface sound: clicks, hovers, toggles, keys, sliders, scrolling, panels, page transitions, entrance animations
   and the robot. Synthesised live with Web Audio (no files), soft and low: everything runs through a 3 kHz low-pass
   so nothing is sharp or hissy. On by default; off if the visitor chose "No sound" at the journey.
   Audio only starts on a real gesture (browsers' autoplay rules); nothing is queued before it. Silent while the
   onboarding journey runs (it has its own sound). */
import { useSyncExternalStore } from 'react'
import { onboarding } from './onboarding'

const KEY = 'cognia-sfx'
const VOL_KEY = 'cognia-sfx-volume'
const JOURNEY_KEY = 'cognia-osb-journey-sound'
/** loudness at 100%: about three times the first fixed level; the compressor keeps it clean */
const MAX_GAIN = 1.8

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* private mode */
  }
}

let ctx: AudioContext | null = null
let out: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let gestureAt = -1e9
let volume = (() => {
  const v = parseFloat(read(VOL_KEY) ?? '')
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6
})()
let lastAudible = volume > 0 ? volume : 0.6
let enabled = (read(KEY) ?? read(JOURNEY_KEY)) !== 'off' && volume > 0

const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

/** called from real gestures only: creates or wakes the audio context */
function unlock() {
  gestureAt = performance.now()
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3000
    lp.Q.value = 0.5
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 4
    out = ctx.createGain()
    out.gain.value = volume * MAX_GAIN
    out.connect(lp).connect(comp).connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    let b = 0
    for (let i = 0; i < d.length; i++) {
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1) // brown-ish: warm, no hiss
      d[i] = b * 6
    }
  }
  if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume()
}

/** the context, only when a sound may play now (never queue onto a sleeping context) */
function audio() {
  if (!enabled || !ctx || !out || onboarding.isActive()) return null
  if (ctx.state === 'running') return ctx
  // the gesture that is waking it right now still gets its own sound
  return ctx.state !== 'closed' && performance.now() - gestureAt < 300 ? ctx : null
}

/** a gliding tone with a soft envelope */
function tone(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine', at = 0) {
  const c = audio()
  if (!c || !out) return
  const t = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.2))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** filtered noise with a sweeping band (air, swish, whoosh) */
function air(dur: number, vol: number, fA: number, fB: number, fC = fA, at = 0) {
  const c = audio()
  if (!c || !out || !noiseBuf) return
  const t = c.currentTime + at
  const s = c.createBufferSource()
  s.buffer = noiseBuf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.9
  bp.frequency.setValueAtTime(fA, t)
  bp.frequency.exponentialRampToValueAtTime(fB, t + dur * 0.55)
  bp.frequency.exponentialRampToValueAtTime(fC, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.45)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(bp).connect(g).connect(out)
  s.start(t, Math.random())
  s.stop(t + dur + 0.05)
}

const throttle = (ms: number) => {
  let last = -1e9
  return () => {
    const now = performance.now()
    if (now - last < ms) return false
    last = now
    return true
  }
}
const hoverOk = throttle(70)
const tickOk = throttle(45)
const stepOk = throttle(80)
const panelOk = throttle(160)
const previewOk = throttle(120)
let lastArrive = 0
let arriveStep = 0
let scrollQuietUntil = 0
const NOTES = [196, 220, 247, 294, 330, 294, 247, 220] // a soft pentatonic walk for cascades and steps

export type ArriveSound = 'reveal' | 'text' | 'line' | 'count' | 'none'

export const sfx = {
  get volume() {
    return volume
  },
  get enabled() {
    return enabled
  },
  /** 0..1, remembered; 0 turns interface sound off. Plays a click so the level can be heard while dragging. */
  setVolume(v: number) {
    volume = Math.min(1, Math.max(0, v))
    if (volume > 0) lastAudible = volume
    write(VOL_KEY, String(volume))
    const on = volume > 0
    if (on !== enabled) {
      enabled = on
      write(KEY, on ? 'on' : 'off')
    }
    if (ctx && out) out.gain.setTargetAtTime(volume * MAX_GAIN, ctx.currentTime, 0.02)
    emit()
    if (previewOk()) sfx.click()
  },
  setEnabled(on: boolean) {
    enabled = on
    write(KEY, on ? 'on' : 'off')
    if (on && volume === 0) {
      volume = lastAudible
      write(VOL_KEY, String(volume))
      if (ctx && out) out.gain.setTargetAtTime(volume * MAX_GAIN, ctx.currentTime, 0.02)
    }
    emit()
    if (on) sfx.toggle(true)
  },
  /** silence the scroll wind for a moment (programmatic jumps: route changes, the end of the journey) */
  quietScroll(ms = 400) {
    scrollQuietUntil = performance.now() + ms
  },
  click() {
    tone(190, 85, 0.09, 0.32)
    air(0.05, 0.05, 1400, 900)
  },
  /** a press on anything that is not a control: quieter */
  tap() {
    tone(140, 80, 0.07, 0.14)
  },
  hover() {
    if (hoverOk()) tone(330, 300, 0.05, 0.035)
  },
  toggle(on: boolean) {
    const [a, b] = on ? [262, 392] : [392, 262]
    tone(a, a, 0.08, 0.16, 'triangle')
    tone(b, b, 0.12, 0.16, 'triangle', 0.07)
  },
  /** a detent: slider drags, arrow keys through tabs and lists. v (0..1) sets the pitch */
  tick(v = 0.5) {
    if (tickOk()) tone(130 + v * 110, 110 + v * 90, 0.035, 0.07, 'triangle')
  },
  /** a figure moves to its next step (concept animations) */
  step(i = 0) {
    if (!stepOk()) return
    const f = NOTES[i % NOTES.length]
    tone(f, f * 0.99, 0.2, 0.07, 'triangle')
    tone(f / 2, f / 2, 0.22, 0.05)
    air(0.2, 0.035, 300, 650, 350)
  },
  /** a panel, dialog or menu opens */
  open() {
    if (!panelOk()) return
    air(0.26, 0.1, 260, 900, 480)
    tone(196, 262, 0.14, 0.08, 'triangle')
  },
  /** it closes */
  close() {
    if (!panelOk()) return
    air(0.22, 0.08, 700, 300, 220)
    tone(220, 150, 0.12, 0.07)
  },
  /** a lesson is finished: a soft rising triad */
  done() {
    tone(196, 196, 0.3, 0.1, 'triangle')
    tone(247, 247, 0.3, 0.1, 'triangle', 0.09)
    tone(294, 294, 0.7, 0.11, 'triangle', 0.18)
    tone(98, 98, 0.9, 0.09, 'sine')
    air(0.7, 0.06, 200, 800, 300)
  },
  /** a plate lands (the hero's stack assembling); i lifts the pitch a little per layer */
  plate(i = 0) {
    tone(95 + i * 11, 58, 0.2, 0.12)
    air(0.14, 0.035, 220, 420, 260)
  },
  /** section change: the shutter closes */
  cover() {
    sfx.quietScroll(1600)
    air(0.55, 0.22, 180, 1300, 260)
    tone(70, 45, 0.6, 0.22)
  },
  /** the new page opens */
  reveal() {
    sfx.quietScroll(600)
    for (const [f, d] of [[110, 0], [165, 0.03], [220, 0.06]]) tone(f, f * 0.995, 0.9, 0.07, 'sine', d)
    air(0.5, 0.08, 600, 300, 200)
  },
  /** same section: a quick slide */
  slide() {
    sfx.quietScroll(900)
    air(0.26, 0.14, 300, 1100, 500)
    tone(150, 110, 0.14, 0.08)
  },
  /** an element animates in (Reveal, RevealText, Stagger, CountUp, DrawLine): rapid arrivals become a soft cascade */
  arrive(kind: ArriveSound = 'reveal') {
    if (kind === 'none' || !audio()) return
    const now = performance.now()
    if (now - lastArrive < 55) return
    arriveStep = now - lastArrive < 600 ? arriveStep + 1 : 0
    lastArrive = now
    const f = NOTES[arriveStep % NOTES.length]
    if (kind === 'line') return void air(0.4, 0.07, 250, 900, 400)
    if (kind === 'count') {
      for (let i = 0; i < 6; i++) tone(f * 1.5, f * 1.5, 0.03, 0.035, 'triangle', i * 0.07)
      return
    }
    if (kind === 'text') {
      tone(f / 2, f / 2, 0.5, 0.06)
      air(0.35, 0.05, 300, 700, 300)
      return
    }
    tone(f, f * 0.99, 0.35, 0.05, 'sine')
    tone(f / 2, f / 2, 0.3, 0.05)
    air(0.28, 0.04, 260, 620, 300)
  },
  /** the robot chatters back */
  robot(n = 3 + Math.floor(Math.random() * 3)) {
    let at = 0
    for (let i = 0; i < n; i++) {
      const f = 280 + Math.random() * 420
      const d = 0.05 + Math.random() * 0.07
      tone(f, f * (0.7 + Math.random() * 0.8), d, 0.09, i % 2 ? 'square' : 'triangle', at)
      at += d + 0.02
    }
    tone(90, 60, 0.18, 0.12)
  },
  robotHover() {
    if (hoverOk()) tone(420, 620, 0.09, 0.05, 'triangle')
  },
}

/* scrolling (the page and any scrolling panel): a wind that swells with speed, and a soft detent tick every stretch */
function initScroll() {
  let wind: GainNode | null = null
  let bp: BiquadFilterNode | null = null
  const last = new WeakMap<object, { y: number; t: number }>()
  let travel = 0
  let vel = 0
  let raf = 0
  const pos = (t: EventTarget | null) => (t instanceof Element ? t.scrollTop + t.scrollLeft : window.scrollY + window.scrollX)
  const ensure = () => {
    const c = audio()
    if (!c || !out || !noiseBuf) return false
    if (!wind) {
      const s = c.createBufferSource()
      s.buffer = noiseBuf
      s.loop = true
      bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 0.7
      bp.frequency.value = 250
      wind = c.createGain()
      wind.gain.value = 0
      s.connect(bp).connect(wind).connect(out)
      s.start()
    }
    return true
  }
  const decay = () => {
    vel *= 0.86
    if (ctx && wind && bp) {
      wind.gain.setTargetAtTime(audio() ? Math.min(0.16, vel * 0.00006) : 0, ctx.currentTime, 0.06)
      bp.frequency.setTargetAtTime(200 + Math.min(900, vel * 0.25), ctx.currentTime, 0.08)
    }
    raf = vel > 5 ? requestAnimationFrame(decay) : 0
    if (!raf && ctx && wind) wind.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
  }
  document.addEventListener(
    'scroll',
    (e) => {
      const key = e.target instanceof Element ? e.target : document
      const now = performance.now()
      const y = pos(e.target)
      const prev = last.get(key)
      last.set(key, { y, t: now })
      if (!prev || now < scrollQuietUntil) return
      const dy = Math.abs(y - prev.y)
      const dt = Math.max(8, now - prev.t)
      if (dy > window.innerHeight * 1.5) return // a jump, not a scroll
      if (e.target instanceof Element && e.target.closest('[data-sfx="none"]')) return
      if (!ensure()) return
      vel = Math.max(vel, Math.min(6000, (dy / dt) * 1000))
      travel += dy
      if (travel > 140) {
        travel = 0
        tone(120, 95, 0.05, 0.05)
      }
      if (!raf) raf = requestAnimationFrame(decay)
    },
    { capture: true, passive: true },
  )
}

const INTERACTIVE =
  'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="slider"], [role="radio"], [role="checkbox"], [data-slot="slider"], summary, select, input, label[for]'
const ARROW_NAV = '[role="tab"], [role="tablist"], [role="option"], [role="listbox"], [role="menuitem"], [role="menu"], [role="radio"], [role="radiogroup"]'

/** wires interface sound into the whole page (call once) */
export function initSfx() {
  initScroll()
  for (const ev of ['pointerup', 'touchend', 'click'] as const) document.addEventListener(ev, unlock, { capture: true, passive: true })
  let hovered: Element | null = null
  document.addEventListener(
    'pointerdown',
    (e) => {
      unlock()
      const t = e.target as Element | null
      if (t?.closest?.('[data-sfx="none"]')) return
      const el = t?.closest?.(INTERACTIVE)
      if (!el) return sfx.tap()
      if (el.closest('[data-sfx="robot"]')) return sfx.robot()
      const pressed = el.getAttribute('aria-pressed') ?? el.getAttribute('aria-checked') ?? (el.getAttribute('role') === 'switch' ? 'false' : null)
      if (pressed !== null && pressed !== 'mixed') return sfx.toggle(pressed !== 'true')
      sfx.click()
    },
    { capture: true, passive: true },
  )
  document.addEventListener(
    'keydown',
    (e) => {
      unlock()
      if (e.repeat && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      const t = e.target as Element | null
      if (t?.closest?.('[data-sfx="none"]')) return
      if (e.key === 'Escape') return sfx.close()
      if (e.key === 'Enter' || e.key === ' ') {
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
        const el = t?.closest?.(INTERACTIVE)
        if (el) return el.closest('[data-sfx="robot"]') ? sfx.robot() : sfx.click()
        if (t instanceof HTMLElement && t.tabIndex >= 0 && t !== document.body) sfx.tap()
        return
      }
      if (/^(Arrow(Up|Down|Left|Right)|Home|End|PageUp|PageDown)$/.test(e.key) && t?.closest?.(ARROW_NAV)) sfx.tick()
    },
    { capture: true, passive: true },
  )
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse') return
      const el = (e.target as Element | null)?.closest?.(INTERACTIVE) ?? null
      if (el === hovered) return
      hovered = el
      if (!el || el.closest('[data-sfx="none"]')) return
      if (el.closest('[data-sfx="robot"]')) return sfx.robotHover()
      sfx.hover()
    },
    { passive: true },
  )
}

/** { volume, enabled } for controls */
export function useSfx() {
  const volume = useSyncExternalStore(subscribe, () => sfx.volume)
  const enabled = useSyncExternalStore(subscribe, () => sfx.enabled)
  return { volume, enabled }
}
