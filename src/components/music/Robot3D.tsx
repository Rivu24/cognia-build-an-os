/* The robot on the open player's stage. A boxy monochrome head in headphones, drawn with three.js:
   - its pupils (and a little of its head) follow the pointer anywhere on the page;
   - the antenna light pulses with the bass, the head nods on beats, the mouth grill is an equaliser,
     and a ring of bars behind it is a circular spectrum;
   - it blinks now and then; paused, it sleeps (eyes shut to a line, slow breathing) and wakes with a blink and a look round.
   Loaded on demand when the panel opens. Renders only while mounted and the tab is visible, and frees everything on unmount. */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import * as THREE from 'three'
import { music, useMusic } from '@/lib/music'
import { cursor, gazeFrom, watchCursor } from '@/components/music/cursor'
import { createLevels } from '@/components/music/levels'
import { RobotFace } from '@/components/music/RobotFace'

const CAM_Z = 9.1
const RING = 56 // bars in the circular spectrum (mirrored: 28 bands each side)
const MOUTH = 9 // bars in the mouth grill
const HEAD = { w: 2.2, h: 1.72, d: 1.7 }
const HEAD_Y = 0.06
const RING_R = 1.62

type Palette = { dark: boolean; fg: string; dim: string; body: string; edge: string; visor: string; screen: string; pupil: string }

/** Parse a CSS colour token to [r,g,b] 0..1 (hex or rgb[a]()). */
function parse(c: string): [number, number, number] | null {
  c = c.trim()
  const hex = c.match(/^#([0-9a-f]{3,8})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length <= 4) h = h.split('').map((x) => x + x).join('')
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
  }
  const rgb = c.match(/rgba?\(([^)]+)\)/)
  if (rgb) {
    const p = rgb[1].split(/[\s,/]+/).map(parseFloat)
    return [p[0] / 255, p[1] / 255, p[2] / 255]
  }
  return null
}

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el)
  const tok = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
  const bg = parse(tok('--viz-bg', '#000000')) ?? [0, 0, 0]
  const dark = bg[0] * 0.3 + bg[1] * 0.59 + bg[2] * 0.11 < 0.5
  const fg = tok('--viz-fg', dark ? '#ececea' : '#111111')
  const dim = tok('--viz-dim', dark ? '#8c8c8a' : '#6a6a6a')
  return dark
    ? { dark, fg, dim, body: '#1d1d1c', edge: '#6b6b69', visor: '#050505', screen: fg, pupil: '#050505' }
    : { dark, fg, dim, body: '#f3f3f1', edge: '#111111', visor: '#141414', screen: '#ffffff', pupil: '#141414' }
}

