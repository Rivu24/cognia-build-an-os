/* Serial logging over COM1 (16550 UART at 0x3F8). Every port, value and bit is from the Serial Ports article:
   init_serial() writes IER 0x00, LCR 0x80 (DLAB), divisor 3 (38400 baud), LCR 0x03 (8N1), FCR 0xC7, MCR 0x0F;
   write_serial() polls LSR (0x3FD) bit 5 (THR empty, mask 0x20) and then outb(0x3F8, byte). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'serial-logging',
  title: 'Serial logging on COM1',
  summary: 'How a kernel sets up the COM1 UART at 0x3F8 (38400 baud, 8N1, FIFO), polls the line status register and sends bytes that QEMU prints in your terminal.',
  lessons: ['t4m1l1', 't4m1l2'],
  articles: ['Serial Ports', 'Kernel Debugging', 'UART'],
  group: 'Devices',
  order: 411,
}

const steps: VizStep[] = [
  { caption: 'COM1 is a UART chip with its registers at I/O ports 0x3F8 to 0x3FF.', detail: 'You reach it with outb/inb on port base + offset. Serial needs no driver stack, and QEMU can forward it to your terminal.' },
  { caption: 'Init 1: write 0x00 to 0x3F9 to turn off the UART\'s interrupts.', detail: 'For logging we simply poll the status register, so no IRQ handler is needed yet.' },
  { caption: 'Init 2: set DLAB (0x80 to 0x3FB); 0x3F8 and 0x3F9 now hold the divisor.', detail: 'DLAB is bit 7 of the line control register. It only changes what offsets +0 and +1 mean.' },
  { caption: 'Init 3: divisor 3 → 115200 / 3 = 38400 baud.', detail: 'The UART clock runs at 115200 ticks per second. Low byte 0x03 to 0x3F8, high byte 0x00 to 0x3F9. Never use divisor 0.' },
  { caption: 'Init 4: 0x03 to 0x3FB: 8 data bits, no parity, 1 stop bit (8N1). DLAB off.', detail: 'Bits 1:0 = 11 → 8 bits, bit 2 = 0 → 1 stop bit, bits 5:3 = 000 → no parity, bit 7 = 0 → +0/+1 are data and IER again.' },
  { caption: 'Init 5: 0xC7 enables and clears the FIFOs; 0x0F to 0x3FC: normal mode.', detail: 'The wiki\'s init_serial also runs a loopback self-test first (MCR 0x1E, send 0xAE, read it back) before writing 0x0F.' },
  { caption: 'To send, poll the line status register 0x3FD until bit 5 is 1.', detail: 'Bit 5 (THRE, mask 0x20) means the transmit buffer is empty. Writing earlier would overwrite a byte still waiting.' },
  { caption: 'outb(0x3F8, \'H\'): the UART shifts the byte out one bit at a time.', detail: '\'H\' = 0x48. On the wire: a start bit (0), the 8 data bits lowest first, then a stop bit (1). 10 bits per byte.', ms: 4000 },
  { caption: 'qemu -serial stdio prints it in your terminal, even after a crash.', detail: 'Screen text vanishes on a reset or a broken video driver. The log lives on the host. -serial file:serial.log saves it to a file.', ms: 4000 },
]

const CODE = [
  ['outb(0x3F9, 0x00);', '// IER off'],
  ['outb(0x3FB, 0x80);', '// DLAB = 1'],
  ['outb(0x3F8, 0x03);', '// divisor lo'],
  ['outb(0x3F9, 0x00);', '// divisor hi'],
  ['outb(0x3FB, 0x03);', '// 8N1'],
  ['outb(0x3FA, 0xC7);', '// FIFO'],
  ['outb(0x3FC, 0x0F);', '// normal mode'],
  ['while (!(inb(0x3FD) & 0x20));', ''],
  ["outb(0x3F8, 'H');", '// send'],
]
/* which code lines run in each step */
const LINES: number[][] = [[], [0], [1], [2, 3], [4], [5, 6], [7], [8], [7, 8]]
/* which register (row) each code line touches */
const LINE_ROW = [1, 3, 0, 1, 3, 2, 4, 5, 0]
const LINE_VAL = ['0x00', '0x80', '0x03', '0x00', '0x03', '0xC7', '0x0F', '0x60', "'H'"]

const CX = 20
const CY = 40
const LY = (i: number) => CY + 48 + i * 26
const UX = 330
const RY = (i: number) => 72 + i * 36

