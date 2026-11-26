/* Where the pointer is on the page, shared by the robots. One passive listener for the whole app,
   attached only while something is watching. Reading it costs nothing: callers poll `cursor` in their own frame loop. */

export const cursor = {
  x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
  y: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
  /** performance.now() of the last move; 0 before the first one */
  at: 0,
  /** false once the pointer has left the window */
  inside: false,
}

const subs = new Set<() => void>()
let users = 0

function move(e: PointerEvent) {
  cursor.x = e.clientX
  cursor.y = e.clientY
  cursor.at = performance.now()
  cursor.inside = true
  subs.forEach((f) => f())
}
function out(e: MouseEvent) {
  if (e.relatedTarget) return
  cursor.inside = false
  cursor.at = performance.now()
  subs.forEach((f) => f())
}

/** Start following the pointer. `onMove` (optional) wakes an idle loop. Returns a cleanup. */
export function watchCursor(onMove?: () => void) {
  if (onMove) subs.add(onMove)
  if (users++ === 0) {
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', move, { passive: true })
    document.addEventListener('mouseout', out, { passive: true })
  }
  return () => {
    if (onMove) subs.delete(onMove)
    if (--users === 0) {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', move)
      document.removeEventListener('mouseout', out)
    }
  }
}

/** Gaze target in -1..1 for an element whose centre is at (cx, cy): which way it should look to see the pointer.
    Centred when the pointer is outside the window. Soft-clamped, so far corners still read as "far" without pinning the eyes to the edge. */
export function gazeFrom(cx: number, cy: number, out: { x: number; y: number }) {
  if (!cursor.inside) {
    out.x = 0
    out.y = 0
    return out
  }
  const sx = Math.max(240, window.innerWidth * 0.5)
  const sy = Math.max(240, window.innerHeight * 0.5)
  out.x = Math.tanh(((cursor.x - cx) / sx) * 1.6)
  out.y = Math.tanh(((cursor.y - cy) / sy) * 1.6)
  return out
}
