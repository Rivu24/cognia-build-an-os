/* Preemptive round robin with task states, blocking, sleeping and an idle task, following Brendan's
   Multi-tasking Tutorial (steps 4, 6, 7, 10, 11) and the Round Robin section of "Scheduling Algorithms".
   PIT at 1000 Hz (1 ms per tick), 50 ms time slices; the times are one consistent worked example. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'scheduler-round-robin',
  title: 'Round robin scheduler: states, slices, idle',
  summary: 'Tasks move between running, ready, blocked and sleeping: the PIT drains the time slice, the head of the ready queue runs next, blocked tasks leave the queue, and the idle task runs HLT when nothing is ready.',
  lessons: ['t7m1l3', 't7m2l3'],
  articles: ["Brendan's Multi-tasking Tutorial", 'Scheduling Algorithms'],
  group: 'Tasks',
  order: 730,
}

const steps: VizStep[] = [
  { caption: 'A runs. B and C are ready, waiting in the queue.', detail: 'Four states: running (on the CPU), ready (in the queue), blocked (waiting for an event) and sleeping (waiting for a time).' },
  { caption: 'Each PIT tick takes 1 ms off A’s 50 ms time slice.', detail: 'The PIT fires IRQ 0 at 1000 Hz. While more than one tick is left, the handler subtracts the tick length from time_slice_remaining.', ms: 3800 },
  { caption: 'Slice used up: A goes to the back of the queue, B (the head) runs.', detail: 'Round robin: one queue, equal slices, tasks take turns in queue order. B starts with a fresh 50 ms.' },
  { caption: 'B reads from disk and blocks. It leaves the CPU and is not queued.', detail: 'block_task() sets B’s state and calls schedule(). A blocked task costs no CPU time. C, now at the head, runs.' },
  { caption: 'C sleeps until t = 75 ms. A, next in the queue, runs.', detail: 'C goes on the sleeping list with its wake-up time. The PIT handler checks that list on every tick.' },
  { caption: 'A waits for a key. Nothing is ready, so the idle task runs HLT.', detail: 'Idle never blocks and stays on the ready list; schedule() skips it while other tasks are ready. HLT waits for the next IRQ. No time slice.' },
  { caption: 'The disk IRQ unblocks B. It preempts the idle task at once.', detail: 'unblock_task() switches straight to the woken task when idle is running. Idle goes back on the ready list (drawn in its own box).' },
  { caption: 'At t = 75 ms the PIT wakes C. B is running, so C joins the ready queue.', detail: 'unblock_task() preempts only the idle task, or when nothing else is ready. C runs when B’s slice ends.', ms: 4000 },
]

type P = [number, number]
const CPU: P = [400, 92]
const Q: P[] = [[320, 229], [400, 229], [480, 229]]
const BL: P[] = [[80, 352], [150, 352]]
const SL: P = [610, 352]
const IDLE: P = [80, 95]

type St = 'running' | 'ready' | 'blocked' | 'sleeping'
const TASKS: { id: string; pos: P[]; st: St[] }[] = [
  { id: 'A', pos: [CPU, CPU, Q[1], Q[0], CPU, BL[1], BL[1], BL[1]], st: ['running', 'running', 'ready', 'ready', 'running', 'blocked', 'blocked', 'blocked'] },
  { id: 'B', pos: [Q[0], Q[0], CPU, BL[0], BL[0], BL[0], CPU, CPU], st: ['ready', 'ready', 'running', 'blocked', 'blocked', 'blocked', 'running', 'running'] },
  { id: 'C', pos: [Q[1], Q[1], Q[0], CPU, SL, SL, SL, Q[0]], st: ['ready', 'ready', 'ready', 'running', 'sleeping', 'sleeping', 'sleeping', 'ready'] },
  { id: 'idle', pos: [IDLE, IDLE, IDLE, IDLE, IDLE, CPU, IDLE, IDLE], st: ['ready', 'ready', 'ready', 'ready', 'ready', 'running', 'ready', 'ready'] },
]

const TIME = [0, 49, 50, 62, 65, 69, 72, 75]
const SLICE = [50, 1, 50, 50, 50, 0, 50, 47] // ms left at the end of each step
const SLICE_TXT = ['slice: 50 ms', 'slice: −1 ms per tick', 'B: fresh 50 ms slice', 'C: fresh 50 ms slice', 'A: fresh 50 ms slice', 'idle: no time slice', 'B: fresh 50 ms slice', 'B: 47 ms left']
const CODE = [
  'first_ready_to_run_task → B → C',
  'if (time_slice_remaining <= time_between_ticks) schedule(); else time_slice_remaining -= …;',
  'schedule():  task = first_ready_to_run_task;  first_ready_to_run_task = task->next;',
  'block_task(reason);    // state = reason, then schedule()',
  'nano_sleep_until(75 ms);    // C joins sleeping_task_list',
  'kernel_idle_task:  for (;;) HLT();    // time_slice_remaining = 0',
  'unblock_task(B):  current_task_TCB == idle_task  →  switch_to_task(B)',
  'if (this_task->sleep_expiry <= time_since_boot) unblock_task(this_task);',
]

function Token({ id, p, st }: { id: string; p: P; st: St }) {
  const running = st === 'running'
  const waiting = st === 'blocked' || st === 'sleeping'
  return (
    <motion.g initial={false} animate={{ x: p[0], y: p[1], opacity: waiting ? 0.6 : 1 }} transition={{ type: 'spring', stiffness: 70, damping: 15 }}>
      <motion.rect x={-30} y={-23} width={60} height={46} initial={false}
        animate={{ fill: running ? 'var(--viz-fg)' : 'var(--viz-bg)', stroke: waiting ? 'var(--viz-dim)' : 'var(--viz-fg)', strokeWidth: running ? 2 : 1 }}
        transition={{ duration: 0.5 }} filter={running ? 'url(#viz-glow)' : undefined} strokeDasharray={waiting ? '4 3' : undefined} />
      <motion.text y={id === 'idle' ? 0 : 2} textAnchor="middle" initial={false} animate={{ fill: running ? 'var(--viz-bg)' : 'var(--viz-fg)' }}
        style={{ fontSize: id === 'idle' ? 13 : 17, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>{id}</motion.text>
      <motion.text y={17} textAnchor="middle" initial={false} animate={{ fill: running ? 'var(--viz-bg)' : 'var(--viz-dim)' }}
        style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{st}</motion.text>
    </motion.g>
  )
}

export default function SchedulerRoundRobin() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => (
        <Scene label={meta.summary}>
          {/* idle task */}
          <Block x={30} y={40} w={200} h={100} state={s === 5 ? 'on' : 'off'} />
          <Label x={40} y={56} size={10.5} dim>IDLE TASK (never blocks)</Label>
          <Label x={124} y={92} size={11}>for (;;)</Label>
          <Label x={136} y={108} size={11}>HLT();</Label>

          {/* CPU */}
          <Block x={300} y={40} w={200} h={100} state="off" />
          <Label x={310} y={56} size={10.5} dim>CPU · RUNNING</Label>
          <rect x={320} y={124} width={160} height={8} fill="none" stroke="var(--viz-faint)" />
          <motion.rect x={320} y={124} height={8} initial={false} fill="var(--viz-fg)"
            animate={{ width: (SLICE[s] / 50) * 160 }}
            transition={s === 1 ? { duration: 3, ease: 'linear' } : { duration: 0.6 }} />
          {SLICE_TXT.map((t, i) => (
            <Label key={i} x={400} y={158} size={11} anchor="middle" on={s === i} weight={i === 1 || i === 5 ? 600 : 400}>{t}</Label>
          ))}

          {/* PIT */}
          <Block x={570} y={40} w={200} h={100} state={s === 1 || s === 2 || s === 7 ? 'on' : 'off'} />
          <Label x={580} y={56} size={10.5} dim>PIT · IRQ 0 · 1000 Hz</Label>
          <circle cx={596} cy={90} r={5} fill="var(--viz-fg)" />
          <Pulse x={596} y={90} on={s === 1 || s === 2 || s === 7} r={9} />
          <Label x={612} y={94} size={11}>tick every 1 ms</Label>
          <Label x={580} y={126} size={10.5} dim>time_since_boot</Label>
          {TIME.map((t, i) => (
            <Label key={i} x={760} y={126} size={11} anchor="end" weight={600} on={s === i}>{`${t} ms`}</Label>
          ))}
          {/* ticks flowing into the slice */}
          <Packet on={s === 1} points={[[570, 100], [480, 128]]} duration={0.5} r={3.5} />

          {/* ready queue */}
          <Label x={530} y={190} size={10.5} dim anchor="end">READY QUEUE</Label>
          <rect x={270} y={196} width={260} height={66} fill="none" stroke="var(--viz-fg)" />
          <Label x={280} y={278} size={10.5} dim>head</Label>
          <Label x={520} y={278} size={10.5} dim anchor="end">tail</Label>
          <Label x={400} y={234} size={11} dim anchor="middle" on={s === 5 || s === 6}>(empty)</Label>

          {/* blocked + sleeping */}
          <Label x={40} y={316} size={10.5} dim>BLOCKED (waiting for an event)</Label>
          <rect x={30} y={300} width={230} height={100} fill="none" stroke="var(--viz-fg)" />
          <Label x={80} y={392} size={10.5} anchor="middle" on={s >= 3 && s < 6} dim>disk</Label>
          <Label x={150} y={392} size={10.5} anchor="middle" on={s >= 5} dim>key</Label>
          <Label x={560} y={316} size={10.5} dim>SLEEPING (waiting for a time)</Label>
          <rect x={550} y={300} width={220} height={100} fill="none" stroke="var(--viz-fg)" />
          <Label x={650} y={348} size={11} on={s >= 4 && s < 7}>wake at</Label>
          <Label x={650} y={364} size={11} on={s >= 4 && s < 7} weight={600}>t ≥ 75 ms</Label>

          {/* flows */}
          <Wire from={[305, 194]} to={[305, 143]} on={s >= 2 && s <= 4} />
          <Wire d="M500 92 C 552 92, 552 229, 533 229" on={s === 2} />
          <Wire d="M300 125 C 250 150, 220 230, 200 297" on={s === 3 || s === 5} dashed />
          <Wire d="M500 125 C 550 150, 580 230, 600 297" on={s === 4} dashed />
          <Wire from={[230, 92]} to={[298, 92]} on={s === 5} dashed />
          <Wire d="M160 299 C 180 220, 250 150, 298 128" on={s === 6} />
          <Wire d="M600 297 C 590 270, 560 245, 533 240" on={s === 7} />

          {/* tasks */}
          {TASKS.map((t) => <Token key={t.id} id={t.id} p={t.pos[s]} st={t.st[s]} />)}

          {/* the code doing it */}
          {CODE.map((c, i) => (
            <motion.text key={i} x={30} y={428} initial={false} animate={{ opacity: s === i ? 1 : 0 }} transition={{ duration: 0.5 }}
              fill="var(--viz-fg)" style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontVariantLigatures: 'none' }}>{c}</motion.text>
          ))}
        </Scene>
      )}
    </VizStage>
  )
}
