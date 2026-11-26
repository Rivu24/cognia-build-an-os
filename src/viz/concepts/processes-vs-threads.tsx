/* Processes vs threads, following "Processes and Threads": a process owns an address space (its page
   directory, loaded into CR3) and resources such as open files; a thread is an execution context
   (registers + its own stack) inside a process. CR3 values are a worked example. */
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'processes-vs-threads',
  title: 'Processes vs threads',
  summary: 'A process is an address space (page directory, CR3) plus resources; threads are register sets and stacks that share it. A thread switch keeps CR3, a process switch loads a new one.',
  lessons: ['t7m1l1'],
  articles: ['Processes and Threads'],
  group: 'Tasks',
  order: 710,
}

const steps: VizStep[] = [
  { caption: 'A process is an address space plus resources.', detail: 'Its page directory (loaded into CR3 while it runs) maps code, data, heap and stacks. Open files and other resources belong to the process too.' },
  { caption: 'A thread is an execution context: registers and a stack.', detail: 'EIP says where it is in the code; ESP points into its own stack. The scheduler runs threads, not processes.' },
  { caption: 'A second thread shares code, data, heap and files, but has its own stack.', detail: 'Both threads see the same globals and heap, so they can share data directly. Separate stacks keep their locals and call chains apart.' },
  { caption: 'A second process gets its own page directory, CR3 and files.', detail: '0x00400000 in process 2 maps to different frames than in process 1. Neither process can see the other’s memory.' },
  { caption: 'Thread switch inside one process: swap EIP, ESP and registers; CR3 stays.', detail: 'Thread 1 → thread 2 keeps CR3 = 0x00210000, so the TLB keeps its translations. Only the execution context changes.' },
  { caption: 'Process switch: the same, plus a new CR3 and a flushed TLB.', detail: 'Thread 2 → thread 3 loads CR3 = 0x00340000. The next memory accesses walk the page tables again until the TLB refills.', ms: 4000 },
]

type St = 'on' | 'off' | 'dim' | 'fill' | 'hatch'

/** One process: memory map on the left, page directory + files on the right, threads below. */
function Process({ x, n, cr3, fds, two, s, shared, focus, cr3On }: {
  x: number; n: number; cr3: string; fds: string; two: boolean; s: number; shared: boolean; focus: number[]; cr3On: boolean
}) {
  const mx = x + 14 // map x
  const rx = x + 160 // right column x
  const rows: { label: string; y: number; h: number; state: St; show?: boolean }[] = [
    { label: 'kernel', y: 68, h: 28, state: 'dim' },
    { label: !two || s >= 1 ? `stack T${two ? 1 : 3}` : '', y: 96, h: 28, state: !two || s >= 1 ? (focus.includes(two ? 1 : 3) ? 'on' : 'off') : 'hatch' },
    { label: two && s >= 2 ? 'stack T2' : '', y: 124, h: 28, state: two && s >= 2 ? (focus.includes(2) ? 'on' : 'off') : 'hatch' },
    { label: '', y: 152, h: 44, state: 'hatch' },
    { label: 'heap', y: 196, h: 28, state: shared ? 'on' : 'off' },
    { label: 'data', y: 224, h: 28, state: shared ? 'on' : 'off' },
    { label: 'code 0x400000', y: 252, h: 32, state: shared || s === 3 ? 'on' : 'off' },
  ]
  const thread = (k: number, tx: number, show: boolean) => (
    <Appear on={show} dy={10}>
      <Block x={tx} y={166} w={88} h={118} state={focus.includes(k) ? 'on' : 'off'} />
      <Label x={tx + 8} y={183} size={11} mono={false} weight={600}>thread {k}</Label>
      <Block x={tx + 8} y={190} w={72} h={24} label="EIP" mono size={10.5} state="off" />
      <Block x={tx + 8} y={216} w={72} h={24} label="ESP" mono size={10.5} state="off" />
      <Block x={tx + 8} y={242} w={72} h={24} label="regs" mono size={10.5} state="off" />
    </Appear>
  )
  return (
    <g>
      <Label x={x} y={32} size={12} mono={false} weight={600}>Process {n}</Label>
      <rect x={x} y={40} width={360} height={280} fill="none" stroke="var(--viz-fg)" />
      <Label x={mx} y={60} size={10.5} dim>address space</Label>
      {rows.map((r, i) => (
        <Block key={i} x={mx} y={r.y} w={130} h={r.h} label={r.label || undefined} mono size={11} state={r.state} />
      ))}
      <Block x={rx} y={68} w={186} h={38} label="page directory" sub={`CR3 = ${cr3}`} size={12} state={cr3On ? 'on' : 'off'} />
      <Block x={rx} y={112} w={186} h={38} label="open files" sub={fds} size={12} state={shared ? 'on' : 'off'} />
      {thread(two ? 1 : 3, rx, two ? s >= 1 : true)}
      {two && thread(2, rx + 98, s >= 2)}
      {/* ESP → own stack */}
      <Wire d={`M${rx + 8} 228 H${rx - 4} V110 H${mx + 132}`} on={two ? s >= 1 : true} width={1.2} />
      {two && <Wire d={`M${rx + 140} 284 V298 H${rx - 10} V138 H${mx + 132}`} on={s >= 2} width={1.2} />}
    </g>
  )
}

