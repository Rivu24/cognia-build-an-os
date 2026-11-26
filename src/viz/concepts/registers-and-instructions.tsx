/* Registers and the fetch-decode-execute loop on i386.
   Worked example (NASM syntax, 32-bit code loaded at 0x00100000):
     0x00100000  B8 05 00 00 00   mov eax, 5
     0x00100005  83 C0 03         add eax, 3
     0x00100008  83 F8 08         cmp eax, 8      ; 8 - 8 = 0 -> ZF = 1, PF = 1
     0x0010000B  74 05            je  done        ; 0x0010000D + 5 = 0x00100012
     0x0010000D  B8 00 00 00 00   mov eax, 0      ; skipped
     0x00100012  F4               done: hlt
   EFLAGS bit 1 always reads 1, so EFLAGS = 0x00000002 with all flags clear and 0x00000046 after the cmp. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'registers-and-instructions',
  title: 'Registers and the instruction loop',
  summary: 'The i386 register file, how EAX splits into AX, AH and AL, and how EIP walks through mov, add, cmp and je while ZF decides the jump.',
  lessons: ['t1m3l2', 'p4l1', 'p4l2'],
  articles: ['CPU Registers x86', 'Assembly'],
  group: 'CPU',
  order: 132,
}

const steps: VizStep[] = [
  { caption: 'The CPU keeps the values it works on in registers, inside the chip.', detail: 'Eight 32-bit general registers (EAX to EBP), EIP for the next instruction, EFLAGS for results of comparisons.' },
  { caption: 'EAX is 32 bits. Its low 16 bits are AX, split into AH and AL.', detail: 'With EAX = 0x12345678: AX = 0x5678, AH = 0x56, AL = 0x78. The top 16 bits have no name of their own.' },
  { caption: 'Fetch: EIP = 0x00100000, so the CPU reads the bytes stored there.', detail: 'Instructions are just bytes in memory. B8 05 00 00 00 is 5 bytes long.' },
  { caption: 'Decode B8 as mov eax, imm32. EIP moves past its 5 bytes, then execute: EAX = 5.', detail: 'EIP = 0x00100005, the next instruction, before mov runs. The old value 0x12345678 is gone and AL now reads 0x05.' },
  { caption: 'add eax, 3: EIP moves on to 0x00100008, then EAX = 5 + 3 = 8.', detail: '83 C0 03 is 3 bytes. The result 8 is not zero, so ZF stays 0.' },
  { caption: 'cmp eax, 8 computes 8 − 8 = 0 without storing it. Result zero, so ZF = 1.', detail: 'ZF is bit 6 of EFLAGS. 0 has an even number of 1 bits, so PF (bit 2) is set too: EFLAGS = 0x46 (bit 1 is always 1).' },
  { caption: 'je done reads ZF = 1 and jumps: EIP = 0x00100012.', detail: '74 05 means "if ZF, add 5 to EIP". EIP was 0x0010000D after the fetch, so mov eax, 0 is skipped.', ms: 3800 },
  { caption: 'That is all a CPU does: fetch at EIP, decode, execute, repeat.', detail: 'hlt at done stops the loop until the next interrupt arrives.', ms: 3800 },
]

/* ---------- data ---------- */
const CODE = [
  { addr: '0x00100000', bytes: 'B8 05 00 00 00', asm: 'mov eax, 5' },
  { addr: '0x00100005', bytes: '83 C0 03', asm: 'add eax, 3' },
  { addr: '0x00100008', bytes: '83 F8 08', asm: 'cmp eax, 8' },
  { addr: '0x0010000B', bytes: '74 05', asm: 'je  done' },
  { addr: '0x0010000D', bytes: 'B8 00 00 00 00', asm: 'mov eax, 0' },
  { addr: '0x00100012', bytes: 'F4', asm: 'done: hlt' },
]
const MX = 64
const MW = 290
const MY = 58
const RH = 34
const rowY = (i: number) => MY + i * RH
const rowC = (i: number) => MY + i * RH + RH / 2

