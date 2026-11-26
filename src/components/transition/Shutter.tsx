/* The section shutter: six black columns rise over the whole screen (rail and player included), the destination
   name is set large while the route swaps underneath, then the columns lift away and carry the name off with them.
   Each column carries a famous x86 physical address at its foot, a small memory map for people who are about to
   build one.

   The name is printed on the columns themselves: every column holds a full-screen copy of it, shifted so the copies
   line up, and clipped to the column. While the columns close, each copy is counter-moved so the type holds still
   and only shows where the screen is already covered (it never floats over the old page). When the columns lift,
   the copies ride along, so the name leaves sheared across the plates. */
import { Fragment, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { animate, motion, stagger } from 'motion/react'
import { Mark } from '@/components/brand'
import type { Dest } from './routes'

export type ShutterApi = {
  /** cover the screen; resolves once every column is closed */
  cover(dest: Dest, dir: 1 | -1): Promise<void>
  /** change the label while covered (data arrived, or the user picked another destination) */
  label(dest: Dest): void
  /** lift the columns away; resolves when the screen is clear */
  reveal(dir: 1 | -1): Promise<void>
  /** drop the shutter immediately (reduced motion, interrupted) */
  hide(): void
}

const COLUMNS = [
  { at: '0x0000 0000', short: '0x0', what: 'Interrupt table' },
  { at: '0x0000 7C00', short: '0x7C00', what: 'Boot sector' },
  { at: '0x000B 8000', short: '0xB8000', what: 'VGA text' },
  { at: '0x0010 0000', short: '0x100000', what: 'Kernel' },
  { at: '0xC000 0000', short: '0xC0000000', what: 'Higher half' },
  { at: '0xFEE0 0000', short: '0xFEE00000', what: 'Local APIC' },
]

const EASE_COVER = [0.76, 0, 0.24, 1] as const
const EASE_OUT = [0.22, 1, 0.36, 1] as const

type Phase = 'idle' | 'in' | 'out'

function titleSize(t: string) {
  if (t.length <= 14) return 'text-[clamp(52px,9.2vw,148px)]'
  if (t.length <= 26) return 'text-[clamp(42px,6.8vw,112px)]'
  if (t.length <= 44) return 'text-[clamp(34px,4.8vw,80px)]'
  return 'text-[clamp(30px,3.6vw,60px)]'
}

export function Shutter({ ref }: { ref: Ref<ShutterApi> }) {
  const root = useRef<HTMLDivElement>(null)
  const cols = useRef<(HTMLDivElement | null)[]>([])
  const prints = useRef<(HTMLDivElement | null)[]>([])
  const phaseRef = useRef<Phase>('idle')
  const token = useRef(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [dest, setDest] = useState<Dest>({ eyebrow: '', title: '' })
  const [run, setRun] = useState(0)

  const go = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }
  /** the visible columns (five on phones) and their printed copies, in sweep order */
  const ordered = (dir: 1 | -1) => {
    const idx = COLUMNS.map((_, i) => i).filter((i) => (cols.current[i]?.offsetWidth ?? 0) > 0)
    if (dir < 0) idx.reverse()
    return {
      cols: idx.map((i) => cols.current[i]).filter((el): el is HTMLDivElement => !!el),
      prints: idx.map((i) => prints.current[i]).filter((el): el is HTMLDivElement => !!el),
    }
  }
  const show = (on: boolean) => {
    const el = root.current
    if (!el) return
    el.style.visibility = on ? 'visible' : 'hidden'
    el.style.pointerEvents = on ? 'auto' : 'none'
  }
  const park = () => {
    cols.current.forEach((c) => c && animate(c, { y: '100%' }, { duration: 0 }))
    prints.current.forEach((p) => p && animate(p, { y: '-100%' }, { duration: 0 }))
  }

  useLayoutEffect(park, [])

  useImperativeHandle(ref, () => ({
    async cover(d, dir) {
      const t = ++token.current
      const wasIdle = phaseRef.current === 'idle'
      setDest(d)
      if (phaseRef.current !== 'in') setRun((r) => r + 1)
      go('in')
      const list = ordered(dir)
      if (wasIdle) {
        list.cols.forEach((c) => animate(c, { y: dir > 0 ? '100%' : '-100%' }, { duration: 0 }))
        list.prints.forEach((p) => animate(p, { y: dir > 0 ? '-100%' : '100%' }, { duration: 0 }))
      }
      show(true)
      const opts = { duration: wasIdle ? 0.32 : 0.24, ease: EASE_COVER, delay: stagger(wasIdle ? 0.026 : 0.018) }
      // a column and its copy share one timing, so the type holds still while the column slides over it
      void animate(list.prints, { y: '0%' }, opts)
      await animate(list.cols, { y: '0%' }, opts)
      if (t !== token.current) return
    },
    label(d) {
      setDest((cur) => (cur.title === d.title && cur.eyebrow === d.eyebrow ? cur : d))
    },
    async reveal(dir) {
      const t = ++token.current
      go('out')
      // the copies stay put inside their columns: the name rides away on the plates
      await animate(ordered(dir).cols, { y: dir > 0 ? '-100%' : '100%' }, { duration: 0.38, ease: EASE_COVER, delay: stagger(0.026) })
      if (t !== token.current) return
      show(false)
      park()
      go('idle')
    },
    hide() {
      ++token.current
      park()
      show(false)
      go('idle')
    },
  }))

  return (
    <div ref={root} data-shutter aria-hidden="true"
      className="fixed inset-0 z-[90] overflow-hidden [container-type:size] [--n:6] max-sm:[--n:5]"
      style={{ visibility: 'hidden', pointerEvents: 'none' }}>
      <div className="absolute inset-0 flex">
        {COLUMNS.map((c, i) => (
          <div key={c.at} ref={(el) => { cols.current[i] = el }}
            className="relative h-full flex-1 overflow-hidden bg-black will-change-transform max-sm:[&:nth-child(6)]:hidden">
            {/* vertical hairline between columns, under the type */}
            {i > 0 && <span className="absolute inset-y-0 left-0 w-px bg-white/[.09]" />}
            <span className="absolute bottom-5 left-3 font-mono text-[9px] leading-tight tracking-[.04em] text-white/30 sm:left-4 sm:text-[10.5px] sm:tracking-[.06em]">
              <span className="block whitespace-nowrap max-sm:hidden">{c.at}</span>
              <span className="block whitespace-nowrap sm:hidden">{c.short}</span>
              <span className="mt-0.5 block whitespace-nowrap text-white/20 uppercase max-md:hidden">{c.what}</span>
            </span>
            {/* this column's slice of the destination name */}
            <div ref={(el) => { prints.current[i] = el }} className="absolute top-0 h-full w-[100cqw] will-change-transform"
              style={{ left: `calc(-100cqw / var(--n) * ${i})` }}>
              <Print dest={dest} phase={phase} run={run} />
            </div>
            {/* leading and trailing edges: a lit hairline that reads as the edge of a moving plate */}
            <span className="absolute inset-x-0 top-0 h-px bg-white/60 shadow-[0_0_22px_2px_rgba(255,255,255,.22)]" />
            <span className="absolute inset-x-0 bottom-0 h-px bg-white/60 shadow-[0_0_22px_2px_rgba(255,255,255,.22)]" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The destination as set on the shutter: one full-screen copy, of which each column shows its own slice. */
function Print({ dest, phase, run }: { dest: Dest; phase: Phase; run: number }) {
  const words = dest.title.split(/\s+/).filter(Boolean)
  const on = phase !== 'idle'
  const entering = phase === 'in'
  const now = { duration: 0 }
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-6 text-[#ececea] sm:pr-[calc(100%/6)] sm:pl-[calc(100%/6+20px)] lg:pl-[calc(100%/6+28px)]">
      <motion.div key={'m' + run} className="absolute top-7 flex items-center gap-2.5 text-white/55"
        initial={{ opacity: 0 }} animate={{ opacity: on ? 1 : 0 }} transition={entering ? { duration: 0.4, delay: 0.22 } : now}>
        <Mark className="size-[22px]" />
        <span className="font-mono text-[10.5px] tracking-[.18em] uppercase">COGNIA · Build an OS</span>
      </motion.div>

      <div className="w-fit max-w-[min(100%,980px)]">
        <motion.div key={'e' + run + dest.eyebrow} className="flex items-center gap-2.5 font-mono text-[11.5px] tracking-[.14em] text-white/70 uppercase sm:text-[12.5px]"
          initial={{ opacity: 0, x: -10 }} animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: 0 }}
          transition={entering ? { duration: 0.4, delay: 0.2, ease: EASE_OUT } : now}>
          <span className="dot !size-[6px]" />{dest.eyebrow}
        </motion.div>

        <div key={'t' + run + dest.title} className={`mt-4 leading-[.98] font-semibold tracking-[-.04em] text-balance ${titleSize(dest.title)}`}>
          {words.map((w, i) => (
            <Fragment key={i}>
              {/* the space sits outside the word's mask: inside an inline-block a trailing space collapses */}
              {i > 0 && ' '}
              <span className="-mb-[.14em] inline-block overflow-hidden pb-[.14em] align-bottom">
                <motion.span className="inline-block" initial={{ y: '108%' }} animate={{ y: on ? '0%' : '108%' }}
                  transition={entering ? { duration: 0.42, delay: 0.1 + i * 0.03, ease: EASE_OUT } : now}>
                  {w}
                </motion.span>
              </span>
            </Fragment>
          ))}
        </div>

        {/* hairline progress: draws while covered, completes as the plates lift */}
        <motion.div key={'p' + run} className="relative mt-7 h-px w-full min-w-[min(100%,280px)] bg-white/[.14] sm:mt-9"
          initial={{ opacity: 0 }} animate={{ opacity: on ? 1 : 0 }} transition={entering ? { duration: 0.25, delay: 0.2 } : now}>
          <motion.div className="absolute inset-0 origin-left bg-white shadow-[0_0_12px_rgba(255,255,255,.5)]"
            initial={{ scaleX: 0 }} animate={{ scaleX: entering ? 0.82 : phase === 'out' ? 1 : 0 }}
            transition={entering ? { duration: 1.1, delay: 0.26, ease: [0.1, 0.7, 0.2, 1] } : phase === 'out' ? { duration: 0.18, ease: EASE_OUT } : now} />
        </motion.div>
      </div>
    </div>
  )
}