const CPU_ROWS = [
  // [CR3, EIP, ESP, regs, TLB]
  ['—', '—', '—', '—', '—'],
  ['0x00210000', 'thread 1 code', 'stack T1', 'thread 1', 'warm'],
  ['0x00210000', 'thread 1 code', 'stack T1', 'thread 1', 'warm'],
  ['0x00210000', 'thread 1 code', 'stack T1', 'thread 1', 'warm'],
  ['0x00210000 (same)', 'thread 2 code', 'stack T2', 'thread 2', 'kept'],
  ['0x00340000', 'thread 3 code', 'stack T3', 'thread 3', 'flushed'],
]
const NOTES = [
  '',
  'running: process 1, thread 1',
  'shared by both threads: code, data, heap, open files',
  'two address spaces: same virtual address, different frames',
  'thread switch: EIP, ESP, registers change · CR3 untouched',
  'process switch: EIP, ESP, registers change · mov cr3 · TLB flushed',
]

export default function ProcessesVsThreads() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const [cr3, eip, esp, regs, tlb] = CPU_ROWS[s]
        const ctx = s === 4 || s === 5
        const focus1 = s === 1 ? [1] : s === 2 ? [2] : s === 4 ? [2] : []
        return (
          <Scene label={meta.summary}>
            <Process x={30} n={1} cr3="0x00210000" fds="fd 0, 1, 2, 3" two s={s} shared={s === 2} focus={focus1} cr3On={s === 0 || s === 3} />
            <Appear on={s >= 3} dx={20} dy={0}>
              <Process x={410} n={2} cr3="0x00340000" fds="fd 0, 1, 2" two={false} s={s} shared={false} focus={s === 5 ? [3] : []} cr3On={s === 3 || s === 5} />
            </Appear>

            {/* what the CPU has loaded right now */}
            <Label x={30} y={338} size={10.5} dim>CPU, NOW</Label>
            <Block x={30} y={346} w={80} h={46} label="TLB" sub={tlb} mono size={12} state={s === 5 ? 'on' : s === 0 ? 'dim' : 'off'} />
            <Block x={120} y={346} w={170} h={46} label="CR3" sub={cr3} mono size={12} state={s === 5 ? 'on' : s === 0 ? 'dim' : 'off'} />
            <Block x={300} y={346} w={140} h={46} label="EIP" sub={eip} mono size={12} state={ctx ? 'on' : s === 0 ? 'dim' : 'off'} />
            <Block x={450} y={346} w={150} h={46} label="ESP" sub={esp} mono size={12} state={ctx ? 'on' : s === 0 ? 'dim' : 'off'} />
            <Block x={610} y={346} w={160} h={46} label="EAX … EBP" sub={regs} mono size={12} state={ctx ? 'on' : s === 0 ? 'dim' : 'off'} />

            {NOTES.map((t, i) => (
              <Label key={i} x={30} y={420} size={11.5} weight={600} on={s === i}>{t}</Label>
            ))}

            {/* context flowing into the CPU */}
            <Packet on={s === 1} points={[[234, 284], [234, 330], [370, 330], [370, 346]]} duration={1.6} />
            <Packet on={s === 4} points={[[332, 284], [332, 330], [370, 330], [370, 346]]} duration={1.6} label="thread 2" />
            <Packet on={s === 5} points={[[614, 284], [614, 330], [370, 330], [370, 346]]} duration={1.8} />
            <Packet on={s === 5} points={[[663, 68], [663, 50], [400, 50], [400, 330], [205, 330], [205, 346]]} duration={2.4} delay={0.4} label="CR3" />
          </Scene>
        )
      }}
    </VizStage>
  )
}
