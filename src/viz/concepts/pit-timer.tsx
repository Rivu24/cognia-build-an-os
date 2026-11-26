/* The PIT (8253/8254) as a timer tick source: 1.193182 MHz oscillator -> channel 0 divider -> IRQ0 -> vector 0x20.
   Worked example: 100 Hz. divisor = 1193182 / 100 = 11931.82 -> 11932 = 0x2E9C (lo 0x9C, hi 0x2E);
   command byte 0x36 = channel 0, lobyte/hibyte, mode 3, binary. 1193182 / 11932 = 99.998 Hz. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'pit-timer',
  title: 'A timer tick from the PIT',
  summary: 'The PIT divides its 1.193182 MHz clock by 11932 to fire IRQ 0 about 100 times a second; each tick runs ticks++ and EOI, which sleep() and later the scheduler build on.',
  lessons: ['t5m1l2'],
  articles: ['Programmable Interval Timer', 'Timer Interrupt Sources'],
  group: 'Interrupts',
  order: 520,
}

const steps: VizStep[] = [
  { caption: 'The PIT’s oscillator runs at about 1.193182 MHz.', detail: 'A 14.31818 MHz crystal divided by 12, inherited from the original IBM PC. Far too fast to interrupt the CPU on every pulse.' },
  { caption: 'Channel 0 counts down from a reload value; at zero it fires and reloads.', detail: 'A 16-bit frequency divider: output = 1193182 / reload. The BIOS leaves 65536, which gives 18.2 Hz (one IRQ every 54.9 ms).' },
  { caption: 'Pick 100 Hz: divisor = 1193182 / 100 ≈ 11932 (0x2E9C).', detail: '1193182 / 11932 = 99.998 Hz, so one tick about every 10 ms. Divisors must fit in 16 bits, so the slowest rate is about 18 Hz.' },
  { caption: 'Send command 0x36 to port 0x43: channel 0, low then high byte, mode 3.', detail: 'Bits 7–6 = 00 channel 0, 5–4 = 11 lobyte/hibyte, 3–1 = 011 square wave, bit 0 = 0 binary. Mode 2 (0x34) works too.' },
  { caption: 'Write the divisor to port 0x40: low byte 0x9C, then high byte 0x2E.', detail: 'The data port is 8 bits wide, so the 16-bit value goes in two writes to the same port, low byte first.' },
  { caption: 'Each time the count runs out: IRQ 0 → PIC → vector 0x20.', detail: 'Channel 0 is wired to IRQ 0. With the PIC remapped, that arrives as vector 0x20 in your IDT. Unmask IRQ 0 on port 0x21.' },
  { caption: 'The handler adds one to ticks and sends EOI.', detail: 'outb(0x20, 0x20) lets the PIC deliver the next tick. Keep the handler short: it runs 100 times a second.' },
  { caption: 'sleep(ms) just waits until enough ticks have passed.', detail: 'At 100 Hz one tick is 10 ms, so sleep(50) waits 5 ticks. Run hlt in the wait loop so the CPU rests until the next interrupt.' },
  { caption: 'Later the same tick drives the scheduler.', detail: 'Every 3 ticks the handler calls schedule() to switch tasks. Send EOI first: if schedule() switches away before EOI, the timer stops.', ms: 4200 },
]

const nb = (t: string) => t.replace(/ /g, ' ')

/** A square wave that scrolls to the right inside a clip box: a signal travelling along a wire. */
function ScrollWave({ id, x, y, w, h, period, duration, on }: { id: string; x: number; y: number; w: number; h: number; period: number; duration: number; on: boolean }) {
  const n = Math.ceil(w / period) + 2
  let d = `M${x - period} ${y + h}`
  for (let i = 0; i < n; i++) {
    const x0 = x - period + i * period
    d += ` V${y} H${x0 + period / 2} V${y + h} H${x0 + period}`
  }
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y - 3} width={w} height={h + 6} />
        </clipPath>
      </defs>
      <motion.g initial={false} animate={{ opacity: on ? 1 : 0.25 }}>
        <g clipPath={`url(#${id})`}>
          <motion.path key={`${period}-${duration}`} d={d} fill="none" stroke="var(--viz-fg)" strokeWidth={1.4}
            initial={{ x: 0 }} animate={{ x: on ? period : 0 }} transition={{ duration, repeat: Infinity, ease: 'linear' }} />
        </g>
      </motion.g>
    </g>
  )
}

