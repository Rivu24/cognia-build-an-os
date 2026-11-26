import { cn } from '@/lib/utils'

export const PRODUCT = 'Build an OS'
export const COPYRIGHT = '© 2026 Dron Guin, Founder, Cognia Labs.'
export const WIKI = 'https://wiki.osdev.org/'

/** The COGNIA master mark: a sharp bracket (the human frame) holding one point (a thought). */
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={cn('mark', className)} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M30 6H8v28h22" />
      <circle cx="21" cy="20" r="3.6" strokeLinecap="round" />
    </svg>
  )
}

/** Lockup: mark · COGNIA | product name. */
export function Lockup({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <span className={cn('flex items-center', lg ? 'gap-5' : 'gap-2.5', className)}>
      <Mark className={lg ? 'size-14 [stroke-width:2.2]' : 'size-[26px]'} />
      <span className={cn('wordmark', lg ? 'text-[clamp(22px,3.4vw,40px)]' : 'text-[13px]')}>COGNIA</span>
      <span className={cn('border-l border-line-strong leading-none font-medium whitespace-nowrap', lg ? 'pl-5 text-[clamp(18px,2.4vw,28px)]' : 'pl-2.5 text-[14px]')}>
        {PRODUCT}
      </span>
    </span>
  )
}
