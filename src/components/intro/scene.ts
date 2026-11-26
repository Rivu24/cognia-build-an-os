/* Intro loader, WebGL scene. Loaded with import() so three stays out of the main bundle.
   1. Glowing bits drift in from deep space and condense onto the COGNIA mark; the bracket then materialises out of
      them as a solid, bevelled graphite object (lit by a studio environment, rim lights and a fresnel edge).
   2. The mark's circle becomes a wormhole: an accretion disc of particles spiralling into a black throat, a bright
      event-horizon rim, gravitational lensing of the starfield (a screen-space lens pass) and a tunnel behind it.
   3. The camera dives into the throat and travels the tunnel along a curved spline, streaks rushing past and speed
      building, then reaches the light at the far end; the site opens as an iris inside that exit.
   Layers: background (dust, then the lens pass adds a procedural starfield and bends both) → foreground (mark,
   wormhole, tunnel) drawn on top without lensing → bloom → output. */
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { FOV, MARK, PLUNGE_POW, T, easeInOut, easeOut3, layout, rng, smooth, type Engine, type Frame, type Iris } from './timeline'

const INK = 'vec3(0.93, 0.93, 0.92)'

/* ───────────────────────── shaders ───────────────────────── */

const POINT_FRAG = /* glsl */ `
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c) * 4.0;
    if (r2 > 1.0) discard;
    float a = exp(-r2 * 6.0) + 0.1 * exp(-r2 * 1.8);
    gl_FragColor = vec4(${INK}, a * vA);
  }
`

/** bits from deep space that condense onto the mark */
const BITS_VERT = /* glsl */ `
  uniform float uT;
  uniform float uA;
  uniform float uPR;
  uniform float uScale;
  uniform float uSize;
  uniform float uTwist;
  uniform float uFade;
  attribute vec3 aStart;
  attribute vec4 aData; // delay, dur (fractions of uA), seed, brightness
  varying float vA;
  vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
  void main() {
    float delay = aData.x, dur = aData.y, seed = aData.z, br = aData.w;
    float lp = clamp((uT / uA - delay) / dur, 0.0, 1.0);
    float k = pow(1.0 - lp, 3.0);
    vec3 p = position + (aStart - position) * k;
    p.xy = rot(p.xy, k * uTwist * (0.55 + seed));
    float since = uT - (delay + dur) * uA;
    float flash = since > 0.0 ? exp(-since * 4.5) : 0.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    float ps = uSize * br * (1.0 + 1.6 * flash) * uScale * uPR / max(d, 0.05);
    float psc = clamp(ps, 1.4, 6.0 * uPR);
    float energy = min(1.0, (ps * ps) / (psc * psc));
    gl_PointSize = psc;
    float travel = 0.6 + 0.4 * smoothstep(0.0, 0.5, lp);
    float dn = d * 1000.0 / uScale;
    vA = travel * (0.26 + 1.1 * flash) * energy * smoothstep(5.0, 22.0, dn) * uFade;
    gl_Position = projectionMatrix * mv;
  }
`

/** accretion disc: logarithmic spirals into the throat, then down into the tunnel */
const DISC_VERT = /* glsl */ `
  uniform float uFlow;
  uniform float uOn;
  uniform float uPR;
  uniform float uScale;
  uniform float uSize;
  attribute vec4 aD; // theta0, phase, seed, brightness
  varying float vA;
  const float RI = ${MARK.inner.toFixed(2)};
  void main() {
    float th0 = aD.x, ph = aD.y, seed = aD.z, br = aD.w;
    float rate = 0.13 + 0.12 * fract(seed * 13.7);
    float u = fract(ph + uFlow * rate);
    float ro = mix(${MARK.outer.toFixed(2)}, 7.6, pow(seed, 2.2));
    float r = pow(mix(pow(ro, 1.5), pow(RI - 0.1, 1.5), u), 1.0 / 1.5);
    float th = th0 + 2.4 * log(ro / r) + uFlow * 0.22;
    float dive = smoothstep(0.86, 1.0, u);
    r *= 1.0 - 0.28 * dive;
    float z = -dive * dive * 18.0 + (fract(seed * 7.31) - 0.5) * 0.45 * smoothstep(2.4, 6.0, r);
    vec3 p = vec3(${MARK.circle.x.toFixed(1)} + r * cos(th), r * sin(th), z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    float ps = uSize * br * uScale * uPR / max(d, 0.05);
    float psc = clamp(ps, 1.2, 5.0 * uPR);
    gl_PointSize = psc;
    float energy = min(1.0, (ps * ps) / (psc * psc));
    // the band of the mark's stroke is bright, the halo outside it fades, the throat swallows the rest
    float prof = (0.35 + 0.65 * smoothstep(5.6, 4.4, r)) * smoothstep(7.6, 5.8, r) * (0.75 + 0.5 * smoothstep(3.1, 2.4, r));
    float life = smoothstep(0.0, 0.06, u) * (1.0 - 0.75 * dive);
    float dn = d * 1000.0 / uScale;
    vA = uOn * prof * life * energy * smoothstep(5.0, 22.0, dn) * 0.5;
    gl_Position = projectionMatrix * mv;
  }
`

