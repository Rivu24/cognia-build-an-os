/* The 8259 PIC pair: cascade on IRQ 2, the BIOS vector clash with CPU exceptions, the ICW1-ICW4 remap to
   0x20/0x28, masks on 0x21/0xA1, EOI on 0x20 (and 0xA0), and spurious IRQ 7/15.
   Values follow the OSDev Wiki "8259 PIC" code: ICW1 = 0x11, ICW2 = 0x20 / 0x28, ICW3 = 4 / 2, ICW4 = 0x01. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'pic-remap',
  title: 'Remapping the 8259 PIC',
  summary: 'Master and slave 8259 PICs cascade on IRQ 2; the BIOS vectors collide with CPU exceptions, so ICW1–ICW4 move them to 0x20–0x2F, then masks, EOI and spurious IRQs.',
  lessons: ['t5m1l1'],
  articles: ['8259 PIC', 'Interrupts'],
  group: 'Interrupts',
  order: 510,
}

const steps: VizStep[] = [
  { caption: 'Two 8259 PICs: the master takes IRQ 0–7, the slave IRQ 8–15.', detail: 'The slave’s output feeds the master’s input 2 (cascade). So IRQ 12 from the mouse reaches the CPU through both chips, and IRQ 2 itself is never a device.' },
  { caption: 'At boot, the BIOS maps master IRQs to vectors 0x08–0x0F.', detail: 'Each PIC adds its line number to a vector offset: master 0x08, slave 0x70. That suits real mode.' },
  { caption: 'In protected mode that clashes: 0x08–0x0F are CPU exceptions.', detail: 'A timer tick (IRQ 0) arrives as vector 8, the same as a double fault; IRQ 5 looks like #GP. You cannot tell them apart.' },
  { caption: 'ICW1 = 0x11 on both command ports starts re-initialisation.', detail: '0x10 = initialise, 0x01 = an ICW4 will follow. Each PIC now expects three more words on its data port (0x21 / 0xA1).' },
  { caption: 'ICW2 sets the vector offsets: master 0x20, slave 0x28.', detail: 'Offsets must be multiples of 8, because the PIC puts the line number (0–7) in the low 3 bits. IRQ 0–15 now land on 0x20–0x2F.' },
  { caption: 'ICW3 describes the wiring; ICW4 = 0x01 selects 8086 mode.', detail: 'Master gets 0x04 (bit 2: a slave sits on IR2). Slave gets 0x02 (its cascade identity, 2). Without ICW4 = 0x01 the PIC behaves like an 8080 part.' },
  { caption: 'Now the data ports are mask registers: a 1 bit silences that line.', detail: 'outb(0x21, 0xFC) lets only IRQ 0 and IRQ 1 through. The slave is fully masked with 0xFF (and IRQ 2 is masked on the master too).' },
  { caption: 'Every IRQ handler ends with EOI: outb(0x20, 0x20).', detail: 'For IRQ 8–15 send it to the slave (0xA0) and the master (0x20). Without EOI the PIC never delivers that IRQ, or lower-priority ones, again.' },
  { caption: 'Spurious IRQ 7 (or 15): check the In-Service Register before EOI.', detail: 'If the request vanished before the CPU acknowledged it, the PIC reports its lowest-priority line. ISR bit clear = spurious: send no EOI (for 15, still EOI the master).', ms: 4200 },
]

const MASTER_PINS = ['IRQ0 timer', 'IRQ1 keyboard', 'IRQ2 cascade', 'IRQ3 COM2', 'IRQ4 COM1', 'IRQ5 LPT2', 'IRQ6 floppy', 'IRQ7 LPT1']
const SLAVE_PINS = ['IRQ8 RTC', 'IRQ9', 'IRQ10', 'IRQ11', 'IRQ12 mouse', 'IRQ13 FPU', 'IRQ14 ATA 1', 'IRQ15 ATA 2']
const MY = 60
const SY = 262
const pinY = (base: number, i: number) => base + 15 + i * 20

const vx = (v: number) => (v <= 0x30 ? 390 + v * 6 : 712 + (v - 0x70) * 6)

const WRITES: [string, string, string, number][] = [
  ['outb(0x20, 0x11)', 'outb(0xA0, 0x11)', 'ICW1 init', 3],
  ['outb(0x21, 0x20)', 'outb(0xA1, 0x28)', 'ICW2 offset', 4],
  ['outb(0x21, 0x04)', 'outb(0xA1, 0x02)', 'ICW3 wiring', 5],
  ['outb(0x21, 0x01)', 'outb(0xA1, 0x01)', 'ICW4 8086', 5],
  ['outb(0x21, 0xFC)', 'outb(0xA1, 0xFF)', 'masks (IMR)', 6],
  ['outb(0x20, 0x20)', 'IRQ≥8: 0xA0 too', 'EOI', 7],
  ['outb(0x20, 0x0B)', 'inb(0x20) = ISR', 'spurious?', 8],
]
const nb = (t: string) => t.replace(/ /g, ' ')

function MaskBits({ x, y, bits, on }: { x: number; y: number; bits: string; on: boolean }) {
  return (
    <g>
      {bits.split('').map((b, i) => (
        <g key={i}>
          <motion.rect x={x + i * 14} y={y} width={14} height={16} stroke="var(--viz-faint)" initial={false}
            animate={{ fill: on && b === '1' ? 'var(--viz-fg)' : 'var(--viz-bg)' }} transition={{ ...ease, delay: on ? i * 0.06 : 0 }} />
          <motion.text x={x + i * 14 + 7} y={y + 12} textAnchor="middle" initial={false}
            animate={{ fill: on && b === '1' ? 'var(--viz-bg)' : 'var(--viz-dim)', opacity: on ? 1 : 0.5 }}
            style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{on ? b : '·'}</motion.text>
        </g>
      ))}
    </g>
  )
}

export default function PicRemap() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const remapped = s >= 4
        const cpuSub = s === 0 ? 'INTR' : s <= 2 ? 'gets 0x08' : s <= 6 ? 'cli while remapping' : s === 7 ? 'gets 0x20' : 'gets 0x27'
        return (
          <Scene label={meta.summary}>
            {/* master */}
            {MASTER_PINS.map((p, i) => {
              const casc = i === 2 && (s === 0 || s === 5)
              const lit = casc || ((s === 1 || s === 2 || s === 7) && i === 0)
              return (
                <g key={i}>
                  <Wire from={[160, pinY(MY, i)]} to={[200, pinY(MY, i)]} arrow={false} dim={!lit && !(s === 8 && i === 1)} width={lit ? 2.2 : 1} />
                  <Label x={154} y={pinY(MY, i) + 4} size={10.5} anchor="end" weight={casc ? 600 : 400}
                    dim={!(lit || (s === 8 && i === 1) || (s === 6 && i < 2))}>{nb(casc ? 'IRQ2 ← slave' : p)}</Label>
                </g>
              )
            })}
            <Block x={200} y={MY} w={150} h={170} state={s === 1 || s === 2 || s === 7 || s === 8 ? 'on' : 'off'} />
            <Label x={275} y={MY + 24} size={12} anchor="middle" weight={600}>MASTER</Label>
            <Label x={275} y={MY + 40} size={10.5} anchor="middle" dim>cmd 0x20 · data 0x21</Label>
            <Label x={275} y={MY + 74} size={10.5} anchor="middle" dim>vector offset</Label>
            <Label x={275} y={MY + 96} size={16} anchor="middle" weight={600}>{remapped ? '0x20' : '0x08'}</Label>
            <Label x={275} y={MY + 126} size={10.5} anchor="middle" dim>mask (IMR)</Label>
            <MaskBits x={219} y={MY + 134} bits="11111100" on={s >= 6} />
            <Label x={219} y={MY + 162} size={9.5} dim>7</Label>
            <Label x={331} y={MY + 162} size={9.5} anchor="end" dim>0</Label>

            {/* slave */}
            {SLAVE_PINS.map((p, i) => (
              <g key={i}>
                <Wire from={[160, pinY(SY, i)]} to={[200, pinY(SY, i)]} arrow={false} dim={!(s === 0 && i === 4)} width={s === 0 && i === 4 ? 2.2 : 1} />
                <Label x={154} y={pinY(SY, i) + 4} size={10.5} anchor="end" dim={!(s === 0 && i === 4)}>{nb(p)}</Label>
              </g>
            ))}
            <Block x={200} y={SY} w={150} h={168} state={s === 0 ? 'on' : 'off'} />
            <Label x={275} y={SY + 24} size={12} anchor="middle" weight={600}>SLAVE</Label>
            <Label x={275} y={SY + 40} size={10.5} anchor="middle" dim>cmd 0xA0 · data 0xA1</Label>
            <Label x={275} y={SY + 74} size={10.5} anchor="middle" dim>vector offset</Label>
            <Label x={275} y={SY + 96} size={16} anchor="middle" weight={600}>{remapped ? '0x28' : '0x70'}</Label>
            <Label x={275} y={SY + 126} size={10.5} anchor="middle" dim>mask (IMR)</Label>
            <MaskBits x={219} y={SY + 134} bits="11111111" on={s >= 6} />

            {/* cascade */}
            <Wire from={[275, SY]} to={[275, MY + 172]} width={s === 0 || s === 5 ? 2.4 : 1.6} />
            <Label x={283} y={MY + 189} size={10.5} on={s === 0 || s === 5}>slave INT → master IR2</Label>
            <Appear on={s === 5}>
              <Label x={283} y={MY + 203} size={10.5} weight={600}>ICW3: 0x04 / 0x02</Label>
            </Appear>
            <Pulse x={275} y={SY - 16} on={s === 5} />

            {/* CPU */}
            <Wire from={[350, 100]} to={[618, 100]} />
            <Label x={485} y={92} size={10.5} anchor="middle">INTR</Label>
            <Block x={620} y={60} w={160} h={80} label="CPU" sub={cpuSub} state={s === 2 ? 'on' : 'off'} />
            <Appear on={s === 2}>
              <Label x={620} y={160} size={10.5} weight={600}>IRQ0 → 0x08 = #DF</Label>
              <Label x={620} y={174} size={10.5} weight={600}>IRQ5 → 0x0D = #GP</Label>
            </Appear>
            <Appear on={s === 7}>
              <Label x={620} y={160} size={10.5}>IRQ0 → 0x20: no clash</Label>
            </Appear>
            <Appear on={s === 8}>
              <Label x={620} y={160} size={10.5} weight={600}>ISR bit 7 = 0 ?</Label>
              <Label x={620} y={174} size={10.5}>→ spurious, no EOI</Label>
            </Appear>

            {/* vector line */}
            <Label x={390} y={190} size={11} dim>VECTORS</Label>
            <Block x={390} y={196} w={192} h={24} label="CPU exceptions 0x00–0x1F" mono size={10.5} state={s === 2 ? 'on' : 'hatch'} />
            <Block x={582} y={196} w={96} h={24} label="free" mono size={10.5} state="dim" />
            <Block x={712} y={196} w={48} h={24} state="dim" />
            <Label x={695} y={213} size={11} anchor="middle" dim>//</Label>
            <motion.g initial={false} animate={{ x: remapped ? vx(0x20) - vx(0x08) : 0 }} transition={{ type: 'spring', stiffness: 90, damping: 16 }}>
              <Block x={vx(0x08)} y={226} w={48} h={22} label="IRQ0–7" mono size={10.5} state={s === 1 || s === 2 || s === 4 ? 'on' : 'fill'} />
            </motion.g>
            <motion.g initial={false} animate={{ x: remapped ? vx(0x28) - vx(0x70) : 0 }} transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.15 }}>
              <Block x={vx(0x70)} y={226} w={48} h={22} label="IRQ8–15" mono size={10.5} state={s === 4 ? 'on' : 'fill'} />
            </motion.g>
            {[[0x08, '0x08'], [0x20, '0x20'], [0x28, '0x28'], [0x70, '0x70']].map(([v, t]) => (
              <g key={t as string}>
                <line x1={vx(v as number)} x2={vx(v as number)} y1={250} y2={256} stroke="var(--viz-dim)" />
                <Label x={vx(v as number)} y={268} size={10} anchor="middle" dim>{t}</Label>
              </g>
            ))}
            <Appear on={s === 2} dy={0}>
              <motion.rect x={vx(0x08)} y={192} width={48} height={58} fill="none" stroke="var(--viz-fg)" strokeWidth={2} strokeDasharray="4 3"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            </Appear>

            {/* port writes */}
            <Label x={400} y={300} size={11} dim>PORT WRITES</Label>
            {WRITES.map(([a, b, c, at], i) => {
              const active = at === s
              return (
                <g key={i}>
                  <Label x={400} y={320 + i * 17} size={11} on={s >= at} weight={active ? 600 : 400} dim={!active}>{a}</Label>
                  <Label x={532} y={320 + i * 17} size={11} on={s >= at} weight={active ? 600 : 400} dim={!active}>{nb(b)}</Label>
                  <Label x={664} y={320 + i * 17} size={11} on={s >= at} weight={active ? 600 : 400} dim={!active}>{c}</Label>
                </g>
              )
            })}

            {/* motion */}
            <Packet on={s === 0} points={[[160, pinY(SY, 4)], [275, SY + 50], [275, MY + 172], [300, 100], [618, 100]]} duration={2.4} />
            <Packet on={s === 1 || s === 2} points={[[160, pinY(MY, 0)], [300, 100], [618, 100]]} duration={1.8} label="0x08" />
            <Packet on={s === 3} points={[[620, 120], [352, 80]]} duration={1.3} label="0x11" />
            <Packet on={s === 3} points={[[620, 130], [352, 290]]} duration={1.3} delay={0.2} label="0x11" />
            <Pulse x={275} y={MY + 90} on={s === 4} />
            <Pulse x={275} y={SY + 90} on={s === 4} />
            <Pulse x={275} y={MY + 142} on={s === 6} />
            <Packet on={s === 7} points={[[160, pinY(MY, 0)], [300, 100], [618, 100]]} duration={1.6} label="0x20" />
            <Packet on={s === 7} points={[[620, 128], [352, 128]]} duration={1.4} delay={1.1} label="EOI" />
            <Packet on={s === 8} points={[[150, pinY(MY, 1)], [176, pinY(MY, 1)], [190, pinY(MY, 1)]]} duration={1} label="gone" />
            <Packet on={s === 8} points={[[352, 100], [618, 100]]} duration={1.5} delay={0.5} label="0x27" />
          </Scene>
        )
      }}
    </VizStage>
  )
}
