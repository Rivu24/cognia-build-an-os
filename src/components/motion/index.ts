/* Motion kit: weight, not bounce.

   The site should feel heavy and calm as you scroll. Everything here shares one physics (tokens.ts): slow eases that
   leave fast and settle long ([0.16, 1, 0.3, 1] over 1.1 to 1.4 s) and heavy, nearly critically damped springs. Things
   arrive lazily: each piece watches the viewport once, does nothing off screen, waits while the intro or a route
   transition covers the page (arrive.ts), and honours prefers-reduced-motion (a short fade, or nothing).

   Pieces, and when to use them:
   - <RevealText as="h1">Text</RevealText>  Big headlines. Words rise out of clip masks line by line (by="word" for
     short titles that should ripple), with a slight blur. Plain strings only. textContent stays the sentence.
   - <Reveal>  A section, card or figure settling into place: y 60 to 0, scale .97 to 1, blur 6 to 0, optional tilt
     (tilt={6}). Use blur={0} on tall blocks. Never wrap reading content you came to read (wiki article text, lesson
     body): reveal the chrome around it instead.
   - <Stagger> + <StaggerItem>  Rows of chips, cards or short lists that cascade in. For dozens of items use
     stagger={STAGGER.dense}; for hundreds, Reveal the group instead.
   - <Parallax speed={0.2}>  Decoration that drifts against the scroll (hero art, big numerals). Not text.
   - <DrawLine />  Hairline rules (1px, line colour) that draw across, or down with `vertical`.
   - <CountUp value={758} />  Numbers that count up on arrival (tabular figures; screen readers get the final value).
   - <Magnetic>  One or two primary buttons per screen lean toward the cursor and spring back. Fine pointers only.
   - <SmoothScroll>  Lenis inertial scrolling (lerp 0.09). Mount once in App/AppShell. Off for reduced motion and
     touch. Pauses itself while a dialog or the Sheet locks the page; smoothScroll.stop()/start() or
     useSmoothScrollLock(active) pause it from code. Inner scroll areas scroll natively (nested scrollables are
     detected; add data-lenis-prevent to force it). For in-page links use scrollToId(id) / scrollToElement(el):
     same glide when Lenis runs, native smooth scroll otherwise, and correct even while the target is mid-Reveal.
   - useArrive(ref)  The trigger behind all of the above, for custom one-off entrances.

   Restraint: one RevealText per screen, Reveal per section rather than per paragraph, Parallax on one or two things. */
export * from './tokens'
export { useArrive, useReduced, whenStageClear, type ArriveOptions } from './arrive'
export { Reveal, type RevealProps, type MotionTag } from './Reveal'
export { RevealText, type RevealTextProps } from './RevealText'
export { Stagger, StaggerItem, type StaggerProps, type StaggerItemProps } from './Stagger'
export { Parallax, type ParallaxProps } from './Parallax'
export { DrawLine, type DrawLineProps } from './DrawLine'
export { CountUp, type CountUpProps } from './CountUp'
export { Magnetic, type MagneticProps } from './Magnetic'
export {
  SmoothScroll,
  smoothScroll,
  scrollToElement,
  scrollToId,
  useLenis,
  useSmoothScrollLock,
  type SmoothScrollProps,
} from './SmoothScroll'
