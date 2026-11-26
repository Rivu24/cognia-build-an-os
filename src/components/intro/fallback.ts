/* Intro loader, SVG fallback (no WebGL 2): the same sequence drawn in 2D. Bits converge onto the mark while its
   stroke draws; the circle becomes a wormhole (spiral arms turning into a black throat, a bright rim, rings receding
   inside it); then the view zooms into the throat, rings rush outward like a tunnel, and the site opens inside the
   light at the end. */
import { MARK, PLUNGE_POW, T, easeInOut, easeOut3, layout, plungeScale, rng, smooth, type Engine, type Frame, type Iris } from './timeline'

const NS = 'http://www.w3.org/2000/svg'
const INK = '#ececea'
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) => {
  const n = document.createElementNS(NS, tag)
  for (const k in attrs) n.setAttribute(k, String(attrs[k]))
  return n
}

export function createFallback(host: HTMLElement, w0: number, h0: number): Engine {
  const rnd = rng(5)
  const svg = el('svg', { class: 'intro-canvas', 'aria-hidden': 'true' })
  const zoom = el('g')
  const bracket = el('path', { fill: 'none', stroke: INK, 'stroke-linecap': 'square', 'stroke-linejoin': 'miter' })
  // the wormhole, drawn in units of the mark around the circle's centre (scaled by a transform)
  const hole = el('g', { opacity: 0 })
  const band = el('circle', { fill: 'none', stroke: INK, opacity: 0.18, r: MARK.circle.r, 'stroke-width': MARK.stroke })
  const throat = el('circle', { fill: '#000', r: MARK.inner })
  const arms = el('g', { fill: 'none', stroke: INK, 'stroke-linecap': 'round' })
  const ARMS = 7
  for (let i = 0; i < ARMS; i++) {
    // a logarithmic spiral from the outer edge of the stroke into the throat
    let d = ''
    for (let k = 0; k <= 24; k++) {
      const r = MARK.outer + 0.6 - (MARK.outer + 0.6 - MARK.inner) * (k / 24)
      const a = (i / ARMS) * Math.PI * 2 + 2.4 * Math.log((MARK.outer + 0.6) / r)
      d += `${k ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`
    }
    arms.appendChild(el('path', { d, 'stroke-width': 0.16 + (i % 3) * 0.08, opacity: 0.35 + (i % 2) * 0.35 }))
  }
  const depthRings = Array.from({ length: 5 }, () => el('circle', { fill: 'none', stroke: INK, 'stroke-width': 0.06 }))
  const rimC = el('circle', { fill: 'none', stroke: INK, r: MARK.inner, 'stroke-width': 0.22 })
  hole.append(band, arms, throat, ...depthRings, rimC)
  const dotsG = el('g')
  const tunnelG = el('g', { fill: 'none', stroke: INK })
  const warpG = el('g', { stroke: INK, 'stroke-width': 1 })
  const light = el('circle', { fill: '#fff', r: 0, opacity: 0 })
  zoom.append(bracket, hole)
  svg.append(warpG, dotsG, zoom, tunnelG, light)
  host.appendChild(svg)

  // bits: converge from far outside onto points of the mark
  const ND = 160
  const dots = Array.from({ length: ND }, () => {
    const c = el('circle', { r: 1.1, fill: INK, opacity: 0 })
    dotsG.appendChild(c)
    const onCircle = rnd() < 0.3
    let tx: number, ty: number, delay: number
    if (onCircle) {
      const a = rnd() * Math.PI * 2
      tx = MARK.circle.x + Math.cos(a) * MARK.circle.r
      ty = MARK.circle.y + Math.sin(a) * MARK.circle.r
      delay = 0.5 + rnd() * 0.12
    } else {
      const d = rnd() * 72
      const s = d / 72
      if (d < 22) [tx, ty] = [11 - d, 14]
      else if (d < 50) [tx, ty] = [-11, 14 - (d - 22)]
      else [tx, ty] = [-11 + (d - 50), -14]
      delay = 0.02 + s * 0.3 + rnd() * 0.1
    }
    const a = rnd() * Math.PI * 2
    const r = 0.6 + rnd() * 0.9
    return { c, tx, ty, sx: Math.cos(a) * r, sy: Math.sin(a) * r, delay, dur: 0.35 + rnd() * 0.15 }
  })
  const warp = Array.from({ length: 72 }, () => {
    const l = el('line', { opacity: 0 })
    warpG.appendChild(l)
    return { l, a: rnd() * Math.PI * 2, r: 0.05 + rnd() * 0.5, s: rnd() }
  })
  const NT = 16
  const tunnel = Array.from({ length: NT }, () => {
    const c = el('circle', { opacity: 0 })
    tunnelG.appendChild(c)
    return c
  })

  let w = w0
  let h = h0
  let ppu = 1
  let mx = 0
  let my = 0
  function resize(nw: number, nh: number) {
    w = nw
    h = nh
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    const L = layout(w, h)
    ppu = L.markPx / MARK.height
    mx = w / 2
    my = L.markCY
    const P = (x: number, y: number) => `${mx + x * ppu} ${my - y * ppu}`
    bracket.setAttribute('d', `M${P(11, 14)}L${P(-11, 14)}L${P(-11, -14)}L${P(11, -14)}`)
    bracket.setAttribute('stroke-width', String(MARK.stroke * ppu))
    bracket.setAttribute('stroke-dasharray', String(72 * ppu))
  }
  resize(w0, h0)

  let spin = 0
  function frame({ t, plunge, dt }: Frame): Iris | null {
    const A = T.assemble
    const u = t / A
    bracket.setAttribute('stroke-dashoffset', String(72 * ppu * (1 - easeOut3((u - 0.08) / 0.8))))
    const span = Math.max(w, h)
    for (const d of dots) {
      const lp = Math.min(1, Math.max(0, (u - d.delay) / d.dur))
      const k = Math.pow(1 - lp, 3)
      const x = mx + d.tx * ppu + d.sx * span * k
      const y = my - d.ty * ppu + d.sy * span * k
      d.c.setAttribute('cx', x.toFixed(1))
      d.c.setAttribute('cy', y.toFixed(1))
      d.c.setAttribute('opacity', String((0.25 + 0.75 * lp) * (1 - smooth(0.85, 1, lp) * 0.9) * (u > 1.6 || plunge >= 0 ? 0 : 1)))
    }

    // the wormhole: arms turn into the throat, rings recede inside it
    spin += dt * (1 + (plunge >= 0 ? 3 * smooth(0, T.dive, plunge) : 0))
    hole.setAttribute('opacity', String(smooth(0.5, 0.95, u)))
    arms.setAttribute('transform', `rotate(${((-spin * 40) % 360).toFixed(2)})`)
    depthRings.forEach((c, i) => {
      const q = (i + ((spin * 0.6) % 1)) / depthRings.length
      c.setAttribute('r', String(MARK.inner * Math.pow(0.16, q)))
      c.setAttribute('opacity', String(0.5 * (1 - q) * smooth(0, 0.15, q)))
    })

    const c0x = mx + MARK.circle.x * ppu
    const c0y = my - MARK.circle.y * ppu
    const placeHole = (s: number, fx: number, fy: number) =>
      hole.setAttribute('transform', `translate(${fx} ${fy}) scale(${ppu * s}) scale(1 -1)`)

    if (plunge < 0) {
      zoom.removeAttribute('transform')
      placeHole(1, c0x, c0y)
      return null
    }
    // dive: zoom into the throat
    const diag = Math.hypot(w, h) / 2
    const tau = Math.min(plunge / T.dive, 1)
    const a = easeInOut(tau / 0.8)
    const fx = c0x + (w / 2 - c0x) * a
    const fy = c0y + (h / 2 - c0y) * a
    const rEnd = diag * 1.06
    const s = plungeScale(tau, Math.log(rEnd / (MARK.inner * ppu)))
    zoom.setAttribute('transform', `translate(${fx} ${fy}) scale(${s}) translate(${-c0x} ${-c0y})`)
    placeHole(1, c0x, c0y)
    zoom.setAttribute('opacity', String(1 - smooth(0.85, 1, tau)))

    // ride: rings rush outward from the centre of the tunnel, speed building
    const ride = Math.max(0, plunge - T.dive)
    const R = T.plunge - T.dive
    const rideOn = plunge >= T.dive * 0.85 ? 1 : 0
    const phase = ride * 1.2 + Math.pow(ride, 3) * 0.9
    tunnel.forEach((c, i) => {
      const q = (i / NT + phase) % 1
      const r = 6 * Math.pow(diag / 6, q)
      c.setAttribute('cx', String(fx))
      c.setAttribute('cy', String(fy))
      c.setAttribute('r', r.toFixed(1))
      c.setAttribute('stroke-width', String(0.6 + q * 1.8))
      c.setAttribute('opacity', String(rideOn * 0.55 * smooth(0, 0.25, q) * (1 - smooth(0.8, 1, q)) * (1 - smooth(0.82, 1, ride / R))))
    })
    const pw = rideOn * smooth(0, 0.3, ride / R)
    for (const l of warp) {
      const k = (l.r + phase * (0.5 + l.s) * 0.5) % 1
      const r1 = diag * Math.pow(k, PLUNGE_POW)
      const r2 = r1 + diag * (0.04 + 0.3 * smooth(0, 1, ride / R))
      l.l.setAttribute('x1', String(fx + Math.cos(l.a) * r1))
      l.l.setAttribute('y1', String(fy + Math.sin(l.a) * r1))
      l.l.setAttribute('x2', String(fx + Math.cos(l.a) * r2))
      l.l.setAttribute('y2', String(fy + Math.sin(l.a) * r2))
      l.l.setAttribute('opacity', String(pw * (0.3 + 0.5 * l.s) * smooth(0, 0.2, k)))
    }
    // exit: the light at the end grows; the site opens inside it
    const e = smooth(R - 0.75, R, ride)
    const rl = 4 * Math.pow((diag * 1.25) / 4, e * e)
    light.setAttribute('cx', String(fx))
    light.setAttribute('cy', String(fy))
    light.setAttribute('r', ride > 0 ? rl.toFixed(1) : '0')
    light.setAttribute('opacity', String(rideOn * smooth(R - 0.95, R - 0.7, ride)))
    const r = rl * 0.86 - 26
    return r > 0 && ride > 0 ? { x: fx, y: fy, r } : null
  }

  return { kind: 'svg', resize, frame, dispose: () => svg.remove() }
}
