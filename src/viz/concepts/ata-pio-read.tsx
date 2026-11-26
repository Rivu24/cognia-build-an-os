/* ata-pio-read: a 28-bit LBA PIO read on the primary ATA bus, port by port.
   Worked example: master drive, LBA 0x01234567, sector count 1.
   0x1F6 <- 0xE0 | 0x1 = 0xE1, 0x1F2 <- 1, 0x1F3 <- 0x67, 0x1F4 <- 0x45, 0x1F5 <- 0x23, 0x1F7 <- 0x20,
   poll 0x1F7 until BSY (0x80) clears and DRQ (0x08) sets, then 256 x inw(0x1F0). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'ata-pio-read',
  title: 'ATA PIO: reading one sector',
  summary: 'A 28-bit LBA read on the primary ATA bus: select the drive, write count and LBA, send 0x20, poll BSY and DRQ, then read 256 words from 0x1F0.',
  lessons: ['t9m2l3'],
  articles: ['ATA PIO Mode'],
  group: 'Storage',
  order: 923,
}

const steps: VizStep[] = [
  { caption: 'The primary ATA bus is 8 I/O ports, 0x1F0–0x1F7, plus control port 0x3F6.', detail: 'Each port is a register on the drive. Some mean one thing on read and another on write: 0x1F7 is Status when read and Command when written.' },
  { caption: 'Select the master drive in LBA mode: write 0xE0 | LBA bits 24–27 to 0x1F6.', detail: 'For LBA 0x01234567 the top 4 bits are 0x1, so 0xE0 | 0x01 = 0xE1. Bit 6 turns on LBA mode; bit 4 = 0 picks the master drive.' },
  { caption: 'Write how many sectors to read into 0x1F2: here, 1.', detail: 'The count is one byte. A count of 0 means 256 sectors (128 KiB).' },
  { caption: 'Write the low 24 bits of the LBA, one byte each, to 0x1F3, 0x1F4, 0x1F5.', detail: 'LBA 0x01234567: 0x67 to LBA lo, 0x45 to LBA mid, 0x23 to LBA hi. Bits 24–27 already went into 0x1F6.' },
  { caption: 'Send command 0x20, READ SECTORS, to 0x1F7.', detail: 'Writing the command register starts the operation. The drive reads the sector into its own 512-byte buffer.' },
  { caption: 'Poll the status port: while BSY (bit 7) is set, the drive is busy.', detail: 'While BSY is set the other status bits mean nothing. Keep reading 0x1F7, or wait for IRQ 14 instead of polling.' },
  { caption: 'BSY clears and DRQ (bit 3) sets: the data is ready to transfer.', detail: 'If ERR (bit 0) or DF (bit 5) sets instead, the command failed: mask 0x29 stops the loop on those too. Here status is 0x48: RDY and DRQ.' },
  { caption: 'Read 256 16-bit words from the data port 0x1F0: one 512-byte sector.', detail: 'Each inw moves 2 bytes through the CPU into your buffer. REP INSW does the whole loop in one instruction.' },
  { caption: 'For more sectors, poll and read 256 words again, once per sector.', detail: 'After the last word of a sector, give the drive about 400 ns to update BSY and DRQ before you trust the status again.', ms: 4200 },
]

const CODE: [string, string][] = [
  ['outb(0x1F6, 0xE1);', '// drive, LBA 27:24'],
  ['outb(0x1F2, 1);', '// sector count'],
  ['outb(0x1F3, 0x67);', '// LBA 7:0'],
  ['outb(0x1F4, 0x45);', '// LBA 15:8'],
  ['outb(0x1F5, 0x23);', '// LBA 23:16'],
  ['outb(0x1F7, 0x20);', '// READ SECTORS'],
  ['while (inb(0x1F7) & 0x80);', '// BSY'],
  ['while (!(inb(0x1F7) & 0x29));', '// DRQ|DF|ERR'],
  ['insw(0x1F0, buf, 256);', '// 512 B'],
]
const lineY = (i: number) => 54 + i * 22
/* highlighted code lines per step: [first, count] */
const HL: [number, number][] = [[0, 0], [0, 1], [1, 1], [2, 3], [5, 1], [6, 1], [7, 1], [8, 1], [6, 3]]

