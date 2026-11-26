/* Polling a memory-mapped status register with and without volatile.
   From "Volatile (keyword)": without volatile the compiler may read a polled value once and keep it in a CPU
   register, giving an infinite loop; volatile forces every read and write, in order, but does not stop the CPU
   from reordering accesses at run time (use atomics or memory barriers). From "Memory mapped registers in C/C++":
   the compiler does not know the "variable" is a device register; hardware registers should be mapped uncached or
   write-through; GCC compiler barrier asm volatile ("": : :"memory").
   The assembly is a simplified picture of gcc -O2 output on x86 (Intel syntax). The device is generic. */
import { useEffect, type ReactNode } from 'react'
import { motion, useSpring, useTransform, type Transition } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'volatile-optimizer',
  title: 'volatile: why the poll loop hangs',
  summary: 'A loop polls a memory-mapped status register. Without volatile, gcc -O2 reads it once into EAX and spins on that stale copy while the device sets the READY bit in memory; with volatile the read moves inside the loop and the change is seen.',
  lessons: ['p3l3'],
  articles: ['Volatile (keyword)', 'Memory mapped registers in C/C++'],
  group: 'Basics',
  order: 52,
}

const steps: VizStep[] = [
  { caption: 'A driver waits for a device: loop until the READY bit of its status register is 1.', detail: 'The register is memory-mapped: reading *status reads the device, not RAM. The device sets bit 0 on its own when it has finished.', ms: 4600 },
  { caption: 'The optimiser sees nothing in the loop write *status, so it reads it once.', detail: 'Compilers assume memory only changes when your code writes it. At -O2 the load is hoisted above the loop. At -O0 it is not, which is why the bug hides in debug builds.', ms: 5000 },
  { caption: 'The CPU copies status into EAX once, then spins on EAX.', detail: 'mov eax, [status] runs a single time. After that, test and jz only look at the register. Real gcc can go further: test once, then .L3: jmp .L3 forever.', ms: 4600 },
  { caption: 'The device sets READY in memory. The loop never sees it.', detail: 'Memory now says 1, but EAX is a stale copy that still says 0. The driver hangs forever, and nothing in the C source looks wrong.', ms: 5000 },
  { caption: 'Add volatile, and the read moves back inside the loop.', detail: 'volatile uint32_t * says the data pointed to can change behind the compiler\'s back (uint32_t * volatile would mark the pointer instead). Every *status becomes a real read.', ms: 5000 },
  { caption: 'Now every pass reads memory again.', detail: 'Each time round, mov eax, [status] fetches a fresh value from the device. Slower than a register, and exactly what hardware access needs.', ms: 4600 },
  { caption: 'The device sets READY, the next read sees 1, and the loop exits.', detail: 'test eax, 1 is no longer zero, so jz .L2 falls through and the driver carries on.', ms: 4600 },
  { caption: 'volatile fixes the compiler, not the CPU.', detail: 'It keeps every access and their order in the generated code. The CPU can still reorder or cache them: map device memory uncached or write-through, and use memory barriers.', ms: 5400 },
]

/* weight: heavy springs. Instructions slide like solid objects, values land instead of popping. */
const heavy: Transition = { type: 'spring', stiffness: 50, damping: 13, mass: 1.4 }
const lazy: Transition = { duration: 1.1, ease: [0.3, 0.05, 0.15, 1] }

// assembly panel
const AX = 360, AY = 30, AW = 420
const LBL = AX + 26, INS = AX + 50, CMT = AX + 246
const rowY = (r: number) => AY + 48 + r * 24
// row 2: machine
const CPU = { x: 20, y: 196, w: 290, h: 140 }
const MEM = { x: 420, y: 196, w: 210, h: 140 }
const DEV = { x: 680, y: 196, w: 100, h: 140 }
const BUS_Y = 250

