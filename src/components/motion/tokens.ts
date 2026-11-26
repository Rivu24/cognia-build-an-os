/* One physics for the whole site. Weight comes from mass and slowness, not from bounce: the springs are heavy and
   nearly critically damped, the eases leave fast and settle long. Import these instead of inventing new numbers. */
import type { Transition } from 'motion/react'

/** Slow exponential settle: leaves quickly, arrives over a long tail. */
export const EASE_WEIGHT = [0.16, 1, 0.3, 1] as const
/** A softer settle for small things (chips, labels). */
export const EASE_SETTLE = [0.22, 1, 0.36, 1] as const

/** Durations in seconds. */
export const DUR = {
  /** reduced-motion fades and small chrome */
  quick: 0.4,
  /** blocks settling into place */
  base: 1.1,
  /** headlines rising out of their masks */
  slow: 1.25,
  /** hairlines drawing, numbers counting */
  slower: 1.4,
} as const

/** Stagger intervals in seconds. */
export const STAGGER = {
  /** words in a line */
  word: 0.035,
  /** lines in a headline */
  line: 0.12,
  /** cards, chips, list items */
  item: 0.08,
  /** dense lists (dozens of small things) */
  dense: 0.02,
} as const

/** A heavy body: slow to start, no visible overshoot. */
export const SPRING_HEAVY = { type: 'spring', mass: 1.4, stiffness: 90, damping: 22 } as const satisfies Transition
/** Heavy but responsive: for things that follow the pointer (Magnetic). */
export const SPRING_FOLLOW = { type: 'spring', mass: 0.9, stiffness: 140, damping: 18 } as const satisfies Transition
/** Scroll-linked smoothing for parallax (a little lag reads as mass). */
export const SPRING_DRIFT = { mass: 0.6, stiffness: 80, damping: 24, restDelta: 0.5 } as const

/** Ease transition helper. */
export const weighted = (duration: number = DUR.base, delay = 0): Transition => ({ duration, delay, ease: EASE_WEIGHT })

/** How much of an element must be on screen before it arrives. */
export const VIEW_AMOUNT = 0.25
