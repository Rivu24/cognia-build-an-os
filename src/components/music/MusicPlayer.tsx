/* The music dock: a small bar in the corner that opens into the full player.
   Lives in the app shell, so the music keeps playing while you move between pages. Never starts on its own. */
import { Component, Suspense, lazy, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, ChevronUp, Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Spectrum } from '@/components/music/Spectrum'
import { RobotFace } from '@/components/music/RobotFace'
import { TRACKS, fmt, music, useMusic, type Track } from '@/lib/music'
import { cn } from '@/lib/utils'
import { SfxVolume } from '@/components/music/SfxVolume'

const OPEN_KEY = 'cognia-osb-music-open'
// three.js only loads when the panel first opens
const Robot3D = lazy(() => import('@/components/music/Robot3D'))

/** If the 3D chunk cannot load (offline, a stale deploy), show the flat face instead of breaking the page. */
class StageBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Where focus should land once the player has finished folding or unfolding (the swap waits for the exit animation). */
type PendingFocus = RefObject<'chip' | 'panel' | null>

export function MusicPlayer() {
  const [open, setOpenState] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === '1'
    } catch {
      return false
    }
  })
  const setOpen = (v: boolean) => {
    setOpenState(v)
    try {
      localStorage.setItem(OPEN_KEY, v ? '1' : '0')
    } catch {
      /* not kept */
    }
  }
  const root = useRef<HTMLDivElement>(null)
  const pending = useRef<'chip' | 'panel' | null>(null)
  const reduce = useReducedMotion()

  // Escape or a click outside folds the player back into the bar
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // an Escape meant for another dialog (search, a menu) is not ours
        const a = document.activeElement
        if (e.defaultPrevented || (a && !root.current?.contains(a) && a.closest('[role=dialog],[role=alertdialog],[role=menu],[role=listbox]'))) return
        // give focus back to the bar only if it was inside the player
        pending.current = root.current?.contains(document.activeElement) ? 'chip' : null
        setOpen(false)
      }
    }
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (root.current?.contains(t) || t.closest?.('[data-slot=tooltip-content]')) return
      setOpen(false)
    }
    window.addEventListener('keydown', key)
    document.addEventListener('pointerdown', down)
    return () => {
      window.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', down)
    }
  }, [open])

  if (!TRACKS.length) return null

  return (
    <div ref={root} className="fixed right-3 bottom-3 z-40 sm:right-5 sm:bottom-5">
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.section
            key="panel"
            aria-label="Music player"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            style={{ transformOrigin: 'bottom right' }}
            className="flex max-h-[calc(100dvh-24px)] w-[min(calc(100vw-24px),384px)] flex-col overflow-hidden border border-line-strong bg-background shadow-[0_24px_80px_-20px_rgba(0,0,0,.65)] sm:max-h-[calc(100dvh-40px)]"
          >
            <Panel pending={pending} onClose={() => { pending.current = 'chip'; setOpen(false) }} />
          </motion.section>
        ) : (
          <motion.div
            key="chip"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.18 }}
          >
            <Chip pending={pending} onOpen={() => { pending.current = 'panel'; setOpen(true) }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ───── the folded bar ───── */
function Chip({ onOpen, pending }: { onOpen: () => void; pending: PendingFocus }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (pending.current === 'chip') {
      pending.current = null
      btnRef.current?.focus()
    }
  }, [pending])
  const index = useMusic((s) => s.index)
  const playing = useMusic((s) => s.playing)
  const loading = useMusic((s) => s.loading)
  const time = useMusic((s) => s.time)
  const duration = useMusic((s) => s.duration)
  const t = TRACKS[index]
  return (
    <div className="relative flex h-12 items-stretch overflow-hidden border border-line-strong bg-background/95 shadow-[0_12px_40px_-12px_rgba(0,0,0,.6)] backdrop-blur">
      <button
        ref={btnRef}
        type="button"
        onClick={onOpen}
        aria-label={`Open music player${t ? `: ${t.title}` : ''}`}
        aria-expanded={false}
        className="group flex min-w-0 cursor-pointer items-center gap-3 pr-2 pl-3 text-left hover:bg-soft"
      >
        <RobotFace className="h-[26px] w-[30px] shrink-0" />
        <span className="hidden min-w-0 flex-col sm:flex sm:w-[150px]">
          <span className="truncate text-[13px] leading-tight font-medium">{t?.title}</span>
          <span className="truncate font-mono text-[10.5px] leading-tight text-muted-foreground">{playing ? 'Playing' : t?.artist || 'Music'}</span>
        </span>
        <ChevronUp className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5" />
      </button>
      <button
        type="button"
        onClick={() => music.toggle()}
        aria-label={playing ? 'Pause music' : 'Play music'}
        className="inline-flex w-12 shrink-0 cursor-pointer items-center justify-center border-l border-line bg-foreground text-background transition-opacity hover:opacity-85"
      >
        <PlayIcon playing={playing} loading={loading} />
      </button>
      <motion.span
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-foreground"
        animate={{ scaleX: duration ? time / duration : 0 }}
        transition={{ duration: 0.25, ease: 'linear' }}
      />
    </div>
  )
}