/** accretion disc surface: noise sheared by differential rotation into spiral arms that wind into the throat */
const SWIRL_VERT = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SWIRL_FRAG = /* glsl */ `
  uniform float uFlow;
  uniform float uOn;
  varying vec2 vP;
  float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float n3(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    float r = length(vP);
    float th = atan(vP.y, vP.x);
    float lr = log(r);
    float om = 1.7 * pow(${MARK.inner.toFixed(2)} / r, 1.5);
    float tp = th + 2.6 * lr - uFlow * om;
    float lq = lr * 7.0 + uFlow * 1.6;
    vec3 q = vec3(cos(tp) * 2.2, sin(tp) * 2.2, lq);
    float n = n3(q) * 0.6 + n3(q * 2.03 + 7.0) * 0.3 + n3(q * 4.1 + 3.0) * 0.1;
    float arms = pow(smoothstep(0.3, 0.9, n), 2.2);
    float edge = smoothstep(${MARK.inner.toFixed(2)} - 0.02, ${MARK.inner.toFixed(2)} + 0.06, r);
    float prof = edge * (0.75 * exp(-(r - ${MARK.inner.toFixed(2)}) / 0.28) + 0.5 * smoothstep(5.4, 3.9, r) + 0.1 * smoothstep(7.8, 4.8, r));
    float I = prof * (0.1 + 1.2 * arms) * uOn;
    gl_FragColor = vec4(${INK} * I, 1.0);
  }
`

const DUST_VERT = /* glsl */ `
  uniform float uT;
  uniform float uPR;
  uniform float uScale;
  attribute vec3 aData; // seed, brightness, speed
  varying float vA;
  void main() {
    vec3 p = position;
    p.z = mod(position.z + uT * aData.z + 420.0, 560.0) - 420.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    float ps = 0.5 * aData.y * uScale * uPR / max(d, 0.05);
    float psc = clamp(ps, 1.2, 30.0 * uPR);
    gl_PointSize = psc;
    vA = 0.16 * aData.y * min(1.0, (ps * ps) / (psc * psc)) * smoothstep(0.5, 6.0, d);
    gl_Position = projectionMatrix * mv;
  }
`

/** the tunnel: an opaque black tube; light streaks flow along its walls, hairline rings mark its depth */
const TUBE_VERT = /* glsl */ `
  attribute vec2 aST; // arc length (world units), angle (0..1)
  varying vec2 vST;
  varying float vDist;
  void main() {
    vST = aST;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDist = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const TUBE_FRAG = /* glsl */ `
  uniform float uFlow;
  uniform float uStretch;
  uniform float uOn;
  uniform float uNear;
  uniform float uFar;
  uniform float uWall;
  varying vec2 vST;
  varying float vDist;
  float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  void main() {
    float lanes = 44.0;
    float a = vST.y * lanes;
    float lane = floor(a);
    float h1 = h11(lane + 1.0), h2 = h11(lane + 71.0);
    float lx = abs(fract(a) - 0.5);
    float fw = fwidth(a);
    // hairlines at any distance; lanes that crowd together far away fade instead of aliasing
    float line = (1.0 - smoothstep(0.0, fw * 1.15, lx)) * (1.0 - smoothstep(0.22, 0.45, fw));
    float y = vST.x / (9.0 + 16.0 * h2) - uFlow * (0.55 + 0.9 * h1) + h1 * 9.0;
    float f = fract(y);
    float len = mix(0.1, 0.62, uStretch) * (0.45 + 0.55 * h2);
    float dash = smoothstep(0.0, 0.025, f) * (1.0 - smoothstep(len * 0.35, len, f));
    float streak = line * dash * (0.25 + 0.75 * h1) * step(0.28, h2);
    float rg = vST.x / 7.0;
    float rd = abs(fract(rg + 0.5) - 0.5);
    float fr = fwidth(rg);
    float ring = (1.0 - smoothstep(0.0, fr * 1.2, rd)) * (1.0 - smoothstep(0.18, 0.4, fr)) * 0.16;
    float fog = 1.0 - smoothstep(uNear, uFar, vDist);
    // the walls themselves: a faint fluted tone, so the tube reads as a surface that curves away into the dark
    float flute = 0.7 + 0.3 * sin(vST.y * 43.98 + vST.x * 0.09);
    float I = (streak * 1.7 + ring + uWall * flute) * fog * uOn;
    gl_FragColor = vec4(${INK} * I, 1.0);
  }
`

/** streaks rushing past inside the tunnel; their length follows the camera speed */
const WARP_VERT = /* glsl */ `
  uniform float uStretch;
  uniform float uWarp;
  attribute vec3 aTan;
  attribute float aEnd;
  attribute float aSeed;
  varying float vA;
  void main() {
    vec3 p = position + aTan * aEnd * uStretch * (0.4 + aSeed);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    vA = uWarp * (1.0 - 0.9 * aEnd) * (0.3 + 0.7 * aSeed) * smoothstep(0.2, 3.0, d) * (1.0 - smoothstep(14.0, 38.0, d));
    gl_Position = projectionMatrix * mv;
  }
`
const WARP_FRAG = /* glsl */ `
  varying float vA;
  void main() { gl_FragColor = vec4(${INK}, vA); }
