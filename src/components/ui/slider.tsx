import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/utils"
import { sfx } from "@/lib/sfx"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  getAriaValueText,
  onValueChange,
  ...props
}: SliderPrimitive.Root.Props & {
  "aria-label"?: string
  /** what a screen reader hears for the value, e.g. "2:21 of 3:54" */
  getAriaValueText?: SliderPrimitive.Thumb.Props["getAriaValueText"]
}) {
  // one thumb for a single number, one per entry for a range
  const _values = Array.isArray(value)
    ? value
    : value !== undefined
      ? [value]
      : Array.isArray(defaultValue)
        ? defaultValue
        : defaultValue !== undefined
          ? [defaultValue]
          : [min, max]

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      onValueChange={(v, d) => {
        // a soft detent as it moves, pitched by position (a slider can opt out with data-sfx="none")
        if ((props as Record<string, unknown>)["data-sfx"] !== "none") {
          const x = Array.isArray(v) ? v[0] : v
          sfx.tick(max > min ? (x - min) / (max - min) : 0.5)
        }
        onValueChange?.(v, d)
      }}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden bg-soft-2 select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-foreground select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            aria-label={ariaLabel}
            getAriaValueText={getAriaValueText}
            // the focusable element is a visually hidden <input> inside the thumb, so the focus ring keys off :has()
            className="relative block size-3 shrink-0 border border-foreground bg-foreground ring-foreground/25 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 active:ring-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground has-[:focus-visible]:outline-solid data-disabled:pointer-events-none"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