/* ───── the open player ───── */
function Panel({ onClose, pending }: { onClose: () => void; pending: PendingFocus }) {
  const s = useMusic((x) => x)
  const reduce = useReducedMotion()
  const foldBtn = useRef<HTMLButtonElement>(null)
  // opened from the bar: focus lands on the first control. Restored open on page load: focus is left alone.
  useEffect(() => {
    if (pending.current === 'panel') {
      pending.current = null
      foldBtn.current?.focus()
    }
  }, [pending])
  // Slider keys move by useful amounts and act at once (the sliders' own step stays fine-grained for dragging).
  // Arrows: small step; Shift+Arrow or Page Up/Down: large step; Home/End: either end.
  const keys = (e: ReactKeyboardEvent, small: number, large: number, value: number, max: number, apply: (v: number) => void) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const by = e.shiftKey ? large : small
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? value + by
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? value - by
      : e.key === 'PageUp' ? value + large
      : e.key === 'PageDown' ? value - large
      : e.key === 'Home' ? 0
      : e.key === 'End' ? max
      : null
    if (next === null) return
    e.preventDefault()
    apply(Math.max(0, Math.min(max, next)))
  }
  const t = TRACKS[s.index]
  const [drag, setDrag] = useState<number | null>(null)
  const pos = drag ?? s.time
  const vol = s.muted ? 0 : s.volume
  const VolIcon = vol === 0 ? VolumeX : vol < 0.5 ? Volume1 : Volume2
  const loopLabel = s.loop === 'off' ? 'Loop is off' : s.loop === 'all' ? 'Looping all tracks' : 'Looping this track'

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line py-2 pr-2 pl-4">
        <span className="flex items-center gap-2.5 font-mono text-[11px] tracking-[.08em] text-muted-foreground uppercase">
          <span className="relative flex size-2">
            <span className={cn('absolute inline-flex size-full rounded-full bg-foreground opacity-60', s.playing && !reduce && 'animate-ping')} />
            <span className="relative inline-flex size-2 rounded-full bg-foreground" />
          </span>
          {s.playing ? 'Now playing' : 'Music'}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-faint">{String(s.index + 1).padStart(2, '0')} / {String(TRACKS.length).padStart(2, '0')}</span>
          <button ref={foldBtn} type="button" onClick={onClose} aria-label="Fold the player away" title="Fold away (Esc)"
            className="inline-flex size-8 cursor-pointer items-center justify-center border border-line transition-colors hover:border-foreground">
            <ChevronDown className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto [scrollbar-width:thin]">
        {/* stage */}
        <div className="relative h-[220px] overflow-hidden border-b border-line bg-[var(--viz-bg)]">
          <StageBoundary fallback={<div className="flex h-full items-center justify-center text-foreground"><RobotFace className="h-24 w-28" /></div>}>
            <Suspense fallback={<div className="flex h-full items-center justify-center text-faint"><RobotFace className="h-16 w-[74px]" /></div>}>
              <Robot3D />
            </Suspense>
          </StageBoundary>
          <div className="pointer-events-none absolute right-3 bottom-2 font-mono text-[10px] tracking-[.12em] text-faint uppercase">
            {s.loop === 'one' ? 'loop · one' : s.loop === 'all' ? 'loop · all' : 'loop · off'}{s.shuffle ? ' · shuffle' : ''}
          </div>
        </div>

        <div className="px-4 pt-4 pb-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={t?.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
              <div className="truncate text-[19px] leading-tight font-semibold tracking-[-.01em]" title={t?.title}>{t?.title}</div>
              <div className="mt-1 truncate text-[13px] text-muted-foreground" title={t?.artist}>{t?.artist || ' '}</div>
            </motion.div>
          </AnimatePresence>

          {/* seek */}
          <div className="mt-4">
            <Slider
              aria-label="Seek"
              min={0}
              max={Math.max(1, s.duration)}
              step={1}
              largeStep={15}
              value={Math.min(pos, Math.max(1, s.duration))}
              disabled={!s.duration}
              getAriaValueText={(_, v) => `${fmt(v)} of ${fmt(s.duration)}`}
              onKeyDownCapture={(e) => keys(e, 5, 15, s.time, Math.max(0, s.duration - 1), music.seek)}
              onValueChange={(v) => setDrag(Array.isArray(v) ? v[0] : v)}
              onValueCommitted={(v) => {
                music.seek(Array.isArray(v) ? v[0] : v)
                setDrag(null)
              }}
              className="py-2"
            />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground tabular-nums">
              <span>{fmt(pos)}</span>
              <span>{s.duration ? `-${fmt(s.duration - pos)}` : '--:--'}</span>
            </div>
          </div>

          {/* transport */}
          <div className="mt-3 flex items-center justify-between">
            <Ctl label={s.shuffle ? 'Shuffle is on' : 'Shuffle is off'} active={s.shuffle} onClick={music.toggleShuffle}>
              <Shuffle className="size-4" />
            </Ctl>
            <Ctl label="Previous track" onClick={music.prev} big>
              <SkipBack className="size-[18px]" />
            </Ctl>
            <Tooltip>
              <TooltipTrigger
                onClick={() => music.toggle()}
                aria-label={s.playing ? 'Pause' : 'Play'}
                className="relative inline-flex size-14 cursor-pointer items-center justify-center bg-foreground text-background transition-transform hover:scale-[1.04] active:scale-95"
              >
                <PlayIcon playing={s.playing} loading={s.loading} size="size-6" />
              </TooltipTrigger>
              <TooltipContent>{s.playing ? 'Pause' : 'Play'}</TooltipContent>
            </Tooltip>
            <Ctl label="Next track" onClick={music.next} big>
              <SkipForward className="size-[18px]" />
            </Ctl>
            <Ctl label={loopLabel} active={s.loop !== 'off'} onClick={music.cycleLoop}>
              {s.loop === 'one' ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
            </Ctl>
          </div>

          {/* volume */}
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={music.toggleMute} aria-label={s.muted ? 'Unmute' : 'Mute'} title={s.muted ? 'Unmute' : 'Mute'}
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground">
              <VolIcon className="size-4" />
            </button>
            <Slider
              aria-label="Volume"
              min={0}
              max={100}
              step={1}
              largeStep={20}
              value={Math.round(vol * 100)}
              getAriaValueText={(_, v) => (v === 0 ? 'Muted' : `${Math.round(v)}%`)}
              onKeyDownCapture={(e) => keys(e, 5, 20, Math.round(vol * 100), 100, (v) => music.setVolume(v / 100))}
              onValueChange={(v) => music.setVolume((Array.isArray(v) ? v[0] : v) / 100)}
              className="py-2"
            />
            <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums">{Math.round(vol * 100)}</span>
          </div>

          <SfxVolume className="mt-1" />

          {s.error && <p className="mt-3 border-l-2 border-foreground pl-3 text-[12.5px] text-muted-foreground" role="status">{s.error}</p>}
        </div>

        {/* queue */}
        <div className="border-t border-line">
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <span className="label">Queue</span>
            <span className="font-mono text-[11px] text-faint">{TRACKS.length} track{TRACKS.length === 1 ? '' : 's'}</span>
          </div>
          <ol className="pb-2">
            {TRACKS.map((tr, i) => (
              <QueueRow key={tr.id} track={tr} i={i} current={i === s.index} playing={i === s.index && s.playing} duration={i === s.index ? s.duration : 0} />
            ))}
          </ol>
        </div>
      </div>
    </>
  )
}

