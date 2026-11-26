/* Whether the home page opens with the scroll journey (kept free of three, so the decision costs nothing). */

/** the hash route is the home page */
export function onHome() {
  try {
    const h = location.hash.replace(/^#/, '').split('?')[0]
    return h === '' || h === '/'
  } catch {
    return false
  }
}

let cached: boolean | null = null
/** WebGL 2 and motion allowed */
export function canJourney() {
  if (cached != null) return cached
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return (cached = false)
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return (cached = !!gl)
  } catch {
    return (cached = false)
  }
}
