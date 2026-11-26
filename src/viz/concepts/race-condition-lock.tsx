/* Race condition on counter++ and the spinlock that fixes it.
   Two tasks share `counter`. counter++ is three instructions (load, add, store), so an interrupt or a second
   CPU can slip in between them and one update is lost. A spinlock built on the atomic `xchg` fixes it. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'race-condition-lock',
  title: 'Race condition and the spinlock',
  summary: 'Two tasks run counter++ at the same time and lose an update; a spinlock built on atomic xchg makes the load-add-store run one task at a time.',
  lessons: ['t7m2l1', 't7m3l1'],
  articles: ['Synchronization Primitives', 'Spinlock', 'Atomic operation'],
  group: 'Tasks',
  order: 720,
}

const steps: VizStep[] = [
  { caption: 'Two tasks both run counter++ on a shared counter that holds 5.', detail: 'In machine code counter++ is three steps: load the value into a register, add 1, store it back.' },
  { caption: 'Task A loads the counter: eax = 5.', detail: 'The value is now a private copy in task A’s register. Memory still says 5.' },
  { caption: 'A timer interrupt switches to task B. B also loads 5.', detail: 'A was stopped between its load and its store. On a multi-core machine B could do this at the same moment on another CPU.' },
  { caption: 'Each task adds 1 to its own copy: both registers hold 6.', detail: 'Neither task knows the other one has the same old value.' },
  { caption: 'Both store 6. Two increments ran, but the counter is 6: one update is lost.', detail: 'This is a race condition: the result depends on timing. It may only show up once in a million runs.', ms: 4200 },
  { caption: 'Replay with a spinlock: from 5, task A runs xchg to swap 1 into lock and gets back 0.', detail: 'xchg with memory is atomic on x86 (it locks the bus by itself). Old value 0 = lock was free, now A owns it. The Spinlock article does the same with lock bts.' },
  { caption: 'B tries the same xchg, gets 1 back, and spins. A does load, add, store: 5 to 6.', detail: 'Old value 1 means someone else holds the lock, so B loops (pause, test, retry) until the lock reads 0.' },
  { caption: 'A releases (mov [lock], 0). B’s next xchg wins, B adds its 1: counter = 7.', detail: 'Only one task at a time can be between acquire and release. That region is the critical section.', ms: 4200 },
  { caption: 'Other tools for the same job: cli/sti on one CPU, or a semaphore or mutex that sleeps.', detail: 'Disabling interrupts is enough on a single CPU only. A semaphore or mutex puts the waiting task in a queue instead of burning CPU time.', ms: 4600 },
]

const CODE = ['acquire(&lock)', 'mov eax, [counter]', 'add eax, 1', 'mov [counter], eax', 'release(&lock)']
const LINE_Y = (i: number) => 52 + i * 30

const RACE_CELLS = ['A: load 5', 'B: load 5', 'A: add → 6', 'B: add → 6', 'A: store 6', 'B: store 6']
const LOCK_CELLS = ['A: xchg → 0', 'B: xchg → 1, spin', 'A: 5 → 6', 'A: release', 'B: xchg → 0', 'B: 6 → 7']

/** A value that pops in whenever it changes. */
function Val({ x, y, v, size = 13, anchor = 'start', weight = 500 }: { x: number; y: number; v: string | number; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number }) {
  return (
    <motion.g key={String(v)} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill="var(--viz-fg)" style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>
        {v}
      </text>
    </motion.g>
  )
}

type LineState = 'on' | 'off' | 'dim'

function Task({ x, name, lines, eax, lockOn, eaxOn, plusOne }: { x: number; name: string; lines: LineState[]; eax: string; lockOn: boolean; eaxOn: boolean; plusOne: boolean }) {
  return (
    <g>
      <Label x={x} y={38} size={11} dim>{name}</Label>
      {CODE.map((c, i) => {
        const isLock = i === 0 || i === 4
        const el = <Block key={i} x={x} y={LINE_Y(i)} w={236} h={30} label={c} mono size={12} align="start" state={lines[i]} />
        return isLock ? <Appear key={i} on={lockOn} dx={0} dy={0}>{el}</Appear> : el
      })}
      <Block x={x} y={216} w={236} h={40} state={eaxOn ? 'on' : 'off'} />
      <Label x={x + 12} y={241} size={12} dim>eax</Label>
      <Val x={x + 224} y={242} v={eax} anchor="end" size={15} />
      <Label x={x + 150} y={241} size={12} on={plusOne}>+1 →</Label>
    </g>
  )
}