`

/** gravitational lens: bends the background (dust + a procedural starfield) around the throat, swallows what falls
    inside the event horizon, and blacks the background out once the camera is inside the tunnel */
const LENS = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAspect: { value: 1 },
    uResY: { value: 900 },
    uPR: { value: 1 },
    uC: { value: new THREE.Vector2(0.5, 0.5) },
    uRs: { value: 0.05 },
    uOn: { value: 0 },
    uSwirl: { value: 1.1 },
    uInside: { value: 0 },
    uSky: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAspect, uResY, uPR, uRs, uOn, uSwirl, uInside, uSky;
    uniform vec2 uC;
    varying vec2 vUv;
    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
    }
    float stars(vec2 px, float cell, float thr, float sig) {
      vec2 g = px / cell;
      vec2 id = floor(g);
      float h = h21(id);
      if (h < thr) return 0.0;
      vec2 o = vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5;
      vec2 d = (fract(g) - 0.5 - o * 0.7) * cell;
      return (h - thr) / (1.0 - thr) * exp(-dot(d, d) / (sig * uPR * uPR));
    }
    vec3 sky(vec2 q) {
      vec2 px = q * uResY;
      float s = 0.42 * stars(px, 7.0 * uPR, 0.92, 0.45) + 0.7 * stars(px + 31.0, 19.0 * uPR, 0.9, 0.7) + stars(px + 97.0, 53.0 * uPR, 0.86, 1.3);
      float n = vnoise(q * 2.6) * 0.6 + vnoise(q * 6.1) * 0.3 + vnoise(q * 13.0) * 0.1;
      float band = exp(-pow((q.y - 0.5 + 0.35 * (q.x - 0.5 * uAspect)) * 2.4, 2.0));
      return vec3(s * 0.85 + pow(n, 3.0) * 0.022 * (0.25 + band));
    }
    void main() {
      vec2 k = vec2(uAspect, 1.0);
      vec2 q = vUv * k;
      vec2 c = uC * k;
      vec2 d = q - c;
      float r = max(length(d), 1e-5);
      float rs = uRs;
      float E2 = 6.0 * rs * rs * uOn; // Einstein radius about 2.4 horizons: the bending shows around the disc
      float rr = r - E2 / r;
      float ang = uSwirl * uOn * min(1.0, rs / r);
      float ca = cos(ang), sa = sin(ang);
      vec2 dir = d / r;
      dir = vec2(ca * dir.x - sa * dir.y, sa * dir.x + ca * dir.y);
      vec2 sq = c + dir * rr;
      vec2 suv = sq / k;
      float inb = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
      vec3 col = texture2D(tDiffuse, suv).rgb * inb + sky(sq) * uSky;
      float shadow = smoothstep(rs * 0.985, rs * 1.04, r);
      col *= mix(1.0, shadow, uOn);
      col += vec3(0.16) * uOn * shadow * exp(-max(r - rs, 0.0) / max(rs * 0.3, 1e-4));
      gl_FragColor = vec4(col * (1.0 - uInside), 1.0);
    }
  `,
}

/** draws the foreground scene over the lensed background (keeps the colour, clears the depth) */
class OverlayPass extends Pass {
  scene: THREE.Scene
  camera: THREE.Camera
  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    super()
    this.scene = scene
    this.camera = camera
    this.needsSwap = false
  }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const auto = renderer.autoClear
    renderer.autoClear = false
    renderer.setRenderTarget(this.renderToScreen ? null : read)
    renderer.clearDepth()
    renderer.render(this.scene, this.camera)
    renderer.autoClear = auto
  }
}

/* ───────────────────────── geometry ───────────────────────── */

/** Points on the stroked bracket (and on the stroke band of the circle) with the order they lock in. */
function buildBits(n: number, rnd: () => number) {
  const segs = MARK.bars.map(([a, b]) => ({ a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]), horiz: a[1] === b[1] }))
  const L = segs.reduce((s, x) => s + x.len, 0)
  const C = 2 * Math.PI * MARK.circle.r * 1.1
  const hs = MARK.half
  const target = new Float32Array(n * 3)
  const start = new Float32Array(n * 3)
  const data = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number, delay: number, dur: number
    if (rnd() < C / (L + C)) {
      const th = rnd() * Math.PI * 2
      const R = MARK.inner + 0.1 + (MARK.outer - MARK.inner) * (0.5 + (rnd() - 0.5) * (rnd() + 0.3))
      x = MARK.circle.x + R * Math.cos(th)
      y = MARK.circle.y + R * Math.sin(th)
      z = (rnd() - 0.5) * 0.4
      delay = 0.5 + (th / (Math.PI * 2)) * 0.06 + rnd() * 0.05
      dur = 0.3 + rnd() * 0.08
    } else {
      let d = rnd() * L
      let s = 0
      let seg = segs[0]
      for (const g of segs) {
        if (d <= g.len) {
          seg = g
          break
        }
        d -= g.len
        s += g.len
      }
      const t = d / seg.len
      const cx = seg.a[0] + (seg.b[0] - seg.a[0]) * t
      const cy = seg.a[1] + (seg.b[1] - seg.a[1]) * t
      // on the surface of the square cross-section, so the solid grows exactly where the bits land
      let u = (rnd() * 2 - 1) * hs
      let v = (rnd() * 2 - 1) * hs
      if (rnd() < 0.5) u = rnd() < 0.5 ? -hs : hs
      else v = rnd() < 0.5 ? -hs : hs
      x = seg.horiz ? cx : cx + u
      y = seg.horiz ? cy + u : cy
      z = v
      const sp = (s + d) / L
      delay = 0.02 + sp * 0.3 + rnd() * 0.1
      dur = 0.38 + rnd() * 0.14
    }
    target.set([x, y, z], i * 3)
    const ang = rnd() * Math.PI * 2
    const rad = 30 + Math.pow(rnd(), 0.5) * 220
    const front = rnd() < 0.12
    start.set([x + Math.cos(ang) * rad * 1.4, y + Math.sin(ang) * rad * 0.9, front ? 20 + rnd() * 75 : -30 - Math.pow(rnd(), 0.8) * 300], i * 3)
    const br = rnd() < 0.04 ? 1.9 : 0.6 + rnd() * 0.7
    data.set([delay, dur, rnd(), br], i * 4)
  }
  return { target, start, data }
}

