/* The home journey, WebGL scene (loaded with import(), so three stays out of the main bundle).
   One continuous camera move, scrubbed by scroll: the singularity and the Big Bang → the cosmic web → into our galaxy
   → the Sun (a full turn around it, skimming the corona) → Earth and the Moon → the ISS → Voyager → the COGNIA mark,
   whose circle is a wormhole → through it. Everything keeps moving when the scroll stops; the pointer steers the
   camera, parts the particles and turns the mark.
   Models: NASA 3D Resources (ISS, Voyager). Earth and Moon maps: the three.js examples (from NASA imagery). */
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MARK, rng } from '@/components/intro/timeline'
import { CH, chapterAt, span, type JourneyFrame, type JourneyObjects } from './story'
import { createRig } from './camera'
import { CW, NM, DIR0, E, G, ISS, MARK_FROM, MARK_POS, MARK_SCALE, OUT, R_EARTH, R_SUN, SIDE, SUN, T_ISS, UP, VD, VOY, W, simT, updateWorld } from './world'
import { PLANETS, orbitPath, planetAt, type Planet } from './orbits'
import * as S from './shaders'
import { disposeTree, loadSpacecraft, setupLoader } from './models'

const V3 = THREE.Vector3
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export type JourneyEngine = {
  setActive(on: boolean): void
  resize(w: number, h: number): void
  dispose(): void
}

type Opts = {
  /** raw scroll progress of the journey section, 0..1 */
  getTarget: () => number
  onFrame: (f: JourneyFrame) => void
}

const BASE = import.meta.env.BASE_URL

