import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { CountUp, DrawLine, Magnetic, Parallax, Reveal, RevealText, scrollToId } from '@/components/motion'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { WIKI } from '@/components/brand'
import { useNextLesson, usePrereqProgress } from '@/lib/next'
import { useAnswers } from '@/components/prereq/selfcheck'
import { CONCEPTS, byId } from '@/viz/registry'
import { HeroArt } from '@/components/home/HeroArt'
import { Journey } from '@/components/journey/Journey'
import { WatchArt, ReadArt, ProveArt } from '@/components/home/StepArt'
import { PathStepper } from '@/components/home/PathStepper'
import { useHeroReady } from '@/components/home/hooks'
import { onboarding, useOnboarding } from '@/lib/onboarding'
import { cn } from '@/lib/utils'

const PAD = 'px-6 sm:px-10 lg:px-14 xl:px-20'

export default function Home() {
  const info = useNextLesson()
  const ob = useOnboarding()
  const ready = useHeroReady() && !ob
  const featured = byId['power-on-to-kernel'] ?? CONCEPTS[0]

  return (
    <div>
      {ob && <Journey />}
      <Hero ready={ready} info={info} />

      {/* 2 · HOW IT WORKS */}
      <section id="how" className={cn(PAD, 'py-24 sm:py-32')}>
        <Heading eyebrow="How it works" title="Every lesson is three steps." />
        <ol className="mt-14 grid gap-14 md:grid-cols-3 md:gap-8 xl:gap-12">
          {[
            { k: 'Watch it move', d: 'A short animation shows the mechanism working, with real addresses and values you can check.', Art: WatchArt },
            { k: 'Read the wiki', d: 'The OSDev Wiki article, complete and unedited, set for long and calm reading.', Art: ReadArt },
            { k: 'Prove it in QEMU', d: 'Build it, boot it, and pass a concrete checkpoint before you move on.', Art: ProveArt },
          ].map((s, i) => (
            <Reveal as="li" key={s.k} delay={i * 0.16} y={70} tilt={7} blur={4} duration={1.3}>
              <div className="bg-soft px-4 py-5 sm:px-6"><s.Art /></div>
              <DrawLine className="bg-line-strong" delay={0.35 + i * 0.16} />
              <div className="mt-6 flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-faint">0{i + 1}</span>
                <h3 className="text-[clamp(20px,2vw,26px)] leading-tight font-semibold tracking-[-.015em]">{s.k}</h3>
              </div>
              <p className="mt-2.5 max-w-[34ch] text-[15.5px] leading-relaxed text-muted-foreground">{s.d}</p>
            </Reveal>
          ))}
        </ol>
        <Settle className="mt-14"><TextLink to="/method">Read how we teach</TextLink></Settle>
      </section>

      {/* 3 · THE PATH */}
      <section className={cn(PAD, 'relative py-24 sm:py-32')}>
        <SectionRule />
        <div className="grid gap-14 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-20">
          <div className="xl:sticky xl:top-16 xl:self-start">
            <Heading eyebrow="The path" title="Nine tracks. One kernel you keep." />
            <Settle delay={0.2}>
              <p className="mt-5 max-w-[42ch] text-[16.5px] leading-relaxed text-muted-foreground">
                Each track builds on the one before it, from the boot sector to a filesystem. Nothing you write is thrown away.
              </p>
              {info.path && info.started && (
                <p className="mt-6 font-mono text-[12px] text-muted-foreground"><CountUp value={info.coreDone} /> of {info.coreTotal} core lessons done</p>
              )}
              <TextLink to="/path" className="mt-8">See the whole path</TextLink>
            </Settle>
          </div>
          <div>
            {info.path ? <PathStepper path={info.path} next={info.next} started={info.started} /> : <StepperSkeleton />}
          </div>
        </div>
      </section>

      {/* 4 · ONE FEATURED ANIMATION */}
      {featured && (
        <section className={cn(PAD, 'relative py-24 sm:py-32')}>
          <SectionRule />
          <div className="flex flex-wrap items-end justify-between gap-6">
            <Heading eyebrow="Concept Lab" title="See the machine move." />
            <Settle delay={0.25} className="max-w-[38ch]">
              <p className="text-[15.5px] leading-relaxed text-muted-foreground">
                <CountUp value={CONCEPTS.length} /> animations like this one, from power-on to the filesystem. Each lesson opens with the one it needs.
              </p>
            </Settle>
          </div>
          <Reveal className="mt-12 max-w-[1040px]" y={90} tilt={5} blur={0} duration={1.4} amount={0.15}>
            <featured.default />
          </Reveal>
          <Settle className="mt-10"><TextLink to="/lab">Open the Concept Lab</TextLink></Settle>
        </section>
      )}

      {/* 5 · CREDIT */}
      <section className={cn(PAD, 'relative py-24 sm:py-28')}>
        <SectionRule />
        <div className="max-w-[720px]">
          <Heading title="Built on the OSDev Wiki." />
          <Settle delay={0.2}>
            <p className="mt-5 text-[16.5px] leading-relaxed text-muted-foreground">
              Every article here was written by the <a className="text-foreground underline decoration-line-strong underline-offset-4 hover:decoration-foreground" href={WIKI} target="_blank" rel="noopener">OSDev Wiki</a> community over more than twenty years and released under CC0. We did not rewrite it. We put it in order, drew the animations and added goals and checkpoints around it.
            </p>
            <TextLink to="/credits" className="mt-8">Credits and licence</TextLink>
          </Settle>
        </div>
      </section>
    </div>
  )
}

