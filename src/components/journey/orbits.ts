/* A small orbital engine: where each planet really is today (Keplerian elements, JPL "Approximate Positions of the
   Planets", valid 1800–2050), moving on its real orbit in time-lapse. Distances are compressed so the whole Solar
   System fits on screen (r_scene = 170 · r_AU^0.55: Earth at 170, Neptune near 1100); angles, eccentricities,
   inclinations and the planets' current positions are real. Scene axes: ecliptic x → x, ecliptic y → -z, north → y. */
import * as THREE from 'three'

type El = [number, number, number, number, number, number] // a (AU), e, I, L, ϖ (long. of perihelion), Ω (all degrees)
const P: Record<Planet, { el: El; rate: El }> = {
  mercury: { el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  venus: { el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418] },
  earth: { el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0] },
  mars: { el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  jupiter: { el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  saturn: { el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
  uranus: { el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
  neptune: { el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
}
export type Planet = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune'
export const PLANETS = Object.keys(P) as Planet[]

const D = Math.PI / 180
/** compressed scene distance for a distance in AU */
export const scaleAU = (au: number) => 170 * Math.pow(au, 0.55)

/** heliocentric ecliptic position (AU) at Julian centuries T since J2000 */
function helio(p: Planet, T: number, out: THREE.Vector3) {
  const { el, rate } = P[p]
  const [a, e, I, L, w, O] = el.map((v, i) => v + rate[i] * T)
  const M = (((L - w) % 360) + 540) % 360 - 180
  const om = w - O
  let E = M * D + e * Math.sin(M * D)
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M * D) / (1 - e * Math.cos(E))
  const x = a * (Math.cos(E) - e)
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const co = Math.cos(om * D), so = Math.sin(om * D), cO = Math.cos(O * D), sO = Math.sin(O * D), cI = Math.cos(I * D), sI = Math.sin(I * D)
  const X = (co * cO - so * sO * cI) * x + (-so * cO - co * sO * cI) * y
  const Y = (co * sO + so * cO * cI) * x + (-so * sO + co * cO * cI) * y
  const Z = so * sI * x + co * sI * y
  return out.set(X, Y, Z)
}

/** scene position of a planet at Julian centuries T (compressed distance, real direction) */
export function planetAt(p: Planet, T: number, out: THREE.Vector3) {
  helio(p, T, out)
  const r = out.length()
  const s = scaleAU(r) / r
  return out.set(out.x * s, out.z * s, -out.y * s)
}

/** points along a planet's orbit (for the faint orbit lines) */
export function orbitPath(p: Planet, T: number, n = 256) {
  const period = 360 / P[p].rate[3] // centuries per orbit
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < n; i++) pts.push(planetAt(p, T + (i / n) * period, new THREE.Vector3()))
  return pts
}

/** Julian centuries since J2000 for a JS time */
export const centuries = (ms: number) => (ms / 86400000 + 2440587.5 - 2451545) / 36525

/** Voyager 1's direction today (RA 17h 13m, Dec +12°, ~167 AU), in scene axes */
export function voyagerAt(out: THREE.Vector3) {
  const ra = (17 + 13 / 60) * 15 * D, dec = 12.1 * D, eps = 23.44 * D
  const xq = Math.cos(dec) * Math.cos(ra), yq = Math.cos(dec) * Math.sin(ra), zq = Math.sin(dec)
  const X = xq, Y = Math.cos(eps) * yq + Math.sin(eps) * zq, Z = -Math.sin(eps) * yq + Math.cos(eps) * zq // equatorial → ecliptic
  const r = scaleAU(167)
  return out.set(X * r, Z * r, -Y * r)
}
