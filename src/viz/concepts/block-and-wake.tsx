/* Blocking and waking, after Brendan's Multi-tasking Tutorial (steps 6 to 9) and the Semaphore article.
   Worked example on one CPU: task A waits for a key, D and later A sleep. The PIT ticks every 1 ms
   (about 1000 Hz, as in the tutorial), so time_since_boot moves in 1 ms steps. Task chips move between
   the CPU, the ready queue, the keyboard wait list and the sleeping list. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'block-and-wake',
  title: 'Blocking and waking a task',
  summary: 'Task A blocks on an empty keyboard buffer and joins a wait list, IRQ 1 unblocks it onto the ready queue, and sleep(50) parks it on a sleeping list that each timer tick checks.',
  lessons: ['t7m2l2', 't7m3l1'],
  articles: ["Brendan's Multi-tasking Tutorial", 'Semaphore', 'Blocking Process'],
  group: 'Tasks',
  order: 725,
}

const steps: VizStep[] = [
  { caption: 'Task A runs. B and C wait in the ready queue. D is asleep until 1020 ms.', detail: 'Each task has a TCB with a state field. Only one task runs; the rest are on exactly one list, chained through the same "next" field.' },
  { caption: 'A calls read_key(). The keyboard buffer is empty: there is nothing to return.', detail: 'A loop that keeps checking the buffer would burn CPU time for nothing (busy-waiting). Instead, A gives up the CPU until a key arrives.' },
  { caption: 'A joins the keyboard wait list and calls block_task(). The scheduler switches to B.', detail: 'block_task(reason) sets the state and calls schedule(). A is on no ready list now, so the scheduler cannot pick it.', ms: 3800 },
  { caption: 'A key is pressed. IRQ 1 interrupts B and the handler puts ‘k’ in the buffer.', detail: 'The handler reads the scancode from port 0x60, turns it into a character, stores it and sends EOI to the PIC. B is paused only for the handler.' },
  { caption: 'The handler calls unblock_task(A): A leaves the wait list for the end of the ready queue.', detail: 'Brendan’s unblock_task preempts only if no task was ready. C is waiting, so A just queues up. This is a semaphore signal waking the first waiter.', ms: 4000 },
  { caption: 'Later the scheduler picks A. read_key() continues and returns ‘k’.', detail: 'B’s and C’s 50 ms time slices ran out first. From A’s point of view, read_key() simply took a while. It used no CPU time while it waited.' },
  { caption: 'At 1000 ms A calls sleep(50): wake time 1050 ms. It joins the sleeping list and blocks.', detail: 'sleep() stores sleep_expiry = now + 50 ms, puts A on the sleeping list and calls block_task(SLEEPING). The list here is sorted by wake time.', ms: 4000 },
  { caption: 'Every timer tick the IRQ 0 handler checks the list. At 1020 ms D is due and wakes.', detail: 'Brendan’s version keeps the list unsorted and checks every entry. A sorted list lets the handler stop at the first task that is not due yet: A (1050).', ms: 4000 },
  { caption: 'At 1050 ms A is due: it moves to the ready queue and runs again soon.', detail: 'sleep(50) means "at least 50 ms". A runs when the scheduler next reaches it, so the real delay can be a little longer.', ms: 3800 },
]

type T = 'A' | 'B' | 'C' | 'D'
type Where = ['cpu'] | ['ready', number] | ['kbd', number] | ['sleep', number]

// where each task is at each step
const LAYOUT: Record<T, Where>[] = [
  { A: ['cpu'], B: ['ready', 0], C: ['ready', 1], D: ['sleep', 0] },
  { A: ['cpu'], B: ['ready', 0], C: ['ready', 1], D: ['sleep', 0] },
  { A: ['kbd', 0], B: ['cpu'], C: ['ready', 0], D: ['sleep', 0] },
  { A: ['kbd', 0], B: ['cpu'], C: ['ready', 0], D: ['sleep', 0] },
  { A: ['ready', 1], B: ['cpu'], C: ['ready', 0], D: ['sleep', 0] },
  { A: ['cpu'], B: ['ready', 0], C: ['ready', 1], D: ['sleep', 0] },
  { A: ['sleep', 1], B: ['cpu'], C: ['ready', 0], D: ['sleep', 0] },
  { A: ['sleep', 0], B: ['cpu'], C: ['ready', 0], D: ['ready', 1] },
  { A: ['ready', 2], B: ['cpu'], C: ['ready', 0], D: ['ready', 1] },
]
const STATE: Record<T, string>[] = [
  { A: 'RUNNING', B: 'READY', C: 'READY', D: 'SLEEPING' },
  { A: 'RUNNING', B: 'READY', C: 'READY', D: 'SLEEPING' },
  { A: 'WAITING_FOR_KEY', B: 'RUNNING', C: 'READY', D: 'SLEEPING' },
  { A: 'WAITING_FOR_KEY', B: 'RUNNING', C: 'READY', D: 'SLEEPING' },
  { A: 'READY', B: 'RUNNING', C: 'READY', D: 'SLEEPING' },
  { A: 'RUNNING', B: 'READY', C: 'READY', D: 'SLEEPING' },
  { A: 'SLEEPING', B: 'RUNNING', C: 'READY', D: 'SLEEPING' },
  { A: 'SLEEPING', B: 'RUNNING', C: 'READY', D: 'READY' },
  { A: 'READY', B: 'RUNNING', C: 'READY', D: 'READY' },
]
const WAKE: Partial<Record<T, string>> = { A: '1050 ms', D: '1020 ms' }
const TIME = ['895 ms', '895 ms', '900 ms', '920 ms', '920 ms', '1000 ms', '1000 ms', '1020 ms', '1050 ms']
// which task the caption is about, per step
const FOCUS: (T | null)[] = ['A', 'A', 'A', null, 'A', 'A', 'A', 'D', 'A']

const CODE = [
  'current = A;   ready: B → C;   sleeping: D (1020 ms)',
  'c = read_key();          // buffer empty',
  'kbd_waiter = A;  block_task(WAITING_FOR_KEY);   // schedule() → B',
  'IRQ 1:  sc = inb(0x60);  buffer_put(\'k\');  send EOI',
  'unblock_task(kbd_waiter);     // C is ready: no preemption',
  'return \'k\';                   // read_key() finishes in A',
  'A->sleep_expiry = 1000 + 50;  block_task(SLEEPING);',
  'IRQ 0:  time_since_boot += 1 ms;  1020 >= 1020: unblock_task(D)',
  'IRQ 0:  1050 >= 1050: unblock_task(A)',
]

// geometry
const CW = 64, CH = 46
const CPU = { x: 20, y: 52, w: 150, h: 70 }
const LIST_X = 220, LIST_W = 340
const READY_Y = 52, KBD_Y = 172, SLEEP_Y = 292
const slotX = (i: number) => LIST_X + 14 + i * 84

function chipPos(w: Where): [number, number] {
  if (w[0] === 'cpu') return [CPU.x + (CPU.w - CW) / 2, CPU.y + (CPU.h - CH) / 2]
  const y = w[0] === 'ready' ? READY_Y : w[0] === 'kbd' ? KBD_Y : SLEEP_Y
  return [slotX(w[1]), y + 12]
}

const count = (s: number, list: Where[0]) => Object.values(LAYOUT[s]).filter((w) => w[0] === list).length

/** The "next" pointer between two list entries. */
function Link({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <motion.path d={`M${x} ${y} h14`} stroke="var(--viz-dim)" strokeWidth={1.2} markerEnd="url(#viz-arrow-dim)"
      initial={false} animate={{ opacity: on ? 1 : 0 }} transition={ease} />
  )
}