const TX = 20
const TW = 44
const TN = 12
const TY = 352

export default function PitTimer() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const fast = s >= 4
        const cycle = fast ? 0.5 : 1.6
        return (
          <Scene label={meta.summary}>
            {/* signal chain */}
            <Block x={20} y={55} w={130} h={60} label="Oscillator" sub="1.193182 MHz" state={s === 0 ? 'on' : 'off'} />
            <ScrollWave id="pit-osc" x={160} y={72} w={140} h={26} period={10} duration={0.25} on />
            <Label x={230} y={64} size={10.5} anchor="middle" dim>1,193,182 pulses/s</Label>

            <Block x={310} y={45} w={200} h={85} state={s === 1 || s === 3 || s === 4 ? 'on' : s === 0 ? 'dim' : 'off'} />
            <motion.g initial={false} animate={{ opacity: s === 0 ? 0.35 : 1 }}>
            <Label x={322} y={64} size={11} dim>CHANNEL 0 (divider)</Label>
            <Label x={322} y={84} size={12} weight={600}>{nb(s >= 4 ? 'reload 11932' : 'reload 65536 (BIOS)')}</Label>
            <rect x={322} y={94} width={176} height={12} fill="none" stroke="var(--viz-faint)" />
            {s >= 1 && (
              <motion.rect key={cycle} x={322} y={94} height={12} fill="var(--viz-fg)" initial={{ width: 176 }} animate={{ width: [176, 0] }}
                transition={{ duration: cycle, repeat: Infinity, ease: 'linear' }} />
            )}
            <Label x={322} y={122} size={10.5} dim>counts down, reloads at 0</Label>

            </motion.g>
            <ScrollWave id="pit-out" x={520} y={72} w={80} h={26} period={40} duration={cycle} on={s >= 1} />
            <Label x={560} y={64} size={10.5} anchor="middle" dim on={s >= 1}>{fast ? '≈100 Hz' : '18.2 Hz'}</Label>
            <Wire from={[600, 85]} to={[608, 85]} on={s >= 1} />
            <Block x={610} y={55} w={170} h={60} label="8259 PIC" sub="IRQ0 → 0x20" state={s === 5 ? 'on' : s < 5 ? 'dim' : 'off'} />

            <Wire from={[675, 115]} to={[675, 163]} on={s >= 5} />
            <Block x={620} y={165} w={110} h={50} label="IDT[0x20]" sub="timer stub" mono size={12} state={s === 5 ? 'on' : s < 5 ? 'dim' : 'off'} />
            <Wire from={[675, 215]} to={[675, 318]} on={s >= 5} />

            {/* divisor */}
            <Appear on={s >= 2}>
              <Label x={20} y={166} size={11} dim>DIVISOR FOR 100 Hz</Label>
              <Label x={20} y={192} size={15} weight={600}>1193182 / 100</Label>
              <Label x={20} y={214} size={12}>= 11931.82 → 11932</Label>
              <Label x={20} y={238} size={15} weight={600}>= 0x2E9C</Label>
              <Block x={20} y={250} w={80} h={38} label="0x2E" sub="high · 2nd" mono size={13} state={s === 4 ? 'on' : 'off'} />
              <Block x={100} y={250} w={80} h={38} label="0x9C" sub="low · 1st" mono size={13} state={s === 4 ? 'on' : 'off'} />
            </Appear>
            <Label x={20} y={308} size={11} on={s >= 4} weight={s === 4 ? 600 : 400} dim={s > 4}>outb(0x40, 0x9C); outb(0x40, 0x2E);</Label>
            <Pulse x={140} y={269} on={s === 4} />

            {/* command byte */}
            <Appear on={s >= 3}>
              <Label x={310} y={166} size={11} dim>COMMAND BYTE → port 0x43</Label>
              <BitField x={310} y={190} cellW={32} h={26} bits="00110110" fields={[[0, 2, 'ch 0'], [2, 2, 'lo/hi'], [4, 3, 'mode 3'], [7, 1, 'bin']]} active={s === 3 ? 2 : undefined} />
              <Label x={310} y={266} size={15} weight={600}>= 0x36</Label>
              <Label x={392} y={266} size={11} dim>(mode 2 would be 0x34)</Label>
            </Appear>
            <Label x={310} y={308} size={11} on={s >= 3} weight={s === 3 ? 600 : 400} dim={s > 3}>outb(0x43, 0x36);</Label>

            {/* ticks timeline */}
            <Label x={TX} y={330} size={11} dim on={s >= 5}>TICKS · one cell = one tick ≈ 10 ms</Label>
            <Appear on={s >= 5} dy={0}>
              {s >= 6 && (
                <motion.rect x={TX} y={TY} height={28} fill="var(--viz-fg)" fillOpacity={0.28} initial={{ width: 0 }}
                  animate={{ width: [0, TW * TN] }} transition={{ duration: TN * 0.5, repeat: Infinity, ease: (t: number) => Math.floor(t * TN + 0.0001) / TN }} />
              )}
              {Array.from({ length: TN }, (_, i) => (
                <rect key={i} x={TX + i * TW} y={TY} width={TW} height={28} fill="none" stroke="var(--viz-faint)" />
              ))}
              <rect x={TX} y={TY} width={TW * TN} height={28} fill="none" stroke="var(--viz-dim)" />
            </Appear>
            <Appear on={s >= 7}>
              <path d={`M${TX + 2} ${TY - 4} V${TY - 9} H${TX + 5 * TW - 2} V${TY - 4}`} fill="none" stroke="var(--viz-fg)" strokeWidth={1.6} />
              <Label x={TX + 5 * TW + 10} y={TY - 4} size={11} weight={600}>sleep(50) = 5 ticks</Label>
            </Appear>
            <Appear on={s >= 8}>
              {[3, 6, 9, 12].map((k) => (
                <g key={k}>
                  <line x1={TX + k * TW} x2={TX + k * TW} y1={TY - 2} y2={TY + 38} stroke="var(--viz-fg)" strokeWidth={2.2} />
                  <Label x={TX + k * TW - (k === 12 ? 2 : 0)} y={TY + 52} size={10.5} anchor={k === 12 ? 'end' : 'middle'}>switch</Label>
                </g>
              ))}
            </Appear>

            {/* handler */}
            <Block x={600} y={320} w={180} h={110} state={s === 6 || s === 8 ? 'on' : s < 5 ? 'dim' : 'off'} />
            <motion.g initial={false} animate={{ opacity: s < 5 ? 0.35 : 1 }}>
            <Label x={610} y={338} size={10.5} dim>timer_handler() · 0x20</Label>
            <Label x={610} y={360} size={11.5} weight={s === 6 ? 600 : 400}>ticks++;</Label>
            <Label x={610} y={378} size={11.5} weight={s === 6 ? 600 : 400}>outb(0x20, 0x20);</Label>
            <Label x={610} y={395} size={11.5} on={s >= 8} weight={s === 8 ? 600 : 400}>if (ticks % 3 == 0)</Label>
            <Label x={610} y={414} size={11.5} on={s >= 8} weight={s === 8 ? 600 : 400}>{nb('    schedule();')}</Label>
            </motion.g>
            <Wire d="M760 320 V117" on={s >= 6} dashed />
            <Label x={765} y={250} size={10.5} on={s >= 6}>EOI</Label>

            {/* motion */}
            <Pulse x={85} y={85} on={s === 0} />
            <Packet on={s === 3} points={[[440, 300], [440, 134]]} duration={1.3} label="0x36" />
            <Packet on={s === 4} points={[[140, 250], [330, 134]]} duration={1.2} label="0x9C" />
            <Packet on={s === 4} points={[[60, 250], [330, 134]]} duration={1.2} delay={0.7} label="0x2E" />
            <Packet on={s === 5} points={[[520, 85], [610, 85], [675, 140], [675, 190], [675, 320]]} duration={2} label="IRQ0" />
            <Packet on={s === 6} points={[[760, 318], [760, 118]]} duration={1.2} delay={0.4} label="EOI" />
            <Pulse x={TX + 5 * TW} y={TY + 14} on={s === 7} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
