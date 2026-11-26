/* Deadlock: two tasks, two locks, opposite order -> a cycle in the wait-for graph.
   Fix: a global lock order (rank A = 1, B = 2, always lock in increasing rank), so the cycle cannot form. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'deadlock',
  title: 'Deadlock and lock ordering',
  summary: 'Two tasks take locks A and B in opposite order, the wait-for graph closes into a cycle and both wait forever; a global lock order prevents it.',
  lessons: ['t7m3l2'],
  articles: ['Deadlock'],
  group: 'Tasks',
  order: 735,
}

const steps: VizStep[] = [
  { caption: 'Two tasks share two locks, A and B. Each one needs both to do its work.', detail: 'Task 1 locks A then B. Task 2 locks B then A. Solid arrow = lock is held by a task. Dashed arrow = task is waiting for a lock.' },
  { caption: 'Task 1 takes lock A. At the same time task 2, on another CPU, takes lock B.', detail: 'Each lock was free, so each request succeeds at once. A lock is exclusive: it has at most one owner.' },
  { caption: 'Task 1 now asks for B. B is held by task 2, so task 1 waits.', detail: 'Task 1 keeps holding A while it waits. This is called hold and wait.' },
  { caption: 'Task 2 asks for A. A is held by task 1, so task 2 waits too.', detail: 'Task 2 keeps holding B, and nothing can take a lock away from its owner (no preemption). Each task holds what the other needs.' },
  { caption: 'The arrows form a cycle: 1 → B → 2 → A → 1. Nobody can move: deadlock.', detail: 'Exclusive locks, hold and wait, no preemption and a circular wait all hold. The wiki adds a fifth: a waiting task never gives up.', ms: 4600 },
  { caption: 'Fix: give every lock a rank and always take locks in increasing rank.', detail: 'A = 1, B = 2. Task 2 is rewritten to lock A first. If locks are only taken in increasing order, no waiting cycle can exist.', ms: 4000 },
  { caption: 'Task 1 takes A. Task 2 also starts with A, so it waits while holding nothing.', detail: 'Waiting is fine. The problem was waiting while holding a lock someone else needs.' },
  { caption: 'Task 1 takes B as well and does its work. Nothing can block it.', detail: 'No task can hold B while waiting for A, so the arrow that closed the cycle never appears.' },
  { caption: 'Task 1 unlocks B and A. Task 2 gets A, then B, and runs. No cycle, no deadlock.', detail: 'Lock ordering is the most common deadlock rule in kernels: document the order and check it in debug builds.', ms: 4200 },
]

type Line = 'lockA' | 'lockB' | 'work' | 'unlockA' | 'unlockB'
const TEXT: Record<Line, string> = { lockA: 'lock(A);', lockB: 'lock(B);', work: 'work();', unlockA: 'unlock(A);', unlockB: 'unlock(B);' }
const ORDER_GOOD: Line[] = ['lockA', 'lockB', 'work', 'unlockB', 'unlockA']
const ORDER_BAD: Line[] = ['lockB', 'lockA', 'work', 'unlockA', 'unlockB']

/** A dashed arrow whose dashes march along it: a task that keeps asking for a lock. */
function WaitWire({ d, on }: { d: string; on: boolean }) {
  return (
    <motion.path d={d} fill="none" stroke="var(--viz-fg)" strokeWidth={1.6} strokeDasharray="6 5" markerEnd="url(#viz-arrow)"
      initial={false} animate={{ opacity: on ? 1 : 0, strokeDashoffset: on ? [0, -22] : 0 }}
      transition={{ opacity: ease, strokeDashoffset: { duration: 0.8, repeat: Infinity, ease: 'linear' } }} />
  )
}

