/* The journey's camera. Big Bang → galaxy formation → in from behind the Sun, past its side through the corona →
   past the side of Earth (and the station) → out through the Van Allen belts → Voyager → the COGNIA mark → through it.
   The planets move, so the keyframes are rebuilt from the live world every frame; a monotone spline maps scroll
   progress onto the path, so speed carries smoothly through every key. */
import * as THREE from 'three'
import { CH, CORONA, span } from './story'
import { CW, DIR0, E, G, H, ISS, MARK_FROM, MARK_POS, N_ISS, NM, OUT, R_EARTH, S_ISS, SIDE, SUN, SV, T_ISS, UP, VD, VOY } from './world'

const V3 = THREE.Vector3
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const easeInOut = (x: number) => {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** the Big Bang flash, 0..1, for a progress p */
export const flashAt = (p: number) => smooth(CH.bang - 0.002, CH.bang + 0.006, p) * (1 - smooth(CH.bang + 0.008, CH.expansion + 0.02, p))

export type RigInput = { p: number; t: number; dt: number; mx: number; my: number; aspect: number }
/** sunNear: 0..1 how close the camera is to the Sun's surface; flash: the Big Bang flash; speed: camera speed (world units per second) */
export type RigOutput = { sunNear: number; flash: number; speed: number }

type Key = { p: number; pos: THREE.Vector3; tgt: THREE.Vector3; fov: number; roll: number }
const v = () => new V3()

function buildKeys(): Key[] {
  const k: Key[] = []
  const key = (p: number, pos: THREE.Vector3, tgt: THREE.Vector3, fov = 50, roll = 0) => k.push({ p, pos, tgt, fov, roll })
  key(CH.sun, H.clone(), SUN.clone(), 50)
  // in from behind the Sun (the Sun between us and Earth)
  key(0.31, v().addScaledVector(OUT, -160).addScaledVector(SIDE, 24).addScaledVector(UP, 26), SUN.clone(), 50)
  key(0.355, v().addScaledVector(OUT, -46).addScaledVector(SIDE, 22).addScaledVector(UP, 6), v().addScaledVector(OUT, 8), 52, 0.06)
  // past its side, through the corona: the limb is the horizon
  key(CORONA, v().addScaledVector(SIDE, 16.5).addScaledVector(UP, 1.2).addScaledVector(OUT, -1), v().addScaledVector(OUT, 40).addScaledVector(SIDE, 12.5), 64, 0.22)
  key(0.445, v().addScaledVector(OUT, 42).addScaledVector(SIDE, 14).addScaledVector(UP, 3), E.clone(), 52, 0.05)
  // Earth: arrive on the day side, then pass close along its side
  key(CH.earth, E.clone().addScaledVector(OUT, -30).addScaledVector(SIDE, 9).addScaledVector(UP, 4), E.clone(), 46)
  key(0.535, E.clone().addScaledVector(OUT, -7).addScaledVector(SIDE, R_EARTH * 1.4).addScaledVector(UP, 1), E.clone().addScaledVector(OUT, 25).addScaledVector(SIDE, 3), 48, 0.06)
  key(0.59, ISS.clone().addScaledVector(N_ISS, 0.55).addScaledVector(S_ISS, 1.6).addScaledVector(T_ISS, -1.0), ISS.clone(), 40)
  key(0.625, ISS.clone().addScaledVector(N_ISS, 0.42).addScaledVector(S_ISS, 0.55).addScaledVector(T_ISS, 0.85), ISS.clone().addScaledVector(T_ISS, 0.25), 42, -0.06)
  // out through the inner and outer Van Allen belts, towards Voyager
  key(0.662, E.clone().addScaledVector(VD, R_EARTH * 2.1).addScaledVector(UP, 1.4), E.clone().addScaledVector(VD, 30), 52)
  key(0.692, E.clone().addScaledVector(VD, R_EARTH * 4.3).addScaledVector(UP, 2), E.clone().addScaledVector(VD, 80), 56)
  // the long cruise out of the Solar System to the farthest machine
  key(0.728, VOY.clone().addScaledVector(VD, -40).addScaledVector(SV, 10).addScaledVector(UP, 4), VOY.clone(), 46)
  key(0.755, VOY.clone().addScaledVector(VD, -3.4).addScaledVector(SV, 1.9).addScaledVector(UP, 0.7), VOY.clone(), 44)
  key(0.786, VOY.clone().addScaledVector(VD, 1.4).addScaledVector(SV, -1.7).addScaledVector(UP, 0.45), VOY.clone().addScaledVector(VD, 6), 46)
  key(CH.cognia, MARK_FROM.clone(), MARK_POS.clone(), 46)
  key(0.865, CW.clone().addScaledVector(NM, 64).addScaledVector(UP, 3), CW.clone(), 44)
  key(0.905, CW.clone().addScaledVector(NM, 34), CW.clone(), 44)
  key(CH.dive, CW.clone().addScaledVector(NM, 18), CW.clone(), 46)
  key(0.965, CW.clone().addScaledVector(NM, 0.9), CW.clone().addScaledVector(NM, -10), 64, 0.4)
  // through the throat, out the other side, and up to the mark assembling in the light
  key(0.977, CW.clone().addScaledVector(NM, -12), CW.clone().addScaledVector(NM, -150), 80, 0.25)
  key(0.99, CW.clone().addScaledVector(NM, -40), CW.clone().addScaledVector(NM, -150), 58, 0)
  key(1, CW.clone().addScaledVector(NM, -62), CW.clone().addScaledVector(NM, -150), 52, 0)
  return k
}

export function createRig(camera: THREE.PerspectiveCamera) {
  const camPos = new V3()
  const camTgt = new V3()
  let camFov = 50
  let camRoll = 0
  const dirTmp = new V3()
  const qTmp = new THREE.Quaternion()
  const right = new V3()
  const upv = new V3()
  const fwd = new V3()
  const last = new V3()
  let speed = 0
  let primed = false
  const posCurve = new THREE.CatmullRomCurve3([], false, 'centripetal')
  const tgtCurve = new THREE.CatmullRomCurve3([], false, 'centripetal')

  function cameraAt(p: number) {
    if (p < CH.sun) {
      if (p < CH.expansion) {
        // in front of the singularity; the bang throws the camera back a little
        const d = 1800 + 1400 * smooth(CH.bang, CH.expansion, p)
        camTgt.copy(G)
        camPos.copy(G).addScaledVector(DIR0, d)
      } else if (p < CH.galaxy) {
        const e = easeInOut(span(CH.expansion, CH.galaxy, p))
        camTgt.copy(G)
        camPos.copy(G).addScaledVector(DIR0, Math.exp(lerp(Math.log(3200), Math.log(70000), e)))
      } else {
        // into our galaxy, then down onto one star, arriving behind it
        const q = span(CH.galaxy, CH.sun, p)
        const e = easeInOut(q)
        camTgt.lerpVectors(G, SUN, smooth(0.3, 1, q))
        const d = Math.exp(lerp(Math.log(70000), Math.log(H.length()), e))
        dirTmp.copy(DIR0).lerp(H.clone().normalize(), smooth(0.15, 0.95, q)).normalize()
        camPos.copy(camTgt).addScaledVector(dirTmp, d)
      }
      camFov = 50
      camRoll = 0
      return
    }
    const keys = buildKeys()
    const n = keys.length
    posCurve.points = keys.map((k) => k.pos)
    tgtCurve.points = keys.map((k) => k.tgt)
    const slope: number[] = []
    for (let i = 0; i < n - 1; i++) slope.push(1 / (keys[i + 1].p - keys[i].p))
    const tng = keys.map((_, i) => (i === 0 ? slope[0] : i === n - 1 ? slope[n - 2] : (2 * slope[i - 1] * slope[i]) / (slope[i - 1] + slope[i])))
    let i = 0
    while (i < n - 2 && p >= keys[i + 1].p) i++
    const h = keys[i + 1].p - keys[i].p
    const s = clamp01((p - keys[i].p) / h)
    const s2 = s * s, s3 = s2 * s
    const x = Math.min(n - 1, Math.max(0, i * (2 * s3 - 3 * s2 + 1) + h * tng[i] * (s3 - 2 * s2 + s) + (i + 1) * (-2 * s3 + 3 * s2) + h * tng[i + 1] * (s3 - s2)))
    const j = Math.min(n - 2, Math.floor(x))
    const l = x - j
    posCurve.getPoint(x / (n - 1), camPos)
    tgtCurve.getPoint(x / (n - 1), camTgt)
    const sm = l * l * (3 - 2 * l)
    camFov = lerp(keys[j].fov, keys[j + 1].fov, sm)
    camRoll = lerp(keys[j].roll, keys[j + 1].roll, sm)
  }

  return {
    update({ p, t, dt, mx, my, aspect }: RigInput): RigOutput {
      cameraAt(p)
      // portrait screens: step back so wide subjects still fit across; not in the corona or the dive
      if (aspect < 0.95 && p >= CH.sun) {
        const far = Math.min(1.9, Math.pow(0.95 / aspect, 0.75))
        const wgt = (1 - smooth(CORONA - 0.05, CORONA - 0.02, p) * (1 - smooth(CORONA + 0.02, CORONA + 0.05, p))) * (1 - smooth(0.935, 0.962, p))
        camPos.sub(camTgt).multiplyScalar(1 + (far - 1) * wgt).add(camTgt)
      }
      const dist = camPos.distanceTo(camTgt)
      fwd.subVectors(camTgt, camPos).normalize()
      right.crossVectors(fwd, UP).normalize()
      upv.crossVectors(right, fwd).normalize()
      const lookK = Math.min(dist, 900) * 0.06 * (1 - smooth(CH.dive, 0.95, p))
      const drift = Math.min(dist, 900) * 0.012
      camPos
        .addScaledVector(right, mx * lookK + Math.sin(t * 0.21) * drift)
        .addScaledVector(upv, my * lookK * 0.6 + Math.cos(t * 0.17) * drift * 0.7)
      camTgt.addScaledVector(right, mx * lookK * 0.25).addScaledVector(upv, my * lookK * 0.15)
      const flash = flashAt(p)
      const sunNear = smooth(46, 17, camPos.distanceTo(SUN))
      // natural shake: layered slow sines (like value noise), a small sway and a larger turn of the head
      const shake = flash * 1.6 + sunNear * 0.5 + smooth(0.95, 0.985, p) * (1 - smooth(0.99, 1, p)) * 0.6
      const nz = (a: number, b: number, c: number) => Math.sin(t * a + b) * 0.55 + Math.sin(t * a * 2.13 + c) * 0.3 + Math.sin(t * a * 4.37 + b + c) * 0.15
      if (shake > 0) {
        camPos.addScaledVector(right, nz(3.1, 0.4, 1.7) * shake * 0.35).addScaledVector(upv, nz(2.7, 2.2, 0.3) * shake * 0.35)
        const aim = Math.min(dist, 900) * shake * 0.012
        camTgt.addScaledVector(right, nz(1.9, 1.1, 2.9) * aim).addScaledVector(upv, nz(2.3, 0.7, 1.3) * aim)
      }
      if (primed && dt > 0) speed += (camPos.distanceTo(last) / dt - speed) * (1 - Math.exp(-dt * 5))
      last.copy(camPos)
      primed = true
      camera.position.copy(camPos)
      camera.up.copy(UP)
      camera.lookAt(camTgt)
      if (camRoll) {
        qTmp.setFromAxisAngle(fwd, camRoll)
        camera.up.copy(UP).applyQuaternion(qTmp)
        camera.lookAt(camTgt)
      }
      if (Math.abs(camera.fov - camFov) > 1e-3) {
        camera.fov = camFov
        camera.updateProjectionMatrix()
      }
      return { sunNear, flash, speed }
    },
  }
}
