/* One quiet, collapsed-by-default disclosure, used for everything that is optional on the learning pages.
   Built on the shadcn Collapsible (Base UI); the panel height animates through Base UI's CSS variable. */
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export function Disclosure({
  title,
  hint,
  icon,
  defaultOpen = false,
  className,
  children,
}: {
  title: React.ReactNode
  /** short grey text after the title, e.g. "2 questions · 1 lesson" */
  hint?: React.ReactNode
  icon?: React.ReactNode
  defaultOpen?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn('border border-line', className)}>
      <CollapsibleTrigger className="group/disc flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-soft sm:px-5">
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="text-[15px] font-medium">{title}</span>
          {hint && <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground sm:mt-0 sm:ml-2.5 sm:inline">{hint}</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-data-[panel-open]/disc:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-300 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none">
        <div className="border-t border-line px-4 py-4 sm:px-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
