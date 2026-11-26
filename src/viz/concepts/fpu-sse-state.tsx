/* FPU and SSE: turn them on, then keep each task's registers safe across a task switch.
   Bits and instructions come from the FPU and SSE articles: CPUID.01h:EDX bit 25 = SSE (bit 0 = FPU,
   bit 24 = FXSR), CR0.EM = bit 2 (clear), CR0.MP = bit 1 (set), CR0.TS = bit 3 (lazy switching, #NM),
   CR4.OSFXSR = bit 9, CR4.OSXMMEXCPT = bit 10, FNINIT control word 0x37F, FXSAVE/FXRSTOR need a
   512-byte, 16-byte-aligned area (#GP otherwise). MXCSR 0x1F80 = mask bits 7–12 set. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'fpu-sse-state',
  title: 'FPU and SSE: enable, then save on switch',
  summary: 'Set CR0 and CR4 so x87 and SSE instructions run, reset with fninit, then keep each task\'s st0–st7 and xmm registers with fxsave/fxrstor or lazily with CR0.TS and #NM.',
  lessons: ['t11m3l2', 't11m3l1'],
  articles: ['FPU', 'SSE'],
  group: 'CPU',
  order: 1132,
}

const steps: VizStep[] = [
  { caption: 'First ask the CPU: CPUID leaf 1, EDX bit 25 = SSE, bit 24 = FXSR, bit 0 = FPU.', detail: 'Setting the SSE bits in CR4 on a CPU without SSE raises an exception, so check before you touch anything. Long mode CPUs always have SSE and SSE2.' },
  { caption: 'CR0: clear EM (bit 2) so FPU instructions run, set MP (bit 1).', detail: 'With EM=1 every FPU and SSE instruction raises #UD so software can emulate it. MP makes FWAIT respect TS. The code is the one from the SSE article.', ms: 3600 },
  { caption: 'CR4: set OSFXSR (bit 9) and OSXMMEXCPT (bit 10). Now SSE is allowed.', detail: 'OSFXSR says "my OS saves XMM state with fxsave". OSXMMEXCPT sends SSE math errors to #XF instead of turning SSE off with #UD.', ms: 3600 },
  { caption: 'fninit resets the x87: empty stack, control word 0x037F, exceptions masked.', detail: 'Precision: 64-bit mantissa (80-bit extended), round to nearest. fninit does not touch MXCSR; it powers up as 0x1F80 (bits 7–12 set), so SSE exceptions are masked too.' },
  { caption: 'Task A computes: values now live in st0–st7 and xmm0–xmm15.', detail: 'x87 registers are 80 bits wide, XMM registers 128 bits. 32-bit mode has xmm0–7; 64-bit mode adds xmm8–15. The compiler uses them freely.' },
  { caption: 'A timer IRQ switches to task B. These registers still hold A\'s values.', detail: 'The CPU does not save FPU or SSE state on a software task switch. If B starts using them, A\'s numbers are silently destroyed.', ms: 3600 },
  { caption: 'fxsave [A.fpu]: write all of it to A\'s 512-byte area.', detail: 'One instruction stores x87, MMX, XMM and MXCSR. The area must be 16-byte aligned: 0x00105A00 ends in 0, so it is.', ms: 3600 },
  { caption: 'fxrstor [B.fpu]: load B\'s saved state. B continues exactly where it stopped.', detail: 'A misaligned area raises #GP. Each task needs its own area, e.g. char fpu[512] __attribute__((aligned(16))) in the task struct.', ms: 3600 },
  { caption: 'Lazy option: set CR0.TS on a switch. B\'s first FPU use raises #NM; save and load only then.', detail: 'The #NM handler runs clts, fxsave for the last FPU owner, fxrstor for B. Tasks that never touch the FPU never pay for it.', ms: 4400 },
]

type Cell = { name: string; bit: number; v: string; hl?: boolean; dim?: boolean }

/** A register drawn as named bit cells: name on top, value in the middle, bit number underneath. */
function Bits({ x, y, w, cells }: { x: number; y: number; w: number; cells: Cell[] }) {
  return (
    <g>
      {cells.map((c, i) => (
        <g key={c.name}>
          <Block x={x + i * w} y={y} w={w} h={46} state={c.hl ? 'on' : c.dim ? 'dim' : 'off'} />
          <Label x={x + i * w + w / 2} y={y + 15} size={10.5} anchor="middle" dim>{c.name}</Label>
          <motion.g key={c.v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <text x={x + i * w + w / 2} y={y + 37} textAnchor="middle" fill="var(--viz-fg)" style={{ fontSize: 15, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.v}</text>
          </motion.g>
          <Label x={x + i * w + w / 2} y={y + 60} size={10.5} anchor="middle" dim>bit {c.bit}</Label>
        </g>
      ))}
    </g>
  )
}

/** One register row of the register file, value fades when it changes. */
function Reg({ x, y, w, name, v, state }: { x: number; y: number; w: number; name: string; v: string; state: 'on' | 'off' | 'dim' | 'fill' }) {
  return (
    <g>
      <Block x={x} y={y} w={w} h={22} state={state} />
      <Label x={x + 6} y={y + 15} size={10.5} dim>{name}</Label>
      <motion.g key={v} initial={{ opacity: 0 }} animate={{ opacity: state === 'dim' ? 0.45 : 1 }} transition={{ duration: 0.5 }}>
        <text x={x + w - 6} y={y + 15} textAnchor="end" fill="var(--viz-fg)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{v}</text>
      </motion.g>
    </g>
  )
}

const CODE = [
  'mov eax, 1 / cpuid / test edx, 1 << 25',
  'mov eax,cr0 / and ax,0xFFFB / or ax,2 / mov cr0,eax',
  'mov eax, cr4 / or ax, 3 << 9 / mov cr4, eax',
  'fninit',
  'fld, fmul, addps, mulps …   (task A)',
  'timer IRQ → schedule() picks task B',
  'fxsave [A.fpu]',
  'fxrstor [B.fpu]',
  'switch: set CR0.TS  …  #NM → clts, save, load',
]

const A_ST = ['3.14159265', '2.71828183', '1.41421356']
const B_ST = ['42.0', '-0.5', 'empty']
const A_X = ['1,2,3,4', '5,6,7,8']
const B_X = ['9,9,9,9', '0,0,0,1']

export default function FpuSseState() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const owner: 'none' | 'A' | 'B' = s < 4 ? 'none' : s === 7 ? 'B' : 'A'
        const x87Live = s >= 3
        const sseLive = s >= 2
        const regState = (live: boolean): 'on' | 'off' | 'dim' => (!live ? 'dim' : s === 5 || s === 6 ? 'on' : 'off')
        const stVal = (i: number) => (!x87Live ? '—' : owner === 'A' ? (A_ST[i] ?? 'empty') : owner === 'B' ? (B_ST[i] ?? 'empty') : 'empty')
        const xVal = (i: number) => (!sseLive ? '—' : owner === 'A' ? (A_X[i] ?? '0') : owner === 'B' ? (B_X[i] ?? '0') : '0')
        return (
          <Scene label={meta.summary}>
            {/* ---- CPUID ---- */}
            <Label x={20} y={40} size={10.5} dim>CPUID LEAF 1 · EDX</Label>
            {([['FPU', 0], ['FXSR', 24], ['SSE', 25]] as const).map(([n, b], i) => (
              <Block key={n} x={20 + i * 124} y={46} w={124} h={42} label={n} sub={`bit ${b} = 1`} size={12} mono state={s === 0 ? 'on' : 'off'} />
            ))}

            {/* ---- CR0 ---- */}
            <Label x={20} y={110} size={10.5} dim>CR0 (LOW BITS)</Label>
            <Bits x={20} y={118} w={62} cells={[
              { name: 'NE', bit: 5, v: '?', dim: true },
              { name: 'ET', bit: 4, v: '1', dim: true },
              { name: 'TS', bit: 3, v: s === 8 ? '1' : '0', hl: s === 8 },
              { name: 'EM', bit: 2, v: s >= 1 ? '0' : '?', hl: s === 1 },
              { name: 'MP', bit: 1, v: s >= 1 ? '1' : '?', hl: s === 1 },
              { name: 'PE', bit: 0, v: '1', dim: true },
            ]} />

            {/* ---- CR4 ---- */}
            <Label x={20} y={204} size={10.5} dim>CR4</Label>
            <Bits x={20} y={212} w={124} cells={[
              { name: 'OSXSAVE', bit: 18, v: '0', dim: true },
              { name: 'OSXMMEXCPT', bit: 10, v: s >= 2 ? '1' : '0', hl: s === 2 },
              { name: 'OSFXSR', bit: 9, v: s >= 2 ? '1' : '0', hl: s === 2 },
            ]} />

            {/* ---- register file ---- */}
            <Label x={420} y={40} size={10.5} dim>x87 · 80-BIT</Label>
            {Array.from({ length: 8 }, (_, i) => (
              <Reg key={`st${i}`} x={420} y={48 + i * 22} w={150} name={`st${i}`} v={stVal(i)} state={regState(x87Live)} />
            ))}
            <Label x={584} y={40} size={10.5} dim>XMM · 128-BIT</Label>
            {Array.from({ length: 16 }, (_, i) => (
              <Reg key={`x${i}`} x={i < 8 ? 584 : 684} y={48 + (i % 8) * 22} w={i < 8 ? 98 : 96} name={`xmm${i}`} v={i < 2 ? xVal(i) : sseLive ? '0' : '—'} state={regState(sseLive)} />
            ))}
            <Block x={420} y={234} w={150} h={30} state={s === 3 ? 'on' : x87Live ? 'off' : 'dim'} />
            <Label x={428} y={253} size={11} dim>FCW</Label>
            <Label x={562} y={253} size={11} anchor="end" on={x87Live}>0x037F</Label>
            <Block x={584} y={234} w={196} h={30} state={sseLive ? 'off' : 'dim'} />
            <Label x={592} y={253} size={11} dim>MXCSR</Label>
            <Label x={772} y={253} size={11} anchor="end" on={sseLive}>0x1F80</Label>
            <Label x={600} y={282} size={10.5} anchor="middle" on={s < 2} dim>SSE off: these raise #UD</Label>

            {/* ---- code being executed ---- */}
            <Label x={20} y={298} size={10.5} dim>EXECUTING</Label>
            <Block x={20} y={306} w={370} h={40} state="off" />
            <motion.g key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
              <text x={32} y={331} fill="var(--viz-fg)" style={{ fontSize: s === 1 ? 10.5 : 11.5, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{CODE[s]}</text>
            </motion.g>

            {/* ---- tasks ---- */}
            <Block x={20} y={362} w={175} h={48} label="task A" sub={owner === 'A' && s !== 8 && s < 5 ? 'running' : s >= 5 ? 'switched out' : 'not started'} size={13}
              state={s === 4 ? 'on' : s >= 5 ? 'dim' : 'off'} />
            <Block x={215} y={362} w={175} h={48} label="task B" sub={s >= 5 ? (s === 8 ? 'running · #NM!' : 'running') : 'waiting'} size={13}
              state={s >= 5 ? (s === 5 || s === 7 || s === 8 ? 'on' : 'off') : 'dim'} />
            <Pulse x={302} y={362} on={s === 8} r={14} />

            {/* ---- save areas in RAM ---- */}
            <Appear on={s >= 5}>
              <Label x={420} y={298} size={10.5} dim>FXSAVE AREAS (RAM) · 512 B · 16-BYTE ALIGNED</Label>
              <Block x={420} y={306} w={360} h={40} label="A.fpu @ 0x00105A00" sub={s >= 6 ? 'holds A: st0–7, xmm0–15, MXCSR' : 'empty'} size={12} mono
                state={s === 6 ? 'on' : 'off'} />
              <Block x={420} y={362} w={360} h={48} label="B.fpu @ 0x00107C00" sub="holds B's last saved state" size={12} mono
                state={s === 7 ? 'on' : 'off'} />
            </Appear>

            {/* ---- motion ---- */}
            <Packet on={s === 1} points={[[200, 306], [200, 190], [237, 164]]} duration={1.4} />
            <Packet on={s === 2} points={[[300, 306], [268, 258]]} duration={1.2} />
            <Packet on={s === 3} points={[[200, 306], [400, 290], [505, 264]]} duration={1.4} />
            <Packet on={s === 6} points={[[505, 140], [505, 290], [600, 326]]} duration={1.6} />
            <Packet on={s === 7} points={[[600, 386], [700, 290], [700, 140]]} duration={1.6} />
            <Packet on={s === 5} points={[[107, 386], [302, 386]]} duration={1.2} label="switch" />
            <Packet on={s === 4} points={[[107, 362], [505, 70], [651, 70]]} duration={1.8} />
            <Packet on={s === 8} points={[[175, 166], [302, 360]]} duration={1.4} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
