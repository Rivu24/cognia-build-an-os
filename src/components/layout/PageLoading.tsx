import { motion } from 'motion/react'
import { Mark } from '@/components/brand'

export function PageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-muted-foreground">
        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <Mark className="size-6" />
        </motion.span>
        <span className="font-mono text-xs tracking-[.08em] uppercase">{label}…</span>
      </div>
    </div>
  )
}

export function ErrorNote({ error }: { error: Error }) {
  return (
    <div className="m-8 max-w-xl border border-line p-5">
      <div className="eyebrow mb-2">Could not load</div>
      <p className="text-sm text-muted-foreground">{error.message}. If you opened the file directly, serve the folder instead (for example <code className="font-mono">npm run preview</code>).</p>
    </div>
  )
}