const PORTS: [string, string][] = [
  ['0x1F0', 'Data'],
  ['0x1F1', 'Error / Features'],
  ['0x1F2', 'Sector count'],
  ['0x1F3', 'LBA lo'],
  ['0x1F4', 'LBA mid'],
  ['0x1F5', 'LBA hi'],
  ['0x1F6', 'Drive / Head'],
  ['0x1F7', 'Status / Cmd'],
]
const rowY = (i: number) => 34 + i * 28
const rowC = (i: number) => rowY(i) + 14
/* port rows lit per step */
const HOT: number[][] = [[], [6], [2], [3, 4, 5], [7], [7], [7], [0], [7]]

const STATUS = ['01000000', '01000000', '01000000', '01000000', '01000000', '10000000', '01001000', '01001000', '01000000']
const STATUS_HEX = ['0x40', '0x40', '0x40', '0x40', '0x40', '0x80', '0x48', '0x48', '0x40']
const STATUS_FIELDS: [number, number, string][] = ['BSY', 'RDY', 'DF', 'SRV', 'DRQ', 'CORR', 'IDX', 'ERR'].map((n, i) => [i, 1, n])

function portValue(i: number, s: number): string {
  if (i === 0) return s === 7 ? 'word' : '–'
  if (i === 1) return '–'
  if (i === 2) return s >= 2 ? '1' : '–'
  if (i === 3) return s >= 3 ? '0x67' : '–'
  if (i === 4) return s >= 3 ? '0x45' : '–'
  if (i === 5) return s >= 3 ? '0x23' : '–'
  if (i === 6) return s >= 1 ? '0xE1' : '–'
  return s === 4 ? '0x20' : STATUS_HEX[s]
}