export async function createJourney(host: HTMLElement, opts: Opts): Promise<JourneyEngine> {
  const w0 = Math.max(1, host.clientWidth)
  const h0 = Math.max(1, host.clientHeight)
  const small = w0 < 700
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' })
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2 required')
  renderer.debug.checkShaderErrors = false
  let pr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75)
  renderer.setPixelRatio(pr)
  renderer.setSize(w0, h0, false)
  renderer.setClearColor(0x000000, 1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  host.appendChild(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, w0 / h0, 0.02, 600000)
  const rnd = rng(23)
  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(d: T) => (disposables.push(d), d)

  // shared uniforms for every particle system
  const common = {
    uT: { value: 0 },
    uPR: { value: pr },
    uScale: { value: 1 },
    uMouse: { value: new THREE.Vector2(9, 9) },
    uAspect: { value: w0 / h0 },
    uRepel: { value: 1 },
  }
  const pointsMat = (vert: string, extra: Record<string, THREE.IUniform>) =>
    track(
      new THREE.ShaderMaterial({
        uniforms: { ...common, uOn: { value: 1 }, ...extra },
        vertexShader: vert,
        fragmentShader: S.POINT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )

  // ── studio fill for the metal and the spacecraft (rendered once, under the boot screen) ──
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const envRT = track(pmrem.fromScene(room, 0.04))
  room.dispose()
  pmrem.dispose()
  scene.environment = envRT.texture
  scene.environmentIntensity = 0.1

  // ── light: the Sun lights everything that is not self-lit ──
  const sunLight = new THREE.PointLight(0xffffff, 2, 0, 0)
  scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0xffffff, 0.03))

  /* ── far stars (they ride with the camera: always at infinity) ── */
  const starN = small ? 5000 : 9000
  const starGeo = track(new THREE.BufferGeometry())
  {
    const pos = new Float32Array(starN * 3)
    const size = new Float32Array(starN)
    const seed = new Float32Array(starN)
    for (let i = 0; i < starN; i++) {
      const u = rnd() * 2 - 1
      const a = rnd() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      // denser towards a band (the Milky Way as seen from inside it)
      const band = rnd() < 0.45 ? 0.22 : 1
      const r = 200000
      pos.set([Math.cos(a) * s * r, u * band * r, Math.sin(a) * s * r], i * 3)
      const k = Math.pow(rnd(), 3)
      size[i] = 0.7 + k * 2.6
      seed[i] = rnd()
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    starGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  }
  const starMat = pointsMat(S.STARS_VERT, {})
  const stars = new THREE.Points(starGeo, starMat)
  stars.frustumCulled = false
  scene.add(stars)

  /* ── the universe: singularity → burst → cosmic web ── */
  const cosN = small ? 26000 : 60000
  const cosGeo = track(new THREE.BufferGeometry())
  {
    const centers: THREE.Vector3[] = [new V3(0, 0, 0)]
    while (centers.length < 170) {
      const v = new V3(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.7, rnd() * 2 - 1).multiplyScalar(W)
      if (v.length() > W || v.length() < 8000) continue
      centers.push(v)
    }
    const near = centers.map((c, i) =>
      centers
        .map((d, j) => ({ j, d: c.distanceTo(d) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map((x) => x.j),
    )
    const dir = new Float32Array(cosN * 3)
    const web = new Float32Array(cosN * 3)
    const seed = new Float32Array(cosN)
    const clump = new Float32Array(cosN)
    const g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5
    const tmp = new V3()
    for (let i = 0; i < cosN; i++) {
      const u = rnd() * 2 - 1
      const a = rnd() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      dir.set([Math.cos(a) * s, u, Math.sin(a) * s], i * 3)
      seed[i] = rnd()
      const k = rnd()
      if (k < 0.12) {
        // our own galaxy, flattened (the detailed galaxy takes over from it)
        const r = 2600 * Math.sqrt(rnd())
        const b = rnd() * Math.PI * 2
        tmp.set(Math.cos(b) * r, g() * 160, Math.sin(b) * r)
        clump[i] = 0.9
      } else if (k < 0.55) {
        const c = centers[1 + Math.floor(rnd() * (centers.length - 1))]
        const r = 700 * Math.pow(rnd(), 1.5)
        tmp.set(g(), g(), g()).normalize().multiplyScalar(r).add(c)
        clump[i] = 0.75 + rnd() * 0.25
      } else if (k < 0.9) {
        const ci = Math.floor(rnd() * centers.length)
        const c = centers[ci]
        const d = centers[near[ci][Math.floor(rnd() * 3)]]
        tmp.lerpVectors(c, d, rnd()).add(new V3(g(), g(), g()).multiplyScalar(320))
        clump[i] = 0.35 + rnd() * 0.2
      } else {
        tmp.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).multiplyScalar(W)
        clump[i] = 0.08
      }
      web.set([tmp.x, tmp.y, tmp.z], i * 3)
    }
    cosGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cosN * 3), 3))
    cosGeo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
    cosGeo.setAttribute('aWeb', new THREE.BufferAttribute(web, 3))
    cosGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    cosGeo.setAttribute('aClump', new THREE.BufferAttribute(clump, 1))
  }
  const cosMat = pointsMat(S.COSMOS_VERT, { uE: { value: 0 }, uR: { value: W * 0.9 } })
  const cosmos = new THREE.Points(cosGeo, cosMat)
  cosmos.frustumCulled = false
  cosmos.position.copy(G)
  scene.add(cosmos)

  // the singularity's glow, the flash and the shock ring
  const glowMat = track(
    new THREE.ShaderMaterial({
      uniforms: { uCore: { value: 1 }, uHalo: { value: 0.6 }, uRing: { value: 0 }, uRingR: { value: 0 }, uT: common.uT },
      vertexShader: S.GLOW_VERT,
      fragmentShader: S.GLOW_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  const glow = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1)), glowMat)
  glow.position.copy(G)
  glow.renderOrder = 5
  scene.add(glow)

  /* ── our galaxy ── */
  const galN = small ? 50000 : 120000
  const galGeo = track(new THREE.BufferGeometry())
  {
    const sunLocal = SUN.clone().sub(G)
    const rSun = Math.hypot(sunLocal.x, sunLocal.z)
    const aSun = Math.atan2(sunLocal.z, sunLocal.x)
    const B = 0.32 // spiral pitch
    const a0 = 260
    const off = aSun - Math.log(rSun / a0) / B // arm 0 passes through the Sun
    const R = new Float32Array(galN)
    const A = new Float32Array(galN)
    const Y = new Float32Array(galN)
    const Sd = new Float32Array(galN)
    const Br = new Float32Array(galN)
    const g = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2
    for (let i = 0; i < galN; i++) {
      const k = rnd()
      let r: number
      let a: number
      let y: number
      if (k < 0.24) {
        // bulge and bar
        r = Math.abs(g()) * 900
        a = rnd() * Math.PI * 2
        const bar = rnd() < 0.5
        if (bar) {
          const x = g() * 1300
          const z = g() * 260
          r = Math.hypot(x, z)
          a = Math.atan2(z, x) + 0.4
        }
        y = g() * 260 * (1 - r / 1800)
      } else if (k < 0.86) {
        const arm = Math.floor(rnd() * 4)
        const major = arm < 2
        r = a0 * Math.exp(rnd() * Math.log(5200 / a0))
        r = Math.max(r, 500)
        a = Math.log(r / a0) / B + off + arm * (Math.PI / 2) + (major ? 0 : 0.25)
        a += g() * (major ? 0.22 : 0.32)
        r += g() * r * 0.06
        y = g() * 70
      } else {
        r = 500 + Math.sqrt(rnd()) * 5000
        a = rnd() * Math.PI * 2
        y = g() * 140
      }
      R[i] = r
      A[i] = a
      Y[i] = y
      Sd[i] = rnd()
      Br[i] = Math.pow(rnd(), 2.6) * (k < 0.24 ? 1.2 : 1)
    }
    galGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(galN * 3), 3))
    galGeo.setAttribute('aR', new THREE.BufferAttribute(R, 1))
    galGeo.setAttribute('aA', new THREE.BufferAttribute(A, 1))
    galGeo.setAttribute('aY', new THREE.BufferAttribute(Y, 1))
    galGeo.setAttribute('aSeed', new THREE.BufferAttribute(Sd, 1))
    galGeo.setAttribute('aB', new THREE.BufferAttribute(Br, 1))
  }
  const galMat = pointsMat(S.GALAXY_VERT, {})
  const galaxy = new THREE.Points(galGeo, galMat)
  galaxy.frustumCulled = false
  galaxy.position.copy(G)
  scene.add(galaxy)

  /* ── the Sun ── */
  const sunMat = track(new THREE.ShaderMaterial({ uniforms: { uT: common.uT, uBright: { value: 2.4 } }, vertexShader: S.SUN_VERT, fragmentShader: S.SUN_FRAG }))
  const sun = new THREE.Mesh(track(new THREE.SphereGeometry(R_SUN, 160, 120)), sunMat)
  scene.add(sun)
  const coronaMat = track(
    new THREE.ShaderMaterial({
      uniforms: { uT: common.uT, uI: { value: 1.6 }, uSpan: { value: 9 }, uMouseA: { value: 0 }, uLean: { value: 0 } },
      vertexShader: S.GLOW_VERT,
      fragmentShader: S.CORONA_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  const corona = new THREE.Mesh(track(new THREE.PlaneGeometry(R_SUN * 18, R_SUN * 18)), coronaMat)
  scene.add(corona)
  // prominences: plasma loops standing on the surface
  const proms: THREE.ShaderMaterial[] = []
  for (let i = 0; i < 60; i++) {
    const a = new V3(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.6, rnd() * 2 - 1).normalize()
    const axis = new V3().crossVectors(a, new V3(rnd(), rnd(), rnd()).normalize()).normalize()
    const b = a.clone().applyAxisAngle(axis, 0.25 + rnd() * 0.45)
    const hgt = 2 + rnd() * 6.5
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 12; k++) {
      const t = k / 12
      const d = a.clone().lerp(b, t).normalize()
      pts.push(d.multiplyScalar(R_SUN * 0.985 + Math.sin(Math.PI * t) * hgt))
    }
    const geo = track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.06 + rnd() * 0.12, 6))
    const mat = track(
      new THREE.ShaderMaterial({
        uniforms: { uT: common.uT, uI: { value: 2.2 }, uSeed: { value: rnd() * 50 } },
        vertexShader: S.PROM_VERT,
        fragmentShader: S.PROM_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    proms.push(mat)
    scene.add(new THREE.Mesh(geo, mat))
  }
  // solar wind
  const windN = small ? 3500 : 7000
  const windGeo = track(new THREE.BufferGeometry())
  {
    const dir = new Float32Array(windN * 3)
    const seed = new Float32Array(windN)
    for (let i = 0; i < windN; i++) {
      const u = rnd() * 2 - 1
      const a = rnd() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      dir.set([Math.cos(a) * s, u, Math.sin(a) * s], i * 3)
      seed[i] = rnd()
    }
    windGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(windN * 3), 3))
    windGeo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
    windGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  }
  const windMat = pointsMat(S.WIND_VERT, { uR0: { value: R_SUN * 1.05 }, uLen: { value: 90 } })
  const wind = new THREE.Points(windGeo, windMat)
  wind.frustumCulled = false
  scene.add(wind)

  /* ── Earth and the Moon ── */
  const tl = new THREE.TextureLoader()
  const tex = (f: string, srgb = false) => {
    const t = tl.load(BASE + 'journey/' + f)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return track(t)
  }
  const sunU = { value: SUN.clone() }
  const cloudOff = { value: 0 }
  // 4K maps: day, night, and one map holding bump (r), roughness (g) and clouds (b)
  const clouds = tex('earth_bump_roughness_clouds_4096.jpg')
  clouds.wrapS = THREE.RepeatWrapping
  const earthMat = track(
    new THREE.ShaderMaterial({
      uniforms: {
        uDay: { value: tex('earth_day_4096.jpg', true) },
        uNight: { value: tex('earth_night_4096.jpg', true) },
        uSpec: { value: clouds },
        uNormal: { value: tex('earth_normal_2048.jpg') },
        uClouds: { value: clouds },
        uSun: sunU,
        uCloudOff: cloudOff,
      },
      vertexShader: S.EARTH_VERT,
      fragmentShader: S.EARTH_FRAG,
    }),
  )
  const earthSys = new THREE.Group()
  earthSys.position.copy(E)
  earthSys.rotation.z = 0.41 // axial tilt
  scene.add(earthSys)
  const earthGeo = track(new THREE.SphereGeometry(R_EARTH, 192, 128))
  const earth = new THREE.Mesh(earthGeo, earthMat)
  earthSys.add(earth)
  const cloudMat = track(
    new THREE.ShaderMaterial({
      uniforms: { uClouds: { value: clouds }, uSun: sunU, uCloudOff: cloudOff },
      vertexShader: S.EARTH_VERT,
      fragmentShader: S.CLOUD_FRAG,
      transparent: true,
      depthWrite: false,
    }),
  )
  const cloudMesh = new THREE.Mesh(earthGeo, cloudMat)
  cloudMesh.scale.setScalar(1.009)
  earth.add(cloudMesh)
  const atmoMat = track(
    new THREE.ShaderMaterial({
      uniforms: { uSun: sunU, uI: { value: 0.8 } },
      vertexShader: S.ATMO_VERT,
      fragmentShader: S.ATMO_FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  const atmo = new THREE.Mesh(track(new THREE.SphereGeometry(R_EARTH * 1.16, 96, 64)), atmoMat)
  scene.add(atmo)
  atmo.position.copy(E)
  const moon = new THREE.Mesh(
    track(new THREE.SphereGeometry(R_EARTH * 0.27, 96, 64)),
    track(new THREE.MeshStandardMaterial({ map: tex('moon_1024.jpg', true), roughness: 1, metalness: 0, envMapIntensity: 0 })),
  )
  scene.add(moon)
  const moonAt = (t: number, out: THREE.Vector3) =>
    out.copy(E).addScaledVector(OUT, -6).add(new V3(Math.cos(t * 0.02 + 2.2) * 19, 3.5, Math.sin(t * 0.02 + 2.2) * 19))

  /* ── the other planets, their moons, Saturn's rings, and Earth's Van Allen belts ── */
  const col = (h: number) => new THREE.Color(h)
  const planetMat = (type: number, c1: number, c2: number, seed: number) =>
    track(new THREE.ShaderMaterial({ uniforms: { uSun: sunU, uC1: { value: col(c1) }, uC2: { value: col(c2) }, uType: { value: type }, uSeed: { value: seed }, uT: common.uT, uR: { value: 1 } }, vertexShader: S.PLANET_VERT, fragmentShader: S.PLANET_FRAG }))
  const spinners: THREE.Mesh[] = []
  const planet = (pos: THREE.Vector3, r: number, mat: THREE.ShaderMaterial, seg = 96) => {
    const m = new THREE.Mesh(track(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.66))), mat)
    m.position.copy(pos)
    scene.add(m)
    spinners.push(m)
    return m
  }
  // real positions today, moving along their real orbits (orbits.ts); distances compressed
  const T0 = simT(0)
  const P3: Partial<Record<Planet, THREE.Vector3>> = {}
  for (const name of PLANETS) P3[name] = planetAt(name, T0, new V3())
  const bodies: { name: Planet; m: THREE.Mesh }[] = []
  const body = (name: Planet, r: number, mat: THREE.ShaderMaterial, seg = 96) => bodies.push({ name, m: planet(P3[name]!, r, mat, seg) })
  body('mercury', 1.4, planetMat(0, 0x8a8178, 0x5a534d, 3))
  body('venus', 3.2, planetMat(2, 0xe8d6a8, 0xc9a96b, 7))
  body('mars', 2.6, planetMat(0, 0xc1643a, 0x7a3a22, 11))
  body('jupiter', 14, planetMat(1, 0xd8c2a0, 0x9a6b45, 5), 128)
  body('saturn', 12, planetMat(1, 0xe6d3a3, 0xb89a62, 9), 128)
  body('uranus', 6, planetMat(2, 0x9fd8de, 0x7cc0ca, 13))
  body('neptune', 6, planetMat(2, 0x4a6fd8, 0x2f4fb0, 17))
  // faint orbit lines
  const orbitMat = track(new THREE.LineBasicMaterial({ color: 0x9aa4b4, transparent: true, opacity: 0.16, depthWrite: false }))
  for (const name of PLANETS) scene.add(new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(orbitPath(name, T0))), orbitMat))
  const SATURN = P3.saturn!, JUPITER = P3.jupiter!
  const ringMat = track(new THREE.ShaderMaterial({ uniforms: { uSun: sunU, uIn: { value: 15 }, uOut: { value: 29 } }, vertexShader: S.PLANET_VERT, fragmentShader: S.RING_FRAG, transparent: true, side: THREE.DoubleSide, depthWrite: false }))
  const rings = new THREE.Mesh(track(new THREE.RingGeometry(15, 29, 256, 1)), ringMat)
  rings.position.copy(SATURN)
  rings.rotation.set(-Math.PI / 2 + 0.47, 0, 0.2)
  scene.add(rings)
  const moons: { m: THREE.Mesh; c: THREE.Vector3; d: number; s: number; a: number }[] = []
  const moonOf = (c: THREE.Vector3, r: number, d: number, s: number, c1: number, c2: number) => {
    const m = planet(c, r, planetMat(0, c1, c2, d), 48)
    moons.push({ m, c, d, s, a: d })
  }
  moonOf(JUPITER, 0.9, 21, 0.05, 0xe8d36a, 0xa8742e) // Io
  moonOf(JUPITER, 0.8, 26, 0.035, 0xd9cdb8, 0x9a8a72) // Europa
  moonOf(JUPITER, 1.3, 32, 0.025, 0x9a8f80, 0x5d554c) // Ganymede
  moonOf(JUPITER, 1.2, 39, 0.018, 0x6d655c, 0x3f3a35) // Callisto
  moonOf(SATURN, 1.2, 36, 0.02, 0xd9a85a, 0x9a6a2e) // Titan
  // Van Allen belts: inner and outer, around the magnetic axis
  const beltN = small ? 7000 : 14000
  const beltGeo = track(new THREE.BufferGeometry())
  {
    const R = new Float32Array(beltN), A = new Float32Array(beltN), Bt = new Float32Array(beltN), Sd = new Float32Array(beltN)
    for (let i = 0; i < beltN; i++) {
      const outer = rnd() < 0.6
      R[i] = R_EARTH * (outer ? 3.2 + rnd() * 1.6 : 1.55 + rnd() * 0.35)
      A[i] = rnd() * Math.PI * 2
      Bt[i] = rnd() * Math.PI * 2
      Sd[i] = rnd()
    }
    beltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(beltN * 3), 3))
    beltGeo.setAttribute('aR', new THREE.BufferAttribute(R, 1))
    beltGeo.setAttribute('aA', new THREE.BufferAttribute(A, 1))
    beltGeo.setAttribute('aB', new THREE.BufferAttribute(Bt, 1))
    beltGeo.setAttribute('aSeed', new THREE.BufferAttribute(Sd, 1))
  }
  const beltMat = track(new THREE.ShaderMaterial({ uniforms: { ...common, uOn: { value: 0 } }, vertexShader: S.BELT_VERT, fragmentShader: S.BELT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  const belts = new THREE.Points(beltGeo, beltMat)
  belts.frustumCulled = false
  belts.position.copy(E)
  belts.rotation.z = 0.41 + 0.19 // magnetic axis, tilted from the spin axis
  scene.add(belts)

  /* ── spacecraft (NASA models, loaded in the background) ── */
  const draco = new DRACOLoader()
  draco.setDecoderPath(BASE + 'draco/')
  const gltf = new GLTFLoader()
  gltf.setDRACOLoader(draco)
  const issPivot = new THREE.Group()
  issPivot.position.copy(ISS)
  scene.add(issPivot)
  const voyPivot = new THREE.Group()
  voyPivot.position.copy(VOY)
  scene.add(voyPivot)
  let disposed = false
  // each tier replaces the previous one (models.ts): a light preview first, the detailed model when it arrives
  const mount = (pivot: THREE.Group) => (holder: THREE.Group) => {
    if (disposed) return disposeTree(holder)
    holder.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      mats.forEach((mt) => {
        const s = mt as THREE.MeshStandardMaterial
        if (s.isMeshStandardMaterial) s.envMapIntensity = 0.45
      })
    })
    const prev = pivot.children.slice()
    pivot.add(holder)
    prev.forEach((c) => {
      pivot.remove(c)
      disposeTree(c)
    })
    models.push(holder)
  }
  const models: THREE.Group[] = []
  setupLoader(gltf)
  const cancelIss = loadSpacecraft(gltf, 'iss', 0.62, mount(issPivot))
  const cancelVoy = loadSpacecraft(gltf, 'voyager', 0.9, mount(voyPivot))
  issPivot.lookAt(ISS.clone().add(T_ISS))
  issPivot.rotateZ(0.2)
  voyPivot.lookAt(VOY.clone().addScaledVector(VD, -1)) // its dish faces home

  /* ── the COGNIA mark, its circle a wormhole ── */
  const mark = new THREE.Group()
  mark.position.copy(MARK_POS)
  mark.lookAt(MARK_FROM)
  mark.scale.setScalar(MARK_SCALE)
  scene.add(mark)
  const markBase = mark.quaternion.clone()
  const metal = track(new THREE.MeshStandardMaterial({ color: 0x7a7a7a, metalness: 0.95, roughness: 0.3, envMapIntensity: 0.75 }))
  {
    const shape = new THREE.Shape(MARK.outline.map(([x, y]) => new THREE.Vector2(x - MARK.circle.x, y - MARK.circle.y)))
    const geo = track(new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.28, bevelSegments: 5, curveSegments: 1 }))
    geo.translate(0, 0, -1.1)
    mark.add(new THREE.Mesh(geo, metal))
  }
  // the round: a solid metal ring around the throat
  mark.add(new THREE.Mesh(track(new THREE.TorusGeometry(MARK.circle.r, MARK.half, 48, 160)), metal))
  const horizon = new THREE.Mesh(track(new THREE.CircleGeometry(MARK.inner * 0.995, 128)), track(new THREE.MeshBasicMaterial({ color: 0x000000 })))
  mark.add(horizon)
  const rimMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(3.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
  const rimRing = new THREE.Mesh(track(new THREE.TorusGeometry(MARK.inner + 0.02, 0.045, 8, 160)), rimMat)
  mark.add(rimRing)
  const swirlN = small ? 6000 : 12000
  const swirlGeo = track(new THREE.BufferGeometry())
  {
    const r0 = new Float32Array(swirlN)
    const a0 = new Float32Array(swirlN)
    const sd = new Float32Array(swirlN)
    for (let i = 0; i < swirlN; i++) {
      r0[i] = MARK.inner + Math.pow(rnd(), 0.8) * 7.5
      a0[i] = rnd() * Math.PI * 2
      sd[i] = rnd()
    }
    swirlGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(swirlN * 3), 3))
    swirlGeo.setAttribute('aR0', new THREE.BufferAttribute(r0, 1))
    swirlGeo.setAttribute('aA0', new THREE.BufferAttribute(a0, 1))
    swirlGeo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1))
  }
  const swirlMat = pointsMat(S.SWIRL_VERT, { uIn: { value: MARK.inner }, uOut: { value: 10 }, uSpin: { value: 0 } })
  const swirl = new THREE.Points(swirlGeo, swirlMat)
  swirl.frustumCulled = false
  swirl.position.z = 0.05
  mark.add(swirl)
  // light streaks beyond the throat
  const warpN = small ? 900 : 1800
  const warpGeo = track(new THREE.BufferGeometry())
  {
    const pos = new Float32Array(warpN * 2 * 3)
    const end = new Float32Array(warpN * 2)
    const seed = new Float32Array(warpN * 2)
    const xy = new Float32Array(warpN * 4)
    for (let i = 0; i < warpN; i++) {
      const a = rnd() * Math.PI * 2
      const r = 0.6 + Math.pow(rnd(), 0.6) * 5.5
      const s = rnd()
      for (let k = 0; k < 2; k++) {
        end[i * 2 + k] = k
        seed[i * 2 + k] = s
        xy.set([Math.cos(a) * r, Math.sin(a) * r], (i * 2 + k) * 2)
      }
    }
    warpGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    warpGeo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
    warpGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    warpGeo.setAttribute('aXY', new THREE.BufferAttribute(xy, 2))
  }
  const warpMat = track(
    new THREE.ShaderMaterial({
      uniforms: { uFlow: { value: 0 }, uLen: { value: 420 }, uStretch: { value: 2 }, uOn: { value: 0 } },
      vertexShader: S.WARP_VERT,
      fragmentShader: S.WARP_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  const warp = new THREE.LineSegments(warpGeo, warpMat)
  warp.frustumCulled = false
  mark.add(warp)
  // a rim light from behind the mark, so its edges read against the dark
  const markRim = new THREE.DirectionalLight(0xffffff, 1.5)
  markRim.position.copy(MARK_POS).addScaledVector(OUT, 40).addScaledVector(UP, 30).addScaledVector(SIDE, -20)
  markRim.target = mark
  scene.add(markRim)
  mark.updateMatrixWorld(true)
  const CW = new V3(0, 0, 0).applyMatrix4(mark.matrixWorld) // the throat's centre (world)
  const NM = new V3(0, 0, 1).applyQuaternion(mark.quaternion).normalize() // the mark's facing

  /* ── beyond the throat: a colossal COGNIA mark assembling out of light ── */
  const FORM_AT = CW.clone().addScaledVector(NM, -150) // behind the mark, where the dive leads
  const formN = small ? 26000 : 52000
  const formGeo = track(new THREE.BufferGeometry())
  {
    const S3 = 3.2 // mark units → this many world units
    const start = new Float32Array(formN * 3), end = new Float32Array(formN * 3), seed = new Float32Array(formN)
    const bars = MARK.bars
    const lens = bars.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]))
    const ring = 2 * Math.PI * MARK.circle.r
    const total = lens.reduce((x, y) => x + y, 0) + ring
    const g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5
    for (let i = 0; i < formN; i++) {
      let x: number, y: number
      let u = rnd() * total
      const w = MARK.stroke * (0.5 + 0.5 * rnd())
      if (u < total - ring) {
        let j = 0
        while (u > lens[j]) u -= lens[j++]
        const [a, b] = bars[j]
        const t = u / lens[j]
        const nx = -(b[1] - a[1]) / lens[j], ny = (b[0] - a[0]) / lens[j]
        const off = (rnd() - 0.5) * w
        x = a[0] + (b[0] - a[0]) * t + nx * off
        y = a[1] + (b[1] - a[1]) * t + ny * off
      } else {
        const ang = rnd() * Math.PI * 2, rr = MARK.circle.r + (rnd() - 0.5) * w
        x = MARK.circle.x + Math.cos(ang) * rr
        y = MARK.circle.y + Math.sin(ang) * rr
      }
      // centred on the circle like the mark itself; a faint halo of strays around it
      const stray = rnd() < 0.12
      end.set([(x - MARK.circle.x) * S3 + (stray ? g() * 30 : 0), (y - MARK.circle.y) * S3 + (stray ? g() * 30 : 0), g() * (stray ? 20 : 1.5)], i * 3)
      const d = 160 + rnd() * 340, th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 2 - 1)
      start.set([Math.sin(ph) * Math.cos(th) * d, Math.sin(ph) * Math.sin(th) * d, Math.cos(ph) * d * 0.6], i * 3)
      seed[i] = rnd()
    }
    formGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(formN * 3), 3))
    formGeo.setAttribute('aStart', new THREE.BufferAttribute(start, 3))
    formGeo.setAttribute('aEnd', new THREE.BufferAttribute(end, 3))
    formGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  }
  const formMat = track(new THREE.ShaderMaterial({ uniforms: { ...common, uOn: { value: 0 }, uForm: { value: 0 } }, vertexShader: S.FORM_VERT, fragmentShader: S.FORM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  const form = new THREE.Points(formGeo, formMat)
  form.frustumCulled = false
  form.position.copy(FORM_AT)
  form.lookAt(CW) // face the camera coming through
  scene.add(form)
  // its heart: a blazing core in the circle
  const coreMat = track(new THREE.ShaderMaterial({ uniforms: { uCore: { value: 0 }, uHalo: { value: 0 }, uRing: { value: 0 }, uRingR: { value: 0.3 }, uT: common.uT }, vertexShader: S.GLOW_VERT, fragmentShader: S.GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  const core = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1)), coreMat)
  core.position.copy(FORM_AT)
  core.scale.setScalar(32)
  scene.add(core)

  /* ── post ── */
  const rt = new THREE.WebGLRenderTarget(w0 * pr, h0 * pr, { type: THREE.HalfFloatType, samples: small ? 0 : 4 })
  const composer = new EffectComposer(renderer, rt)
  composer.setPixelRatio(pr)
  composer.setSize(w0, h0)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(w0, h0), 0.6, 0.5, 0.9)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const grade = new ShaderPass(S.GRADE)
  composer.addPass(grade)

  /* ── the camera (camera.ts) ── */
  const rig = createRig(camera)

  /* ── layout ── */
  let w = w0
  let h = h0
  const focal = () => h / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  function resize(nw: number, nh: number) {
    w = Math.max(1, nw)
    h = Math.max(1, nh)
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    common.uAspect.value = w / h
  }

  /* ── pointer ── */
  let mxT = 0
  let myT = 0
  let mx = 0
  let my = 0
  let seen = false
  const onPointer = (e: PointerEvent) => {
    const r = host.getBoundingClientRect()
    mxT = ((e.clientX - r.left) / r.width) * 2 - 1
    myT = 1 - ((e.clientY - r.top) / r.height) * 2
    seen = true
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  /* ── the loop ── */
  let active = true
  let raf = 0
  let last = performance.now()
  let t = 0
  let p = clamp01(opts.getTarget())
  let v = 0
  let warpFlow = 0
  let swirlSpin = 0
  let slow = 0
  let sampled = 0
  const tmp = new V3()
  const mPos = new V3()
  const qTmp = new THREE.Quaternion()
  const objs: JourneyObjects = {
    singularity: { x: 0, y: 0, z: 0, d: 0, on: 0 },
    sun: { x: 0, y: 0, z: 0, d: 0, on: 0 },
    earth: { x: 0, y: 0, z: 0, d: 0, on: 0 },
    iss: { x: 0, y: 0, z: 0, d: 0, on: 0 },
    voyager: { x: 0, y: 0, z: 0, d: 0, on: 0 },
    wormhole: { x: 0, y: 0, z: 0, d: 0, on: 0 },
  }
  const place = (o: keyof JourneyObjects, wp: THREE.Vector3, on: number) => {
    const e = objs[o]
    tmp.copy(wp).applyMatrix4(camera.matrixWorldInverse)
    e.x = tmp.x
    e.y = tmp.y
    e.z = tmp.z
    e.d = tmp.length()
    e.on = on
  }

  function frame(now: number) {
    raf = active ? requestAnimationFrame(frame) : 0
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    if (document.hidden) return
    t += dt
    common.uT.value = t

    // heavy scrub: the story follows the scroll with weight
    const target = clamp01(opts.getTarget())
    const prev = p
    p += (target - p) * (1 - Math.exp(-dt * 1.7))
    if (Math.abs(target - p) < 1e-5) p = target
    v += ((dt > 0 ? (p - prev) / dt : 0) - v) * (1 - Math.exp(-dt * 6))
    const k = 1 - Math.exp(-dt * 2.2)
    mx += (mxT - mx) * k
    my += (myT - my) * k
    common.uMouse.value.set(seen ? mx : 9, seen ? my : 9)

    // ── the Solar System moves (time-lapse), then the camera follows it ──
    const T = simT(t)
    updateWorld(T)
    for (const b of bodies) planetAt(b.name, T, b.m.position)
    earthSys.position.copy(E)
    atmo.position.copy(E)
    belts.position.copy(E)
    rings.position.copy(SATURN)

    // ── camera ──
    const { sunNear, flash, speed: camSpeed } = rig.update({ p, t, dt, mx, my, aspect: w / h })
    common.uScale.value = focal()
    stars.position.copy(camera.position)

    // ── the universe ──
    const e = p < CH.bang ? 0 : span(CH.bang, CH.galaxy, p)
    cosMat.uniforms.uE.value = p < CH.bang ? 0 : Math.max(0.0001, e)
    cosMat.uniforms.uOn.value = 1 - smooth(CH.galaxy + 0.02, CH.galaxy + 0.08, p)
    cosmos.visible = cosMat.uniforms.uOn.value > 0.001
    const pre = 1 - smooth(CH.bang, CH.bang + 0.01, p)
    glowMat.uniforms.uCore.value = pre * (0.8 + 0.2 * Math.sin(t * 2.3)) + flash * 2
    glowMat.uniforms.uHalo.value = pre * (0.45 + 0.15 * Math.sin(t * 1.1)) + flash * 3
    const ringT = span(CH.bang, CH.expansion + 0.03, p)
    glowMat.uniforms.uRing.value = ringT > 0 && ringT < 1 ? (1 - ringT) * 2 : 0
    glowMat.uniforms.uRingR.value = 0.04 + 0.9 * Math.pow(ringT, 0.6)
    glow.visible = p < CH.expansion + 0.04
    glow.quaternion.copy(camera.quaternion)
    glow.scale.setScalar(900 + 22000 * Math.pow(ringT, 0.8))
    starMat.uniforms.uOn.value = smooth(CH.bang + 0.01, CH.galaxy, p) * 0.9
    galMat.uniforms.uOn.value = smooth(CH.galaxy - 0.02, CH.galaxy + 0.05, p) * (1 - 0.82 * smooth(CH.sun - 0.03, CH.sun + 0.03, p))
    galaxy.visible = galMat.uniforms.uOn.value > 0.001

    // ── the Sun ──
    const sunOn = smooth(CH.galaxy + 0.04, CH.sun - 0.02, p)
    sun.visible = corona.visible = sunOn > 0.001
    corona.quaternion.copy(camera.quaternion)
    coronaMat.uniforms.uI.value = 2.2 * sunOn * (1 - 0.6 * sunNear)
    sunMat.uniforms.uBright.value = 2.4 * sunOn - 1.55 * sunNear
    tmp.copy(SUN).project(camera)
    coronaMat.uniforms.uMouseA.value = Math.atan2(my - tmp.y, (mx - tmp.x) * common.uAspect.value)
    coronaMat.uniforms.uLean.value = seen ? 1 : 0
    for (const m of proms) m.uniforms.uI.value = 3.2 * sunOn
    windMat.uniforms.uOn.value = sunOn * (0.25 + 0.75 * sunNear)
    sunLight.intensity = 2 * sunOn + 0.4

    // ── Earth, Moon, the station, the planets ──
    for (const m of spinners) m.rotation.y = t * 0.02
    for (const o of moons) {
      const a = o.a + t * o.s
      o.m.position.set(o.c.x + Math.cos(a) * o.d, o.c.y + Math.sin(a * 0.7) * 1.5, o.c.z + Math.sin(a) * o.d)
    }
    beltMat.uniforms.uOn.value = smooth(CH.earth - 0.03, CH.earth + 0.01, p) * (1 - smooth(CH.voyager + 0.05, CH.voyager + 0.08, p)) * 0.9
    earth.rotation.y = t * 0.012 + 2.1
    cloudOff.value = (t * 0.0009) % 1
    moonAt(t, moon.position)
    moon.rotation.y = t * 0.01
    issPivot.position.copy(ISS).addScaledVector(T_ISS, Math.sin(t * 0.05) * 0.05)
    issPivot.lookAt(tmp.copy(issPivot.position).add(T_ISS))
    voyPivot.rotation.z = Math.sin(t * 0.1) * 0.02

    // ── the mark and the wormhole ──
    const lean = 1 - smooth(0.9, CH.dive + 0.01, p)
    qTmp.setFromEuler(new THREE.Euler(-my * 0.22 * lean + Math.sin(t * 0.3) * 0.03 * lean, mx * 0.32 * lean + Math.sin(t * 0.23) * 0.04 * lean, 0))
    mark.quaternion.copy(markBase).multiply(qTmp)
    swirlSpin += dt * (1 + 5 * smooth(0.88, 0.96, p))
    swirlMat.uniforms.uSpin.value = swirlSpin
    swirlMat.uniforms.uOn.value = smooth(CH.voyager + 0.02, CH.cognia + 0.02, p)
    rimMat.opacity = 0.4 + 0.6 * smooth(CH.cognia, 0.87, p) + 0.25 * Math.sin(t * 2)
    // through the throat: streaks rush past, then everything fades to black
    mPos.copy(camera.position)
    mark.worldToLocal(mPos)
    const inside = mPos.z < 0
    horizon.visible = !inside
    warp.visible = inside
    warpFlow += dt * (60 + 260 * smooth(0.96, 0.99, p))
    warpMat.uniforms.uFlow.value = warpFlow
    warpMat.uniforms.uStretch.value = 3 + 30 * smooth(0.965, 0.99, p)
    warpMat.uniforms.uOn.value = inside ? 0.9 * (1 - smooth(0.982, 0.99, p)) : 0
    // the arrival: the light gathers into the mark, its core ignites
    const arrive = smooth(0.972, 0.982, p)
    formMat.uniforms.uOn.value = arrive * (1 - smooth(0.996, 1, p))
    formMat.uniforms.uForm.value = smooth(0.975, 0.992, p)
    form.visible = core.visible = arrive > 0.001
    core.quaternion.copy(camera.quaternion)
    const ign = smooth(0.988, 0.993, p)
    coreMat.uniforms.uCore.value = ign * (0.8 + 0.2 * Math.sin(t * 3))
    coreMat.uniforms.uHalo.value = ign * (0.6 + 0.15 * Math.sin(t * 1.7))
    coreMat.uniforms.uRing.value = ign > 0 && ign < 1 ? (1 - ign) * 2 : 0
    coreMat.uniforms.uRingR.value = 0.1 + 0.8 * ign

    // ── exposure, bloom, grade ──
    renderer.toneMappingExposure = 0.85 - 0.3 * sunNear
    bloom.strength = (0.6 - 0.4 * sunNear + flash * 1.2) * (1 - 0.7 * smooth(0.9, 0.95, p) * (1 - smooth(0.965, 0.98, p))) + 0.12 * smooth(0.965, 0.985, p)
    grade.uniforms.uFlash.value = flash * 0.85
    grade.uniforms.uFade.value = smooth(0.995, 1, p)
    grade.uniforms.uT.value = t

    // adaptive quality: drop resolution and multisampling when the first seconds run slow
    if (sampled < 90 && t > 0.5) {
      sampled++
      if (dt > 0.03) slow++
      if (sampled === 90 && slow > 50 && pr > 1) {
        pr = 1
        renderer.setPixelRatio(pr)
        composer.setPixelRatio(pr)
        common.uPR.value = pr
        resize(w, h)
      }
    }
    composer.render(dt)

    camera.updateMatrixWorld()
    place('singularity', G, 1 - smooth(CH.expansion, CH.galaxy, p))
    place('sun', SUN, sunOn)
    place('earth', E, smooth(CH.orbit + 0.12, CH.earth, p) * (1 - smooth(CH.voyager, CH.cognia, p)))
    place('iss', issPivot.position, smooth(CH.earth + 0.04, CH.iss, p) * (1 - smooth(CH.voyager, CH.voyager + 0.03, p)))
    place('voyager', VOY, smooth(CH.iss + 0.03, CH.voyager, p) * (1 - smooth(CH.cognia, CH.cognia + 0.04, p)))
    place('wormhole', CW, smooth(CH.voyager + 0.02, CH.cognia, p))
    opts.onFrame({ p, v, t, dt, chapter: chapterAt(p), sun: sunNear, flash, mx, my, visible: active, speed: camSpeed, inside: inside ? 1 : 0, objs })
  }

  // compile everything once (all visible) before the first real frame, while the boot screen still covers it
  renderer.compile(scene, camera)
  composer.render(0)
  raf = requestAnimationFrame(frame)

  return {
    setActive(on) {
      if (on === active) return
      active = on
      if (on && !raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
      if (!on) opts.onFrame({ p, v: 0, t, dt: 0, chapter: chapterAt(p), sun: 0, flash: 0, mx, my, visible: false, speed: 0, inside: 0, objs })
    },
    resize,
    dispose() {
      disposed = true
      cancelIss()
      cancelVoy()
      issPivot.children.slice().forEach(disposeTree)
      voyPivot.children.slice().forEach(disposeTree)
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      disposables.forEach((d) => d.dispose())
      draco.dispose()
      bloom.dispose()
      composer.dispose()
      rt.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
