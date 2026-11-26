/* Step 4: one card, one decision. "Finished? Mark this lesson done and go to the next one." */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'
import type { PathLesson } from '@/lib/data'
import { actions } from '@/lib/progress'
import { Level, Minutes } from './bits'
import { Magnetic, Reveal, RevealText } from '@/components/motion'
import { StepBox, type Step } from './steps'
import { sfx } from '@/lib/sfx'

export function DoneCard({ step, lesson, isDone, next }: { step: Step; lesson: PathLesson; isDone: boolean; next?: PathLesson }) {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [leaving, setLeaving] = useState(false)
  // what the left column says while the card acknowledges and leaves: it keeps the words it had at the click, so
  // the headline does not start rising again under the ring in the 650 ms before the next lesson opens
  const [frozen, setFrozen] = useState<boolean | null>(null)
  const shownDone = frozen ?? isDone
  const timer = useRef<number>(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const finish = () => {
    if (leaving) return
    if (!isDone) {
      actions.toggleDone(lesson.id)
      sfx.done()
    }
    if (!next) return
    if (reduce || isDone) return navigate(`/learn/${next.id}`)
    // a short acknowledgement (the ring, the tick), then move on
    setFrozen(isDone)
    setLeaving(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => navigate(`/learn/${next.id}`), 650)
  }

  const label = !next
    ? isDone ? 'Lesson done' : 'Mark this lesson done'
    : isDone ? `Continue to ${next.code}` : 'Mark done and continue'

  return (
    <Reveal y={80} tilt={6} blur={0} duration={1.35} amount={0.3} className="relative max-w-[920px] overflow-hidden border border-foreground">
      <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* left: the question */}
        <div className="p-6 sm:p-9">
          <div className="flex items-center gap-3">
            <StepBox n={step.n} state={isDone ? 'done' : 'past'} />
            <span className="eyebrow">Step {step.n} · Done</span>
          </div>
          <h2 className="mt-6">
            <RevealText as="span" by="word" delay={0.35} stagger={0.09} duration={1.3} amount={0.6}
              className="block text-[clamp(40px,5.4vw,68px)] leading-[.95] font-semibold tracking-[-.04em]">{shownDone ? 'Lesson done.' : 'Finished?'}</RevealText>
            <span className="mt-4 block max-w-[24ch] text-[clamp(19px,1.9vw,23px)] leading-snug font-medium tracking-[-.015em] text-balance">
              {shownDone ? (next ? 'On to the next one.' : 'That was the last open lesson.') : 'Mark this lesson done and go to the next one.'}
            </span>
          </h2>
          <p className="mt-4 max-w-[46ch] text-[14.5px] leading-relaxed text-muted-foreground">
            {shownDone
              ? 'Your progress is saved in this browser only.'
              : 'Once the checkpoint in step 3 works. Progress is saved in this browser only.'}
          </p>
        </div>

        {/* right: where the button takes you */}
        <div className="flex flex-col justify-between gap-6 border-t border-line bg-soft p-6 sm:p-9 md:border-t-0 md:border-l">
          {next ? (
            <div>
              <div className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">
                {lesson.section === 'prereq' && next.section !== 'prereq' ? `On to the path · Lesson ${next.code}` : `Next ${next.section === 'prereq' ? 'prerequisite' : 'lesson'} · ${next.code}`}
              </div>
              <div className="mt-2 text-[20px] leading-snug font-semibold tracking-[-.015em] text-balance">{next.title}</div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-mono text-[11px] text-muted-foreground">{next.section === 'prereq' ? 'Prerequisites' : `Track ${next.trackN}`} · {next.module.title}</span>
                <Minutes m={next.minutes} />
                <Level n={next.level} />
              </div>
            </div>
          ) : (
            <div>
              <div className="font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">Next lesson</div>
              <div className="mt-2 text-[18px] leading-snug font-medium">No open lessons left. Every lesson in the path is done.</div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Magnetic className="block w-full" max={5}>
            <button
              type="button"
              onClick={finish}
              disabled={!next && isDone}
              className="group inline-flex h-12 w-full cursor-pointer items-center justify-between gap-3 bg-foreground px-5 text-[15px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-60"
            >
              <AnimatePresence mode="wait" initial={false}>
                {leaving ? (
                  <motion.span key="ok" role="status" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.18 }} className="inline-flex items-center gap-2">
                    <Check className="size-4" strokeWidth={2.5} /> Done. Opening {next?.code}
                  </motion.span>
                ) : (
                  <motion.span key="go" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.06 } }}>{label}</motion.span>
                )}
              </AnimatePresence>
              {next && <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />}
            </button>
            </Magnetic>
            {isDone && !leaving && (
              <button type="button" onClick={() => actions.toggleDone(lesson.id)}
                className="inline-flex cursor-pointer items-center gap-1.5 self-start font-mono text-[11px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
                <RotateCcw className="size-3" /> Mark as not done
              </button>
            )}
          </div>
        </div>
      </div>

      {/* one ring expands once on completion: acknowledgement, not a reward loop */}
      <AnimatePresence>
        {leaving && (
          <motion.span key="ring" aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-24 rounded-full border border-foreground"
            initial={{ scale: 0.2, opacity: 0.7, x: '-50%', y: '-50%' }} animate={{ scale: 12, opacity: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
        )}
      </AnimatePresence>
    </Reveal>
  )
}
