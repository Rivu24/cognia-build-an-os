/* The home journey: a tall section whose scroll scrubs one continuous 3D story, from the Big Bang to the COGNIA
   wormhole. The stage is sticky; the scene (three, loaded on demand) runs only while the section is on screen.
   A minimal prompt offers the sound experience once the scene is ready. Without WebGL 2, or with reduced motion,
   the section is not rendered at all and the page opens on the hero. */
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Volume2, VolumeX } from 'lucide-react'
import { bootScreen } from '@/lib/intro'
import { onboarding } from '@/lib/onboarding'
import { music, useMusic } from '@/lib/music'
import { sfx } from '@/lib/sfx'
import { cn } from '@/lib/utils'
import { canJourney } from './capable'
import { CAPTIONS, type ChapterId, type JourneyFrame } from './story'
import { createJourneySound, type JourneySound } from './sound'
import type { JourneyEngine } from './scene'

const NAMES: Record<ChapterId, string> = {
  void: 'The beginning',
  bang: 'The Big Bang',
  expansion: 'Expansion',
  galaxy: 'Our galaxy',
  sun: 'The Sun',
  orbit: 'Around the Sun',
  earth: 'Earth',
  iss: 'The station',
  voyager: 'Voyager',
  cognia: 'COGNIA',
  dive: 'Beyond',
}
const ORDER = Object.keys(NAMES) as ChapterId[]
const SOUND_KEY = 'cognia-osb-journey-sound'

