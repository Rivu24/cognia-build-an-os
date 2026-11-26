/* Where everything in the journey sits (world units). The planets move on their real orbits (orbits.ts), so the
   Earth-bound points here are live vectors: updateWorld(T) rewrites them in place every frame, and everything that
   imported them (camera, scene) sees the new values. Voyager and the COGNIA mark beyond it are fixed. */
import * as THREE from 'three'
import { centuries, planetAt, voyagerAt } from './orbits'

const V3 = THREE.Vector3
export const R_SUN = 10
export const R_EARTH = 5
export const UP = new V3(0, 1, 0)
export const SUN = new V3(0, 0, 0)
export const G = new V3(-2400, -40, -1700) // centre of our galaxy (the Sun sits in one of its arms)
export const DIR0 = new V3(0.22, 0.78, 0.58).normalize() // where we watch the universe from
export const W = 30000 // radius of the cosmic web

/** time-lapse: simulated days per real second (the planets visibly move along their orbits) */
export const DAYS_PER_SECOND = 0.6
/** the journey starts at the real date and time */
export const T0 = centuries(Date.now())
export const simT = (t: number) => T0 + (t * DAYS_PER_SECOND) / 36525

/* live (rewritten by updateWorld) */
export const E = new V3() // Earth
export const OUT = new V3() // from the Sun through Earth
export const SIDE = new V3() // horizontal, across OUT
export const H = new V3() // behind the Sun (seen from Earth): where the galaxy flight hands over
export const N_ISS = new V3()
export const ISS = new V3()
export const S_ISS = new V3()
export const T_ISS = new V3()
export const VD = new V3() // from Earth towards Voyager
export const SV = new V3() // across VD

/* fixed: Voyager 1 in its real direction, the COGNIA mark beyond it, outside the Solar System */
export const VOY = voyagerAt(new V3())
const VDIR = VOY.clone().normalize()
const VSIDE = new V3().crossVectors(VDIR, UP).normalize()
/** the COGNIA mark: its local origin is the centre of the circle (the wormhole's throat); its +z faces MARK_FROM */
export const MARK_POS = VOY.clone().addScaledVector(VDIR, 240).addScaledVector(VSIDE, -6).addScaledVector(UP, 9)
export const MARK_FROM = VOY.clone().addScaledVector(VDIR, 12).addScaledVector(UP, 1)
export const MARK_SCALE = 0.8
export const CW = MARK_POS.clone()
export const NM = MARK_FROM.clone().sub(MARK_POS).normalize()

export function updateWorld(T: number) {
  planetAt('earth', T, E)
  OUT.copy(E).normalize()
  SIDE.set(OUT.z, 0, -OUT.x).normalize()
  H.copy(OUT).multiplyScalar(-900).addScaledVector(UP, 140)
  N_ISS.copy(SIDE).multiplyScalar(0.9).addScaledVector(UP, 0.35).addScaledVector(OUT, -0.15).normalize()
  ISS.copy(E).addScaledVector(N_ISS, R_EARTH * 1.075)
  S_ISS.crossVectors(N_ISS, UP).normalize()
  T_ISS.crossVectors(S_ISS, N_ISS).normalize()
  VD.subVectors(VOY, E).normalize()
  SV.crossVectors(VD, UP).normalize()
}
updateWorld(T0)
