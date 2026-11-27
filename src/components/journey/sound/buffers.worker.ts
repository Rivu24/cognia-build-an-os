/* Makes the journey sound's buffers off the main thread, so turning the sound on never stalls the page.
   In: the sample rate. Out: the Raw buffers (their memory is handed over, not copied). */
import { makeRaw, type Raw } from './core'

self.onmessage = (e: MessageEvent<number>) => {
  const raw = makeRaw(e.data)
  const move = (Object.keys(raw) as (keyof Raw)[]).flatMap((k) => (k === 'sr' ? [] : raw[k].map((c) => c.buffer as ArrayBuffer)))
  ;(self as unknown as Worker).postMessage(raw, move)
}