/** A lock token sliding from its lock to the task that now owns it (fades out on arrival, then repeats). */
function Token({ from, to, on, label, delay = 0 }: { from: [number, number]; to: [number, number]; on: boolean; label: string; delay?: number }) {
  if (!on) return null
  const mx = from[0] + (to[0] - from[0]) * 0.15
  const my = from[1] + (to[1] - from[1]) * 0.15
  return (
    <motion.g initial={{ x: from[0], y: from[1], opacity: 0 }}
      animate={{ x: [from[0], mx, to[0], to[0]], y: [from[1], my, to[1], to[1]], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.5, times: [0, 0.15, 0.8, 1], delay, repeat: Infinity, repeatDelay: 0.9, ease: 'easeInOut' }}>
      <circle r={5} fill="var(--viz-fg)" filter="url(#viz-glow)" />
      <text x={10} y={4} fill="var(--viz-fg)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{label}</text>
    </motion.g>
  )
}

function Code({ x, title, order, onSet, dimAll }: { x: number; title: string; order: Line[]; onSet: Line[]; dimAll: boolean }) {
  return (
    <g>
      <Label x={x} y={38} size={11} dim>{title}</Label>
      {(Object.keys(TEXT) as Line[]).map((k) => {
        const i = order.indexOf(k)
        return (
          <motion.g key={k} initial={false} animate={{ y: i * 30 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
            <Block x={x} y={52} w={190} h={30} label={TEXT[k]} mono size={12} align="start" state={onSet.includes(k) ? 'on' : dimAll ? 'dim' : 'off'} />
          </motion.g>
        )
      })}
    </g>
  )
}

function Status({ x, text, on }: { x: number; text: string; on: boolean }) {
  return (
    <g>
      <Block x={x} y={214} w={190} h={34} state={on ? 'on' : 'off'} />
      <motion.g key={text} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
        <text x={x + 12} y={236} fill="var(--viz-fg)" style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>{text}</text>
      </motion.g>
    </g>
  )
}

const P = {
  holdA1: 'M350 80 C 318 84, 300 108, 300 146',
  waitB1: 'M300 204 C 300 242, 318 270, 346 275',
  holdB1: 'M350 277 C 318 272, 300 244, 300 208',
  holdB2: 'M450 277 C 482 272, 500 244, 500 208',
  waitA2: 'M500 146 C 500 108, 482 84, 454 79',
  holdA2: 'M450 80 C 482 84, 500 108, 500 146',
}

export default function Deadlock() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const fixed = s >= 5
        const t1On: Line[][] = [[], ['lockA'], ['lockB'], ['lockB'], ['lockB'], [], ['lockA'], ['lockB', 'work'], ['unlockB', 'unlockA']]
        const t2On: Line[][] = [[], ['lockB'], [], ['lockA'], ['lockA'], [], ['lockA'], ['lockA'], ['lockA', 'lockB', 'work']]
        const t1Status = ['ready', 'holds A', 'holds A, waits for B', 'holds A, waits for B', 'stuck forever', 'ready', 'holds A', 'holds A + B, working', 'done'][s]
        const t2Status = ['ready', 'holds B', 'holds B', 'holds B, waits for A', 'stuck forever', 'ready', 'waits for A, holds none', 'waits for A', 'holds A + B, working'][s]

        return (
          <Scene label={meta.summary}>
            <Code x={24} title="TASK 1 CODE" order={ORDER_GOOD} onSet={t1On[s]} dimAll={s === 4} />
            <Code x={586} title={fixed ? 'TASK 2 CODE (FIXED ORDER)' : 'TASK 2 CODE'} order={fixed ? ORDER_GOOD : ORDER_BAD} onSet={t2On[s]} dimAll={s === 4} />
            <Status x={24} text={t1Status} on={s === 4} />
            <Status x={586} text={t2Status} on={s === 4} />

            {/* wait-for graph */}
            <Label x={400} y={38} size={11} dim anchor="middle">WHO HOLDS / WHO WAITS</Label>
            <Block x={350} y={52} w={100} h={54} label="LOCK A" sub={fixed ? 'rank 1' : undefined} mono size={13}
              state={[1, 3, 4, 6].includes(s) ? 'on' : 'off'} />
            <Block x={350} y={250} w={100} h={54} label="LOCK B" sub={fixed ? 'rank 2' : undefined} mono size={13}
              state={[1, 2, 4, 7].includes(s) ? 'on' : 'off'} />
            <Block x={250} y={150} w={100} h={54} label="TASK 1" size={13} state={s === 8 ? 'dim' : [1, 2, 4, 6, 7].includes(s) ? 'on' : 'off'} sub={s === 8 ? 'done' : undefined} />
            <Block x={450} y={150} w={100} h={54} label="TASK 2" size={13} state={[1, 3, 4, 8].includes(s) ? 'on' : 'off'} />

            <Wire d={P.holdA1} on={[1, 2, 3, 4, 6, 7].includes(s)} />
            <Wire d={P.holdB2} on={[1, 2, 3, 4, 8].includes(s)} />
            <Wire d={P.holdB1} on={s === 7} />
            <Wire d={P.holdA2} on={s === 8} />
            <WaitWire d={P.waitB1} on={[2, 3, 4].includes(s)} />
            <WaitWire d={P.waitA2} on={[3, 4, 6, 7].includes(s)} />

            {/* a lock travelling to its new owner */}
            <Token on={s === 1 || s === 6} from={[340, 82]} to={[302, 142]} label="A" />
            <Token on={s === 1} from={[450, 277]} to={[500, 212]} label="B" />
            <Token on={s === 7} from={[350, 277]} to={[300, 212]} label="B" />
            <Token on={s === 8} from={[450, 80]} to={[500, 142]} label="A" />
            <Token on={s === 8} from={[450, 277]} to={[500, 212]} label="B" delay={0.5} />

            {/* the cycle */}
            <Packet on={s === 4} points={[[300, 204], [346, 275], [450, 277], [500, 204], [500, 146], [454, 79], [350, 80], [300, 146], [300, 204]]} duration={3.2} />
            <Pulse x={300} y={177} on={s === 4} r={30} />
            <Pulse x={500} y={177} on={s === 4} r={30} />
            <Label x={400} y={182} size={12} anchor="middle" weight={500} on={s === 4}>CYCLE</Label>
            <Label x={400} y={182} size={11} anchor="middle" dim on={s >= 6 && s <= 7}>no cycle</Label>

            {/* legend */}
            <line x1={24} x2={64} y1={300} y2={300} stroke="var(--viz-fg)" strokeWidth={1.6} markerEnd="url(#viz-arrow)" />
            <Label x={74} y={304} size={11} dim>lock is held by task</Label>
            <line x1={586} x2={626} y1={300} y2={300} stroke="var(--viz-fg)" strokeWidth={1.6} strokeDasharray="6 5" markerEnd="url(#viz-arrow)" />
            <Label x={636} y={304} size={11} dim>task waits for lock</Label>

            {/* the four conditions, lighting up as they become true */}
            <Appear on={s <= 4}>
              {['exclusive locks', 'hold and wait', 'no preemption', 'circular wait'].map((c, i) => {
                const met = s >= [1, 2, 3, 4][i]
                return <Block key={c} x={24 + i * 190} y={320} w={182} h={34} label={met ? c + ' ✓' : c} mono size={11.5} state={met ? (s === [1, 2, 3, 4][i] || s === 4 ? 'on' : 'off') : 'dim'} />
              })}
            </Appear>

            {/* verdict */}
            <Appear on={s === 4}>
              <Block x={150} y={368} w={500} h={58} state="on" />
              <Label x={400} y={392} size={14} anchor="middle" weight={500}>DEADLOCK: 1 → B → 2 → A → 1</Label>
              <Label x={400} y={414} size={11} anchor="middle" dim>each waits for something only the other can release</Label>
            </Appear>
            <Appear on={s >= 5}>
              <Block x={150} y={340} w={500} h={70} state={s === 5 ? 'on' : 'off'} />
              <Label x={400} y={368} size={14} anchor="middle" weight={500}>RULE: always lock A (1) before B (2)</Label>
              <Label x={400} y={392} size={11} anchor="middle" dim>{s === 8 ? 'task 2 waited, then ran: everyone finishes' : 'increasing rank only, so no arrow can point back'}</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