function Hero({ ready, info }: { ready: boolean; info: ReturnType<typeof useNextLesson> }) {
  const reduce = useReducedMotion()
  const { next, started, coreTotal, coreDone, path } = info
  const pre = usePrereqProgress()
  const answers = useAnswers()
  // "I know this" for every module: the line has nothing to offer
  const knowsAll = !!pre.path?.prereq && pre.path.prereq.modules.every((m) => answers[m.id] === 'know')

  return (
    <section id="begin" className="fall relative isolate scroll-mt-14 lg:scroll-mt-0 flex min-h-[calc(100svh-56px)] flex-col overflow-hidden lg:min-h-svh">
      {/* faint grid floor: the deepest layer, it drifts slowest. The still outer layer fades it out before the hero's
          bottom edge, so the drifting grid never ends in a hard line against the next section. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_55%,transparent_94%)]">
        <Parallax speed={0.3} className="absolute inset-x-0 -top-[12%] -bottom-[12%]">
          <motion.div className="absolute inset-0 opacity-[.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_70%_60%,black,transparent_70%)]"
            initial={{ opacity: 0 }} animate={ready ? { opacity: 0.07 } : {}} transition={{ duration: 2.4 }} />
        </Parallax>
      </div>

      <div className={cn(PAD, 'grid flex-1 content-center gap-x-10 pt-16 pb-10 lg:pt-20 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]')}>
        <h1 className="relative z-10 text-[clamp(46px,7.4vw,116px)] leading-[.94] font-semibold tracking-[-.045em] text-white xl:col-span-2">
          <RevealText as="span" className="block" by="word" delay={0.1} stagger={0.1} duration={1.4} blur={8}>Build your own</RevealText>{' '}
          <RevealText as="span" className="block" by="word" delay={0.38} stagger={0.1} duration={1.4} blur={8}>operating system.</RevealText>
        </h1>
        <div className="relative z-10 max-w-[620px]">
          <Reveal delay={0.7} y={28} scale={1} blur={4}>
            <p className="mt-6 text-[clamp(17px,1.45vw,20px)] leading-relaxed text-white/75 xl:mt-8">
              {coreTotal || 75} core lessons take you from the first instruction a PC runs to a kernel with memory, tasks, files and a shell of your own, all from the OSDev Wiki.
            </p>
          </Reveal>
          <Reveal delay={0.88} y={40} blur={4} className="mt-10 flex flex-col items-start gap-5">
            {path ? (
              <Magnetic className="max-w-full">
                <Link to={next ? `/learn/${next.id}` : '/path'}
                  className="group inline-flex max-w-full items-center gap-6 bg-white py-4 pr-5 pl-6 text-black transition-[gap,opacity] duration-500 hover:gap-8 sm:pr-6">
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] tracking-[.08em] text-black/60 uppercase">
                      {next ? `${started ? 'Continue' : 'Start'} · ${next.code}` : 'All lessons done'}
                    </span>
                    <span className="mt-0.5 block text-[17px] leading-snug font-medium">{next ? next.title : 'Review the path'}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0" />
                </Link>
              </Magnetic>
            ) : (
              <span className="block h-[74px] w-[min(420px,100%)] bg-white/10" aria-hidden />
            )}
            {/* for newcomers only: once the core path is under way it is noise */}
            {path && coreDone === 0 && pre.total > 0 && !knowsAll && (
              <Link to="/basics" className="group inline-flex max-w-full items-baseline gap-2 text-[15px] leading-snug text-white/85 transition-colors hover:text-white">
                <span className="underline decoration-white/30 underline-offset-4 group-hover:decoration-white">
                  {pre.done > 0 ? `Continue the prerequisites (${pre.done} of ${pre.total} done)` : 'New to C, assembly or the command line? Start with the prerequisites'}
                </span>
                <ArrowRight className="size-4 shrink-0 translate-y-[3px] transition-transform group-hover:translate-x-1" />
              </Link>
            )}
            <Link to="/library" className="text-[14.5px] text-white/65 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white">
              or browse the library
            </Link>
            <button type="button" onClick={() => onboarding.replay()} className="cursor-pointer font-mono text-[11px] tracking-[.12em] text-white/45 uppercase transition-colors hover:text-white">
              Replay the journey
            </button>
          </Reveal>
        </div>
        {/* one art piece: beside the copy from 1280px, a quiet backdrop (no labels) below that */}
        <div className="pointer-events-none absolute right-[-30%] bottom-[-3%] w-[min(112vw,520px)] opacity-45 max-xl:[mask-image:linear-gradient(to_bottom,black_50%,transparent_92%)] sm:right-[-22%] sm:bottom-[-6%] sm:w-[min(70vw,540px)] sm:opacity-40 lg:right-[-16%] lg:bottom-[-8%] lg:w-[60%] xl:pointer-events-auto xl:relative xl:right-auto xl:bottom-auto xl:mt-6 xl:w-full xl:max-w-[540px] xl:justify-self-end xl:opacity-100">
          <Parallax speed={0.16}>
            <HeroArt play={ready} labelClass="max-xl:hidden" />
          </Parallax>
        </div>
      </div>

      {/* a button, not an anchor: under the hash router "#how" would be read as a route */}
      <motion.button type="button" onClick={() => scrollToId('how')}
        initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 1.6, duration: 1 }}
        className={cn(PAD, 'group flex w-fit cursor-pointer items-center gap-3 pb-8 font-mono text-[11px] tracking-[.12em] text-white/50 uppercase transition-colors hover:text-white')}>
        <motion.span animate={reduce ? {} : { y: [0, 4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}><ArrowDown className="size-3.5" /></motion.span>
        How it works
      </motion.button>
    </section>
  )
}