export default function AtaPioRead() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const [hl0, hlN] = HL[s]
        const fill = s === 5 ? 1 : s === 6 ? 1 : 0
        return (
          <Scene label={meta.summary}>
            {/* ---------- driver code ---------- */}
            <Label x={20} y={18} size={11} dim>DRIVER CODE (runs on the CPU)</Label>
            <Block x={20} y={28} w={300} h={228} />
            <motion.rect x={24} width={292} initial={false}
              animate={{ y: lineY(hl0) - 15, height: Math.max(1, hlN) * 22, opacity: hlN ? 1 : 0 }} transition={ease}
              fill="none" stroke="var(--viz-fg)" strokeWidth={1.6} filter="url(#viz-glow)" />
            {CODE.map(([c, k], i) => {
              const hot = i >= hl0 && i < hl0 + hlN
              return (
                <g key={i}>
                  <Label x={30} y={lineY(i)} size={11} weight={hot ? 700 : 400} dim={!hot && s > 0}>{c}</Label>
                  <Label x={i < 6 ? 170 : i === 7 ? 232 : 258} y={lineY(i)} size={i === 7 ? 10 : 11} dim>{k}</Label>
                </g>
              )
            })}
            <Wire d="M322 230 C 337 230, 337 186, 323 186" on={s === 8} />

            {/* outb / inb traffic */}
            <Packet on={s === 1} points={[[322, lineY(0) - 4], [340, rowC(6)]]} duration={1.2} label="0xE1" />
            <Packet on={s === 2} points={[[322, lineY(1) - 4], [340, rowC(2)]]} duration={1.2} label="1" />
            <Packet on={s === 3} points={[[322, lineY(2) - 4], [340, rowC(3)]]} duration={1.2} />
            <Packet on={s === 3} points={[[322, lineY(3) - 4], [340, rowC(4)]]} duration={1.2} delay={0.3} />
            <Packet on={s === 3} points={[[322, lineY(4) - 4], [340, rowC(5)]]} duration={1.2} delay={0.6} />
            <Packet on={s === 4} points={[[322, lineY(5) - 4], [340, rowC(7)]]} duration={1.2} label="0x20" />
            <Packet on={s === 5 || s === 6} points={[[340, rowC(7)], [322, lineY(s === 5 ? 6 : 7) - 4]]} duration={0.9} label="inb" />

            {/* ---------- ports ---------- */}
            <Label x={340} y={18} size={11} dim>PRIMARY BUS · I/O PORTS</Label>
            {PORTS.map(([p, n], i) => {
              const hot = HOT[s].includes(i)
              const st = hot ? 'on' : s === 0 ? 'off' : 'dim'
              return (
                <g key={p}>
                  <Block x={340} y={rowY(i)} w={58} h={28} label={p} mono size={11.5} state={st} />
                  <Block x={398} y={rowY(i)} w={106} h={28} label={n} size={11} align="start" state={st} />
                  <Block x={504} y={rowY(i)} w={56} h={28} label={portValue(i, s)} mono size={12} state={hot ? 'fill' : st} />
                </g>
              )
            })}
            <Block x={340} y={268} w={58} h={28} label="0x3F6" mono size={11.5} state={s === 0 ? 'off' : 'dim'} />
            <Block x={398} y={268} w={162} h={28} label="Alt status / Device control" size={11} align="start" state={s === 0 ? 'off' : 'dim'} />
            <Pulse x={369} y={rowC(0)} on={s === 0} r={12} />
            <Pulse x={369} y={282} on={s === 0} r={12} />

            {/* ---------- drive ---------- */}
            <Label x={620} y={18} size={11} dim>ATA DRIVE</Label>
            <Block x={620} y={34} w={160} h={150} state={s >= 4 && s <= 6 ? 'on' : 'off'} />
            <Label x={632} y={56} size={11} dim>master · primary bus</Label>
            <Label x={632} y={86} size={13} mono={false} weight={600}>{s < 4 ? 'idle' : s === 4 ? 'got 0x20' : s === 5 ? 'reading…' : s === 6 ? 'data ready' : s === 7 ? 'sending' : 'done'}</Label>
            <Label x={632} y={106} size={11} on={s >= 4 && s <= 6}>LBA 0x01234567</Label>
            <Label x={632} y={138} size={10.5} dim>sector buffer · 512 B</Label>
            <rect x={632} y={146} width={136} height={26} fill="none" stroke="var(--viz-faint)" />
            <motion.rect x={632} y={146} height={26} fill="var(--viz-fg)" initial={false}
              animate={{ width: fill * 136 }} transition={{ duration: s === 5 ? 2.2 : s === 7 ? 2.2 : 0.4, ease: 'linear' }} />
            <Wire d={`M560 ${rowC(7)} C 600 ${rowC(7)}, 596 120, 618 120`} on={s === 4} />
            <Packet on={s === 4} points={[[560, rowC(7)], [596, 180], [620, 120]]} duration={1.2} delay={0.9} />

            {/* RAM buffer */}
            <Label x={620} y={220} size={11} dim>buf IN RAM</Label>
            <Block x={620} y={228} w={160} h={52} state={s === 7 ? 'on' : 'off'} />
            <motion.rect x={626} y={234} height={40} fill="var(--viz-fg)" initial={false}
              animate={{ width: s === 7 || s === 8 ? 148 : 0 }} transition={{ duration: s === 7 ? 2.2 : 0.4, ease: 'linear' }} />
            <Label x={700} y={298} size={10.5} anchor="middle" on={s >= 7}>256 words = 512 bytes</Label>
            {/* PIO: every word goes drive -> port 0x1F0 -> CPU (insw) -> buf; the CPU does the copy */}
            <Wire d={`M630 159 L 590 159 L 590 ${rowC(0)} L 562 ${rowC(0)}`} on={s === 7} dim />
            <Wire d={`M338 ${rowC(0)} L 330 ${rowC(0)} L 330 ${lineY(8) - 4} L 322 ${lineY(8) - 4}`} on={s === 7} dim delay={0.3} />
            <Wire d={`M322 ${lineY(8) + 8} L 330 ${lineY(8) + 8} L 330 263 L 618 263`} on={s === 7} dim delay={0.6} />
            <Packet on={s === 7} duration={3.2} label="word"
              points={[[630, 159], [590, 159], [590, rowC(0)], [560, rowC(0)], [340, rowC(0)], [330, rowC(0)], [330, lineY(8) - 4], [318, lineY(8) - 4], [330, lineY(8) + 8], [330, 263], [470, 263], [620, 263]]} />

            {/* ---------- status register ---------- */}
            <Label x={340} y={322} size={11} dim>STATUS 0x1F7 (read)</Label>
            <BitField x={340} y={346} cellW={34} h={28} bits={STATUS[s]} fields={STATUS_FIELDS}
              active={s === 5 ? 0 : s === 6 || s === 7 ? 4 : undefined} />
            <Label x={632} y={366} size={14} weight={600}>= {STATUS_HEX[s]}</Label>
            <Label x={340} y={424} size={11.5} on={s === 5}>BSY = 1: busy, ignore the other bits</Label>
            <Label x={340} y={424} size={11.5} on={s === 6 || s === 7}>BSY = 0, DRQ = 1: data waiting in 0x1F0</Label>
            <Label x={340} y={424} size={11.5} on={s === 8}>BSY = 0, DRQ = 0: sector done</Label>
            <Pulse x={357} y={360} on={s === 5} r={14} />
            <Pulse x={493} y={360} on={s === 6} r={14} />

            {/* ---------- bottom-left: the bytes being written ---------- */}
            <Appear on={s === 1 || s === 2}>
              <Label x={30} y={280} size={11}>0x1F6 = 0xE0 | (LBA {'>>'} 24 & 0x0F) = 0xE1</Label>
              <BitField x={40} y={304} cellW={32} h={28} bits="11100001"
                fields={[[0, 1, '1'], [1, 1, 'LBA'], [2, 1, '1'], [3, 1, 'DRV'], [4, 4, 'LBA 27:24']]} active={s === 1 ? 1 : 4} />
              <Label x={30} y={382} size={11} dim>bit 6 = LBA mode · bit 4 = 0 → master</Label>
              <Label x={30} y={402} size={11} dim>bits 7 and 5: always 1 (old ATA)</Label>
            </Appear>
            <Appear on={s >= 3 && s <= 7}>
              <Label x={30} y={280} size={11} dim={s > 3}>LBA 0x01234567 → one byte per port</Label>
              {(['0x01', '0x23', '0x45', '0x67'] as string[]).map((b, i) => (
                <g key={b}>
                  <Block x={30 + i * 70} y={292} w={62} h={44} label={b} sub={['→ 1F6', '→ 1F5', '→ 1F4', '→ 1F3'][i]} mono size={13}
                    state={s === 3 ? (i === 0 ? 'off' : 'on') : 'dim'} />
                  <Label x={61 + i * 70} y={354} size={10.5} anchor="middle" dim>{['27:24', '23:16', '15:8', '7:0'][i]}</Label>
                </g>
              ))}
              <Label x={30} y={384} size={11} dim={s > 3}>count 1 → 0x1F2 · command → 0x1F7</Label>
            </Appear>
            <Appear on={s === 8}>
              <Label x={30} y={280} size={11} dim>EVERY SECTOR (count = N)</Label>
              <Block x={30} y={296} w={84} h={38} label="BSY = 0?" mono size={12} state="on" />
              <Block x={130} y={296} w={84} h={38} label="DRQ = 1?" mono size={12} state="on" />
              <Block x={230} y={296} w={84} h={38} label="256 × inw" mono size={12} state="on" />
              <Wire from={[114, 315]} to={[128, 315]} />
              <Wire from={[214, 315]} to={[228, 315]} />
              <Wire d="M272 334 L 272 362 L 72 362 L 72 336" />
              <Label x={172} y={384} size={11} anchor="middle" dim>repeat N times, 400 ns pause between</Label>
              <Packet points={[[72, 296], [172, 296], [272, 296], [272, 362], [72, 362], [72, 296]]} duration={3} />
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
