/* Music: one audio element for the whole app, so playback carries on across pages.
   Tracks are every audio file in web/music/, picked up automatically at build time: drop a file in, it appears.
   File name "Title - Artist.mp3" shows as title and artist. Settings (volume, loop, shuffle) stay in this browser. */
import { useSyncExternalStore } from 'react'

export type Track = { id: string; name: string; url: string; title: string; artist: string }
export type LoopMode = 'off' | 'all' | 'one'

const files = import.meta.glob('/music/*.{mp3,MP3,m4a,M4A,aac,AAC,ogg,OGG,oga,opus,wav,WAV,flac,FLAC,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export const TRACKS: Track[] = Object.entries(files)
  .map(([path, url]) => {
    // glob keys are plain file paths (not URL-encoded), so the name is used as it is: a '%' in it is just a '%'
    const name = path.split('/').pop()!.replace(/\.[^.]+$/, '')
    const [title, ...rest] = name.split(' - ')
    // the id is the whole path, so the same song in two formats still gets two ids
    return { id: path, name, url, title: title.trim(), artist: rest.join(' - ').trim() }
  })
  .sort((a, b) => a.title.localeCompare(b.title))

type Saved = { volume: number; muted: boolean; loop: LoopMode; shuffle: boolean; track: string }
const KEY = 'cognia-osb-music'
function load(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

export type MusicState = {
  index: number
  playing: boolean
  /** waiting for data after pressing play */
  loading: boolean
  time: number
  duration: number
  volume: number
  muted: boolean
  loop: LoopMode
  shuffle: boolean
  /** playback order when shuffle is on (indices into TRACKS) */
  order: number[]
  error: string | null
}

const saved = load()
// older saves kept the bare file name as the id; fall back to it so the remembered track survives the change
const byId = TRACKS.findIndex((t) => t.id === saved.track)
const startIndex = Math.max(0, byId >= 0 ? byId : TRACKS.findIndex((t) => t.name === saved.track))

let state: MusicState = {
  index: TRACKS.length ? startIndex : -1,
  playing: false,
  loading: false,
  time: 0,
  duration: 0,
  volume: typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : 0.7,
  muted: !!saved.muted,
  loop: saved.loop === 'one' || saved.loop === 'off' ? saved.loop : 'all',
  shuffle: !!saved.shuffle,
  order: [],
  error: null,
}

const subs = new Set<() => void>()
function set(p: Partial<MusicState>) {
  state = { ...state, ...p }
  subs.forEach((f) => f())
  if ('volume' in p || 'muted' in p || 'loop' in p || 'shuffle' in p || 'index' in p) {
    try {
      const t = TRACKS[state.index]
      localStorage.setItem(KEY, JSON.stringify({ volume: state.volume, muted: state.muted, loop: state.loop, shuffle: state.shuffle, track: t?.id ?? '' } satisfies Saved))
    } catch {
      /* storage unavailable: settings are simply not kept */
    }
  }
}

export function useMusic<T>(sel: (s: MusicState) => T): T {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => sel(state),
    () => sel(state),
  )
}

/* ───── audio element and analyser (created lazily, in the browser only) ───── */
let audio: HTMLAudioElement | null = null
let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
/** volume goes through this once the audio graph exists (iOS ignores HTMLMediaElement.volume) */
let gain: GainNode | null = null
/** how many unplayable tracks were skipped in a row during auto-advance */
let skips = 0
let advancing = false

function applyVolume() {
  const a = audio
  if (!a) return
  const v = state.muted ? 0 : state.volume
  if (gain && ctx) {
    // the graph owns the volume: keep the element at full level so the curve is not applied twice
    a.volume = 1
    a.muted = false
    gain.gain.setTargetAtTime(v, ctx.currentTime, 0.015)
  } else {
    a.volume = state.volume
    a.muted = state.muted
  }
}

function mediaState(s: MediaSessionPlaybackState) {
  try {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) navigator.mediaSession.playbackState = s
  } catch {
    /* unsupported */
  }
}

function el(): HTMLAudioElement {
  if (audio) return audio
  const a = new Audio()
  a.preload = 'metadata'
  audio = a
  applyVolume()
  a.loop = state.loop === 'one'
  a.addEventListener('timeupdate', () => set({ time: a.currentTime }))
  a.addEventListener('durationchange', () => set({ duration: isFinite(a.duration) ? a.duration : 0 }))
  a.addEventListener('loadedmetadata', () => set({ duration: isFinite(a.duration) ? a.duration : 0 }))
  a.addEventListener('play', () => {
    set({ playing: true, error: null })
    mediaState('playing')
  })
  a.addEventListener('playing', () => {
    skips = 0
    advancing = false
    set({ loading: false })
  })
  a.addEventListener('waiting', () => set({ loading: true }))
  a.addEventListener('pause', () => {
    set({ playing: false, loading: false })
    mediaState('paused')
  })
  a.addEventListener('ended', onEnded)
  a.addEventListener('error', () => {
    // a bad file met while moving on by itself: skip it, but never loop for ever over a list of bad files
    if (advancing && skips < TRACKS.length - 1) {
      skips++
      const i = nextIndex(1)
      if (i !== null) return load_(i, true, true)
    }
    advancing = false
    skips = 0
    set({ playing: false, loading: false, error: 'This track could not be played.' })
  })
  if (state.index >= 0) a.src = TRACKS[state.index].url
  return a
}

/** Frequency data for the visualiser. Null until the first play (browsers only allow audio graphs after a gesture). */
export function getAnalyser() {
  return analyser
}