function Heading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div>
      {eyebrow && <Reveal className="eyebrow mb-4" y={14} scale={1} blur={0} duration={0.9}>{eyebrow}</Reveal>}
      <RevealText as="h2" delay={0.08} className="max-w-[16ch] text-[clamp(32px,4.2vw,58px)] leading-[1.02] font-semibold tracking-[-.035em] text-balance">{title}</RevealText>
    </div>
  )
}

/** Supporting copy and links under a heading: a short, quiet settle (no scale, no tilt). */
function Settle({ children, className, delay = 0.12 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return <Reveal className={className} delay={delay} y={26} scale={1} blur={3} amount={0.4}>{children}</Reveal>
}

/** The hairline between sections, drawn across as the section arrives. */
function SectionRule() {
  return <DrawLine className="absolute inset-x-0 top-0" amount={0} />
}

function TextLink({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('group inline-flex items-center gap-2 text-[15px] font-medium', className)}>
      <span className="underline decoration-line-strong underline-offset-[6px] transition-colors group-hover:decoration-foreground">{children}</span>
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

function StepperSkeleton() {
  return (
    <div aria-hidden className="space-y-7">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="flex items-center gap-6">
          <span className="size-8 bg-soft" />
          <span className="h-5 bg-soft" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
        </div>
      ))}
    </div>
  )
}
