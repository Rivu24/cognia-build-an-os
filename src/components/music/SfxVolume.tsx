/* Sound effects level (clicks, scrolling, transitions, the robot): the rail and the music player both show it.
   0 is off; the button switches it on and off; arrows step by 5%, Shift/Page keys by 20%. */
import type { KeyboardEvent } from 'react'
import { Slider } from '@/components/ui/slider'
import { sfx, useSfx } from '@/lib/sfx'
import { cn } from '@/lib/utils'

function keys(e: KeyboardEvent, value: number, apply: (v: number) => void) {
  if (e.altKey || e.ctrlKey || e.metaKey) return
  const by = e.shiftKey ? 20 : 5
  const next =
    e.key === 'ArrowRight' || e.key === 'ArrowUp' ? value + by
    : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? value - by
    : e.key === 'PageUp' ? value + 20
    : e.key === 'PageDown' ? value - 20
    : e.key === 'Home' ? 0
    : e.key === 'End' ? 100
    : null
  if (next === null) return
  e.preventDefault()
  apply(Math.max(0, Math.min(100, next)))
}

export function SfxVolume({ className }: { className?: string }) {
  const { volume, enabled } = useSfx()
  const v = Math.round((enabled ? volume : 0) * 100)
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        onClick={() => sfx.setEnabled(!enabled)}
        aria-pressed={enabled}
        aria-label={enabled ? 'Turn sound effects off' : 'Turn sound effects on'}
        title="Sound effects"
        className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center font-mono text-[10.5px] tracking-wider whitespace-nowrap text-muted-foreground uppercase hover:text-foreground"
      >
        Sound FX
      </button>
      <Slider
        data-sfx="none"
        aria-label="Sound effects volume"
        min={0}
        max={100}
        step={1}
        largeStep={20}
        value={v}
        getAriaValueText={(_, x) => (x === 0 ? 'Off' : `${Math.round(x)}%`)}
        onKeyDownCapture={(e) => keys(e, v, (x) => sfx.setVolume(x / 100))}
        onValueChange={(x) => sfx.setVolume((Array.isArray(x) ? x[0] : x) / 100)}
        className="py-2"
      />
      <span className="w-8 shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums">{v}</span>
    </div>
  )
}
