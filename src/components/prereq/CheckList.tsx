/* The self-check: each module's "can you..." list and three plain answers. The plan beside it follows the answers. */
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'
import type { PathLesson } from '@/lib/data'
import { Reveal } from '@/components/motion'
import { cn, mins } from '@/lib/utils'
import { ANSWERS, andList, clearAnswers, setAnswer, statement, type Answers, type Plan, type PrereqModule } from './selfcheck'

export function SelfCheckList({ mods, answers }: { mods: PrereqModule[]; answers: Answers }) {
  return (
    <ol className="border-t border-line">
      {mods.map((m) => (
        <CheckRow key={m.id} m={m} answer={answers[m.id]} />
      ))}
    </ol>
  )
}

function CheckRow({ m, answer }: { m: PrereqModule; answer?: Answers[string] }) {
  const name = `selfcheck-${m.id}`
  return (
    <Reveal as="li" y={44} scale={0.985} blur={3} amount={0.15}
      className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-4 border-b border-line pt-6 pb-4 sm:grid-cols-[44px_minmax(0,1fr)] sm:gap-x-5">
      <span className={cn('flex size-9 items-center justify-center border font-mono text-[12px] transition-colors sm:size-11',
        answer === 'know' ? 'border-foreground bg-foreground text-background' : answer ? 'border-foreground text-foreground' : 'border-line-strong text-muted-foreground')}>
        {answer === 'know' ? <Check className="size-4" strokeWidth={2.5} /> : String(m.n).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <h3 id={`${name}-title`} className="text-[17px] leading-snug font-semibold tracking-[-.01em] sm:text-[19px]">{m.title}</h3>
        <div className="mt-3 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase">Can you</div>
        <ul className="mt-2 space-y-1.5 text-[14.5px] leading-relaxed text-foreground/90">
          {m.lessons.map((l) => (
            <li key={l.id} className="flex gap-3">
              <span className="mt-[11px] h-px w-3 shrink-0 bg-line-strong" />
              <span>{statement(l.objectives[0] ?? l.title)}</span>
            </li>
          ))}
        </ul>
        <div role="radiogroup" aria-labelledby={`${name}-title`} className="mt-5 grid max-w-[480px] grid-cols-3 border border-line-strong">
          {ANSWERS.map((a, i) => (
            <label key={a.id} className={cn('relative cursor-pointer', i > 0 && 'border-l border-line-strong')}>
              <input type="radio" name={name} value={a.id} checked={answer === a.id} onChange={() => setAnswer(m.id, a.id)}
                className="peer absolute inset-0 cursor-pointer opacity-0" />
              <span className="flex h-10 items-center justify-center gap-1.5 px-2 text-center text-[13px] leading-tight text-muted-foreground transition-colors peer-checked:bg-foreground peer-checked:font-medium peer-checked:text-background peer-hover:text-foreground peer-checked:peer-hover:text-background peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-4 peer-focus-visible:outline-current sm:text-[13.5px]">
                {a.label}
              </span>
            </label>
          ))}
        </div>
        {/* what the answer did, right where it was given (on a phone the plan card is far below) */}
        <p className="mt-2 min-h-[18px] font-mono text-[11px] leading-[18px] text-muted-foreground">
          {answer === 'know' ? 'Left out of your plan' : answer ? `Added to your plan · ${m.lessons.length} lessons · ${mins(m.minutes)}` : ''}
        </p>
      </div>
    </Reveal>
  )
}

/** The plan, worked out from the answers so far. */
export function PlanCard({ plan, total, coreNext }: { plan: Plan; total: number; coreNext?: PathLesson }) {
  const left = total - plan.marked
  const nums = andList(plan.modules.map((m) => m.n))
  const none = plan.marked === 0
  const ready = !none && plan.modules.length === 0
  const planDone = plan.modules.length > 0 && !plan.first

  let head: string
  let body: string
  if (none) {
    head = 'Your plan appears here.'
    body = `Mark each of the ${total} modules. Anything you are not sure of goes into your plan.`
  } else if (ready) {
    head = left ? 'Nothing in your plan yet.' : 'You can skip this section.'
    body = left ? `${left} module${left > 1 ? 's' : ''} still to mark.` : 'You know every module. Go straight to the first lesson of the path.'
  } else if (planDone) {
    head = `Your plan: module${plan.modules.length > 1 ? 's' : ''} ${nums}. Done.`
    body = 'Every lesson in your plan is done. The path is next.'
  } else {
    head = `Your plan: module${plan.modules.length > 1 ? 's' : ''} ${nums}, about ${mins(plan.minutes)}.`
    body = `${plan.open.length} lesson${plan.open.length > 1 ? 's' : ''} to read${left ? `. ${left} module${left > 1 ? 's' : ''} still to mark` : ''}.`
  }
  const go = plan.first ?? ((ready && !left) || planDone ? coreNext : undefined)

  return (
    <div className="border border-foreground" aria-live="polite">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[.1em] text-muted-foreground uppercase"><span className="dot size-1.5 text-foreground" /> Your plan</span>
        <span className="font-mono text-[10.5px] text-muted-foreground">{plan.marked} / {total} marked</span>
      </div>
      <div className="px-5 pt-5 pb-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={head} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            <p className="text-[19px] leading-snug font-semibold tracking-[-.015em] text-balance">{head}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
          </motion.div>
        </AnimatePresence>

        {plan.modules.length > 0 && (
          <ul className="mt-4 border-t border-line">
            {plan.modules.map((m) => {
              const open = m.lessons.filter((l) => plan.open.includes(l)).length
              return (
                <li key={m.id} className="flex items-baseline gap-3 border-b border-line py-2 text-[13.5px]">
                  <span className="w-5 shrink-0 font-mono text-[11px] text-faint">{String(m.n).padStart(2, '0')}</span>
                  <span className={cn('min-w-0 flex-1', !open && 'text-muted-foreground line-through decoration-line-strong')}>{m.title}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">{open ? `${open} left` : 'done'}</span>
                </li>
              )
            })}
          </ul>
        )}

        {go && (
          <Link to={`/learn/${go.id}`}
            className="group mt-5 flex min-h-11 items-center justify-between gap-3 border border-foreground px-4 py-2 text-[14px] font-medium transition-colors hover:bg-foreground hover:text-background">
            <span className="min-w-0">
              <span className="block font-mono text-[10.5px] tracking-[.06em] opacity-70">{go.section === 'prereq' ? `First lesson of your plan · ${go.code}` : `Lesson ${go.code}`}</span>
              <span className="block truncate">{go.title}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        {plan.marked > 0 && (
          <button type="button" onClick={clearAnswers}
            className="mt-4 inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
            <RotateCcw className="size-3" /> Clear my answers
          </button>
        )}
      </div>
    </div>
  )
}
