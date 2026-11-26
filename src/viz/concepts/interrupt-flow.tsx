/* Interrupt flow on i386: a key press travels device -> PIC -> CPU -> IDTR -> IDT gate -> ISR -> iret.
   Worked example: PIC remapped to 0x20, so IRQ 1 = vector 0x21. IDT at 0x00105000, gate 0x21 at 0x00105108.
   The interrupted instruction is `add eax, 1` at 0x00100F29 (3 bytes), so the saved EIP is 0x00100F2C. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'interrupt-flow',
  title: 'An interrupt, start to finish',
  summary: 'A key press raises IRQ 1; the PIC signals INTR, the CPU finds the gate through IDTR, pushes EFLAGS, CS and EIP, runs the ISR and returns with iret.',
  lessons: ['t4m2l2', 't4m2l3'],
  articles: ['Interrupts', 'Interrupt Descriptor Table', 'Interrupt Service Routines'],
  group: 'Interrupts',
  order: 420,
}

const steps: VizStep[] = [
  { caption: 'A key is pressed: the keyboard raises IRQ 1 on the PIC.', detail: 'Devices do not talk to the CPU directly. They raise a request line on the 8259 PIC, which decides when to pass it on.' },
  { caption: 'The PIC turns IRQ 1 into vector 0x21 and raises the CPU’s INTR pin.', detail: 'With the PIC remapped to offset 0x20, IRQ n becomes vector 0x20 + n. Unremapped, IRQ 1 would be 0x09 and clash with a CPU exception.' },
  { caption: 'The CPU finishes the current instruction, then checks INTR.', detail: 'Interrupts are taken between instructions. If IF = 0 (after cli), the request waits until sti.' },
  { caption: 'It reads vector 0x21 and finds the IDT through IDTR.', detail: 'IDTR holds the table’s base and limit. Gate address = base + vector × 8 = 0x00105000 + 0x108 = 0x00105108.' },
  { caption: 'IDT[0x21] is a gate: selector 0x08, offset 0x00101A40.', detail: 'type_attr 0x8E = present, ring 0, 32-bit interrupt gate. A missing or not-present gate makes the CPU raise a fault instead.' },
  { caption: 'The CPU pushes EFLAGS, CS and EIP, then jumps to the ISR.', detail: 'That is the return address. Some exceptions (8, 10–14, 17…) also push an error code. An interrupt gate clears IF on entry.' },
  { caption: 'The ISR saves registers, handles the key, then sends EOI.', detail: 'pusha saves the general registers; the C handler reads the scancode from port 0x60; out 0x20, 0x20 lets the PIC send the next IRQ.' },
  { caption: 'iret pops EIP, CS and EFLAGS: the program resumes at 0x00100F2C.', detail: 'The interrupted code never notices. Use iret, not ret: ret would pop only EIP and leave CS and EFLAGS on the stack.', ms: 3800 },
]

const IDT_ROWS = ['0x00  #DE', '0x0D  #GP', '0x0E  #PF', '…', '0x20  IRQ0 timer', '0x21  IRQ1 kbd', '0x22  IRQ2', '…     0xFF']
const GATE = 5
const ISR_LINES = ['irq1_stub:', '  pusha', '  call kbd_handler', '  mov al, 0x20', '  out 0x20, al', '  popa', '  iret']

const TIMELINE: [number, number, string][] = [
  [20, 260, 'your code'],
  [260, 420, 'CPU: gate + push'],
  [420, 620, 'ISR'],
  [620, 680, 'iret'],
  [680, 780, 'your code'],
]
const HEAD = [120, 200, 252, 300, 350, 405, 520, 730]
const segOf = (s: number) => (s <= 2 ? 0 : s <= 5 ? 1 : s === 6 ? 2 : 4)

/** A few lines of assembly with a moving highlight bar. `active` may be an array to step through in a loop. */
function Code({ x, y, lines, active, lh = 18 }: { x: number; y: number; lines: string[]; active?: number | number[]; lh?: number }) {
  const seq = active === undefined ? undefined : Array.isArray(active) ? active : [active]
  return (
    <g>
      {seq && (
        <motion.g
          initial={false}
          animate={{ y: seq.map((i) => y + i * lh - 13), opacity: 1 }}
          transition={seq.length > 1 ? { duration: seq.length * 0.7, repeat: Infinity, ease: 'linear', times: seq.map((_, i) => i / (seq.length - 1 || 1)) } : ease}
        >
          <rect x={x - 8} y={0} width={156} height={lh} fill="var(--viz-fg)" fillOpacity={0.12} />
          <rect x={x - 8} y={0} width={3} height={lh} fill="var(--viz-fg)" />
        </motion.g>
      )}
      {lines.map((l, i) => (
        <Label key={i} x={x} y={y + i * lh} size={11.5} weight={seq && seq.length === 1 && seq[0] === i ? 600 : 400}>
          {l.replace(/ /g, ' ')}
        </Label>
      ))}
    </g>
  )
}