const REGS = ['EAX', 'EBX', 'ECX', 'EDX', 'ESI', 'EDI', 'ESP', 'EBP']
const RX = 410
const RW = 172
const RY = 58
const GH = 24

/* per-step state */
const CUR = [-1, -1, 0, 0, 1, 2, 3, 5] // row being executed / fetched
const EIPROW = [0, 0, 0, 1, 2, 3, 5, 5] // row EIP points at after the step
const EIPV = ['0x00100000', '0x00100000', '0x00100000', '0x00100005', '0x00100008', '0x0010000B', '0x00100012', '0x00100012']
const EAX = ['0x12345678', '0x12345678', '0x12345678', '0x00000005', '0x00000008', '0x00000008', '0x00000008', '0x00000008']
const EAXB = [['12', '34', '56', '78'], ['12', '34', '56', '78'], ['12', '34', '56', '78'], ['00', '00', '00', '05'], ['00', '00', '00', '08']]
const STAGE = [-1, -1, 0, 2, 2, 2, 2, -2] // 0 fetch, 1 decode, 2 execute, -2 all
const DECODE: [string, string][] = [
  ['', ''], ['', ''],
  ['B8 05 00 00 00', 'mov eax, 5'],
  ['mov eax, 5', 'EIP += 5 · EAX ← 5'],
  ['add eax, 3', 'EIP += 3 · EAX ← EAX + 3'],
  ['cmp eax, 8', '8 − 8 = 0 → ZF = 1'],
  ['je done', 'ZF = 1 → EIP += 5'],
  ['F4', 'hlt (wait for IRQ)'],
]

/** Text that fades/slides in each time its value changes. */
function Val({ x, y, v, size = 12, anchor = 'end', weight = 400, fill = 'var(--viz-fg)' }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; fill?: string }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill={fill} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>{v}</text>
    </motion.g>
  )
}

/** Step 8: the highlight walks FETCH -> DECODE -> EXECUTE, then a dot rides the drawn return wire back to FETCH. */
const LOOP_T = 3.6
function LoopSweep() {
  const tr = { duration: LOOP_T, repeat: Infinity, ease: 'linear' as const }
  return (
    <g>
      {/* each box lights up in its own time window, so the highlight never slides across labels */}
      {[[0, 0.02, 0.2, 0.24], [0.22, 0.24, 0.42, 0.46], [0.44, 0.46, 0.62, 0.66]].map(([a, b, c, d], i) => (
        <motion.rect key={i} x={120 + i * 205} y={360} width={150} height={40} fill="none" stroke="var(--viz-fg)" strokeWidth={2.4} filter="url(#viz-glow)"
          initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
          transition={{ ...tr, times: [0, a, b, c, d, 1] }} />
      ))}
      <motion.circle r={4} fill="var(--viz-fg)" filter="url(#viz-glow)"
        initial={{ cx: 680, cy: 380, opacity: 0 }}
        animate={{ cx: [680, 680, 680, 720, 720, 80, 80, 117, 117], cy: [380, 380, 380, 380, 428, 428, 380, 380, 380], opacity: [0, 0, 1, 1, 1, 1, 1, 1, 0] }}
        transition={{ ...tr, times: [0, 0.65, 0.66, 0.674, 0.691, 0.92, 0.937, 0.95, 1] }} />
    </g>
  )
}