const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** The home onboarding. At the end of the dive (or on Skip) it fades to black and hands the page to the site. */
export function Journey() {
  const [able] = useState(canJourney)
  const section = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const caps = useRef<(HTMLDivElement | null)[]>([])
  const bar = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  const cue = useRef<HTMLDivElement>(null)
  const sound = useRef<JourneySound | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [ask, setAsk] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const volume = useMusic((s) => s.volume)
  const leave = useRef(() => {})
  leave.current = () => {
    if (leaving) return
    setLeaving(true)
    sound.current?.setMuted(true)
    const withMusic = soundOn // the visitor already said yes to sound: the music player takes over, fading in
    const to = volume > 0.02 ? volume : 0.6
    window.setTimeout(() => {
      onboarding.finish()
      if (!withMusic) return
      sfx.reveal()
      music.setVolume(0.02)
      music.play()
      const t0 = performance.now()
      const id = window.setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / 4000)
        music.setVolume(0.02 + (to - 0.02) * k * k)
        if (k >= 1) window.clearInterval(id)
      }, 80)
    }, 650)
  }

  useEffect(() => {
    if (!able) bootScreen.release()
  }, [able])

  useEffect(() => {
    if (!able) return
    const sec = section.current!
    const st = stage.current!
    const hostEl = host.current!
    let engine: JourneyEngine | null = null
    let cancelled = false
    let shownChapter: ChapterId | null = null

    const getTarget = () => {
      const r = sec.getBoundingClientRect()
      const run = r.height - st.clientHeight
      return run > 0 ? -r.top / run : 0
    }
    const onFrame = (f: JourneyFrame) => {
      sound.current?.update(f)
      if (import.meta.env.DEV) sec.dataset.p = f.p.toFixed(4) // probe for tools/journey-check.mjs
      if (f.p > 0.9985) leave.current() // the dive has ended in black: the site arrives
      // captions: soft in and out at the edges of their span
      CAPTIONS.forEach((c, i) => {
        const el = caps.current[i]
        if (!el) return
        const o = sm(c.from - 0.012, c.from + 0.006, f.p) * (1 - sm(c.to - 0.006, c.to + 0.012, f.p))
        const s = o.toFixed(3)
        if (el.dataset.o === s) return
        el.dataset.o = s
        el.style.opacity = s
        el.style.transform = `translate3d(0, ${((1 - o) * 26).toFixed(1)}px, 0)`
        el.style.filter = o < 0.999 ? `blur(${((1 - o) * 8).toFixed(1)}px)` : ''
        el.style.visibility = o > 0.001 ? 'visible' : 'hidden'
      })
      if (bar.current) bar.current.style.transform = `scaleX(${f.p.toFixed(4)})`
      if (cue.current) cue.current.style.opacity = String(1 - sm(0.002, 0.012, f.p))
      if (label.current && f.chapter !== shownChapter) {
        shownChapter = f.chapter
        label.current.textContent = `${String(ORDER.indexOf(f.chapter) + 1).padStart(2, '0')} · ${NAMES[f.chapter]}`
      }
    }

    import('./scene')
      .then((m) => m.createJourney(hostEl, { getTarget, onFrame }))
      .then((e) => {
        if (cancelled) return e.dispose()
        engine = e
        bootScreen.release()
        setReady(true)
        setAsk(true)
      })
      .catch(() => {
        if (cancelled) return
        bootScreen.release()
        setFailed(true)
      })

    const io = new IntersectionObserver(([en]) => engine?.setActive(en.isIntersecting), { rootMargin: '10% 0px' })
    io.observe(sec)
    const ro = new ResizeObserver(() => engine?.resize(hostEl.clientWidth, hostEl.clientHeight))
    ro.observe(hostEl)
    return () => {
      cancelled = true
      io.disconnect()
      ro.disconnect()
      engine?.dispose()
      sound.current?.dispose()
      sound.current = null
    }
  }, [able])

  const choose = (on: boolean) => {
    setAsk(false)
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
      sfx.setEnabled(on)
    } catch {
      /* private mode */
    }
    if (on) enable()
  }
  const enable = () => {
    if (!sound.current) sound.current = createJourneySound()
    const s = sound.current
    music.pause() // one soundtrack at a time
    if (s.isRunning()) s.setMuted(false)
    else void s.start()
    setSoundOn(true)
  }
  const toggle = () => {
    if (soundOn) {
      sound.current?.setMuted(true)
      setSoundOn(false)
    } else enable()
  }
  const prefers = (() => {
    try {
      return localStorage.getItem(SOUND_KEY)
    } catch {
      return null
    }
  })()

  if (!able || failed) return null

  return (
    <section ref={section} aria-label="The journey: from the Big Bang to COGNIA" className="relative h-[1000svh] bg-black text-white">
      <div ref={stage} className="sticky top-0 h-svh overflow-hidden">
        <div ref={host} className="absolute inset-0" />

        {/* captions */}
        <div className="pointer-events-none absolute inset-0">
          {CAPTIONS.map((c, i) => (
            <div key={i} ref={(el) => void (caps.current[i] = el)} style={{ opacity: 0, visibility: 'hidden' }}
              className={cn('absolute will-change-transform',
                c.big
                  ? 'inset-x-6 top-1/2 -translate-y-1/2 text-center sm:inset-x-12'
                  : 'bottom-[18%] left-6 max-w-[min(680px,calc(100%-48px))] sm:left-10 lg:left-14 xl:left-20')}>
              {c.eyebrow && <div className="mb-4 font-mono text-[11px] tracking-[.14em] text-white/60 uppercase">{c.eyebrow}</div>}
              <p className={cn('font-semibold text-balance text-white',
                c.big ? 'mx-auto max-w-[18ch] text-[clamp(36px,6.4vw,104px)] leading-[.98] tracking-[-.045em]' : 'text-[clamp(26px,3.4vw,52px)] leading-[1.06] tracking-[-.03em]')}
                style={{ textShadow: '0 2px 30px rgba(0,0,0,.65)' }}>
                {c.text}
              </p>
            </div>
          ))}
        </div>

        {/* scroll cue */}
        <div ref={cue} className="pointer-events-none absolute inset-x-0 bottom-[9%] flex flex-col items-center gap-3 transition-opacity">
          <span className="font-mono text-[11px] tracking-[.18em] text-white/70 uppercase">Scroll slowly</span>
          <span className="relative block h-12 w-px overflow-hidden bg-white/15">
            <span className="absolute inset-x-0 top-0 h-1/2 animate-[journey-cue_2.4s_cubic-bezier(.6,0,.2,1)_infinite] bg-white" />
          </span>
        </div>

        {/* chrome: chapter, sound, skip, progress */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-6 pt-5 sm:px-10 lg:px-14 xl:px-20">
          <span ref={label} className="font-mono text-[11px] tracking-[.12em] text-white/60 uppercase">01 · The beginning</span>
          <div className="flex items-center gap-2">
            {ready && (
              <button type="button" onClick={toggle} aria-pressed={soundOn}
                className="inline-flex h-8 cursor-pointer items-center gap-2 border border-white/20 px-3 font-mono text-[11px] tracking-[.08em] text-white/75 uppercase transition-colors hover:border-white hover:text-white">
                {soundOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                {soundOn ? 'Sound on' : 'Sound off'}
              </button>
            )}
            <button type="button" onClick={() => leave.current()}
              className="inline-flex h-8 cursor-pointer items-center gap-2 border border-white/20 px-3 font-mono text-[11px] tracking-[.08em] text-white/75 uppercase transition-colors hover:border-white hover:text-white">
              Skip <ArrowDown className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/10">
          <div ref={bar} className="h-full origin-left bg-white/70" style={{ transform: 'scaleX(0)' }} />
        </div>

        {/* fade to black before the site arrives */}
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 z-20 bg-black transition-opacity duration-[600ms]', leaving ? 'opacity-100' : 'opacity-0')} />

        {/* the sound prompt */}
        {ask && (
          <div role="dialog" aria-modal="false" aria-labelledby="journey-sound-title"
            className="absolute inset-0 z-10 grid place-items-center bg-black/35 px-6 backdrop-blur-[2px] motion-safe:animate-[journey-in_.9s_cubic-bezier(.16,1,.3,1)]">
            <div className="w-full max-w-[380px] border border-white/15 bg-black/80 p-6 sm:p-7">
              <div className="flex items-center gap-2 font-mono text-[11px] tracking-[.14em] text-white/55 uppercase"><Volume2 className="size-3.5" /> Sound</div>
              <h2 id="journey-sound-title" className="mt-3 text-[22px] leading-tight font-semibold tracking-[-.02em]">Turn on the sound experience?</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-white/65">The journey has its own sound design. Best with headphones.</p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button type="button" autoFocus={prefers !== 'off'} onClick={() => choose(true)}
                  className="h-11 flex-1 cursor-pointer bg-white px-4 text-[14.5px] font-medium text-black transition-opacity hover:opacity-90">Sound on</button>
                <button type="button" autoFocus={prefers === 'off'} onClick={() => choose(false)}
                  className="h-11 flex-1 cursor-pointer border border-white/25 px-4 text-[14.5px] text-white/85 transition-colors hover:border-white hover:text-white">No sound</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