/** The solid bracket: extruded with a bevel; the silhouette matches the stroked mark exactly. */
function bracketGeometry() {
  const shape = new THREE.Shape(MARK.outline.map(([x, y]) => new THREE.Vector2(x, y)))
  const bevel = 0.5
  const depth = MARK.stroke - 2 * bevel
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 4, curveSegments: 1 })
  geo.translate(0, 0, -depth / 2)
  return geo
}

/** Graphite metal that materialises out of the bits: a noise dissolve that follows the drawing order of the mark,
    a glowing edge where it forms, and a fresnel rim so the silhouette always catches light. */
function bracketMaterial(env: THREE.Texture) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x7c7c7c,
    metalness: 1,
    roughness: 0.22,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
    envMap: env,
    envMapIntensity: 1.0,
  })
  const uniforms = { uReveal: { value: -0.1 }, uRim: { value: 0.8 } }
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vObj;
        uniform float uReveal;
        uniform float uRim;
        float dh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float dn(vec3 x) {
          vec3 i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(dh(i), dh(i + vec3(1,0,0)), f.x), mix(dh(i + vec3(0,1,0)), dh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(dh(i + vec3(0,0,1)), dh(i + vec3(1,0,1)), f.x), mix(dh(i + vec3(0,1,1)), dh(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        float dissolveEdge() {
          float ord;
          if (vObj.y > 12.7) ord = (12.3 - vObj.x) / 74.6;
          else if (vObj.y < -12.7) ord = (50.0 + vObj.x + 12.3) / 74.6;
          else ord = (24.6 + 12.7 - vObj.y) / 74.6;
          float n = dn(vObj * 0.85) * 0.65 + dn(vObj * 2.3) * 0.35;
          return uReveal - (ord * 0.7 + n * 0.3);
        }`,
      )
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat dEdge = dissolveEdge();\nif (dEdge < 0.0) discard;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(3.2) * (1.0 - smoothstep(0.0, 0.05, dEdge));
        float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
        totalEmissiveRadiance += vec3(fres * uRim);`,
      )
  }
  return { mat, uniforms }
}

/** The tunnel's path: straight out of the mouth, a few gentle bends, straight again into the exit. */
function tunnelCurve() {
  const cx = MARK.circle.x
  const P = [
    [0, 0, 0],
    [0, 0, -12],
    [0, 0, -24],
    [3, 1.4, -40],
    [-2, -1.8, -56],
    [-3.2, 1.2, -70],
    [-0.4, 0.4, -82],
    [0, 0, -94],
    [0, 0, -110],
    [0, 0, -126],
    [0, 0, -142],
  ]
  return new THREE.CatmullRomCurve3(
    P.map(([x, y, z]) => new THREE.Vector3(cx + x, y, z)),
    false,
    'centripetal',
  )
}

const EXIT_R = 14
const BELL = 40 // the last stretch of the tunnel flares open like a bell towards the light
function tubeGeometry(curve: THREE.CatmullRomCurve3, Ls: number) {
  const SEG = 520
  const RAD = 120
  const frames = curve.computeFrenetFrames(SEG, false)
  const pos = new Float32Array((SEG + 1) * (RAD + 1) * 3)
  const st = new Float32Array((SEG + 1) * (RAD + 1) * 2)
  const P = new THREE.Vector3()
  const V = new THREE.Vector3()
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG
    curve.getPointAt(u, P)
    const s = u * Ls
    // the exit flares into a bell so the light at the end opens wide
    const R = MARK.inner + (EXIT_R - MARK.inner) * Math.pow(smooth(Ls - BELL, Ls, s), 1.8)
    const N = frames.normals[i]
    const B = frames.binormals[i]
    for (let j = 0; j <= RAD; j++) {
      const a = (j / RAD) * Math.PI * 2
      V.copy(P).addScaledVector(N, Math.cos(a) * R).addScaledVector(B, Math.sin(a) * R)
      const k = i * (RAD + 1) + j
      pos.set([V.x, V.y, V.z], k * 3)
      st.set([s, j / RAD], k * 2)
    }
  }
  const idx: number[] = []
  for (let i = 0; i < SEG; i++)
    for (let j = 0; j < RAD; j++) {
      const a = i * (RAD + 1) + j
      const b = a + RAD + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aST', new THREE.BufferAttribute(st, 2))
  geo.setIndex(idx)
  return geo
}

/* ───────────────────────── scene ───────────────────────── */

export async function createScene(host: HTMLElement, w0: number, h0: number): Promise<Engine> {
  const canvas = document.createElement('canvas')
  canvas.className = 'intro-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' })
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2 required')
  const pr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(pr)
  renderer.setClearColor(0x000000, 1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  // three would print the D3D compiler's harmless precision notes for its own PMREM shaders as console warnings;
  // link failures are still caught: every program is checked once after the first frame (see checkPrograms)
  renderer.debug.checkShaderErrors = false
  host.appendChild(canvas)

  const small = w0 < 640
  const cpr = Math.min(pr, small ? 1.5 : 2)
  const bg = new THREE.Scene()
  const fg = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, w0 / h0, 0.05, 1400)
  const group = new THREE.Group()
  fg.add(group)
  const rnd = rng(11)
  const disposables: { dispose(): void }[] = []
  const common = { uPR: { value: cpr }, uScale: { value: 1 } }

  // ── studio light for the metal: a neutral room environment, a soft key and two bright rims from behind ──
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const envRT = pmrem.fromScene(room, 0.04)
  room.dispose()
  pmrem.dispose()
  disposables.push(envRT)
  const key = new THREE.DirectionalLight(0xffffff, 0.9)
  key.position.set(-8, 7, 12)
  const rimA = new THREE.DirectionalLight(0xffffff, 5)
  rimA.position.set(10, 9, -12)
  const rimB = new THREE.DirectionalLight(0xffffff, 2.6)
  rimB.position.set(-12, -8, -9)
  // a close light in front, up and to the left: a sheen that travels across the faces as the mark turns
  const sheen = new THREE.PointLight(0xffffff, 0.3, 0, 0)
  sheen.position.set(-12, 18, 26)
  fg.add(key, rimA, rimB, sheen)

  // ── the solid bracket ──
  const bracketGeo = bracketGeometry()
  const bracket = bracketMaterial(envRT.texture)
  const solid = new THREE.Mesh(bracketGeo, bracket.mat)
  solid.renderOrder = 1
  group.add(solid)
  disposables.push(bracketGeo, bracket.mat)

  // ── bits from deep space ──
  const N = small ? 6500 : 11000
  const bits = buildBits(N, rnd)
  const bitsGeo = new THREE.BufferGeometry()
  bitsGeo.setAttribute('position', new THREE.BufferAttribute(bits.target, 3))
  bitsGeo.setAttribute('aStart', new THREE.BufferAttribute(bits.start, 3))
  bitsGeo.setAttribute('aData', new THREE.BufferAttribute(bits.data, 4))
  const bitsMat = new THREE.ShaderMaterial({
    vertexShader: BITS_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: { ...common, uT: { value: 0 }, uA: { value: T.assemble }, uSize: { value: small ? 0.3 : 0.25 }, uTwist: { value: 2.4 }, uFade: { value: 1 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  })
  const bitsPts = new THREE.Points(bitsGeo, bitsMat)
  bitsPts.frustumCulled = false
  bitsPts.renderOrder = 5
  group.add(bitsPts)
  disposables.push(bitsGeo, bitsMat)

  // ── wormhole: accretion disc (a swirling surface, sparks on top that spiral in and fall into the tunnel) ──
  const swirlGeo = new THREE.RingGeometry(MARK.inner - 0.05, 7.8, 192, 12)
  const swirlMat = new THREE.ShaderMaterial({
    vertexShader: SWIRL_VERT,
    fragmentShader: SWIRL_FRAG,
    uniforms: { uFlow: { value: 0 }, uOn: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
  const swirl = new THREE.Mesh(swirlGeo, swirlMat)
  swirl.position.set(MARK.circle.x, MARK.circle.y, 0)
  swirl.renderOrder = 3
  group.add(swirl)
  disposables.push(swirlGeo, swirlMat)
  const ND = small ? 2600 : 4200
  const dD = new Float32Array(ND * 4)
  for (let i = 0; i < ND; i++) dD.set([rnd() * Math.PI * 2, rnd(), rnd(), rnd() < 0.05 ? 1.8 : 0.5 + rnd() * 0.8], i * 4)
  const discGeo = new THREE.BufferGeometry()
  discGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3), 3))
  discGeo.setAttribute('aD', new THREE.BufferAttribute(dD, 4))
  const discMat = new THREE.ShaderMaterial({
    vertexShader: DISC_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: { ...common, uFlow: { value: 0 }, uOn: { value: 0 }, uSize: { value: small ? 0.2 : 0.17 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const disc = new THREE.Points(discGeo, discMat)
  disc.frustumCulled = false
  disc.renderOrder = 4
  group.add(disc)
  disposables.push(discGeo, discMat)

  // ── wormhole: event-horizon rim (a thin bright torus; bloom makes it glow) ──
  const rimGeo = new THREE.TorusGeometry(MARK.inner + 0.03, 0.075, 12, 160)
  const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  const rim = new THREE.Mesh(rimGeo, rimMat)
  rim.position.set(MARK.circle.x, MARK.circle.y, 0)
  rim.renderOrder = 4
  group.add(rim)
  disposables.push(rimGeo, rimMat)

  // ── wormhole: the tunnel ──
  const curve = tunnelCurve()
  const Ls = curve.getLength()
  const tubeGeo = tubeGeometry(curve, Ls)
  // seen from outside the tunnel glows (additive: no black silhouette against the stars when the mark tilts); for
  // the ride it turns solid, so its bends hide what lies beyond them and the exit appears only down the last straight
  const tubeUniforms = { uFlow: { value: 0 }, uStretch: { value: 0 }, uOn: { value: 0 }, uNear: { value: 6 }, uFar: { value: 70 } }
  // the wall tone only inside: seen from outside, through the throat, the tunnel must not grey the black centre
  const tubeGlowMat = new THREE.ShaderMaterial({ vertexShader: TUBE_VERT, fragmentShader: TUBE_FRAG, uniforms: { ...tubeUniforms, uWall: { value: 0 } }, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const tubeSolidMat = new THREE.ShaderMaterial({ vertexShader: TUBE_VERT, fragmentShader: TUBE_FRAG, uniforms: { ...tubeUniforms, uWall: { value: 0.03 } }, side: THREE.DoubleSide })
  const tubeMat = { uniforms: tubeUniforms }
  const tubeGlow = new THREE.Mesh(tubeGeo, tubeGlowMat)
  const tubeSolid = new THREE.Mesh(tubeGeo, tubeSolidMat)
  for (const m of [tubeGlow, tubeSolid]) {
    m.frustumCulled = false
    group.add(m)
  }
  disposables.push(tubeGeo, tubeGlowMat, tubeSolidMat)

  // ── the light at the far end ──
  const endP = curve.getPointAt(1)
  const endT = curve.getTangentAt(1)
  const exitGeo = new THREE.CircleGeometry(EXIT_R + 0.1, 96)
  const exitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.4), side: THREE.DoubleSide })
  const exit = new THREE.Mesh(exitGeo, exitMat)
  exit.position.copy(endP).addScaledVector(endT, -0.05)
  exit.lookAt(endP.clone().addScaledVector(endT, -10))
  group.add(exit)
  disposables.push(exitGeo, exitMat)

  // ── streaks inside the tunnel ──
  const NW = small ? 600 : 1000
  const wPos = new Float32Array(NW * 6)
  const wTan = new Float32Array(NW * 6)
  const wEnd = new Float32Array(NW * 2)
  const wSeed = new Float32Array(NW * 2)
  {
    const frames = curve.computeFrenetFrames(200, false)
    const P = new THREE.Vector3()
    const Tn = new THREE.Vector3()
    for (let i = 0; i < NW; i++) {
      const u = 0.02 + rnd() * 0.9
      curve.getPointAt(u, P)
      curve.getTangentAt(u, Tn)
      const fi = Math.round(u * 200)
      const a = rnd() * Math.PI * 2
      const r = MARK.inner * (0.35 + 0.57 * Math.sqrt(rnd()))
      P.addScaledVector(frames.normals[fi], Math.cos(a) * r).addScaledVector(frames.binormals[fi], Math.sin(a) * r)
      wPos.set([P.x, P.y, P.z, P.x, P.y, P.z], i * 6)
      wTan.set([Tn.x, Tn.y, Tn.z, Tn.x, Tn.y, Tn.z], i * 6)
      wEnd.set([0, 1], i * 2)
      const s = rnd()
      wSeed.set([s, s], i * 2)
    }
  }
  const warpGeo = new THREE.BufferGeometry()
  warpGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3))
  warpGeo.setAttribute('aTan', new THREE.BufferAttribute(wTan, 3))
  warpGeo.setAttribute('aEnd', new THREE.BufferAttribute(wEnd, 1))
  warpGeo.setAttribute('aSeed', new THREE.BufferAttribute(wSeed, 1))
  const warpMat = new THREE.ShaderMaterial({
    vertexShader: WARP_VERT,
    fragmentShader: WARP_FRAG,
    uniforms: { uStretch: { value: 0 }, uWarp: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const warp = new THREE.LineSegments(warpGeo, warpMat)
  warp.frustumCulled = false
  group.add(warp)
  disposables.push(warpGeo, warpMat)

  // ── background: deep-space dust with parallax (the lens pass adds the far starfield) ──
  const NU = small ? 1400 : 2600
  const uPos = new Float32Array(NU * 3)
  const uData = new Float32Array(NU * 3)
  for (let i = 0; i < NU; i++) {
    uPos.set([(rnd() * 2 - 1) * 170, (rnd() * 2 - 1) * 110, -420 + rnd() * 560], i * 3)
    uData.set([rnd(), 0.4 + rnd() * 1.1, 2 + rnd() * 6], i * 3)
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(uPos, 3))
  dustGeo.setAttribute('aData', new THREE.BufferAttribute(uData, 3))
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: { ...common, uT: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  })
  const dust = new THREE.Points(dustGeo, dustMat)
  dust.frustumCulled = false
  bg.add(dust)
  disposables.push(dustGeo, dustMat)

  // compile every material now (all visible for a moment), so nothing compiles mid-sequence; with
  // KHR_parallel_shader_compile the driver works in the background and the boot log keeps running meanwhile
  try {
    await Promise.all([renderer.compileAsync(fg, camera), renderer.compileAsync(bg, camera)])
  } catch (err) {
    disposables.forEach((d) => d.dispose())
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
    throw err
  }

  // ── post: background → lens → foreground → bloom (dropped on slow devices) → output ──
  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(cpr)
  composer.addPass(new RenderPass(bg, camera))
  const lens = new ShaderPass(LENS)
  lens.material.depthTest = false
  lens.material.depthWrite = false
  composer.addPass(lens)
  const overlay = new OverlayPass(fg, camera)
  composer.addPass(overlay)
  const bloom = new UnrealBloomPass(new THREE.Vector2(w0, h0), 0.7, 0.42, 0.7)
  composer.addPass(bloom)
  const output = new OutputPass()
  composer.addPass(output)
  const LU = lens.uniforms as unknown as typeof LENS.uniforms
  let slowFrames = 0
  let sampled = 0

  // ── layout ──
  let w = w0
  let h = h0
  let D = 100 // camera distance that gives the mark its layout size
  let ty = 0 // camera y offset that puts the mark at its layout position
  const focal = (fov: number) => h / (2 * Math.tan(((fov / 2) * Math.PI) / 180))
  function resize(nw: number, nh: number) {
    w = nw
    h = nh
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    const L = layout(w, h)
    const f = focal(FOV)
    D = (MARK.height * f) / L.markPx
    ty = (L.markCY - h / 2) * (D / f)
    common.uScale.value = f
    LU.uAspect.value = w / h
    LU.uResY.value = h * cpr
    LU.uPR.value = cpr
  }
  resize(w0, h0)
  // the post passes' shaders compile in the background too, exactly as the composer uses them (into a render target)
  {
    const post = new THREE.Scene()
    const quad = new THREE.PlaneGeometry(2, 2)
    const mats = [lens.material, bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial, composer.copyPass.material]
    for (const m of mats) post.add(new THREE.Mesh(quad, m))
    renderer.setRenderTarget(composer.renderTarget1)
    const ready = renderer.compileAsync(post, camera)
    renderer.setRenderTarget(null)
    await ready.finally(() => quad.dispose())
  }
  // one warm-up frame (the canvas is still transparent): compiles the output pass and uploads every buffer now,
  // during the boot log, rather than as a stall on the first visible frame of the scene
  camera.position.set(0, 0, 100)
  composer.render(0)
  for (const o of [tubeGlow, tubeSolid, exit, warp]) o.visible = false

  // ── camera path through the tunnel ──
  const mouth = curve.getPointAt(0)
  const startT = curve.getTangentAt(0)
  const P = new THREE.Vector3()
  const Q = new THREE.Vector3()
  /** a point on the camera's path: s < 0 in front of the mouth, 0..Ls inside, beyond Ls past the exit (local) */
  function pathPos(s: number, out: THREE.Vector3) {
    if (s <= 0) return out.copy(mouth).addScaledVector(startT, s)
    if (s >= Ls) return out.copy(endP).addScaledVector(endT, s - Ls)
    return curve.getPointAt(s / Ls, out)
  }
  const DIVE_END = 1.2 // the dive ends this far in front of the mouth, then the tunnel ride takes over
  const RIDE = T.plunge - T.dive - 0.06 // the ride reaches the exit just before the plunge ends
  let plungeFrom = -1
  let kd = 1
  let vEnter = 1
  let cRide = 1
  let prevS = 0
  let speed = 0
  let flow = 0
  let tubeFlow = 0
  const vC = new THREE.Vector3()
  const vE = new THREE.Vector3()
  const up = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const right = new THREE.Vector3()
  const qRoll = new THREE.Quaternion()

  const proj = (v: THREE.Vector3) => ({ x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h })

  /** once, after the first frame: a program that failed to link throws, and the loader opens the page at once */
  let checked = false
  function checkPrograms() {
    checked = true
    const gl = renderer.getContext()
    for (const p of renderer.info.programs ?? []) {
      const prog = (p as unknown as { program: WebGLProgram }).program
      if (prog && gl.getProgramParameter(prog, gl.LINK_STATUS) === false) throw new Error('intro shader failed')
    }
  }

  function frame({ t, plunge, dt, px = 0, py = 0 }: Frame): Iris | null {
    const A = T.assemble
    bitsMat.uniforms.uT.value = t
    dustMat.uniforms.uT.value = t

    // the mark is still turning into place while the solid forms (so its depth reads), then sways slightly while
    // the lockup is read; it squares up to the camera for the dive
    const settle = easeInOut(t / (A * 1.65))
    const calm = plunge >= 0 ? 1 - smooth(0, 0.45, plunge) : 1
    group.rotation.y = (-0.85 * (1 - settle) + (-0.09 + Math.sin(t * 0.55 - 0.6) * 0.07) * settle) * calm
    group.rotation.x = (0.32 * (1 - settle) + (-0.04 + Math.sin(t * 0.41 + 1) * 0.05) * settle) * calm
    // the mark turns to follow the pointer (a heavy, slow lean), straightening out for the dive
    group.rotation.y += px * 0.26 * settle * calm
    group.rotation.x += -py * 0.18 * settle * calm

    // condense → materialise → ignite
    bitsMat.uniforms.uFade.value = 1 - smooth(A * 0.85, A * 1.15, t)
    bracket.uniforms.uReveal.value = -0.03 + 1.13 * smooth(A * 0.5, A * 1.05, t)
    const on = smooth(A * 0.8, A * 1.3, t)
    discMat.uniforms.uOn.value = on
    // the disc dims as it fills the view during the dive, so the throat stays black
    swirlMat.uniforms.uOn.value = on * (plunge >= 0 ? 1 - 0.6 * smooth(T.dive * 0.25, T.dive * 0.9, plunge) : 1)
    rimMat.opacity = on
    const tunnelOn = smooth(A * 0.9, A * 1.55, t)

    // ── camera ──
    let cx = Math.sin(t * 0.31) * 0.9 * settle + px * 2.2 * settle * calm
    let cy = ty + Math.cos(t * 0.27) * 0.5 * settle + py * 1.3 * settle * calm
    let dist = D * (1.07 - 0.07 * easeOut3(t / (A + 1.4)))
    let fov = FOV
    let inside = 0
    let ride = -1
    let rideS = -1
    group.updateMatrixWorld()
    if (plunge >= 0) {
      if (plungeFrom < 0) {
        plungeFrom = dist
        kd = Math.log(plungeFrom / DIVE_END)
        vEnter = (DIVE_END * kd * PLUNGE_POW) / T.dive
        cRide = (Ls - 0.6 + DIVE_END - vEnter * RIDE) / (RIDE * RIDE)
      }
      if (plunge < T.dive) {
        const a = easeInOut(plunge / (T.dive * 0.8))
        cx += (MARK.circle.x - cx) * a
        cy += (MARK.circle.y - cy) * a
        dist = plungeFrom * Math.exp(-kd * Math.pow(plunge / T.dive, PLUNGE_POW))
        camera.position.set(cx, cy, dist)
        camera.up.set(0, 1, 0)
        camera.rotation.set(0, 0, 0)
      } else {
        ride = Math.min(plunge - T.dive, RIDE)
        const s = Math.min(-DIVE_END + vEnter * ride + cRide * ride * ride, Ls - 0.6)
        rideS = s
        pathPos(s, P).applyMatrix4(group.matrixWorld)
        pathPos(Math.min(s + 7, Ls + 7), Q).applyMatrix4(group.matrixWorld)
        camera.position.copy(P)
        fwd.subVectors(Q, P).normalize()
        // a slow roll as the ride gathers speed: the tunnel seems to twist around the traveller
        qRoll.setFromAxisAngle(fwd, 0.85 * Math.pow(ride / RIDE, 2))
        camera.up.set(0, 1, 0).applyQuaternion(qRoll)
        camera.lookAt(Q)
        if (dt > 0 && ride > 0) speed = Math.max(0, (s - prevS) / dt)
        prevS = s
        fov = FOV + 24 * smooth(0, 1.1, ride)
      }
      if (plunge < T.dive) {
        speed = 0
        prevS = -dist
      }
    } else {
      camera.position.set(cx, cy, dist)
    }
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    common.uScale.value = focal(fov)
    camera.updateMatrixWorld()

    // distance from the camera to the mouth plane (0 once inside)
    const mouthW = vC.copy(mouth).applyMatrix4(group.matrixWorld)
    const dMouth = ride >= 0 ? 0 : Math.max(0, camera.position.z - mouthW.z)
    inside = ride >= 0 ? 1 : smooth(0.6, 0.05, dMouth)

    // ── wormhole motion: the disc spins up during the dive ──
    const spin = 1 + (plunge >= 0 ? 2.5 * smooth(0, T.dive, plunge) : 0)
    flow += dt * spin
    discMat.uniforms.uFlow.value = flow
    swirlMat.uniforms.uFlow.value = flow
    tubeFlow += dt * (0.5 + speed * 0.012)
    tubeMat.uniforms.uFlow.value = tubeFlow
    tubeMat.uniforms.uStretch.value = Math.min(1, speed / 160)
    tubeMat.uniforms.uOn.value = tunnelOn * (ride >= 0 ? 1.15 : 1)
    tubeMat.uniforms.uNear.value = dMouth + (ride >= 0 ? 4 : 6)
    tubeMat.uniforms.uFar.value = dMouth + (ride >= 0 ? 62 : 48)
    tubeGlow.visible = tunnelOn > 0 && ride < 0
    tubeSolid.visible = ride >= 0
    tubeSolidMat.uniforms.uWall.value = ride >= 0 ? 0.03 * smooth(0, 0.35, ride) : 0 // the walls catch light as the ride begins
    exit.visible = ride >= 0
    warp.visible = ride >= 0
    warpMat.uniforms.uWarp.value = ride >= 0 ? smooth(0, 0.35, ride) : 0
    warpMat.uniforms.uStretch.value = Math.min(speed * 0.04, 12)
    // the disc and the rim fall behind once the ride starts
    if (ride > 0.25) {
      disc.visible = false
      swirl.visible = false
      rim.visible = false
    }

    // ── lens: centred on the throat, sized by its horizon ──
    vC.set(MARK.circle.x, MARK.circle.y, 0).applyMatrix4(group.matrixWorld)
    const behind = vC.clone().applyMatrix4(camera.matrixWorldInverse).z > -0.01
    if (!behind && ride < 0) {
      vC.project(camera)
      vE.set(MARK.circle.x + MARK.inner, MARK.circle.y, 0).applyMatrix4(group.matrixWorld).project(camera)
      const c = proj(vC)
      const e = proj(vE)
      LU.uC.value.set(c.x / w, 1 - c.y / h)
      LU.uRs.value = Math.hypot(e.x - c.x, e.y - c.y) / h
    }
    LU.uOn.value = smooth(A * 0.9, A * 1.45, t)
    LU.uSky.value = 1
    LU.uInside.value = inside

    // adaptive quality: drop bloom and resolution if the first second runs slow
    if (bloom.enabled && t > 0.25 && sampled < 40) {
      sampled++
      if (dt > 0.034) slowFrames++
      if (sampled === 40 && slowFrames > 24) {
        bloom.enabled = false
        composer.setPixelRatio(1)
        common.uPR.value = 1
        LU.uPR.value = 1
        LU.uResY.value = h
      }
    }
    // bloom: calmer while the disc fills the view, fuller as the light at the exit opens
    bloom.strength = 0.7 - 0.55 * (plunge >= 0 ? smooth(T.dive * 0.3, T.dive * 0.85, plunge) : 0) + 0.45 * (rideS > 0 ? smooth(Ls - 70, Ls - 30, rideS) : 0)
    composer.render(dt)
    if (!checked) checkPrograms()

    // ── iris: the site shows through the light at the end of the tunnel ──
    if (ride < 0) return null
    vE.copy(endP).applyMatrix4(group.matrixWorld)
    const depth = vE.clone().applyMatrix4(camera.matrixWorldInverse).z
    if (depth > -0.01) return { x: w / 2, y: h / 2, r: Math.hypot(w, h) }
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    const edge = vE.clone().addScaledVector(right, EXIT_R).project(camera)
    vE.project(camera)
    const c = proj(vE)
    const e = proj(edge)
    const rExit = Math.hypot(e.x - c.x, e.y - c.y)
    // only once the exit is in plain sight down the final straight; the site opens inside the light
    const r = (rExit * 0.84 - 36) * smooth(Ls - 58, Ls - 44, rideS)
    if (r <= 0) return null
    return { x: c.x, y: c.y, r }
  }

  return {
    kind: 'webgl',
    resize,
    frame,
    dispose() {
      disposables.forEach((d) => d.dispose())
      lens.dispose()
      bloom.dispose()
      output.dispose()
      composer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
