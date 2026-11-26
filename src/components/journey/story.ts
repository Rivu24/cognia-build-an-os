/* The home journey's script: one scroll from the Big Bang to the COGNIA wormhole. Shared by the 3D scene, the
   captions and the sound, so all three agree on where each chapter starts. p is the smoothed scroll progress, 0..1. */

export type ChapterId = 'void' | 'bang' | 'expansion' | 'galaxy' | 'sun' | 'orbit' | 'earth' | 'iss' | 'voyager' | 'cognia' | 'dive'

/** chapter start points (each runs until the next one starts; dive ends at 1) */
export const CH: Record<ChapterId, number> = {
  void: 0,
  bang: 0.03, // the singularity flashes and the universe expands from here
  expansion: 0.055,
  galaxy: 0.16, // matter settles into galaxies; the camera flies into one of them
  sun: 0.27, // one star grows into the Sun; we arrive behind it
  orbit: 0.34, // past the Sun's side, through the corona
  earth: 0.48,
  iss: 0.575, // the station in low Earth orbit: as far as people live today
  voyager: 0.65, // out through the Van Allen belts to the farthest machine
  cognia: 0.8, // the mark appears; its circle is a wormhole
  dive: 0.925, // into the wormhole
}

/** the closest pass through the corona (inside the orbit chapter) */
export const CORONA = 0.41

/** Captions, shown while p is inside [from, to] (with soft edges). `big` marks the closing lines. */
export const CAPTIONS: { from: number; to: number; eyebrow?: string; text: string; big?: boolean }[] = [
  { from: 0.008, to: 0.03, eyebrow: '13.8 billion years in one scroll', text: 'Everything began as a single point.' },
  { from: 0.075, to: 0.15, text: 'Then it expanded, and it has not stopped.' },
  { from: 0.18, to: 0.26, text: 'Gas gathered into galaxies. Galaxies made stars.' },
  { from: 0.29, to: 0.335, text: 'One of them is ours.' },
  { from: 0.38, to: 0.445, eyebrow: 'The corona · over a million degrees', text: 'Every second it turns four million tonnes of itself into light.' },
  { from: 0.5, to: 0.55, eyebrow: 'Earth', text: 'The third planet. Our only home, so far.' },
  { from: 0.588, to: 0.632, eyebrow: 'International Space Station · 400 km', text: 'This is as far as people live today.' },
  { from: 0.652, to: 0.69, eyebrow: 'The Van Allen belts', text: "Earth's magnetic field holds back the Sun's radiation." },
  { from: 0.738, to: 0.79, eyebrow: 'Voyager 1 · launched 1977 · 167 AU', text: 'Our farthest machine is still flying.' },
  { from: 0.82, to: 0.875, text: 'If you want to go beyond what humanity is today,', big: true },
  { from: 0.88, to: 0.94, text: 'you need to get into COGNIA.', big: true },
  { from: 0.99, to: 0.9985, text: 'Welcome inside.', big: true },
]

/** which chapter p is in */
export function chapterAt(p: number): ChapterId {
  let cur: ChapterId = 'void'
  for (const k of Object.keys(CH) as ChapterId[]) if (p >= CH[k]) cur = k
  return cur
}

/** 0..1 progress through the span [a, b] */
export const span = (a: number, b: number, p: number) => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a))

/** A sound-emitting object in listener space: the camera's frame (x right, y up, -z forward), in world units, plus
    its distance and an object-specific "presence" 0..1 (how much it matters right now; 0 when not in the story). */
export type Emitter = { x: number; y: number; z: number; d: number; on: number }
export type JourneyObjects = Record<'singularity' | 'sun' | 'earth' | 'iss' | 'voyager' | 'wormhole', Emitter>

/** The state the scene publishes every frame (read by the sound and the captions). */
export type JourneyFrame = {
  /** smoothed scroll progress 0..1 */
  p: number
  /** scroll speed in p per second (signed, smoothed) */
  v: number
  /** seconds since the scene started (idle motion runs on this) */
  t: number
  dt: number
  chapter: ChapterId
  /** 0..1: how close the camera is to the Sun's surface (1 = skimming the corona) */
  sun: number
  /** 0..1: the Big Bang flash */
  flash: number
  /** pointer, -1..1 (y up), smoothed */
  mx: number
  my: number
  /** the stage is on screen */
  visible: boolean
  /** camera speed in world units per second (log-scale it: it spans 0 to ~10^5 in the galaxy flight) */
  speed: number
  /** 0..1, the camera is through the wormhole's throat */
  inside: number
  /** positions of the things that make sound, relative to the camera (for HRTF panning) */
  objs: JourneyObjects
}