function Chip({ t, s }: { t: T; s: number }) {
  const where = LAYOUT[s][t]
  const [x, y] = chipPos(where)
  const asleep = where[0] === 'sleep'
  const hot = FOCUS[s] === t
  return (
    <motion.g initial={false} animate={{ x, y }} transition={{ type: 'spring', stiffness: 80, damping: 16 }}>
      <Block x={0} y={0} w={CW} h={CH} label={t} sub={asleep ? WAKE[t] : undefined} size={16} state={hot ? 'on' : 'off'} />
    </motion.g>
  )
}

/** A value that fades in whenever it changes. */
function Val({ x, y, v, size = 12, anchor = 'start', dim }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; dim?: boolean }) {
  return (
    <motion.text key={v} x={x} y={y} textAnchor={anchor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={ease}
      fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
      {v}
    </motion.text>
  )
}

export default function BlockAndWake() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const bufHasK = s === 3 || s === 4
        const tick = s === 7 || s === 8
        return (
          <Scene label={meta.summary}>
            {/* ---------- CPU ---------- */}
            <Label x={CPU.x} y={42} size={11} dim>RUNNING ON THE CPU</Label>
            <Block x={CPU.x} y={CPU.y} w={CPU.w} h={CPU.h} state={s === 2 || s === 5 ? 'on' : 'off'} />
            <Label x={CPU.x + CPU.w / 2} y={CPU.y + CPU.h + 16} size={10.5} anchor="middle" on={s === 3} weight={600}>interrupted by IRQ 1</Label>
            <Label x={CPU.x + CPU.w / 2} y={CPU.y + CPU.h + 16} size={10.5} anchor="middle" on={tick} weight={600}>interrupted by IRQ 0</Label>

            {/* ---------- TCB states ---------- */}
            <Label x={20} y={178} size={11} dim>TCB.state</Label>
            {(['A', 'B', 'C', 'D'] as T[]).map((t, i) => (
              <g key={t}>
                <Block x={20} y={186 + i * 28} w={180} h={28} state={FOCUS[s] === t ? 'on' : 'off'} />
                <Label x={32} y={205 + i * 28} size={12} weight={600}>{t}</Label>
                <Val x={190} y={205 + i * 28} v={STATE[s][t]} size={11} anchor="end" dim={STATE[s][t] === 'READY'} />
              </g>
            ))}

            {/* ---------- lists ---------- */}
            <Label x={LIST_X} y={42} size={11} dim>READY QUEUE (first → last)</Label>
            <Block x={LIST_X} y={READY_Y} w={LIST_W} h={70} state={s === 4 || s === 7 || s === 8 ? 'on' : 'off'} />
            <Label x={LIST_X} y={162} size={11} dim>KEYBOARD WAIT LIST</Label>
            <Block x={LIST_X} y={KBD_Y} w={LIST_W} h={70} state={s === 2 ? 'on' : s === 3 || s === 4 ? 'off' : 'dim'} />
            <Label x={LIST_X + LIST_W - 12} y={KBD_Y + 40} size={11} anchor="end" dim on={s < 2 || s > 4}>empty</Label>
            <Label x={LIST_X} y={282} size={11} dim>SLEEPING LIST (sorted by wake time)</Label>
            <Block x={LIST_X} y={SLEEP_Y} w={LIST_W} h={70} state={s >= 6 ? 'on' : 'off'} />
            <Label x={LIST_X + 14} y={SLEEP_Y + 40} size={11} dim on={s === 8}>empty</Label>
            {/* next pointers between slots */}
            {[0, 1].map((i) => (
              <g key={i}>
                <Link x={slotX(i) + CW + 2} y={READY_Y + 35} on={count(s, 'ready') > i + 1} />
                <Link x={slotX(i) + CW + 2} y={SLEEP_Y + 35} on={count(s, 'sleep') > i + 1} />
              </g>
            ))}

            {(['A', 'B', 'C', 'D'] as T[]).map((t) => <Chip key={t} t={t} s={s} />)}

            {/* ---------- keyboard ---------- */}
            <Block x={600} y={52} w={180} h={50} label="IRQ 1 · keyboard" sub="scancode at port 0x60" size={13} state={s === 3 || s === 4 ? 'on' : 'off'} />
            <Label x={600} y={162} size={11} dim>KEYBOARD BUFFER</Label>
            {[0, 1, 2, 3].map((i) => (
              <Block key={i} x={600 + i * 45} y={KBD_Y} w={45} h={44} mono size={16}
                label={i === 0 && bufHasK ? '‘k’' : ''} state={i === 0 && (s === 1 || s === 3) ? 'on' : 'off'} />
            ))}
            <Label x={690} y={KBD_Y + 62} size={10.5} anchor="middle" on={s <= 2 || s >= 5} dim>empty</Label>
            <Wire from={[735, 102]} to={[735, KBD_Y - 2]} on={s === 3} />
            <Packet on={s === 3} points={[[735, 104], [735, KBD_Y + 22], [622, KBD_Y + 22]]} duration={1.4} label="'k'" />
            {/* the handler wakes the waiter */}
            <Packet on={s === 4} points={[[600, 77], [LIST_X + LIST_W + 10, 77], [LIST_X + LIST_W + 10, KBD_Y + 35], [slotX(0) + CW, KBD_Y + 35]]} duration={1.6} label="unblock A" />
            <Packet on={s === 5} points={[[622, KBD_Y + 22], [585, KBD_Y + 22], [585, 140], [42, 140], [42, CPU.y + 50]]} duration={1.2} repeat={false} label="'k'" />
            <Pulse x={622} y={KBD_Y + 22} on={s === 1} r={18} />

            {/* ---------- timer ---------- */}
            <Block x={600} y={292} w={180} h={50} label="IRQ 0 · PIT timer" sub="tick every 1 ms" size={13} state={tick ? 'on' : 'off'} />
            <Label x={600} y={366} size={11} dim>time_since_boot</Label>
            <Val x={780} y={366} v={TIME[s]} size={13} anchor="end" />
            <Packet on={tick} points={[[600, SLEEP_Y + 35], [LIST_X + LIST_W, SLEEP_Y + 35], [slotX(0) + CW + 8, SLEEP_Y + 35]]} duration={1.4} label="check" />

            {/* ---------- the code doing the work ---------- */}
            <line x1={20} x2={780} y1={392} y2={392} stroke="var(--viz-faint)" />
            {CODE.map((c, i) => (
              <Label key={i} x={20} y={420} size={12} on={s === i}>{c}</Label>
            ))}
          </Scene>
        )
      }}
    </VizStage>
  )
}
