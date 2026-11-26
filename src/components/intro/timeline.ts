/* Intro loader: shared timing, layout and mark geometry. Imported by the DOM driver (IntroLoader), the Three.js
   scene (scene.ts, loaded on demand) and the SVG fallback, so all three agree on where the mark sits on screen. */

/** Seconds. The scene clock starts when the renderer is ready; the plunge starts once the site is ready too. */
export const T = {
  sceneMin: 0.5, // the 3D scene never starts before this (the boot log owns the first moment)
  assemble: 2.0, // bits flowing in from deep space and condensing into the mark
  wordIn: 1.25, // after scene start: wordmark fades in (fully legible by about 2.55)
  hold: 3.2, // plunge no earlier than scene start + hold (the solid lockup is read for about a second before the dive)
  kernelLead: 0.45, // "jumping to kernel_main" is printed this long before the plunge
  plunge: 2.1, // dive into the wormhole, travel through the tunnel, open on the site through its exit
  dive: 0.6, // first part of the plunge: from the lockup into the wormhole's mouth
  maxWait: 6, // never wait longer than this for data or fonts
  rendererTimeout: 4, // three not ready by then: use the SVG fallback
  exit: 0.4, // skip: short iris exit
  iris: 0.45, // the site opening inside the light at the tunnel's exit (never faster than this)
}

/** Boot log lines, typed in the lower left. The last line is printed only when the site is ready. */
export const BOOT: { at: number; text: string }[] = [
  { at: 0.04, text: 'BIOS POST' },
  { at: 0.3, text: 'loading boot sector at 0x7C00' },
  { at: 0.62, text: 'enabling A20' },
  { at: 0.96, text: 'loading GDT' },
  { at: 1.32, text: 'entering protected mode' },
  { at: 1.74, text: 'enabling paging' },
  { at: -1, text: 'jumping to kernel_main' },
]

/** The scene runs this many times slower than its timings above (a heavier, more deliberate intro). */
export const SLOW = 1.5

export const FOV = 40

/** The master mark (brand.tsx, viewBox 0 0 40 40): path M30 6H8v28h22, circle (21,20) r 3.6, stroke 2.6.
    World units = viewBox units, origin at the centre of the stroked bounding box (19, 20), y up. */
export const MARK = {
  stroke: 2.6,
  half: 1.3,
  height: 30.6, // 28 + stroke
  /** the bracket as three solid bars (centre lines, world units) that tile the stroke exactly, square caps and mitred
      corners included, in drawing order from the top-right end */
  bars: [
    [[12.3, 14], [-12.3, 14]],
    [[-11, 12.7], [-11, -12.7]],
    [[-12.3, -14], [12.3, -14]],
  ] as [number, number][][],
  /** outline of the stroked bracket (a C), counter-clockwise, for the extruded 3D mark */
  outline: [
    [12.3, 15.3],
    [-12.3, 15.3],
    [-12.3, -15.3],
    [12.3, -15.3],
    [12.3, -12.7],
    [-9.7, -12.7],
    [-9.7, 12.7],
    [12.3, 12.7],
  ] as [number, number][],
  circle: { x: 2, y: 0, r: 3.6 },
  /** radius of the hole inside the circle (centre line minus half the stroke): the wormhole's event horizon */
  inner: 2.3,
  /** outer edge of the stroke: the bright band of the accretion disc ends here, a sparse halo continues outside */
  outer: 4.9,
}

/** Where the mark and the wordmark sit for a viewport (CSS px). Shared by the DOM text and both renderers. */
export function layout(w: number, h: number) {
  const small = w < 640
  const markPx = Math.round(Math.min(h * 0.34, w * (small ? 0.56 : 0.42), 340))
  const textH = small ? 70 : 100
  const gap = Math.round(markPx * 0.2)
  const top = (h - (markPx + gap + textH)) / 2
  return { small, markPx, markCY: top + markPx / 2, textTop: top + markPx + gap, textH }
}

export type Frame = {
  /** seconds since the scene started */
  t: number
  /** seconds since the plunge started, or -1 */
  plunge: number
  dt: number
  /** pointer, -1..1 (y up), smoothed; the mark and the camera lean towards it */
  px?: number
  py?: number
}
/** Iris hole in CSS px: the site shows through it. */
export type Iris = { x: number; y: number; r: number }

export interface Engine {
  kind: 'webgl' | 'svg'
  resize(w: number, h: number): void
  /** draw one frame; returns the iris once the site starts to show through the wormhole's exit */
  frame(f: Frame): Iris | null
  dispose(): void
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const easeOut3 = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)
export const easeIn3 = (x: number) => Math.pow(clamp01(x), 3)
export const easeInOut = (x: number) => {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Dive zoom: the mouth's apparent size grows exponentially (feels like constant speed), reaching its end at τ = 1. */
export const PLUNGE_POW = 1.7
export function plungeScale(tau: number, k: number) {
  return Math.exp(k * Math.pow(clamp01(tau), PLUNGE_POW))
}

/** Small seeded PRNG so the composition is the same on every load. */
export function rng(seed = 7) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
