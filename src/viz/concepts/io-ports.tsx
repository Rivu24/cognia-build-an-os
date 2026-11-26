/* x86 port I/O (I/O Ports, Inline Assembly/Examples, Serial Ports, PIT, 8259 PIC, "8042" PS/2 Controller).
   The I/O address space is separate from memory: 16-bit port numbers 0x0000-0xFFFF, reached only with in/out.
   outb/inb are the wiki's inline-asm versions: "a" puts the value in AL, "Nd" uses an 8-bit immediate or DX.
   Example values: outb(0x3F8, 'A') -> COM1 data; inb(0x60) -> 0x1E (scan code set 1: A pressed); io_wait -> outb(0x80, 0). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'io-ports',
  title: 'I/O ports: in, out and inline assembly',
  summary: 'The separate 64 K I/O port space on x86, the classic device ports, and how outb, inb and io_wait use in/out through GCC inline assembly.',
  lessons: ['t3m1l3', 't4m1l1'],
  articles: ['I/O Ports', 'Inline Assembly/Examples', 'Serial Ports'],
  group: 'Devices',
  order: 313,
}

const steps: VizStep[] = [
  { caption: 'x86 has two address spaces: memory, and a separate 64 K of I/O ports.', detail: 'Port 0x3F8 and memory address 0x3F8 are different places. Ports are numbered 0x0000 to 0xFFFF.' },
  { caption: 'Older PC devices sit at fixed port numbers on that I/O bus.', detail: 'PIC 0x20–0x21, PIT 0x40–0x43, keyboard controller 0x60/0x64, ATA 0x1F0–0x1F7, COM1 0x3F8. PCI devices get ports assigned instead.' },
  { caption: 'mov cannot reach them. Only in and out can: value in AL, port number in DX.', detail: 'out dx, al writes one byte; in al, dx reads one. A constant port below 0x100 can be written straight into the instruction.' },
  { caption: 'C has no in/out, so the kernel wraps them in inline assembly: outb(port, val).', detail: '"a"(val) loads val into AL. "Nd"(port) uses an 8-bit constant or DX. volatile and "memory" stop GCC from moving or dropping it.' },
  { caption: "outb(0x3F8, 'A') sends 0x41 to COM1's data port.", detail: '0x3F8 does not fit in 8 bits, so GCC puts it in DX first. This is how serial logging writes each character.' },
  { caption: 'inb(0x60) reads one byte from the keyboard controller into AL.', detail: '"=a"(ret) takes the result from AL. Here it is 0x1E, the set-1 scan code for "A pressed".' },
  { caption: 'io_wait(): outb(0x80, 0) to an unused port, just to pass 1–4 µs.', detail: 'Port 0x80 shows POST codes during boot and is almost always free afterwards. Linux uses it the same way.' },
  { caption: 'Many devices use a pair of ports: one picks a register or command, one carries data.', detail: 'PIC: 0x20 command, 0x21 data. PS/2: 0x64 status (read) or command (write), 0x60 data. VGA: 0x3D4 index, 0x3D5 data.', ms: 4000 },
]

const ROWS: [string, string][] = [
  ['0x0020–0x0021', 'PIC (master)'],
  ['0x0040–0x0043', 'PIT timer'],
  ['0x0060, 0x0064', 'PS/2 keyboard'],
  ['0x0080', 'POST code, spare'],
  ['0x01F0–0x01F7', 'ATA disk'],
  ['0x03B0–0x03DF', 'VGA'],
  ['0x03F8–0x03FF', 'COM1 serial'],
]
const IX = 520
const IW = 260
const IY = 62
const IH = 32
const rowC = (i: number) => IY + i * IH + IH / 2
const BUS_Y = 215
const SPINE = 495

const CODE: string[][] = [
  ['mov al, [0x3F8]   ; memory byte 0x3F8 (RAM)', 'in  al, dx        ; port 0x3F8 when DX = 0x3F8', '', 'Same number, two different places.'],
  ['mov al, [0x3F8]   ; memory byte 0x3F8 (RAM)', 'in  al, dx        ; port 0x3F8 when DX = 0x3F8', '', 'Same number, two different places.'],
  ['mov dx, 0x3F8     ; port number', "mov al, 0x41      ; value ('A')", 'out dx, al        ; write AL to port DX', 'in  al, dx        ; read port DX into AL'],
  ['static inline void outb(uint16_t port, uint8_t val) {', '    __asm__ volatile ("outb %b0, %w1"', '        : : "a"(val), "Nd"(port) : "memory");', '}'],
  ['static inline void outb(uint16_t port, uint8_t val) {', '    __asm__ volatile ("outb %b0, %w1"', '        : : "a"(val), "Nd"(port) : "memory");', '}', "outb(0x3F8, 'A');"],
  ['static inline uint8_t inb(uint16_t port) {', '    uint8_t ret;', '    __asm__ volatile ("inb %w1, %b0"', '        : "=a"(ret) : "Nd"(port) : "memory");', '    return ret;', '}'],
  ['static inline void io_wait(void)', '{', '    outb(0x80, 0);', '}'],
  ['outb(0x20, 0x20);   // PIC command: end of interrupt', 'outb(0x21, mask);   // PIC data: IRQ mask', 'inb(0x64);          // PS/2 status', 'inb(0x60);          // PS/2 data byte'],
]
const HOT: number[][] = [[0, 1], [0, 1], [2], [2], [4], [3], [2], [0, 1, 2, 3]]

const PORT = ['—', '—', '0x03F8', '0x03F8', '0x03F8', '0x60', '0x80', '—']
const PORT_SUB = ['', '', 'in DX', 'in DX', 'in DX', 'imm8', 'imm8', '']
const AL = ['—', '—', '0x41', '0x41', '0x41', '0x1E', '0x00', '—']
const RESULT = ['', '', '', '', "COM1 data ← 0x41 ('A')", 'AL ← 0x1E (A pressed)', 'nothing listens: a short delay', '']

function Val({ x, y, v, size = 12, anchor = 'middle', dim, weight = 500 }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; dim?: boolean; weight?: number }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>{v}</text>
    </motion.g>
  )
}

export default function IoPorts() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const target = s === 4 ? 6 : s === 5 ? 2 : s === 6 ? 3 : -1
        const pairRows = [0, 2, 5]
        return (
          <Scene label={meta.summary}>
            {/* ---------- CPU ---------- */}
            <Block x={30} y={150} w={150} h={130} state={s >= 2 && s <= 6 ? 'on' : 'off'} />
            <Label x={42} y={170} size={12} weight={600}>CPU</Label>
            <Block x={44} y={180} w={122} h={40} state={s >= 2 && s <= 6 ? 'off' : 'dim'} />
            <Label x={54} y={204} size={12} weight={600}>AL</Label>
            <Val x={156} y={204} v={AL[s]} anchor="end" size={13} />
            <Block x={44} y={228} w={122} h={40} state={s >= 2 && s <= 6 ? 'off' : 'dim'} />
            <Label x={54} y={244} size={11} weight={600}>PORT</Label>
            <Val x={54} y={260} v={PORT_SUB[s] || ' '} anchor="start" size={10.5} dim weight={400} />
            <Val x={156} y={252} v={PORT[s]} anchor="end" size={13} />

            {/* ---------- memory space ---------- */}
            <Block x={230} y={40} w={230} h={64} label="MEMORY" sub="0x00000000 – 0xFFFFFFFF" size={13} state={s === 0 ? 'on' : s >= 2 ? 'dim' : 'off'} />
            <Wire d="M105 150 L105 72 L228 72" on dim={s >= 2} />
            <Label x={113} y={118} size={11} dim>mov</Label>

            {/* ---------- I/O bus ---------- */}
            <Wire from={[180, BUS_Y]} to={[SPINE, BUS_Y]} on arrow={false} width={2} />
            <line x1={SPINE} x2={SPINE} y1={rowC(0)} y2={rowC(ROWS.length - 1)} stroke="var(--viz-fg)" strokeWidth={2} />
            <Label x={200} y={BUS_Y + 20} size={11}>I/O bus: in / out only</Label>
            <Pulse x={SPINE} y={BUS_Y} on={s === 0} />

            {/* ---------- I/O port map ---------- */}
            <Label x={IX} y={40} size={11} dim>I/O PORTS 0x0000–0xFFFF (64 K)</Label>
            {ROWS.map(([p, d], i) => {
              const hot = target === i || (s === 7 && pairRows.includes(i))
              const st = hot ? 'on' : (target >= 0 || s === 7) ? 'dim' : 'off'
              return (
                <Appear key={i} on={s >= 1 || i === 6} dx={20} dy={0} delay={s === 1 ? i * 0.12 : 0}>
                  <line x1={SPINE} x2={IX} y1={rowC(i)} y2={rowC(i)} stroke={st === 'dim' ? 'var(--viz-faint)' : 'var(--viz-fg)'} />
                  <Block x={IX} y={IY + i * IH} w={IW} h={IH} state={st} />
                  <Label x={IX + 8} y={rowC(i) + 4} size={11.5} weight={500} dim={st === 'dim'}>{p}</Label>
                  <Label x={IX + 120} y={rowC(i) + 4} size={12} dim={st === 'dim'}>{d}</Label>
                </Appear>
              )
            })}
            <Label x={IX} y={IY + ROWS.length * IH + 16} size={10.5} dim>… and more, up to 0xFFFF</Label>

            {/* pair labels, step 7 */}
            <Appear on={s === 7}>
              <Block x={IX} y={330} w={IW} h={96} state="on" />
              <Label x={IX + 12} y={350} size={10.5} dim>SELECT PORT · DATA PORT</Label>
              {[['PIC', '0x20 cmd', '0x21 data'], ['PS/2', '0x64 stat/cmd', '0x60 data'], ['VGA', '0x3D4 idx', '0x3D5 data']].map(([n, c, d], i) => (
                <g key={n}>
                  <Label x={IX + 12} y={372 + i * 20} size={11.5} weight={600}>{n}</Label>
                  <Label x={IX + 62} y={372 + i * 20} size={11.5}>{c}</Label>
                  <Label x={IX + 172} y={372 + i * 20} size={11.5}>{d}</Label>
                </g>
              ))}
            </Appear>

            {/* ---------- moving bytes ---------- */}
            <Packet on={s === 0} points={[[105, 150], [105, 72], [228, 72]]} duration={1.4} />
            <Packet on={s === 0} points={[[180, BUS_Y], [SPINE, BUS_Y], [SPINE, rowC(6)], [IX, rowC(6)]]} duration={1.8} delay={0.5} />
            <Packet on={s === 4} points={[[180, BUS_Y], [SPINE, BUS_Y], [SPINE, rowC(6)], [IX, rowC(6)]]} duration={1.8} label="0x41" />
            <Packet on={s === 5} points={[[IX, rowC(2)], [SPINE, rowC(2)], [SPINE, BUS_Y], [180, BUS_Y]]} duration={1.8} label="0x1E" />
            <Packet on={s === 6} points={[[180, BUS_Y], [SPINE, BUS_Y], [SPINE, rowC(3)], [IX, rowC(3)]]} duration={1.6} label="0x00" />

            {/* ---------- code panel ---------- */}
            <Block x={20} y={312} w={470} h={124} state={s >= 2 ? 'on' : 'off'} />
            <Label x={30} y={330} size={10.5} dim>{s <= 1 ? 'MEMORY VS PORT' : s === 2 ? 'ASSEMBLY (INTEL SYNTAX)' : s === 7 ? 'COMMAND / DATA PAIRS' : 'C WITH GCC INLINE ASSEMBLY'}</Label>
            {CODE.map((lines, k) => (
              <motion.g key={k} initial={false} animate={{ opacity: s === k ? 1 : 0 }} transition={{ duration: 0.35 }}>
                {lines.map((t, i) => (
                  <text key={i} x={30} y={350 + i * 15.5} xmlSpace="preserve" fill={HOT[k].includes(i) ? 'var(--viz-fg)' : 'var(--viz-dim)'}
                    style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: HOT[k].includes(i) ? 600 : 400, whiteSpace: 'pre' }}>{t}</text>
                ))}
              </motion.g>
            ))}

            {/* ---------- result ---------- */}
            <Appear on={RESULT[s] !== ''}>
              <Block x={IX} y={330} w={IW} h={56} state="on" />
              <Label x={IX + 12} y={350} size={10.5} dim>RESULT</Label>
              <Val x={IX + 12} y={372} v={RESULT[s] || ' '} anchor="start" size={12} />
            </Appear>
            <Label x={IX} y={410} size={10.5} dim on={s === 3}>"a" → AL · "Nd" → imm8 or DX</Label>
          </Scene>
        )
      }}
    </VizStage>
  )
}
