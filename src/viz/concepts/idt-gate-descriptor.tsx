/* The i386 IDT: IDTR -> 256 gates of 8 bytes -> one gate's bytes -> type_attr bits -> ISR stub -> common handler.
   Worked example: IDT at 0x00105000, gate 0x21 (IRQ 1 after remapping) pointing at a stub at 0x00101A40,
   selector 0x08, type_attr 0x8E. Bytes are shown in memory order (little-endian). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'idt-gate-descriptor',
  title: 'The IDT and one gate, byte by byte',
  summary: 'IDTR points at 256 eight-byte gates; one gate holds a split handler offset, the 0x08 code selector and type_attr 0x8E, and leads to an ISR stub and a common handler.',
  lessons: ['t4m2l3'],
  articles: ['Interrupt Descriptor Table', 'Interrupt Service Routines', 'Interrupts Tutorial'],
  group: 'Interrupts',
  order: 430,
}

const steps: VizStep[] = [
  { caption: 'lidt loads IDTR: the table’s base address and its limit.', detail: 'On i386 IDTR is 6 bytes: a 32-bit base (linear address) and a 16-bit limit = size − 1 = 256 × 8 − 1 = 0x7FF.' },
  { caption: 'The IDT is 256 gates of 8 bytes. Gate n sits at base + n × 8.', detail: 'Unlike the GDT, entry 0 is used: it is vector 0, divide error. The last gate, 0xFF, starts at base + 0x7F8.' },
  { caption: 'Vectors 0–31 are reserved for CPU exceptions.', detail: 'Intel defines them: #DE 0, #UD 6, #DF 8, #GP 13, #PF 14 and so on. Do not put anything else here.' },
  { caption: 'Remapped PIC IRQs use 32–47; 0x80 is a common system-call gate.', detail: 'IRQ 0–15 → vectors 0x20–0x2F after remapping. Many Unix-like kernels use int 0x80. The rest are yours to assign.' },
  { caption: 'Zoom into gate 0x21: the handler offset is split in two halves.', detail: 'Bytes 0–1 hold offset bits 15:0, bytes 6–7 hold bits 31:16. Handler 0x00101A40 → 0x1A40 and 0x0010, stored little-endian.' },
  { caption: 'Bytes 2–3: selector 0x08, the kernel code segment in the GDT.', detail: 'The CPU loads CS from here when it enters the handler. It must point at a valid code segment, or the CPU faults.' },
  { caption: 'Byte 5, type_attr 0x8E: present, DPL 0, type 0xE = 32-bit interrupt gate.', detail: 'Type 0xF (0x8F) is a trap gate: same layout, but IF is left unchanged on entry. DPL limits who may use int n; hardware IRQs ignore it.' },
  { caption: 'Each gate points at a tiny stub that pushes an error code and the vector.', detail: 'The CPU pushes an error code only for some exceptions (8, 10–14, 17, 21…). For the rest the stub pushes a dummy 0, so every frame looks the same.' },
  { caption: 'Every stub jumps to one common handler that saves state and calls C.', detail: 'isr_common saves registers, calls isr_handler(regs), restores them, drops the vector and error code with add esp, 8, then iret.', ms: 3800 },
]

/* IDT strip: rows top = low vectors */
const STRIP: { label: string; sub: string; h: number; off: string }[] = [
  { label: '0x00–0x1F', sub: 'CPU exceptions', h: 70, off: '+0x000' },
  { label: '0x20–0x2F', sub: 'PIC IRQ 0–15', h: 50, off: '+0x100' },
  { label: '0x30–0x7F', sub: 'free', h: 56, off: '+0x180' },
  { label: '0x80', sub: 'syscall (int 0x80)', h: 30, off: '+0x400' },
  { label: '0x81–0xFF', sub: 'free', h: 84, off: '+0x408' },
]
const SX = 90
const SW = 150
const SY = 130

/* gate bytes in memory order */
const BYTES = ['0x40', '0x1A', '0x08', '0x00', '0x00', '0x8E', '0x10', '0x00']
const GX = 290
const CW = 60
const GY = 166
const FIELDS: { a: number; n: number; name: string; val: string; at: number[] }[] = [
  { a: 0, n: 2, name: 'offset 15:0', val: '0x1A40', at: [4] },
  { a: 2, n: 2, name: 'selector', val: '0x0008', at: [5] },
  { a: 4, n: 1, name: 'zero', val: '0x00', at: [] },
  { a: 5, n: 1, name: 'type_attr', val: '0x8E', at: [6] },
  { a: 6, n: 2, name: 'offset 31:16', val: '0x0010', at: [4] },
]