/** A soft round glow, drawn once into a small canvas. */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.35, 'rgba(255,255,255,.35)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function Robot3D() {
  const wrap = useRef<HTMLDivElement>(null)
  const playing = useMusic((s) => s.playing)
  const reduce = !!useReducedMotion()
  const [failed, setFailed] = useState(false)
  const live = useRef({ playing, reduce, hover: false, poke: 0 })
  live.current.playing = playing
  live.current.reduce = reduce

  useEffect(() => {
    const host = wrap.current
    if (!host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      setFailed(true)
      return
    }
    const canvas = renderer.domElement
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    host.prepend(canvas)
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(27, 1.7, 0.1, 50)
    camera.position.set(0, 0.1, CAM_Z)
    camera.lookAt(0, 0, 0)

    /* everything made here is tracked so it can be freed */
    const geos: THREE.BufferGeometry[] = []
    const mats: THREE.Material[] = []
    const G = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g)
    const M = <T extends THREE.Material>(m: T) => (mats.push(m), m)
    const glowTex = glowTexture()

    // lights
    const amb = new THREE.AmbientLight(0xffffff, 0.55)
    scene.add(amb)
    const key = new THREE.DirectionalLight(0xffffff, 1.7)
    key.position.set(3, 5, 6)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffffff, 1.1)
    rim.position.set(-5, 2, -4)
    scene.add(rim)

    // materials (colours set by applyPalette)
    const body = M(new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.15 }))
    const visorM = M(new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0.4 }))
    const edgeM = M(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 }))
    const faintLine = M(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.22 }))
    const screenM = M(new THREE.MeshBasicMaterial())
    const pupilM = M(new THREE.MeshBasicMaterial())
    const shineM = M(new THREE.MeshBasicMaterial({ color: 0xffffff }))
    const lightM = M(new THREE.MeshBasicMaterial())
    const glowM = M(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    const eyeGlowM = M(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.22 }))
    const mouthM = M(new THREE.MeshBasicMaterial())
    const ringM = M(new THREE.MeshBasicMaterial({ transparent: true }))

    /** a box with hairline edges */
    const boxy = (w: number, h: number, d: number, mat: THREE.Material, edges = true) => {
      const g = G(new THREE.BoxGeometry(w, h, d))
      const m = new THREE.Mesh(g, mat)
      if (edges) m.add(new THREE.LineSegments(G(new THREE.EdgesGeometry(g)), edgeM))
      return m
    }

    /* ── figure ── */
    const root = new THREE.Group() // breathing and bobbing
    root.scale.setScalar(1.08) // a touch larger than the ring, so the face carries the stage
    scene.add(root)
    const pivot = new THREE.Group() // turns to follow the pointer
    pivot.position.y = HEAD_Y
    root.add(pivot)

    pivot.add(boxy(HEAD.w, HEAD.h, HEAD.d, body))
    // visor: a dark glass panel on the face
    const visor = boxy(1.86, 0.92, 0.08, visorM)
    visor.position.set(0, 0.14, HEAD.d / 2 + 0.04)
    pivot.add(visor)

    // eyes: a lit square screen, a round pupil with a glint, and a soft glow behind (dark theme)
    const eyes: { g: THREE.Group; pupil: THREE.Group }[] = []
    const SCREEN = 0.44
    for (const x of [-0.42, 0.42]) {
      const g = new THREE.Group()
      g.position.set(x, 0.14, HEAD.d / 2 + 0.085)
      const screen = new THREE.Mesh(G(new THREE.PlaneGeometry(SCREEN, SCREEN * 1.08)), screenM)
      g.add(screen)
      const pupil = new THREE.Group()
      pupil.position.z = 0.004
      pupil.add(new THREE.Mesh(G(new THREE.CircleGeometry(0.1, 28)), pupilM))
      const shine = new THREE.Mesh(G(new THREE.CircleGeometry(0.028, 12)), shineM)
      shine.position.set(0.035, 0.04, 0.002)
      pupil.add(shine)
      g.add(pupil)
      const glow = new THREE.Sprite(eyeGlowM)
      glow.scale.setScalar(1.05)
      glow.position.z = -0.01
      g.add(glow)
      pivot.add(g)
      eyes.push({ g, pupil })
    }

    // mouth grill: small bars in a hairline frame, an equaliser while playing
    const mouthBars: THREE.Mesh[] = []
    const mouthGeo = G(new THREE.BoxGeometry(0.075, 1, 0.03))
    for (let i = 0; i < MOUTH; i++) {
      const b = new THREE.Mesh(mouthGeo, mouthM)
      b.position.set((i - (MOUTH - 1) / 2) * 0.13, -0.53, HEAD.d / 2 + 0.02)
      b.scale.y = 0.04
      pivot.add(b)
      mouthBars.push(b)
    }
    {
      const w = 1.32
      const h = 0.34
      const pts = [new THREE.Vector3(-w / 2, -h / 2, 0), new THREE.Vector3(w / 2, -h / 2, 0), new THREE.Vector3(w / 2, h / 2, 0), new THREE.Vector3(-w / 2, h / 2, 0)]
      const frame = new THREE.LineLoop(G(new THREE.BufferGeometry().setFromPoints(pts)), edgeM)
      frame.position.set(0, -0.53, HEAD.d / 2 + 0.005)
      pivot.add(frame)
    }

    // antenna with a light that pulses with the bass
    const stem = new THREE.Mesh(G(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 10)), body)
    stem.position.set(0, HEAD.h / 2 + 0.22, 0.3)
    pivot.add(stem)
    const base = boxy(0.26, 0.07, 0.26, body)
    base.position.set(0, HEAD.h / 2 + 0.035, 0.3)
    pivot.add(base)
    const bulb = new THREE.Mesh(G(new THREE.SphereGeometry(0.1, 20, 14)), lightM)
    bulb.position.set(0, HEAD.h / 2 + 0.5, 0.3)
    pivot.add(bulb)
    const bulbGlow = new THREE.Sprite(glowM)
    bulbGlow.position.copy(bulb.position)
    pivot.add(bulbGlow)

    // headphones: a band over the top (behind the antenna) and square cups
    const band = new THREE.Mesh(G(new THREE.TorusGeometry(HEAD.w / 2 + 0.17, 0.06, 8, 48, Math.PI)), body)
    band.position.set(0, 0.06, -0.22)
    band.add(new THREE.LineSegments(G(new THREE.EdgesGeometry(band.geometry, 40)), edgeM))
    pivot.add(band)
    for (const s of [-1, 1]) {
      const cup = boxy(0.24, 0.72, 0.72, body)
      cup.position.set(s * (HEAD.w / 2 + 0.12), 0.04, -0.05)
      pivot.add(cup)
      const pad = boxy(0.08, 0.5, 0.5, visorM)
      pad.position.set(s * (HEAD.w / 2 + 0.27), 0.04, -0.05)
      pivot.add(pad)
    }

    // neck and shoulders, cut off by the bottom of the stage
    const neck = boxy(0.56, 0.34, 0.56, visorM)
    neck.position.set(0, HEAD_Y - HEAD.h / 2 - 0.17, -0.15)
    root.add(neck)
    const torso = boxy(2.9, 1.3, 1.3, body)
    torso.position.set(0, HEAD_Y - HEAD.h / 2 - 0.34 - 0.65, -0.45)
    root.add(torso)
    const chestLight = new THREE.Mesh(G(new THREE.PlaneGeometry(0.28, 0.06)), lightM)
    chestLight.position.set(0.9, torso.position.y + 0.4, torso.position.z + 0.651)
    root.add(chestLight)
    {
      const pts = [new THREE.Vector3(-0.9, 0, 0), new THREE.Vector3(0.9, 0, 0)]
      const seam = new THREE.Line(G(new THREE.BufferGeometry().setFromPoints(pts)), faintLine)
      seam.position.set(-0.35, torso.position.y + 0.4, torso.position.z + 0.651)
      root.add(seam)
    }

    // circular spectrum behind the head
    const ringGroup = new THREE.Group()
    ringGroup.position.set(0, HEAD_Y, -1.1)
    scene.add(ringGroup)
    const ring = new THREE.InstancedMesh(G(new THREE.BoxGeometry(1, 1, 1)), ringM, RING)
    ring.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    ringGroup.add(ring)
    {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(a) * (RING_R - 0.1), Math.sin(a) * (RING_R - 0.1), 0))
      }
      ringGroup.add(new THREE.LineLoop(G(new THREE.BufferGeometry().setFromPoints(pts)), faintLine))
    }
    const dummy = new THREE.Object3D()
    const cFg = new THREE.Color()
    const cDim = new THREE.Color()
    const cTmp = new THREE.Color()

    /* ── theme ── */
    let pal = readPalette(host)
    const applyPalette = () => {
      pal = readPalette(host)
      body.color.set(pal.body)
      visorM.color.set(pal.visor)
      edgeM.color.set(pal.edge)
      edgeM.opacity = pal.dark ? 0.75 : 0.9
      faintLine.color.set(pal.dim)
      screenM.color.set(pal.screen)
      pupilM.color.set(pal.pupil)
      lightM.color.set(pal.dark ? pal.fg : pal.visor)
      mouthM.color.set(pal.dark ? pal.fg : pal.visor)
      glowM.color.set(pal.fg)
      eyeGlowM.color.set(pal.fg)
      glowM.visible = eyeGlowM.visible = pal.dark // a white glow does not read on white
      cFg.set(pal.fg)
      cDim.set(pal.dim)
      // light theme: a near-white figure drawn in ink lines; dark theme: charcoal lit from above with a rim
      amb.intensity = pal.dark ? 0.55 : 2.1
      key.intensity = pal.dark ? 1.7 : 1.3
      rim.intensity = pal.dark ? 1.1 : 0.3
    }
    applyPalette()
    const mo = new MutationObserver(applyPalette)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })

    /* ── sizing ── */
    let rect = host.getBoundingClientRect()
    let rectAt = 0
    const size = () => {
      // layout size, not getBoundingClientRect: the panel may still be mid-scale when this runs
      const w = Math.max(1, host.clientWidth)
      const h = Math.max(1, host.clientHeight)
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // keep the whole head and ring in frame on narrow stages
      camera.position.z = CAM_Z * Math.max(1, 1.55 / camera.aspect)
      camera.updateProjectionMatrix()
      rectAt = 0
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(host)
    const onResize = () => size() // also catches a DPR change from zoom or moving windows
    window.addEventListener('resize', onResize)

    /* ── behaviour ── */
    const { L, sample } = createLevels(RING / 2)
    const gaze = { x: 0, y: 0 }
    const eye = { x: 0, y: 0 } // eased pupil offset (-1..1)
    const look = { x: 0, y: 0 } // eased head turn (-1..1)
    let t = 0
    let last = 0
    let raf = 0
    let frameNo = 0
    let wasPlaying = live.current.playing
    let sleep = wasPlaying ? 0 : 1 // 0 awake .. 1 asleep
    let wakeAt = -10 // t when it last woke
    let nextBlink = 1.5 + Math.random() * 2
    let blinkAt = -10
    let bob = 0
    let sweep = 0
    let wander = { x: 0, y: 0, until: 0 }
    let pokeSeen = live.current.poke
    let beats = 0
    let probe = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const { playing: on, reduce: rm, hover } = live.current
      // asleep: half the frame rate is plenty for breathing; with reduced motion nothing moves but the head, so less still
      if (!on && sleep > 0.98 && frameNo++ % (rm ? 6 : 2) !== 0) return
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016)
      last = now
      t += dt

      // wake / sleep
      if (on && !wasPlaying) {
        wakeAt = t
        blinkAt = t + 0.28
      }
      wasPlaying = on
      sleep += ((on ? 0 : 1) - sleep) * (1 - Math.exp(-dt * (on ? 9 : 2.2)))
      if (live.current.poke !== pokeSeen) {
        pokeSeen = live.current.poke
        blinkAt = t
      }

      // where to look: the pointer, a short look round after waking, or an idle wander
      if (now - rectAt > 400) {
        rect = host.getBoundingClientRect()
        rectAt = now
      }
      gazeFrom(rect.left + rect.width / 2, rect.top + rect.height * 0.45, gaze)
      const sinceWake = t - wakeAt
      if (sinceWake < 1.5 && !rm) {
        gaze.x = sinceWake < 0.45 ? 0 : sinceWake < 0.85 ? -0.85 : sinceWake < 1.25 ? 0.85 : gaze.x
        gaze.y = sinceWake < 1.25 && sinceWake > 0.45 ? -0.15 : gaze.y
      } else if (on && performance.now() - cursor.at > 6000) {
        if (t > wander.until) wander = { x: (Math.random() * 2 - 1) * 0.7, y: (Math.random() * 2 - 1) * 0.35, until: t + 1.4 + Math.random() * 2.2 }
        gaze.x = wander.x
        gaze.y = wander.y
      }
      const eyeEase = rm ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * 14)
      eye.x += (gaze.x - eye.x) * eyeEase
      eye.y += (gaze.y - eye.y) * eyeEase
      // asleep, the head stops following the pointer and settles forward
      const headEase = 1 - Math.exp(-dt * 4.5)
      const follow = rm ? 0 : 1 - sleep * 0.9
      look.x += (gaze.x * follow - look.x) * headEase
      look.y += (gaze.y * follow - look.y) * headEase

      // music
      const lv = sample(on, dt)
      if (lv.beat) beats++
      if (lv.beat && !rm) bob = 1
      bob *= Math.exp(-dt * 6.5)

      // blink
      if (on && t > nextBlink) {
        blinkAt = t
        nextBlink = t + 2.2 + Math.random() * 4.5
        if (Math.random() < 0.18) nextBlink = t + 0.32 // sometimes a double blink
      }
      const bp = (t - blinkAt) / 0.17
      const blink = bp >= 0 && bp < 1 ? Math.abs(bp * 2 - 1) : 1

      // pose
      const breathe = Math.sin(t * 1.25) * 0.045 * sleep
      root.position.y = rm ? 0 : breathe - bob * 0.07
      pivot.rotation.y = look.x * 0.42
      pivot.rotation.x = look.y * 0.26 + (rm ? 0 : bob * 0.07) + sleep * 0.12
      pivot.rotation.z = rm ? 0 : -look.x * 0.04 + Math.sin(t * 0.6) * 0.012 * (1 - sleep)

      // eyes
      const open = Math.max(0.07, Math.min(1 - sleep * 0.93, blink))
      const dilate = hover && on ? 1.18 : 1
      for (const e of eyes) {
        e.g.scale.y = open * (1 - bob * 0.14)
        e.pupil.visible = open > 0.3
        e.pupil.position.x = eye.x * 0.1
        e.pupil.position.y = -eye.y * 0.115
        e.pupil.scale.setScalar(THREE.MathUtils.lerp(e.pupil.scale.x, dilate, 1 - Math.exp(-dt * 10)))
      }
      eyeGlowM.opacity = (0.12 + lv.energy * 0.25) * (1 - sleep * 0.7)

      // antenna and chest light
      const pulse = on ? 0.35 + lv.bass * 0.95 : 0.25 + (0.5 + 0.5 * Math.sin(t * 1.25)) * 0.25
      bulb.scale.setScalar(0.85 + pulse * 0.35)
      bulbGlow.scale.setScalar(0.5 + pulse * 1.1)
      glowM.opacity = Math.min(1, pulse * 0.9)
      chestLight.scale.x = 0.25 + (on ? lv.energy * 2.4 : 0.15)

      // mouth equaliser: low bands in the middle, higher ones to the sides
      for (let i = 0; i < MOUTH; i++) {
        const d = Math.abs(i - (MOUTH - 1) / 2)
        const v = L.bands[Math.min(L.bands.length - 1, Math.round(d * 4 + 1))]
        mouthBars[i].scale.y = 0.035 + (on ? v * 0.26 : 0) * (1 - sleep)
      }

      // ring: bass at the top, mirrored down both sides; a soft highlight sweeps round while playing
      if (!rm && on) sweep += dt * 0.9
      for (let i = 0; i < RING; i++) {
        const j = i < RING / 2 ? i : RING - 1 - i
        const v = L.bands[j]
        const a = Math.PI / 2 + (i / RING) * Math.PI * 2 + Math.PI / RING
        const len = 0.05 + v * 0.5
        const r = RING_R + len / 2
        dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, 0)
        dummy.rotation.set(0, 0, a - Math.PI / 2)
        dummy.scale.set(0.05, len, 0.05)
        dummy.updateMatrix()
        ring.setMatrixAt(i, dummy.matrix)
        const s = rm || !on ? 0 : Math.pow(Math.max(0, Math.cos(a - sweep)), 10) * 0.35
        cTmp.copy(cDim).lerp(cFg, Math.min(1, 0.1 + v * 0.95 + s))
        ring.setColorAt(i, cTmp)
      }
      ring.instanceMatrix.needsUpdate = true
      if (ring.instanceColor) ring.instanceColor.needsUpdate = true
      ringM.opacity = 0.55 + 0.45 * (1 - sleep)

      // a slow drift of the camera, for depth
      if (!rm) {
        camera.position.x = Math.sin(t * 0.21) * 0.35
        camera.position.y = 0.1 + Math.sin(t * 0.17) * 0.1
        camera.lookAt(0, 0, 0)
      } else if (camera.position.x !== 0) {
        camera.position.x = 0
        camera.position.y = 0.1
        camera.lookAt(0, 0, 0)
      }

      renderer.render(scene, camera)
      // dev only: expose what the robot is doing so tools/music-check.mjs can verify it
      if (import.meta.env.DEV && probe++ % 12 === 0) {
        host.dataset.gaze = `${eye.x.toFixed(2)},${eye.y.toFixed(2)}`
        host.dataset.beats = String(beats)
        host.dataset.open = open.toFixed(2)
        host.dataset.look = look.x.toFixed(2)
      }
    }

    const start = () => {
      if (!raf && document.visibilityState === 'visible') {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }
    const stopLoop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    const vis = () => (document.visibilityState === 'visible' ? start() : stopLoop())
    document.addEventListener('visibilitychange', vis)
    const unwatch = watchCursor()
    start()

    return () => {
      stopLoop()
      document.removeEventListener('visibilitychange', vis)
      window.removeEventListener('resize', onResize)
      unwatch()
      ro.disconnect()
      mo.disconnect()
      ring.dispose()
      geos.forEach((g) => g.dispose())
      mats.forEach((m) => m.dispose())
      glowTex.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [])

  return (
    <div ref={wrap} data-robot className="absolute inset-0">
      {failed && (
        <div className="flex h-full items-center justify-center text-foreground">
          <RobotFace className="h-24 w-28" />
        </div>
      )}
      {/* the shoulders fade into the stage */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-b from-transparent to-[var(--viz-bg)]" />
      <AnimatePresence>
        {!playing && !reduce && (
          <motion.div key="z" aria-hidden className="pointer-events-none absolute top-[14%] left-[calc(50%+58px)] font-mono text-muted-foreground"
            initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.4, delay: 0.6 } }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="absolute left-0 top-0 block"
                style={{ fontSize: 10 + i * 3 }}
                animate={{ x: [0, 8 + i * 6, 14 + i * 10], y: [0, -14 - i * 6, -30 - i * 10], opacity: [0, 0.9, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, delay: i * 1.05, ease: 'easeOut' }}>
                z
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        data-sfx="robot"
        onClick={() => {
          live.current.poke++
          music.toggle()
        }}
        onPointerEnter={() => (live.current.hover = true)}
        onPointerLeave={() => (live.current.hover = false)}
        aria-label={playing ? 'Robot: pause the music' : 'Robot: play the music'}
        title={playing ? 'Pause' : 'Play'}
        className="absolute inset-x-[22%] inset-y-[6%] cursor-pointer outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-foreground"
      />
    </div>
  )
}