function Val({ x, y, v, size = 13, anchor = 'start', weight = 500, dim, delay = 0 }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean; delay?: number }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...heavy, delay, opacity: { ...lazy, delay } }}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>
        {v}
      </text>
    </motion.g>
  )
}

function Faint({ on, children, low = 0.3 }: { on: boolean; children: ReactNode; low?: number }) {
  return <motion.g initial={false} animate={{ opacity: on ? 1 : low }} transition={lazy}>{children}</motion.g>
}

/** One assembly line that slides (with weight) to its row. */
function AsmRow({ row, children, hot }: { row: number; children: ReactNode; hot?: boolean }) {
  return (
    <motion.g initial={false} animate={{ y: rowY(row) }} transition={heavy}>
      <motion.rect x={AX + 6} y={-16} width={AW - 12} height={22} fill="var(--viz-fg)" initial={false} animate={{ opacity: hot ? 0.12 : 0 }} transition={lazy} />
      {children}
    </motion.g>
  )
}

/** The jz back-edge: from the jz row up to wherever .L2 sits. Its top end swings on a spring. */
function LoopEdge({ topRow, on }: { topRow: number; on: boolean }) {
  const top = useSpring(rowY(topRow), heavy)
  useEffect(() => { top.set(rowY(topRow)) }, [topRow, top])
  const bottom = rowY(3) - 4
  const d = useTransform(top, (t: number) => `M${LBL - 4} ${bottom} L${AX + 12} ${bottom} L${AX + 12} ${t - 4} L${LBL - 6} ${t - 4}`)
  return <motion.path d={d} fill="none" stroke="var(--viz-fg)" strokeWidth={1.4} markerEnd="url(#viz-arrow)" initial={false} animate={{ opacity: on ? 1 : 0.35 }} transition={lazy} />
}

/** A single read travelling from memory into EAX (no loop, fades at the end). */
function OneRead({ on, delay = 0.3 }: { on: boolean; delay?: number }) {
  if (!on) return null
  return (
    <motion.g initial={{ x: MEM.x + 16, y: BUS_Y, opacity: 0 }} animate={{ x: [MEM.x + 16, CPU.x + CPU.w - 10], y: BUS_Y, opacity: [0, 1, 1, 0] }}
      transition={{ x: { duration: 1.8, delay, ease: 'easeInOut' }, opacity: { duration: 1.8, delay, times: [0, 0.1, 0.85, 1] } }}>
      <circle r={5} fill="var(--viz-fg)" filter="url(#viz-glow)" />
      <text y={-11} textAnchor="middle" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }} fill="var(--viz-fg)">read</text>
    </motion.g>
  )
}