/* 'H' = 0x48 = 0100 1000, sent LSB first between a start bit (0) and a stop bit (1) */
const WIRE_BITS = [0, 0, 0, 0, 1, 0, 0, 1, 0, 1]
const WIRE_NAMES = ['start', 'b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'stop']
const WX = 40
const SW = 44
const HI = 358
const LO = 392
function wavePath() {
  let d = `M20 ${HI} L${WX} ${HI}`
  WIRE_BITS.forEach((b, i) => {
    const y = b ? HI : LO
    d += ` L${WX + i * SW} ${y} L${WX + (i + 1) * SW} ${y}`
  })
  return d + ` L${WX + 10 * SW} ${HI} L${WX + 10 * SW + 20} ${HI}`
}

export default function SerialLogging() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const dlab = s === 2 || s === 3
        const active = LINES[s]
        /* latest value written to each register up to this step */
        /* divisor writes (lines 2, 3) live behind DLAB, so rows +0/+1 show them only while DLAB = 1 */
        const vals: (string | undefined)[] = Array(6).fill(undefined)
        const divVals: (string | undefined)[] = Array(2).fill(undefined)
        for (let k = 1; k <= Math.min(s, 7); k++) {
          for (const ln of LINES[k]) {
            if (ln === 2 || ln === 3) divVals[LINE_ROW[ln]] = LINE_VAL[ln]
            else vals[LINE_ROW[ln]] = LINE_VAL[ln]
          }
        }
        if (dlab) { vals[0] = divVals[0]; vals[1] = divVals[1] }
        const touched = new Set(active.map((ln) => LINE_ROW[ln]))
        const regs = [
          dlab ? 'divisor low' : 'data (THR)',
          dlab ? 'divisor high' : 'int. enable',
          'FIFO control',
          'line control',
          'modem control',
          'line status',
        ]
        return (
          <Scene label={meta.summary}>
            {/* ── kernel code ── */}
            <Block x={CX} y={CY} w={290} h={272} />
            <Label x={CX + 12} y={CY + 20} size={10.5} dim>KERNEL CODE (C)</Label>
            {CODE.map(([c, cm], i) => {
              const on = active.includes(i)
              return (
                <g key={i}>
                  <motion.rect x={CX + 4} y={LY(i) - 16} width={282} height={22} fill="var(--viz-fg)" initial={false}
                    animate={{ opacity: on ? 0.13 : 0 }} transition={ease} />
                  <Label x={CX + 12} y={LY(i)} size={11.5} weight={on ? 600 : 400} dim={!on && s > 0}>{c}</Label>
                  {cm && <Label x={CX + 160} y={LY(i)} size={10.5} dim>{cm}</Label>}
                </g>
              )
            })}
            {active.map((ln, k) => (
              <Packet key={`${s}-${ln}`} on points={[[CX + 290, LY(ln) - 4], [UX, RY(LINE_ROW[ln]) + 16]]} duration={1.2} delay={k * 0.4} />
            ))}

            {/* ── UART ── */}
            <Block x={UX - 6} y={40} w={212} h={272} state={s === 0 ? 'on' : 'off'} />
            <Label x={UX + 4} y={60} size={10.5} dim>UART 16550 · COM1</Label>
            {regs.map((r, i) => (
              <g key={i}>
                <Block x={UX} y={RY(i)} w={200} h={32} state={touched.has(i) ? 'on' : s === 0 ? 'off' : s >= 7 && i !== 0 && i !== 5 ? 'dim' : 'off'} />
                <Label x={UX + 10} y={RY(i) + 21} size={12} mono={false} weight={500}>{r}</Label>
                <Label x={UX + 192} y={RY(i) + 21} size={10.5} anchor="end" dim>{`0x3F${(8 + i).toString(16).toUpperCase()}`}</Label>
                <Label x={UX + 214} y={RY(i) + 21} size={12} weight={500} on={vals[i] !== undefined}>{vals[i] ?? ''}</Label>
              </g>
            ))}

            {/* TX wire to the host */}
            <Wire from={[UX + 206, 296]} to={[608, 296]} on={s >= 7} />
            <Label x={572} y={288} size={10.5} anchor="middle" on={s >= 7}>TX</Label>
            <Packet on={s >= 7} points={[[UX + 206, 296], [606, 296]]} duration={0.9} r={4} />

            {/* ── host terminal ── */}
            <Block x={610} y={40} w={170} h={272} state={s === 8 ? 'on' : 'off'} />
            <Label x={620} y={60} size={10.5} dim>HOST TERMINAL</Label>
            <Label x={620} y={84} size={10.5}>$ qemu-system-i386</Label>
            <Label x={620} y={101} size={10.5} weight={s === 8 ? 500 : 400}>{'  -serial stdio'}</Label>
            <Label x={620} y={118} size={10.5}>{'  -cdrom myos.iso'}</Label>
            <Label x={620} y={150} size={12} weight={500} on={s === 7}>H</Label>
            <Cursor x={630} y={140} on={s === 7} />
            {['Hello, kernel!', '[gdt] loaded', '[idt] loaded', 'PANIC: page fault', '  cr2=0x00000000'].map((t, i) => (
              <Label key={i} x={620} y={150 + i * 18} size={10.5} weight={i === 0 ? 500 : 400} on={s === 8} delay={i * 0.25}>{t}</Label>
            ))}

            {/* ── lower area: what this step means ── */}
            <Appear on={s === 0}>
              <Label x={20} y={360} size={13} weight={500}>COM1 base 0x3F8 · offsets +0 … +7 · IRQ 4</Label>
              <Label x={20} y={386} size={11.5} dim>Other ports: COM2 0x2F8 · COM3 0x3E8 · COM4 0x2E8</Label>
            </Appear>
            <Appear on={s === 1}>
              <Label x={20} y={360} size={13} weight={500}>IER (0x3F9) = 0x00</Label>
              <Label x={20} y={386} size={11.5} dim>no UART interrupts: we poll instead</Label>
            </Appear>
            <Appear on={s === 2 || s === 4}>
              <Label x={20} y={338} size={10.5} dim>LINE CONTROL REGISTER · 0x3FB</Label>
              <BitField x={20} y={366} bits={s === 4 ? '00000011' : '10000000'} cellW={44} h={26}
                fields={[[0, 1, 'DLAB'], [1, 1, 'BRK'], [2, 3, 'parity'], [5, 1, 'stop'], [6, 2, 'data']]} active={s === 4 ? 4 : 0} />
              <Label x={420} y={378} size={12} weight={500}>{s === 4 ? 'data 11 = 8 bits · parity 000 = none' : 'DLAB = 1'}</Label>
              <Label x={420} y={400} size={11.5} dim>{s === 4 ? 'stop 0 = 1 bit · DLAB 0 = normal' : '+0 / +1 now reach the divisor'}</Label>
            </Appear>
            <Appear on={s === 3}>
              <Label x={20} y={384} size={24} weight={500}>115200 ÷ 3 = 38400 baud</Label>
              <Label x={420} y={378} size={12} weight={500}>divisor 0x0003</Label>
              <Label x={420} y={400} size={11.5} dim>low 0x03 → 0x3F8 · high 0x00 → 0x3F9</Label>
            </Appear>
            <Appear on={s === 5}>
              <Label x={20} y={338} size={10.5} dim>FIFO CONTROL REGISTER · 0x3FA</Label>
              <BitField x={20} y={366} bits="11000111" cellW={44} h={26}
                fields={[[0, 2, 'trigger 14'], [2, 2, '–'], [4, 1, 'DMA'], [5, 1, 'clrTX'], [6, 1, 'clrRX'], [7, 1, 'on']]} />
              <Label x={420} y={378} size={12} weight={500}>0xC7: FIFOs on, cleared, 14 bytes</Label>
              <Label x={420} y={400} size={11.5} dim>MCR 0x0F: DTR, RTS, OUT1, OUT2 set</Label>
            </Appear>
            <Appear on={s === 6}>
              <Label x={20} y={338} size={10.5} dim>LINE STATUS REGISTER · 0x3FD (read)</Label>
              <BitField x={20} y={366} bits="01100000" cellW={44} h={26}
                fields={[[0, 1, 'ERR'], [1, 1, 'TEMT'], [2, 1, 'THRE'], [3, 1, 'BI'], [4, 1, 'FE'], [5, 1, 'PE'], [6, 1, 'OE'], [7, 1, 'DR']]} active={2} />
              <Label x={420} y={378} size={12} weight={500}>bit 5 THRE = 1: buffer empty</Label>
              <Label x={420} y={400} size={11.5} dim>inb(0x3FD) & 0x20 ≠ 0 → send now</Label>
            </Appear>
            <Appear on={s === 7}>
              <motion.path d={wavePath()} fill="none" stroke="var(--viz-fg)" strokeWidth={2}
                initial={{ pathLength: 0 }} animate={s === 7 ? { pathLength: [0, 1, 1] } : { pathLength: 1 }}
                transition={{ duration: 3, times: [0, 0.8, 1], repeat: Infinity, ease: 'linear' }} />
              {WIRE_BITS.map((b, i) => (
                <g key={i}>
                  <Label x={WX + i * SW + SW / 2} y={348} size={11} anchor="middle" weight={500}>{String(b)}</Label>
                  <Label x={WX + i * SW + SW / 2} y={414} size={10.5} anchor="middle" dim>{WIRE_NAMES[i]}</Label>
                </g>
              ))}
              <Label x={520} y={366} size={12} weight={500}>'H' = 0x48 = 0100 1000</Label>
              <Label x={520} y={388} size={11.5} dim>sent lowest bit first</Label>
              <Label x={520} y={408} size={11.5} dim>10 bits/byte → 3840 bytes/s</Label>
            </Appear>
            <Appear on={s === 8}>
              <Block x={20} y={344} w={360} h={70} state="hatch" label="screen: gone on reset" sub="VGA text is lost on a triple fault" size={13} />
              <Block x={400} y={344} w={380} h={70} label="serial log: safe on the host" sub="-serial stdio · -serial file:serial.log" size={13} state="on" />
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}

/** Blinking terminal cursor. */
function Cursor({ x, y, on }: { x: number; y: number; on: boolean }) {
  if (!on) return null
  return (
    <motion.rect x={x} y={y} width={7} height={13} fill="var(--viz-fg)"
      initial={{ opacity: 1 }} animate={{ opacity: [1, 1, 0, 0] }} transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }} />
  )
}