function ensureGraph() {
  if (ctx || typeof window === 'undefined') return
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  try {
    ctx = new AC()
    const src = ctx.createMediaElementSource(el())
    analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    // light smoothing keeps transients for beat detection; the visualisers ease on their own
    analyser.smoothingTimeConstant = 0.6
    gain = ctx.createGain()
    // the analyser sits before the volume, so the visualiser shows the music whatever the volume
    src.connect(analyser)
    analyser.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.value = state.muted ? 0 : state.volume
  } catch {
    /* no visualiser, audio still plays through the element */
    analyser = null
    gain = null
  }
  applyVolume()
}

function shuffled(first: number) {
  const rest = TRACKS.map((_, i) => i).filter((i) => i !== first)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return [first, ...rest]
}

/** The track after (dir 1) or before (dir -1) the current one, or null when the list has run out and loop is off. */
function nextIndex(dir: 1 | -1): number | null {
  const n = TRACKS.length
  if (!n) return null
  if (state.shuffle) {
    let order = state.order
    if (order.length !== n || !order.includes(state.index)) {
      order = shuffled(state.index)
      set({ order })
    }
    const p = order.indexOf(state.index) + dir
    if (p < n && p >= 0) return order[p]
    if (dir === -1) return order[n - 1]
    if (state.loop === 'off') return null
    // new lap: reshuffle, and never start it with the track that just finished
    const rest = shuffled(state.index).slice(1)
    const lap = n > 1 ? [...rest, state.index] : [state.index]
    set({ order: lap })
    return lap[0]
  }
  const i = state.index + dir
  if (i >= n) return state.loop === 'off' ? null : 0
  if (i < 0) return n - 1
  return i
}

function load_(i: number, autoplay: boolean, auto = false) {
  advancing = auto
  const a = el()
  const url = new URL(TRACKS[i].url, location.href).href
  if (a.src !== url) {
    set({ index: i, time: 0, duration: 0, error: null })
    a.src = url
  } else set({ index: i, time: 0, error: null })
  a.currentTime = 0
  meta()
  if (autoplay) void play()
}

function onEnded() {
  const i = nextIndex(1)
  if (i === null) {
    set({ playing: false, time: 0 })
    if (audio) audio.currentTime = 0
    return
  }
  load_(i, true, true)
}

async function play() {
  if (state.index < 0) return
  // every play path comes through here, so the OS media panel always has the title
  meta()
  const a = el()
  ensureGraph()
  if (ctx?.state === 'suspended') await ctx.resume().catch(() => {})
  set({ loading: a.readyState < 3 })
  try {
    await a.play()
  } catch (e) {
    const n = (e as DOMException)?.name
    if (n === 'AbortError') return
    // NotSupportedError and the like are reported by the element's 'error' listener (which may skip on)
    if (n === 'NotAllowedError') set({ playing: false, loading: false, error: 'Press play to start the music.' })
    else if (!advancing) set({ playing: false, loading: false, error: 'This track could not be played.' })
  }
}

function meta() {
  const t = TRACKS[state.index]
  if (!t || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist || 'COGNIA', album: 'COGNIA · Build an OS' })
  } catch {
    /* MediaMetadata unsupported */
  }
}

export const music = {
  play,
  pause() {
    audio?.pause()
  },
  toggle() {
    if (state.playing) audio?.pause()
    else void play()
  },
  /** Skip ahead. Pressing next always moves on, wrapping to the start even with loop off; playing stays as it was. */
  next() {
    const i = nextIndex(1)
    load_(i ?? (state.shuffle ? state.order[0] ?? 0 : 0), state.playing)
  },
  /** Back to the start of the track if more than 3 s in, else the previous track. */
  prev() {
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      set({ time: 0 })
      return
    }
    const i = nextIndex(-1)
    if (i !== null) load_(i, state.playing)
  },
  select(i: number) {
    if (i === state.index) return music.toggle()
    if (state.shuffle) set({ order: shuffled(i) })
    load_(i, true)
  },
  seek(t: number) {
    const a = el()
    if (!isFinite(t)) return
    a.currentTime = Math.max(0, Math.min(t, state.duration || t))
    set({ time: a.currentTime })
  },
  setVolume(v: number) {
    el()
    const vol = Math.max(0, Math.min(1, v))
    set({ volume: vol, muted: vol === 0 })
    applyVolume()
  },
  toggleMute() {
    el()
    const m = !state.muted
    if (!m && state.volume === 0) set({ muted: m, volume: 0.5 })
    else set({ muted: m })
    applyVolume()
  },
  cycleLoop() {
    const loop: LoopMode = state.loop === 'off' ? 'all' : state.loop === 'all' ? 'one' : 'off'
    el().loop = loop === 'one'
    set({ loop })
  },
  toggleShuffle() {
    const shuffle = !state.shuffle
    set({ shuffle, order: shuffle ? shuffled(state.index) : [] })
  },
}

/* hardware media keys and the OS media panel */
if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && TRACKS.length) {
  const ms = navigator.mediaSession
  const h: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => void play()],
    ['pause', () => music.pause()],
    ['nexttrack', () => music.next()],
    ['previoustrack', () => music.prev()],
    ['seekto', (d) => d.seekTime !== undefined && music.seek(d.seekTime)],
  ]
  h.forEach(([a, f]) => {
    try {
      ms.setActionHandler(a, f)
    } catch {
      /* action unsupported */
    }
  })
}

export function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/* dev only: a hot edit of this file re-runs it; stop the old element so two songs never play at once */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    audio?.pause()
    audio?.removeAttribute('src')
    audio?.load()
    void ctx?.close().catch(() => {})
  })
}
