/* From one bad instruction to a reboot: #UD with no usable IDT -> #GP -> #DF -> triple fault -> CPU reset,
   as QEMU's `-d int,cpu_reset -no-reboot` log shows it; then the same #UD with handlers installed.
   Scenario: IDTR limit is 0 (no gates), so every lookup fails the limit check and raises #GP with
   error code vector*8+2 (IDT bit set): 6*8+2 = 0x32 as QEMU logs it (real CPUs also set EXT: 0x33).
   #UD is benign, so #UD -> #GP is not a double fault; #GP -> #GP (two contributory faults) is. #DF pushes error code 0. */
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'exceptions-triple-fault',
  title: 'Exceptions and the triple fault',
  summary: 'An invalid opcode with no usable IDT escalates #UD → #GP → #DF → triple fault and a CPU reset, as QEMU logs it; with handlers installed the same fault prints a register dump.',
  lessons: ['t4m2l4', 't4m2l5'],
  articles: ['Exceptions', 'Triple Fault', 'QEMU'],
  group: 'Interrupts',
  order: 440,
}

const steps: VizStep[] = [
  { caption: 'The kernel runs ud2, an invalid opcode: exception #UD, vector 6.', detail: 'ud2 always raises #UD. Here it runs before any handlers exist: IDTR still has limit 0, so the IDT holds no gates.' },
  { caption: 'The CPU looks for gate 6, but it lies outside the IDT.', detail: 'Gate 6 would be bytes 48–55, past the limit. A missing or not-present gate cannot be used to call a handler.' },
  { caption: 'So it raises #GP, vector 13, instead. Gate 13 is missing too.', detail: 'The error code names the bad gate: 6 × 8 + 2 = 0x32 (2 = "IDT entry"). QEMU logs 0x32; real CPUs also set bit 0 (EXT), giving 0x33.' },
  { caption: '#GP while starting the #GP handler: two faults in a row → double fault #DF, vector 8.', detail: 'Only some pairs escalate: #DE/#TS/#NP/#SS/#GP then another of these, or #PF then #PF or one of these. #UD → #GP did not. #DF pushes error code 0; its saved EIP is undefined.' },
  { caption: 'Gate 8 is missing as well: triple fault. The CPU resets.', detail: 'A triple fault has no vector and no handler. The machine simply reboots, often in a loop that looks like nothing happened.' },
  { caption: 'QEMU’s -d int,cpu_reset -no-reboot shows the whole chain.', detail: 'One "v=" line per exception: v=06, v=0d, v=08, then "Triple fault". -no-reboot stops QEMU so the log stays on screen.', ms: 4200 },
  { caption: 'The fix: install a gate for each of the 32 exceptions and load IDTR.', detail: 'Each gate points at a stub; the limit becomes 256 × 8 − 1 = 0x7FF. Now no exception can fall through to #DF this way.' },
  { caption: 'Now #UD reaches its handler, which prints a register dump and halts.', detail: 'The vector, error code and saved EIP point straight at the faulting ud2 at 0x00100A12, instead of a silent reboot.', ms: 4200 },
]

const IDT_ROWS: [string, string][] = [
  ['0x00  #DE', 'isr0'],
  ['0x06  #UD', 'isr6'],
  ['0x08  #DF', 'isr8'],
  ['0x0D  #GP', 'isr13'],
  ['0x0E  #PF', 'isr14'],
  ['…', '…'],
]
const ROW_Y = (i: number) => 70 + i * 30

const LOG: [string, number, boolean][] = [
  ['check_exception old: 0xffffffff new 0x6', 0, false],
  ['     0: v=06 e=0000 i=0 cpl=0 IP=0008:00100a12 pc=00100a12', 1, true],
  ['check_exception old: 0x6 new 0xd', 2, false],
  ['     1: v=0d e=0032 i=0 cpl=0 IP=0008:00100a12 pc=00100a12', 2, true],
  ['check_exception old: 0xd new 0xd', 3, false],
  ['     2: v=08 e=0000 i=0 cpl=0 IP=0008:00100a12 pc=00100a12', 3, true],
  ['check_exception old: 0x8 new 0xd', 4, false],
  ['Triple fault', 4, true],
  ['CPU Reset (CPU 0)', 4, true],
]
const FIX = [
  'for (int v = 0; v < 32; v++)',
  '    idt_set_gate(v, isr_stub_table[v], 0x08, 0x8E);',
  'idtr.limit = 256 * 8 - 1;          // 0x07FF',
  'idtr.base  = (uint32_t)&idt;',
  'lidt(&idtr);',
]
const DUMP = [
  '*** EXCEPTION 6: #UD invalid opcode   err=0x00000000',
  'EIP=0x00100A12  CS=0x0008  EFLAGS=0x00000046',
  'EAX=0x00000000  EBX=0x00000000  ECX=0x00000000  EDX=0x00000000',
  'ESP=0x0010EFC8  EBP=0x0010EFF8  ESI=0x00000000  EDI=0x00000000',
  'System halted.',
]
const nb = (t: string) => t.replace(/ /g, ' ')

/** A red-pen style cross, drawn in ink. */
function Cross({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <Appear on={on} dy={0}>
      <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} stroke="var(--viz-fg)" strokeWidth={2.2} />
      <line x1={x - 6} y1={y + 6} x2={x + 6} y2={y - 6} stroke="var(--viz-fg)" strokeWidth={2.2} />
    </Appear>
  )
}