export default function RaceConditionLock() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const lockPhase = s >= 5
        const counter = [5, 5, 5, 5, 6, 5, 6, 7, 7][s]
        const aEax = ['—', '5', '5', '6', '6', '—', '6', '6', '6'][s]
        const bEax = ['—', '—', '5', '6', '6', '—', '—', '7', '7'][s]
        const lockVal = s === 5 || s === 6 ? 1 : 0
        const lockText = s === 5 || s === 6 ? 'held by A' : 'free'
        // per step: which code lines are running ('on'), idle ('off') or paused ('dim')
        const lines = (on: number[], paused = false): LineState[] => CODE.map((_, i) => (on.includes(i) ? 'on' : paused ? 'dim' : 'off'))
        const aLines = [lines([]), lines([1]), lines([], true), lines([2]), lines([3]), lines([0]), lines([1, 2, 3]), lines([4]), lines([])][s]
        const bLines = [lines([]), lines([], true), lines([1]), lines([2]), lines([3]), lines([], true), lines([0]), lines([0, 1, 2, 3, 4]), lines([])][s]

        const cells = lockPhase ? LOCK_CELLS : RACE_CELLS
        const litTo = [0, 1, 2, 4, 6, 1, 3, 6, 6][s]
        const litFrom = [0, 0, 1, 2, 4, 0, 1, 3, 6][s]

        return (
          <Scene label={meta.summary}>
            <Task x={24} name="TASK A" lines={aLines} eax={aEax} lockOn={lockPhase} eaxOn={s === 1 || s === 3 || s === 6} plusOne={s === 3} />
            <Task x={540} name="TASK B" lines={bLines} eax={bEax} lockOn={lockPhase} eaxOn={s === 2 || s === 3 || s === 7} plusOne={s === 3} />

            {/* shared memory */}
            <Label x={320} y={38} size={11} dim>SHARED MEMORY</Label>
            <Block x={320} y={52} w={160} h={82} state={s === 4 || s === 7 ? 'on' : 'off'} />
            <Label x={334} y={74} size={11} dim>counter</Label>
            <Val x={400} y={118} v={counter} anchor="middle" size={30} />
            <Pulse x={400} y={106} on={s === 4} r={26} />

            <Appear on={lockPhase}>
              <Block x={320} y={158} w={160} h={52} state={s === 5 || s === 7 ? 'on' : 'off'} />
              <Label x={334} y={180} size={11} dim>lock</Label>
              <Val x={466} y={182} v={lockVal} anchor="end" size={18} />
              <Val x={334} y={200} v={lockText} size={10.5} weight={400} />
              <Label x={400} y={232} size={10.5} anchor="middle" dim>xchg = one atomic swap:</Label>
              <Label x={400} y={248} size={10.5} anchor="middle" dim>old 0 → yours, old 1 → spin</Label>
            </Appear>

            {/* the interrupt that causes the switch */}
            <Wire d="M262 264 C 330 280, 470 280, 538 264" on={s === 2} dashed />
            <Label x={400} y={298} size={11} anchor="middle" on={s === 2}>timer IRQ: switch to task B</Label>

            {/* data movement */}
            <Packet on={s === 1} points={[[320, 93], [262, 236]]} duration={1.2} label="5" />
            <Packet on={s === 2} points={[[480, 93], [538, 236]]} duration={1.2} delay={0.4} label="5" />
            <Packet on={s === 4} points={[[262, 236], [320, 93]]} duration={1.2} label="6" />
            <Packet on={s === 4} points={[[538, 236], [480, 93]]} duration={1.2} delay={0.6} label="6" />
            <Packet on={s === 5} points={[[262, 67], [320, 184], [262, 67]]} duration={1.8} label="xchg" />
            <Packet on={s === 6} points={[[538, 67], [480, 184], [538, 67]]} duration={1} repeat label="1" />
            <Packet on={s === 6} points={[[320, 93], [262, 236], [320, 93]]} duration={2} delay={0.3} label="5 → 6" />
            <Packet on={s === 7} points={[[480, 93], [538, 236], [480, 93]]} duration={2} delay={0.3} label="6 → 7" />

            {/* timeline of who ran when */}
            <Appear on={s <= 7}>
              <Label x={24} y={330} size={11} dim>ORDER IN TIME →</Label>
              {cells.map((c, i) => (
                <Block key={(lockPhase ? 'l' : 'r') + i} x={24 + i * 125.3} y={340} w={125.3} h={34} label={c} mono size={11}
                  state={i >= litFrom && i < litTo ? 'on' : i < litFrom ? 'off' : 'dim'} />
              ))}
            </Appear>

            {/* result */}
            <Appear on={s === 4}>
              <Label x={400} y={410} size={13} anchor="middle" weight={500}>2 increments, counter = 6: LOST UPDATE</Label>
            </Appear>
            <Appear on={s === 7}>
              <Label x={400} y={410} size={13} anchor="middle" weight={500}>2 increments, counter = 7: correct</Label>
            </Appear>

            {/* the toolbox */}
            <Appear on={s === 8}>
              <Label x={24} y={298} size={11} dim>THREE WAYS TO GET MUTUAL EXCLUSION</Label>
              {[
                ['Spinlock', 'busy-wait on xchg', 'wiki: lock bts/btr; SMP-safe'],
                ['cli ... sti', 'no interrupts, no switch', 'only safe on a single CPU'],
                ['Semaphore / mutex', 'waiter sleeps in a queue', 'scheduler wakes it later'],
              ].map(([t, a, b], i) => (
                <g key={i}>
                  <Block x={24 + i * 256} y={310} w={240} h={116} state={i === 0 ? 'on' : 'off'} />
                  <Label x={38 + i * 256} y={340} size={14} mono={false} weight={500}>{t}</Label>
                  <Label x={38 + i * 256} y={390} size={11}>{a}</Label>
                  <Label x={38 + i * 256} y={410} size={11} dim>{b}</Label>
                </g>
              ))}
              {/* spinlock: a core going round and round */}
              <rect x={198} y={330} width={28} height={28} fill="none" stroke="var(--viz-faint)" />
              <Packet on={s === 8} points={[[198, 330], [226, 330], [226, 358], [198, 358], [198, 330]]} duration={1.2} r={3.5} />
              <Label x={38} y={366} size={10.5} dim>while (xchg) pause;</Label>
              {/* cli/sti: the interrupt flag goes to 0 and back */}
              <Label x={294} y={366} size={10.5} dim>IF: 1 → 0 ... 0 → 1</Label>
              {/* semaphore: tasks waiting in a queue */}
              {[0, 1, 2].map((i) => <rect key={i} x={662 + i * 20} y={350} width={14} height={14} fill="none" stroke="var(--viz-dim)" />)}
              <Packet on={s === 8} points={[[620, 357], [669, 357]]} duration={1.6} r={3.5} />
              <Label x={550} y={366} size={10.5} dim>wait queue</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
