import { Link } from 'react-router'
import { Mark } from '@/components/brand'
import { Magnetic, Reveal, RevealText } from '@/components/motion'

export default function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center px-6 sm:px-14">
      <Reveal y={30} scale={0.9} blur={4} tilt={14} duration={1.3}>
        <Mark className="mb-6 size-10" />
      </Reveal>
      <Reveal y={14} scale={1} blur={0} delay={0.15} duration={0.9} className="eyebrow">Not found</Reveal>
      <RevealText as="h1" delay={0.2} className="mt-2 block text-3xl font-semibold tracking-[-.02em]">{`This ${what} does not exist.`}</RevealText>
      <Reveal y={20} scale={1} delay={0.45} duration={1}>
        <p className="mt-2 text-muted-foreground">It may have moved. Search with Ctrl K, or go back to the path.</p>
      </Reveal>
      <Reveal y={24} scale={1} blur={0} delay={0.6} className="mt-6 flex gap-2">
        <Magnetic>
          <Link to="/path" className="inline-flex h-10 items-center bg-foreground px-4 text-sm font-medium text-background">Learning path</Link>
        </Magnetic>
        <Link to="/library" className="inline-flex h-10 items-center border border-line px-4 text-sm transition-colors hover:border-foreground">Library</Link>
      </Reveal>
    </div>
  )
}