export default function ExceptionsTripleFault() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const fixed = s >= 6
        const chainState = (i: number) => {
          if (s >= 5) return 'off' as const
          const cur = s <= 1 ? 0 : s === 2 ? 1 : s === 3 ? 2 : 3
          return i === cur ? 'on' as const : i < cur ? 'off' as const : 'dim' as const
        }
        return (
          <Scene label={meta.summary}>
            {/* CPU */}
            <Block x={20} y={50} w={220} h={136} state={s === 0 || s === 7 ? 'on' : 'off'} />
            <Label x={32} y={70} size={11} dim>CPU · kernel code</Label>
            {['0x00100A10  xor eax, eax', '0x00100A12  ud2', '0x00100A14  mov [x], eax'].map((t, i) => (
              <Block key={i} x={30} y={80 + i * 24} w={200} h={24} label={nb(t)} mono size={11} align="start"
                state={i === 1 && (s === 0 || s === 7) ? 'on' : i === 1 ? 'off' : 'dim'} />
            ))}
            <Label x={32} y={172} size={11} weight={600}>{nb(fixed ? 'IDTR.limit = 0x07FF' : 'IDTR.limit = 0x0000')}</Label>
            <Pulse x={130} y={116} on={s === 0} />

            {/* IDT */}
            <Label x={280} y={62} size={11} dim>{fixed ? 'IDT · 32 exception gates' : 'IDT · limit 0: no gates'}</Label>
            {IDT_ROWS.map(([r, isr], i) => (
              <Block key={i} x={280} y={ROW_Y(i)} w={170} h={30} mono size={11} align="start"
                label={nb(fixed ? (i === 5 ? '…' : `${r}  → ${isr}`) : r)}
                state={fixed ? (s === 7 && i === 1 ? 'on' : s === 6 ? 'on' : 'off') : 'hatch'} />
            ))}
            <Cross x={466} y={ROW_Y(1) + 15} on={s >= 1 && s < 6} />
            <Cross x={466} y={ROW_Y(3) + 15} on={s >= 2 && s < 6} />
            <Cross x={466} y={ROW_Y(2) + 15} on={s >= 4 && s < 6} />

            {/* failing chain */}
            <Appear on={!fixed} dy={0}>
              {['#UD  vector 6', '#GP  vector 13', '#DF  vector 8', 'TRIPLE FAULT'].map((t, i) => (
                <Block key={i} x={500} y={56 + i * 50} w={170} h={30} label={nb(t)} mono size={12} state={chainState(i)} />
              ))}
              {['gate 6 missing', 'gate 13 missing', 'gate 8 missing'].map((t, i) => (
                <g key={i}>
                  <Wire from={[585, 86 + i * 50]} to={[585, 104 + i * 50]} on={s >= i + 2 || (i === 2 && s >= 4)} />
                  <Label x={594} y={99 + i * 50} size={10.5} dim on={s >= i + 2 || (i === 2 && s >= 4)}>{t}</Label>
                </g>
              ))}
              <Wire from={[670, 221]} to={[688, 221]} on={s >= 4} />
              <Block x={690} y={206} w={90} h={30} label="RESET" mono size={12} state={s === 4 ? 'fill' : s >= 4 ? 'on' : 'dim'} />
            </Appear>

            {/* working chain */}
            <Appear on={s >= 7} dy={0}>
              {['#UD  vector 6', 'isr6 stub', 'exception_handler()', 'dump, then cli; hlt'].map((t, i) => (
                <Block key={i} x={500} y={56 + i * 50} w={200} h={30} label={nb(t)} mono size={12} state={i === 3 ? 'on' : 'off'} />
              ))}
              {[0, 1, 2].map((i) => (
                <Wire key={i} from={[600, 86 + i * 50]} to={[600, 104 + i * 50]} on={s >= 7} delay={0.2 + i * 0.25} />
              ))}
            </Appear>

            {/* bottom panel */}
            <Block x={20} y={262} w={760} h={168} state={s === 5 || s === 7 ? 'on' : 'off'} />
            <Appear on={!fixed} dy={0}>
              <Label x={34} y={284} size={11} weight={600}>$ qemu-system-i386 -kernel kernel.bin -d int,cpu_reset -no-reboot</Label>
              <Label x={766} y={284} size={10.5} anchor="end" dim>(trimmed)</Label>
              {LOG.map(([t, at, key], i) => (
                <Label key={i} x={34} y={306 + i * 14} size={10.5} on={s >= at} dim={s === 5 ? !key : !key || at < s}
                  weight={s === 5 && key ? 600 : 400}>{nb(t)}</Label>
              ))}
            </Appear>
            <Appear on={s === 6} dy={0}>
              <Label x={34} y={284} size={11} dim>kernel source · idt_init()</Label>
              {FIX.map((t, i) => (
                <Label key={i} x={34} y={312 + i * 18} size={12}>{nb(t)}</Label>
              ))}
            </Appear>
            <Appear on={s >= 7} dy={0}>
              <Label x={34} y={284} size={11} dim>kernel screen</Label>
              {DUMP.map((t, i) => (
                <Label key={i} x={34} y={312 + i * 20} size={12} weight={i === 0 || i === 1 ? 600 : 400} delay={0.3 + i * 0.25}>{nb(t)}</Label>
              ))}
            </Appear>

            {/* motion */}
            <Packet on={s === 0} points={[[230, 116], [500, 71]]} duration={1.3} label="#UD" />
            <Packet on={s === 1} points={[[196, 116], [310, 115]]} duration={1.2} label="gate 6?" />
            <Packet on={s === 2} points={[[196, 150], [310, 175]]} duration={1.2} label="gate 13?" />
            <Pulse x={585} y={171} on={s === 3} />
            <Packet on={s === 4} points={[[196, 150], [310, 145]]} duration={1.2} label="gate 8?" />
            <Pulse x={735} y={221} on={s === 4} r={18} />
            <Packet on={s === 7} points={[[230, 116], [500, 71], [600, 121], [600, 171], [600, 221]]} duration={2.4} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