export default function RegistersAndInstructions() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const eaxBytes = EAXB[Math.min(s, 4)]
        const zf = s >= 5
        const stage = STAGE[s]
        return (
          <Scene label={meta.summary}>
            {/* ---------- code in memory ---------- */}
            <Label x={MX} y={44} size={11} dim>CODE IN MEMORY</Label>
            {CODE.map((c, i) => {
              const skipped = s >= 6 && i === 4
              const st = CUR[s] === i ? 'on' : skipped ? 'hatch' : s >= 2 && CUR[s] !== i ? 'dim' : 'off'
              return (
                <g key={i}>
                  <Block x={MX} y={rowY(i)} w={MW} h={RH} state={st} />
                  <Label x={MX + 8} y={rowY(i) + 21} size={10.5} dim>{c.addr}</Label>
                  <Label x={MX + 86} y={rowY(i) + 21} size={11} dim={st === 'dim'}>{c.bytes}</Label>
                  <Label x={MX + 190} y={rowY(i) + 22} size={13} weight={500} dim={st === 'dim' || skipped}>{c.asm}</Label>
                </g>
              )
            })}
            <Label x={MX + MW / 2} y={rowY(6) + 18} size={10.5} anchor="middle" on={s >= 6} dim>skipped: the jump goes over it</Label>

            {/* EIP tag sliding along the rows */}
            <motion.g initial={false} animate={{ y: rowC(EIPROW[s]) }} transition={{ type: 'spring', stiffness: 140, damping: 18 }}>
              <rect x={20} y={-10} width={36} height={20} fill="var(--viz-fg)" />
              <text x={38} y={4} textAnchor="middle" fill="var(--viz-bg)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>EIP</text>
              <path d="M56 -6 L62 0 L56 6 Z" fill="var(--viz-fg)" />
            </motion.g>

            {/* jump arc */}
            <Wire d={`M${MX + MW} ${rowC(3)} C ${MX + MW + 40} ${rowC(3)}, ${MX + MW + 40} ${rowC(5)}, ${MX + MW + 3} ${rowC(5)}`} on={s >= 6} />

            {/* ---------- register file ---------- */}
            <Label x={RX} y={44} size={11} dim>REGISTERS</Label>
            <Pulse x={RX + RW / 2} y={RY + 4 * GH} r={30} on={s === 0} />
            {REGS.map((r, i) => {
              const isEax = i === 0
              const changed = isEax && (s === 3 || s === 4)
              const st = s === 0 ? 'on' : changed ? 'on' : isEax && s === 1 ? 'on' : s >= 2 && !isEax ? 'dim' : 'off'
              const v = isEax ? EAX[s] : r === 'ESP' ? '0x00108000' : '0x00000000'
              return (
                <g key={r}>
                  <Block x={RX} y={RY + i * GH} w={RW} h={GH} label={r} mono size={12} align="start" state={st} />
                  <Val x={RX + RW - 10} y={RY + i * GH + 16} v={v} size={11.5} fill={st === 'dim' ? 'var(--viz-dim)' : 'var(--viz-fg)'} />
                </g>
              )
            })}
            <Block x={RX} y={RY + 8 * GH + 8} w={RW} h={GH + 2} label="EIP" mono size={12} align="start" state={s >= 2 && s <= 6 ? 'on' : 'off'} />
            <Val x={RX + RW - 10} y={RY + 8 * GH + 25} v={EIPV[s]} size={11.5} />
            <Block x={RX} y={RY + 9 * GH + 14} w={RW} h={GH + 2} label="EFLAGS" mono size={12} align="start" state={s === 5 ? 'on' : 'off'} />
            <Val x={RX + RW - 10} y={RY + 9 * GH + 31} v={zf ? '0x00000046' : '0x00000002'} size={11.5} />

            {/* ---------- EAX bit by bit ---------- */}
            <Appear on={s >= 1}>
              <Label x={608} y={44} size={11} dim>EAX, BYTE BY BYTE</Label>
              <Label x={608} y={61} size={10.5} dim>bit 31</Label>
              <Label x={780} y={61} size={10.5} dim anchor="end">bit 0</Label>
              {eaxBytes.map((b, i) => (
                <g key={i}>
                  <Block x={608 + i * 43} y={66} w={43} h={30} state={i >= 2 && s >= 1 && s <= 4 ? 'on' : i < 2 ? 'dim' : 'off'} />
                  <Val x={608 + i * 43 + 21.5} y={86} v={b} size={13} anchor="middle" weight={500} />
                </g>
              ))}
              <Label x={651} y={112} size={10.5} anchor="middle" dim>upper 16</Label>
              <line x1={695} x2={735} y1={102} y2={102} stroke="var(--viz-fg)" />
              <line x1={739} x2={779} y1={102} y2={102} stroke="var(--viz-fg)" />
              <Label x={715} y={116} size={11} anchor="middle" weight={500}>AH</Label>
              <Label x={759} y={116} size={11} anchor="middle" weight={500}>AL</Label>
              <line x1={695} x2={779} y1={124} y2={124} stroke="var(--viz-fg)" />
              <line x1={695} x2={695} y1={120} y2={124} stroke="var(--viz-fg)" />
              <line x1={779} x2={779} y1={120} y2={124} stroke="var(--viz-fg)" />
              <Label x={737} y={140} size={11} anchor="middle" weight={500}>AX = 0x{eaxBytes[2]}{eaxBytes[3]}</Label>
            </Appear>

            {/* ---------- flags ---------- */}
            <Appear on={s >= 2}>
              <Label x={608} y={168} size={11} dim>EFLAGS BITS</Label>
              {([['CF', 0, false], ['PF', 2, zf], ['ZF', 6, zf], ['SF', 7, false]] as [string, number, boolean][]).map(([n, bit, v], i) => (
                <g key={n}>
                  <Block x={608 + i * 43} y={176} w={43} h={44} state={n === 'ZF' && (s === 5 || s === 6) ? 'on' : 'off'} />
                  <Val x={608 + i * 43 + 21.5} y={196} v={`${n}=${v ? 1 : 0}`} size={11} anchor="middle" weight={500}
                    />
                  <Label x={608 + i * 43 + 21.5} y={212} size={10.5} anchor="middle" dim>bit {bit}</Label>
                </g>
              ))}
            </Appear>

            {/* ---------- decode / execute box ---------- */}
            <Appear on={s >= 2}>
              <Block x={608} y={250} w={172} h={64} state={s >= 2 && s <= 6 ? 'on' : 'off'} />
              <Label x={618} y={266} size={10.5} dim>DECODE / EXECUTE</Label>
              <Val x={618} y={286} v={DECODE[s][0]} size={13} anchor="start" weight={500} />
              <Val x={618} y={304} v={DECODE[s][1]} size={10.5} anchor="start" />
            </Appear>

            {/* data/control moving */}
            <Packet on={s === 2 || (s >= 4 && s <= 6)} points={[[MX + MW, rowC(Math.max(0, CUR[s]))], [398, rowC(Math.max(0, CUR[s]))], [398, 336], [694, 336], [694, 318]]} duration={1.6} />
            <Label x={404} y={350} size={10.5} dim on={s >= 2 && s <= 6}>fetch path</Label>
            <Packet on={s === 3 || s === 4} points={[[608, 270], [594, 270], [594, RY + 12], [RX + RW, RY + 12]]} delay={0.4} duration={1.2} />
            <Packet on={s === 5} points={[[715, 250], [715, 236], [715, 222]]} delay={0.4} duration={1} />
            <Packet on={s === 6} points={[[715, 222], [715, 236], [596, 236], [596, RY + 8 * GH + 21], [RX + RW, RY + 8 * GH + 21]]} delay={0.3} duration={1.4} label="ZF" />

            {/* ---------- fetch / decode / execute loop ---------- */}
            {(['FETCH', 'DECODE', 'EXECUTE'] as const).map((n, i) => {
              const active = stage === -2 || stage === i || (stage === 2 && i < 2 && s >= 3)
              return <Block key={n} x={120 + i * 205} y={360} w={150} h={40} label={n} mono size={13} state={stage === -2 ? 'off' : stage === i ? 'on' : active ? 'off' : 'dim'} />
            })}
            <Wire from={[270, 380]} to={[322, 380]} on dim={stage < 0 && stage !== -2} />
            <Wire from={[475, 380]} to={[527, 380]} on dim={stage < 0 && stage !== -2} />
            <Wire d="M680 380 L720 380 L720 428 L80 428 L80 380 L117 380" on dim={stage !== -2} />
            <Label x={400} y={422} size={10.5} anchor="middle" dim>repeat at the new EIP</Label>
            {s === 7 && <LoopSweep />}
          </Scene>
        )
      }}
    </VizStage>
  )
}