export default function VolatileOptimizer() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const vol = s >= 4
        const ready = s === 3 || s >= 6
        const eax = s === 2 || s === 3 || s === 5 ? '0x00000000' : s >= 6 ? '0x00000001' : '—'
        const spinning = s === 2 || s === 3 || s === 5
        const cHot = s === 4 ? 1 : s === 0 || s === 1 ? 2 : -1
        return (
          <Scene label={meta.summary}>
            {/* ===== C source ===== */}
            <Block x={20} y={AY} w={320} h={134} state={s === 0 || s === 4 ? 'on' : 'off'} />
            <Label x={32} y={AY + 18} size={11} dim>driver.c</Label>
            <Label x={32} y={rowY(0)} size={12.5} dim>#define READY 0x1</Label>
            <Val x={32} y={rowY(1)} v={vol ? 'volatile uint32_t *status = …;' : 'uint32_t *status = …;'} size={12.5} weight={cHot === 1 ? 700 : 400} />
            <Label x={32} y={rowY(2)} size={12.5} weight={cHot === 2 ? 700 : 400}>while (!(*status &amp; READY))</Label>
            <Label x={62} y={rowY(3)} size={12.5}>;   // wait</Label>
            <Pulse x={36} y={rowY(1) - 5} on={s === 4} r={12} />

            {/* ===== assembly ===== */}
            <Faint on={s >= 1} low={0.22}>
              <Block x={AX} y={AY} w={AW} h={134} state={s === 1 || s === 4 ? 'on' : 'off'} />
              <Val x={AX + 12} y={AY + 18} v={vol ? 'gcc -O2, with volatile (simplified x86)' : 'gcc -O2, no volatile (simplified x86)'} size={11} weight={400} dim />
              <AsmRow row={vol ? 1 : 0} hot={s === 1 || s === 4 || s === 5 || (s === 2)}>
                <text x={INS} y={0} fill="var(--viz-fg)" style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>mov  eax, [status]</text>
                <Val x={CMT} y={0} v={vol ? '; read every pass' : '; read once'} size={11} weight={400} dim />
              </AsmRow>
              <AsmRow row={vol ? 0 : 1}>
                <text x={LBL} y={0} fill="var(--viz-fg)" style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>.L2:</text>
              </AsmRow>
              <AsmRow row={2} hot={s === 3 || s === 6}>
                <text x={INS} y={0} fill="var(--viz-fg)" style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>test eax, 1</text>
                <text x={CMT} y={0} fill="var(--viz-dim)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>; READY bit set?</text>
              </AsmRow>
              <AsmRow row={3} hot={s === 3 || s === 6}>
                <text x={INS} y={0} fill="var(--viz-fg)" style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>jz   .L2</text>
                <Val x={CMT} y={0} v={s === 6 || s === 7 ? '; not zero → fall through' : '; zero → go round again'} size={11} weight={400} dim />
              </AsmRow>
              <LoopEdge topRow={vol ? 0 : 1} on={s >= 1 && s !== 6 && s !== 7} />
            </Faint>
            <Appear on={s === 1} dy={6}>
              <Label x={AX + AW - 12} y={AY + 150} size={11} anchor="end" weight={600}>load hoisted above the loop</Label>
            </Appear>
            <Appear on={s === 4} dy={6} delay={0.6}>
              <Label x={AX + AW - 12} y={AY + 150} size={11} anchor="end" weight={600}>load moved inside the loop</Label>
            </Appear>

            {/* ===== CPU ===== */}
            <Block x={CPU.x} y={CPU.y} w={CPU.w} h={CPU.h} state={s === 2 || s === 3 ? 'on' : 'off'} />
            <Label x={CPU.x + 12} y={CPU.y + 18} size={11} dim>CPU</Label>
            <Block x={CPU.x + 14} y={CPU.y + 30} w={CPU.w - 28} h={48} state={s === 3 ? 'on' : 'off'} />
            <Label x={CPU.x + 26} y={CPU.y + 60} size={12} dim>EAX</Label>
            <Val x={CPU.x + CPU.w - 26} y={CPU.y + 62} v={eax} size={17} anchor="end" />
            {/* the spin loop: a dot circling a square track */}
            <rect x={CPU.x + 18} y={CPU.y + 92} width={34} height={28} fill="none" stroke="var(--viz-faint)" />
            <Packet on={spinning} points={[[CPU.x + 18, CPU.y + 92], [CPU.x + 52, CPU.y + 92], [CPU.x + 52, CPU.y + 120], [CPU.x + 18, CPU.y + 120], [CPU.x + 18, CPU.y + 92]]} duration={1.9} r={4} />
            <Val x={CPU.x + 64} y={CPU.y + 104} size={11.5} weight={500}
              v={s === 3 ? 'spinning on a stale copy' : spinning ? 'spinning: test, jz, test, jz…' : s >= 6 ? 'loop finished' : 'idle'} />
            <Val x={CPU.x + 64} y={CPU.y + 122} size={10.5} weight={400} dim
              v={s === 3 ? 'memory is never read again' : s === 2 ? 'memory read: 1 time' : s === 5 ? 'memory read: every pass' : s >= 6 ? 'READY seen, driver continues' : ' '} />

            {/* ===== bus ===== */}
            <Wire from={[MEM.x - 2, BUS_Y]} to={[CPU.x + CPU.w + 2, BUS_Y]} on dim={s === 3} />
            <Label x={(MEM.x + CPU.x + CPU.w) / 2} y={BUS_Y + 18} size={10.5} anchor="middle" dim on={s !== 3}>bus</Label>
            <OneRead on={s === 2} />
            <Packet on={s === 5 || s === 6} points={[[MEM.x - 4, BUS_Y], [CPU.x + CPU.w + 6, BUS_Y]]} duration={1.9} label="read" />
            <Label x={(MEM.x + CPU.x + CPU.w) / 2} y={BUS_Y + 22} size={10.5} anchor="middle" weight={600} on={s === 3}>no reads</Label>

            {/* ===== the memory-mapped register ===== */}
            <Block x={MEM.x} y={MEM.y} w={MEM.w} h={MEM.h} state={ready && (s === 3 || s === 6) ? 'on' : 'off'} />
            <Label x={MEM.x + 12} y={MEM.y + 18} size={11} dim>status (memory-mapped)</Label>
            <BitField x={MEM.x + 25} y={MEM.y + 44} bits={ready ? '00000001' : '00000000'} cellW={20} h={28} fields={[[7, 1, 'READY']]} active={ready ? 0 : undefined} />
            <Label x={MEM.x + 25} y={MEM.y + 94} size={10.5} dim>low 8 of 32 bits</Label>
            <Val x={MEM.x + 12} y={MEM.y + 124} v={ready ? 'memory says 1' : 'memory says 0'} size={12} />

            {/* ===== device ===== */}
            <Block x={DEV.x} y={DEV.y} w={DEV.w} h={DEV.h} label="device" sub={ready ? 'set bit 0' : 'working…'} size={13} state={s === 3 || s === 6 ? 'on' : 'off'} />
            <Wire from={[DEV.x - 2, 300]} to={[MEM.x + MEM.w + 2, 300]} on={s === 3 || s === 6} />
            <Packet on={s === 3 || s === 6} points={[[DEV.x - 4, 300], [MEM.x + MEM.w + 6, 300]]} duration={1.8} repeat={false} />

            {/* the verdict line */}
            <motion.g initial={false} animate={{ opacity: s === 3 ? 1 : 0, x: s === 3 ? [0, 0, -5, 5, -3, 3, 0] : 0 }} transition={s === 3 ? { opacity: lazy, x: { duration: 0.8, delay: 2 } } : lazy}>
              <Block x={CPU.x} y={356} w={610} h={40} state="on" />
              <Label x={CPU.x + 305} y={381} size={13} anchor="middle" weight={600}>EAX = 0, memory = 1 → the loop never ends</Label>
            </motion.g>
            <Appear on={s === 6} dy={8}>
              <Block x={CPU.x} y={356} w={610} h={40} state="off" />
              <Label x={CPU.x + 305} y={381} size={13} anchor="middle" weight={600}>fresh read → EAX = 1 → loop exits</Label>
            </Appear>

            {/* ===== what volatile does not do ===== */}
            {([
              ['volatile DOES', 'keep every access, in order', 'on'],
              ['volatile does NOT', 'stop CPU reordering or caching', 'off'],
              ['so also', 'map uncached + use barriers', 'off'],
            ] as [string, string, 'on' | 'off'][]).map(([h, t, st], i) => (
              <Appear key={h} on={s === 7} dy={10} delay={0.25 * i}>
                <Block x={20 + i * 254} y={356} w={246} h={64} state={st} />
                <Label x={32 + i * 254} y={378} size={11} dim>{h}</Label>
                <Label x={32 + i * 254} y={402} size={12} weight={500}>{t}</Label>
              </Appear>
            ))}
            <Label x={780} y={436} size={10.5} anchor="end" dim on={s === 7}>GCC compiler barrier: asm volatile ("" ::: "memory")</Label>
          </Scene>
        )
      }}
    </VizStage>
  )
}