const STUB = ['isr33:            ; IRQ 1', '  push 0         ; dummy error', '  push 33        ; vector 0x21', '  jmp isr_common']
const COMMON = ['isr_common:', '  pusha          ; save regs', '  call isr_handler', '  popa / add esp, 8 / iret']

const EXAMPLES: [string, number][] = [
  ['n = 0x00  →  0x00105000   #DE divide error', 2],
  ['n = 0x0D  →  0x00105068   #GP protection', 2],
  ['n = 0x21  →  0x00105108   IRQ 1 keyboard', 3],
  ['n = 0x80  →  0x00105400   int 0x80 syscall', 3],
  ['n = 0xFF  →  0x001057F8   last gate', 0],
]

function Code({ x, y, lines, lh = 17, active }: { x: number; y: number; lines: string[]; lh?: number; active?: number }) {
  return (
    <g>
      {lines.map((l, i) => (
        <Label key={i} x={x} y={y + i * lh} size={11} weight={active === i ? 600 : 400} dim={active !== undefined && active !== i}>
          {l.replace(/ /g, ' ')}
        </Label>
      ))}
    </g>
  )
}

export default function IdtGateDescriptor() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        let cy = SY
        const rowY = STRIP.map((r) => { const y = cy; cy += r.h; return y })
        const stripState = (i: number) => {
          if (s < 1) return 'dim' as const
          if (s === 2) return i === 0 ? 'on' as const : 'dim' as const
          if (s === 3) return i === 1 || i === 3 ? 'on' as const : 'dim' as const
          if (s >= 4) return i === 1 ? 'off' as const : 'dim' as const
          return 'off' as const
        }
        const fieldOn = (f: number) => (s === 4 && (f === 0 || f === 4)) || (s === 5 && f === 1) || (s === 6 && f === 3) || (s === 7 && (f === 0 || f === 4))
        const gateY = rowY[1] + 50 / 16 + 1.5 // vector 0x21 inside the 0x20–0x2F band
        return (
          <Scene label={meta.summary}>
            {/* IDTR */}
            <Label x={SX} y={30} size={11} dim>IDTR · loaded by lidt [idtr]</Label>
            <Block x={SX} y={42} w={190} h={38} label="base 0x00105000" mono size={12} state={s === 0 ? 'on' : 'off'} />
            <Block x={SX + 190} y={42} w={110} h={38} label="limit 0x07FF" mono size={12} state={s === 0 ? 'on' : 'off'} />
            <Label x={SX} y={96} size={10.5} dim>47</Label>
            <Label x={SX + 188} y={96} size={10.5} dim anchor="end">16</Label>
            <Label x={SX + 194} y={96} size={10.5} dim>15</Label>
            <Label x={SX + 300} y={96} size={10.5} dim anchor="end">0</Label>
            <Label x={SX + 312} y={66} size={11} on={s === 0}>= 256 × 8 − 1</Label>
            <Wire from={[SX + 20, 80]} to={[SX + 20, 127]} on={s >= 1} />

            {/* IDT strip */}
            <Label x={SX + 32} y={122} size={11} dim>IDT · 256 gates × 8 bytes</Label>
            {STRIP.map((r, i) => (
              <g key={i}>
                <Block x={SX} y={rowY[i]} w={SW} h={r.h} label={i === 3 ? '0x80 syscall' : r.label} sub={i === 3 ? undefined : r.sub} mono size={12} state={stripState(i)} />
                <Label x={SX - 8} y={rowY[i] + 10} size={10} anchor="end" dim on={s >= 1}>{r.off}</Label>
              </g>
            ))}
            <Label x={SX - 8} y={420} size={10} anchor="end" dim on={s >= 1}>+0x7FF</Label>
            <Packet on={s === 1} points={[[SX + 20, 134], [SX + 20, 416]]} duration={2.4} label="n × 8" />

            {/* address examples (steps 1-3) */}
            <Appear on={s >= 1 && s <= 3} dx={-12} dy={0}>
              <Label x={390} y={226} size={11} dim>WHERE IS GATE n?</Label>
              <Label x={390} y={252} size={14} weight={600}>address = base + n × 8</Label>
              {EXAMPLES.map(([t, grp], i) => (
                <Label key={i} x={390} y={286 + i * 22} size={11.5} weight={(s === 2 && grp === 2) || (s === 3 && grp === 3) ? 600 : 400}
                  dim={(s === 2 && grp !== 2) || (s === 3 && grp !== 3)}>{t.replace(/ /g, ' ')}</Label>
              ))}
            </Appear>

            {/* gate 0x21 marker */}
            <Appear on={s >= 4}>
              <line x1={SX} x2={SX + SW} y1={gateY} y2={gateY} stroke="var(--viz-fg)" strokeWidth={3} />
            </Appear>
            <Pulse x={SX + SW} y={gateY} on={s === 4} />
            <Wire d={`M${SX + SW} ${gateY} C 270 ${gateY}, 262 186, ${GX - 4} 186`} on={s >= 4} />

            {/* gate bytes */}
            <Appear on={s >= 4} dx={-12} dy={0}>
              <Label x={GX} y={138} size={11} dim>IDT[0x21] at 0x00105108 · bytes in memory order</Label>
              {BYTES.map((b, i) => (
                <g key={i}>
                  <Label x={GX + i * CW + CW / 2} y={158} size={10.5} anchor="middle" dim>{`+${i}`}</Label>
                  <Block x={GX + i * CW} y={GY} w={CW} h={40} label={b} mono size={13}
                    state={FIELDS.some((f, fi) => fieldOn(fi) && i >= f.a && i < f.a + f.n) ? 'on' : s >= 5 && !FIELDS.some((f, fi) => fieldOn(fi) && i >= f.a && i < f.a + f.n) ? 'dim' : 'off'} />
                </g>
              ))}
              {FIELDS.map((f, fi) => {
                const x0 = GX + f.a * CW + 4
                const x1 = GX + (f.a + f.n) * CW - 4
                const on = fieldOn(fi)
                return (
                  <g key={fi}>
                    <motion.path d={`M${x0} 212 V218 H${x1} V212`} fill="none" initial={false}
                      animate={{ stroke: on ? 'var(--viz-fg)' : 'var(--viz-dim)', strokeWidth: on ? 2 : 1 }} transition={ease} />
                    <Label x={(x0 + x1) / 2} y={234} size={10.5} anchor="middle" dim={!on}>{f.name}</Label>
                    <Label x={(x0 + x1) / 2} y={249} size={11} anchor="middle" dim={!on} weight={on ? 600 : 400}>{f.val}</Label>
                  </g>
                )
              })}
            </Appear>
            <Label x={GX + 4} y={272} size={11.5} on={s === 4} weight={600}>offset = 0x0010 : 0x1A40 = 0x00101A40</Label>
            <Label x={GX + 4} y={272} size={11.5} on={s === 5} weight={600}>CS ← 0x08 (GDT entry 1, ring 0)</Label>

            {/* type_attr bits */}
            <Wire d={`M${GX + 5 * CW + CW / 2} 256 C ${GX + 5 * CW + CW / 2} 268, 644 266, 644 280`} on={s >= 6} />
            <Appear on={s >= 6}>
              <BitField x={508} y={294} cellW={34} h={26} bits="10001110" fields={[[0, 1, 'P=1'], [1, 2, 'DPL=0'], [3, 1, '0'], [4, 4, 'type 0xE']]} active={s === 6 ? 3 : undefined} />
              <Label x={300} y={298} size={11} weight={600}>0x8E  interrupt gate</Label>
              <Label x={300} y={313} size={10.5} dim>{'      IF cleared on entry'.replace(/ /g, ' ')}</Label>
              <Label x={300} y={331} size={11}>0x8F  trap gate</Label>
              <Label x={300} y={346} size={10.5} dim>{'      IF left as it was'.replace(/ /g, ' ')}</Label>
            </Appear>

            {/* stub and common handler */}
            <Wire d={`M${GX} 222 H282 V390 H298`} on={s >= 7} dashed />
            <Appear on={s >= 7} dx={0} dy={10}>
              <Block x={300} y={354} w={226} h={74} state={s === 7 ? 'on' : 'off'} />
              <Code x={310} y={372} lines={STUB} active={undefined} />
            </Appear>
            <Wire from={[526, 395]} to={[552, 395]} on={s >= 8} />
            <Appear on={s >= 8} dx={-10} dy={0}>
              <Block x={554} y={354} w={226} h={74} state={s === 8 ? 'on' : 'off'} />
              <Code x={564} y={372} lines={COMMON} />
            </Appear>
            <Packet on={s === 7} points={[[GX + 60, 210], [282, 222], [282, 390], [330, 390]]} duration={1.8} label="enter" />
            <Packet on={s === 8} points={[[500, 410], [540, 395], [620, 395]]} duration={1.6} label="jmp" />
          </Scene>
        )
      }}
    </VizStage>
  )
}