export default function InterruptFlow() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const inIsr = s >= 5 && s < 7
        return (
          <Scene label={meta.summary}>
            {/* EOI path back to the PIC command port */}
            <Wire d="M650 60 V40 H80 V58" on={s >= 6} dashed />
            <Label x={365} y={33} size={11} anchor="middle" on={s >= 6}>EOI: out 0x20, 0x20</Label>

            {/* PIC and keyboard */}
            <Block x={20} y={60} w={120} h={64} label="8259 PIC" sub="IRQ1 → 0x21" state={s === 1 || s === 6 ? 'on' : s >= 2 && s !== 6 ? 'dim' : 'off'} />
            <Block x={20} y={196} w={120} h={50} label="Keyboard" sub="raises IRQ 1" state={s === 0 ? 'on' : s >= 1 ? 'dim' : 'off'} />
            <Wire from={[80, 196]} to={[80, 127]} on />
            <Label x={88} y={166} size={10.5} dim={s !== 0}>IRQ 1</Label>
            <Wire from={[140, 92]} to={[178, 92]} on={s >= 1} />
            <Label x={159} y={84} size={10.5} anchor="middle" on={s >= 1}>INTR</Label>

            {/* CPU */}
            <Block x={180} y={60} w={210} h={200} state={s === 2 || s === 7 ? 'on' : 'off'} />
            <Label x={192} y={80} size={11} dim>CPU</Label>
            {['0x00100F24  mov eax, [n]', '0x00100F29  add eax, 1', '0x00100F2C  mov [n], eax'].map((t, i) => (
              <Block key={i} x={190} y={90 + i * 24} w={190} h={24} label={t.replace(/ /g, ' ')} mono size={11} align="start"
                state={(i === 1 && s <= 2) || (i === 2 && s === 7) ? 'on' : inIsr || s === 3 || s === 4 ? 'dim' : 'off'} />
            ))}
            <Label x={192} y={186} size={11}>{`EIP    ${inIsr ? '0x00101A40' : s <= 1 ? '0x00100F29' : '0x00100F2C'}`.replace(/ /g, ' ')}</Label>
            <Label x={192} y={206} size={11}>{(inIsr ? 'EFLAGS 0x00000002 IF=0' : 'EFLAGS 0x00000202 IF=1').replace(/ /g, ' ')}</Label>
            <Label x={285} y={242} size={11} mono={false} anchor="middle" dim on={s === 2}>checks INTR after each instruction</Label>
            <Label x={285} y={242} size={11} mono={false} anchor="middle" dim on={inIsr}>running the ISR</Label>

            {/* IDTR */}
            <Wire from={[285, 260]} to={[285, 288]} on={s >= 3} />
            <Block x={180} y={290} w={210} h={62} state={s === 3 ? 'on' : 'off'} />
            <Label x={192} y={310} size={12} weight={600}>IDTR</Label>
            <Label x={192} y={328} size={11}>{'base  0x00105000'.replace(/ /g, ' ')}</Label>
            <Label x={192} y={344} size={11}>{'limit 0x07FF'.replace(/ /g, ' ')}</Label>
            <Appear on={s >= 3}>
              <Label x={285} y={372} size={11} anchor="middle">0x00105000 + 0x21 × 8</Label>
              <Label x={285} y={389} size={12} anchor="middle" weight={600}>= 0x00105108</Label>
            </Appear>

            {/* IDT */}
            <Label x={420} y={72} size={11} dim>IDT (8-byte gates)</Label>
            {IDT_ROWS.map((r, i) => (
              <Block key={i} x={420} y={80 + i * 28} w={160} h={28} label={r.replace(/ /g, ' ')} mono size={11} align="start"
                state={i === GATE && s >= 3 && s <= 5 ? 'on' : s >= 3 && s <= 5 ? 'dim' : 'off'} />
            ))}
            <Wire d="M390 320 C 405 320, 404 234, 418 234" on={s >= 3} />
            <Appear on={s >= 4}>
              <Label x={420} y={328} size={11}>{'selector  0x08'.replace(/ /g, ' ')}</Label>
              <Label x={420} y={344} size={11}>{'offset    0x00101A40'.replace(/ /g, ' ')}</Label>
              <Label x={420} y={360} size={11}>{'type_attr 0x8E'.replace(/ /g, ' ')}</Label>
            </Appear>
            <Pulse x={500} y={234} on={s === 4} />
            <Wire d="M580 234 C 595 234, 594 100, 608 100" on={s >= 5} />

            {/* ISR */}
            <Block x={610} y={60} w={170} h={180} state={s === 5 || s === 6 ? 'on' : s === 7 ? 'off' : 'dim'} />
            <Label x={620} y={78} size={11} dim>ISR @ 0x00101A40</Label>
            <Code x={622} y={102} lines={ISR_LINES} active={s === 5 ? 0 : s === 6 ? [1, 2, 3, 4, 5] : s === 7 ? 6 : undefined} />

            {/* Kernel stack */}
            <Label x={610} y={262} size={11} dim>KERNEL STACK</Label>
            {[
              ['EFLAGS 0x00000202', 0],
              ['CS     0x00000008', 1],
              ['EIP    0x00100F2C', 2],
            ].map(([t, i]) => (
              <Appear key={i as number} on={s >= 5} delay={s === 5 ? 0.35 + (i as number) * 0.35 : 0} dy={-10}>
                <Block x={610} y={270 + (i as number) * 28} w={130} h={28} label={(t as string).replace(/ /g, ' ')} mono size={11} align="start"
                  state={s === 7 ? 'dim' : s === 5 && i === 2 ? 'on' : 'off'} />
              </Appear>
            ))}
            <Appear on={s === 5} delay={1.4}>
              <Block x={610} y={354} w={130} h={28} label="+ error code" mono size={11} state="hatch" />
              <Label x={675} y={396} size={10.5} anchor="middle" dim>(only some exceptions)</Label>
            </Appear>
            <motion.g initial={false} animate={{ y: inIsr ? 340 : 270 }} transition={{ ...ease, delay: s === 5 ? 1.1 : 0 }}>
              <path d="M750 -5 L744 0 L750 5 Z" fill="var(--viz-fg)" />
              <text x={753} y={4} style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }} fill="var(--viz-fg)">ESP</text>
            </motion.g>
            <Label x={675} y={372} size={10.5} anchor="middle" dim on={s === 7}>popped by iret</Label>

            {/* timeline: the interrupt is a detour */}
            {TIMELINE.map(([x0, x1, t], i) => (
              <Block key={i} x={x0} y={410} w={x1 - x0} h={20} label={t} size={10.5} mono
                state={i === segOf(s) ? 'on' : 'dim'} />
            ))}
            <motion.g initial={false} animate={{ x: HEAD[s] }} transition={ease}>
              <path d="M0 404 L-5 397 L5 397 Z" fill="var(--viz-fg)" />
            </motion.g>

            {/* motion */}
            <Pulse x={80} y={221} on={s === 0} />
            <Packet on={s === 0} points={[[80, 198], [80, 128]]} duration={1.1} />
            <Packet on={s === 1} points={[[110, 92], [200, 92]]} duration={1.2} label="INTR" />
            <Pulse x={180} y={92} on={s === 2} />
            <Packet on={s === 3} points={[[130, 104], [285, 268], [285, 322], [420, 234]]} duration={2.2} label="0x21" />
            <Packet on={s === 5} points={[[500, 234], [600, 100]]} duration={1.2} label="jmp" />
            <Packet on={s === 5} points={[[385, 196], [610, 300]]} duration={1.4} delay={0.3} label="push" />
            <Packet on={s === 6} points={[[650, 60], [650, 40], [80, 40], [80, 60]]} duration={2.2} label="EOI" />
            <Packet on={s === 7} points={[[640, 210], [380, 150]]} duration={1.4} label="iret" />
            <Pulse x={285} y={150} on={s === 7} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