function QueueRow({ track, i, current, playing, duration }: { track: Track; i: number; current: boolean; playing: boolean; duration: number }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => music.select(i)}
        aria-current={current ? 'true' : undefined}
        aria-label={`${current && playing ? 'Pause' : 'Play'} ${track.title}`}
        className={cn('flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-soft', current && 'bg-soft')}
      >
        <span className="flex w-6 shrink-0 justify-center font-mono text-[11px] text-faint">
          {playing ? <span className="h-3.5 w-4"><Spectrum bars={3} variant="mini" /></span> : String(i + 1).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[13.5px]', current ? 'font-semibold' : 'text-muted-foreground')}>{track.title}</span>
          {track.artist && <span className="block truncate font-mono text-[10.5px] text-faint">{track.artist}</span>}
        </span>
        {duration > 0 && <span className="shrink-0 font-mono text-[11px] text-faint tabular-nums">{fmt(duration)}</span>}
      </button>
    </li>
  )
}

function Ctl({ label, onClick, active, big, children }: { label: string; onClick: () => void; active?: boolean; big?: boolean; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        aria-label={label}
        aria-pressed={active === undefined ? undefined : active}
        className={cn(
          'relative inline-flex cursor-pointer items-center justify-center border transition-colors',
          big ? 'size-11' : 'size-10',
          active ? 'border-foreground bg-foreground text-background' : 'border-line text-foreground hover:border-foreground',
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function PlayIcon({ playing, loading, size = 'size-4' }: { playing: boolean; loading: boolean; size?: string }) {
  if (loading && playing) return <Loader2 className={cn(size, 'animate-spin')} />
  return playing ? <Pause className={size} fill="currentColor" /> : <Play className={cn(size, 'translate-x-[1px]')} fill="currentColor" />
}

