/* Real mode segment:offset addressing, worked by hand.
   Sources: OSDev Wiki "Real Mode" (PhysicalAddress = Segment * 16 + Offset, HMA 0x100000-0x10FFEF),
   "Segmentation" (64k windows overlap), "Babystep2" (07C0:0000 = 0000:7C00), "A20 Line" (wrap-around). */
import { AnimatePresence, motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Label, BitField, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'real-mode-addressing',
  title: 'Real mode: segment × 16 + offset',
  summary: 'How a real mode CPU turns segment:offset into a 20-bit physical address, why 0x07C0:0x0000 and 0x0000:0x7C00 are the same byte, and where the 1 MiB limit and A20 wrap-around come from.',
  lessons: ['t3m2l3', 't1m3l2', 'p4l4'],
  articles: ['Real Mode', 'Segmentation'],
  group: 'CPU',
  order: 323,
}

const steps: VizStep[] = [
  { caption: 'In real mode an address is two 16-bit numbers: segment:offset.', detail: 'Here CS:IP = 0x07C0:0x0000. One 16-bit register alone reaches only 64 KiB; the segment picks which 64 KiB.' },
  { caption: 'The CPU multiplies the segment by 16: shift left one hex digit.', detail: '0x07C0 × 16 = 0x07C00. In binary that is four zero bits added on the right.' },
  { caption: 'Then it adds the offset: 0x07C00 + 0x0000 = physical 0x07C00.', detail: 'physical = segment × 16 + offset. The result is a 20-bit physical address.' },
  { caption: '0x0000:0x7C00 names the same byte: 0x00000 + 0x7C00 = 0x07C00.', detail: 'Some BIOSes jump to 07C0:0000, others to 0000:7C00. Same byte, different CS, so set CS yourself with a far jump.', ms: 3800 },
  { caption: 'Each segment is a 64 KiB window starting at segment × 16. Windows overlap.', detail: 'Segment 0x07C0 spans 0x07C00–0x17BFF (offsets 0x0000–0xFFFF); segment 0x0000 spans 0x00000–0x0FFFF. Bytes in both have two names.', ms: 4000 },
  { caption: '20 address bits reach 1 MiB: 0x00000 to 0xFFFFF.', detail: '0xF000:0xFFFF = 0xF0000 + 0xFFFF = 0xFFFFF, the last byte of the first MiB.' },
  { caption: 'The largest pair, 0xFFFF:0xFFFF, gives 0x10FFEF: just past 1 MiB.', detail: '0xFFFF0 + 0xFFFF = 0x10FFEF. The almost-64 KiB from 0x100000 to 0x10FFEF is the High Memory Area (HMA).', ms: 3800 },
  { caption: 'With the A20 line off, bit 20 is dropped and the address wraps to 0x0FFEF.', detail: 'The 8086 had only lines A0–A19, so it wrapped to 0. PCs keep this quirk; a bootloader enables A20 to reach memory above 1 MiB.', ms: 4200 },
]

// worked arithmetic per step: [segment, offset, physical or '']
const MATH: [string, string, string][] = [
  ['07C0', '0000', ''],
  ['07C0', '0000', ''],
  ['07C0', '0000', '07C00'],
  ['0000', '7C00', '07C00'],
  ['07C0', 'FFFF', '17BFF'],
  ['F000', 'FFFF', 'FFFFF'],
  ['FFFF', 'FFFF', '10FFEF'],
  ['FFFF', 'FFFF', '10FFEF'],
]
const PTR = [-1, -1, 0x07c00, 0x07c00, 0x17bff, 0xfffff, 0x10ffef, 0x0ffef]
const BASE = [-1, -1, 0x07c00, 0x00000, 0x07c00, 0xf0000, 0xffff0, -1]

const CX = 190 // x of hex column 0
const CW = 34
const R1 = 64
const R2 = 108
const R3 = 160

const RX0 = 40
const RX1 = 760
const RY = 330
const zoomX = (v: number) => RX0 + (v / 0x20000) * (RX1 - RX0)
const fullX = (v: number) => RX0 + (v / 0x110000) * (RX1 - RX0)

/** One hex digit cell whose character cross-fades when it changes. */
function Digit({ col, y, ch, dim, strike }: { col: number; y: number; ch: string; dim?: boolean; strike?: boolean }) {
  const x = CX + col * CW + CW / 2
  return (
    <g>
      <AnimatePresence mode="wait" initial={false}>
        <motion.text key={ch} x={x} y={y + 23} textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: dim ? 0.45 : 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }} fill="var(--viz-fg)" style={{ fontSize: 17, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
          {ch}
        </motion.text>
      </AnimatePresence>
      <motion.line x1={x - 9} x2={x + 9} y1={y + 6} y2={y + 28} stroke="var(--viz-fg)" strokeWidth={1.6} initial={false} animate={{ pathLength: strike ? 1 : 0, opacity: strike ? 1 : 0 }} transition={ease} />
    </g>
  )
}

function Cells({ y, from, to }: { y: number; from: number; to: number }) {
  return (
    <g>
      {Array.from({ length: to - from + 1 }).map((_, i) => (
        <rect key={i} x={CX + (from + i) * CW} y={y} width={CW} height={32} fill="var(--viz-bg)" stroke="var(--viz-faint)" />
      ))}
    </g>
  )
}

function Swap({ x, y, text, size = 12, anchor = 'start', dim }: { x: number; y: number; text: string; size?: number; anchor?: 'start' | 'middle' | 'end'; dim?: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.g key={text} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.25 }}>
        <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)' }}>{text}</text>
      </motion.g>
    </AnimatePresence>
  )
}

export default function RealModeAddressing() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const [seg, off, phys] = MATH[s]
        const shifted = s >= 1
        const full = s >= 5
        const sx = full ? fullX : zoomX
        const px = PTR[s] >= 0 ? sx(PTR[s]) : -1
        const bx = BASE[s] >= 0 ? sx(BASE[s]) : px
        const ptrLabel = PTR[s] >= 0 ? '0x' + PTR[s].toString(16).toUpperCase().padStart(5, '0') : ''
        return (
          <Scene label={meta.summary}>
            <Label x={400} y={30} size={15} anchor="middle" weight={500}>physical = segment × 16 + offset</Label>

            {/* ===== arithmetic ===== */}
            <Swap x={50} y={R1 + 21} text={shifted ? 'segment × 16' : 'segment'} />
            <Label x={50} y={R2 + 21} size={12}>+ offset</Label>
            <Swap x={50} y={R3 + 21} text={s === 7 ? 'A20 off' : '= physical'} />
            <Cells y={R1} from={1} to={5} />
            <Cells y={R2} from={2} to={5} />
            <Cells y={R3} from={0} to={5} />
            <motion.g initial={false} animate={{ x: shifted ? -CW : 0 }} transition={{ ...ease, duration: 0.9, delay: s === 1 ? 0.3 : 0 }}>
              {seg.split('').map((ch, i) => <Digit key={i} col={2 + i} y={R1} ch={ch} />)}
            </motion.g>
            <motion.g initial={false} animate={{ opacity: shifted ? 1 : 0 }} transition={{ ...ease, delay: s === 1 ? 1.1 : 0 }}>
              <Digit col={5} y={R1} ch="0" dim />
            </motion.g>
            {off.split('').map((ch, i) => <Digit key={i} col={2 + i} y={R2} ch={ch} dim={s === 1} />)}
            <line x1={CX} x2={CX + 6 * CW} y1={R3 - 8} y2={R3 - 8} stroke="var(--viz-fg)" />
            {[0, 1, 2, 3, 4, 5].map((c) => {
              const d = phys.padStart(6, ' ')[c]
              return <Digit key={c} col={c} y={R3} ch={d === ' ' ? '' : d} strike={s === 7 && c === 0} />
            })}
            <Pulse x={CX + 5 * CW + CW / 2} y={R1 + 16} on={s === 1} r={14} />
            <Label x={CX + 6 * CW} y={R3 + 50} size={11} anchor="end" dim={s !== 7} on={s === 7}>= 0x0FFEF</Label>
            <Label x={CX} y={R3 + 50} size={10.5} dim>hex digits</Label>

            {/* ===== right panel: one idea per step ===== */}
            <Appear on={s === 0}>
              <Label x={440} y={72} size={10.5} dim>SEGMENT REGISTERS (16-BIT EACH)</Label>
              {[['CS', 'code'], ['DS', 'data'], ['SS', 'stack'], ['ES', 'extra'], ['FS', 'general'], ['GS', 'general']].map(([r, d], i) => (
                <Block key={r} x={440 + (i % 3) * 108} y={82 + Math.floor(i / 3) * 46} w={100} h={38} label={r} sub={d} mono size={13} state={r === 'CS' ? 'on' : 'off'} />
              ))}
              <Label x={440} y={196} size={12.5}>CS:IP = 0x07C0:0x0000</Label>
              <Label x={440} y={216} size={11} dim>segment : offset</Label>
            </Appear>
            <Appear on={s === 1}>
              <Label x={440} y={72} size={10.5} dim>× 16 = SHIFT LEFT 4 BITS</Label>
              <BitField x={440} y={92} cellW={16} h={22} bits="0000011111000000" showIndex={false} />
              <Label x={700} y={108} size={11} dim>0x07C0</Label>
              <BitField x={440} y={150} cellW={16} h={22} bits="00000111110000000000" fields={[[0, 16, 'same bits'], [16, 4, '+4 zeros']]} active={1} showIndex={false} />
              <Label x={760} y={140} size={11} anchor="end">0x07C00</Label>
            </Appear>
            <Appear on={s === 2 || s === 3}>
              <Label x={440} y={72} size={10.5} dim>SAME BYTE, DIFFERENT NAMES</Label>
              <Label x={440} y={102} size={13} weight={s === 2 ? 500 : 400} dim={s !== 2}>0x07C0:0x0000 → 0x07C00</Label>
              <Label x={440} y={128} size={13} on={s === 3} weight={500}>0x0000:0x7C00 → 0x07C00</Label>
              <Label x={440} y={168} size={11} dim on={s === 3}>also: 0x0020:0x0010 = 0x0000:0x0210</Label>
              <Label x={440} y={186} size={11} dim on={s === 3}>= 0x0021:0x0000 = 0x00210</Label>
            </Appear>
            <Appear on={s === 4}>
              <Label x={440} y={72} size={10.5} dim>64 KiB WINDOWS</Label>
              <Label x={440} y={102} size={12}>seg 0x0000 → 0x00000–0x0FFFF</Label>
              <Label x={440} y={126} size={12} weight={500}>seg 0x07C0 → 0x07C00–0x17BFF</Label>
              <Label x={440} y={158} size={12}>overlap   → 0x07C00–0x0FFFF</Label>
              <Label x={440} y={184} size={11} dim>offset 0xFFFF is the top of a window</Label>
            </Appear>
            <Appear on={s === 5}>
              <Label x={440} y={72} size={10.5} dim>THE 1 MiB LIMIT</Label>
              <Label x={440} y={102} size={12.5}>20 bits → 2^20 = 1,048,576 bytes</Label>
              <Label x={440} y={128} size={12.5}>0xF000:0xFFFF → 0xFFFFF</Label>
              <Label x={440} y={160} size={11} dim>usable RAM is much less: see the memory map</Label>
            </Appear>
            <Appear on={s === 6}>
              <Label x={440} y={72} size={10.5} dim>PAST THE TOP</Label>
              <Label x={440} y={102} size={12.5}>0xFFFF × 16 = 0xFFFF0</Label>
              <Label x={440} y={126} size={12.5}>+ 0xFFFF    = 0x10FFEF</Label>
              <Label x={440} y={158} size={12} weight={500}>HMA: 0x100000–0x10FFEF</Label>
              <Label x={440} y={178} size={11} dim>needs 21 address bits</Label>
            </Appear>
            <Appear on={s === 7}>
              <Label x={440} y={72} size={10.5} dim>A20 = ADDRESS LINE 20 (THE 21ST BIT)</Label>
              <BitField x={442} y={98} cellW={15} h={24} bits="000001111111111101111" fields={[[0, 1, 'A20 = 0'], [1, 20, 'A19 … A0 pass through']]} active={0} showIndex={false} />
              <Label x={440} y={176} size={11.5}>0x10FFEF with bit 20 cleared = 0x0FFEF</Label>
            </Appear>

            {/* ===== physical memory ruler ===== */}
            <Label x={RX0} y={404} size={10.5} dim>
              {full ? 'PHYSICAL ADDRESSES · 0 TO 1 MiB + 64 KiB' : 'PHYSICAL ADDRESSES · FIRST 128 KiB (ZOOMED)'}
            </Label>
            <rect x={RX0} y={RY} width={RX1 - RX0} height={26} fill="var(--viz-bg)" stroke="var(--viz-fg)" />
            {/* zoomed ruler marks */}
            <Appear on={!full} dy={0}>
              <motion.rect x={zoomX(0x07c00)} y={RY} width={zoomX(0x10000) - zoomX(0x07c00)} height={26} fill="url(#viz-hatch)" initial={false} animate={{ opacity: s === 4 ? 1 : 0 }} />
              {([[0, '0x00000', 'start'], [0x07c00, '0x07C00', 'middle'], [0x10000, '0x10000', 'middle'], [0x17c00, '0x17C00', 'middle'], [0x20000, '0x20000', 'end']] as const).map(([v, t, a]) => (
                <g key={t}>
                  <line x1={zoomX(v)} x2={zoomX(v)} y1={RY + 26} y2={RY + 32} stroke="var(--viz-dim)" />
                  <Label x={zoomX(v)} y={RY + 46} size={10.5} anchor={a} dim>{t}</Label>
                </g>
              ))}
            </Appear>
            <Appear on={full} dy={0}>
              <motion.rect x={fullX(0x100000)} y={RY} width={RX1 - fullX(0x100000)} height={26} fill="url(#viz-hatch)" stroke="var(--viz-fg)" initial={false} animate={{ opacity: s >= 6 ? 1 : 0.3 }} />
              <Label x={(RX0 + fullX(0x100000)) / 2} y={RY + 17} size={11} anchor="middle" dim>first MiB (what the 8086 could address)</Label>
              {([[0, '0x00000', 'start'], [0x80000, '0x80000', 'middle'], [0x100000, '0x100000 = 1 MiB', 'end']] as const).map(([v, t, a]) => (
                <g key={t}>
                  <line x1={fullX(v)} x2={fullX(v)} y1={RY + 26} y2={RY + 32} stroke="var(--viz-dim)" />
                  <Label x={fullX(v)} y={RY + 46} size={10.5} anchor={a} dim>{t}</Label>
                </g>
              ))}
              <Label x={RX1} y={RY + 46} size={10.5} anchor="end" on={s >= 6}>HMA</Label>
            </Appear>

            {/* windows (step 4) */}
            <Appear on={s === 4}>
              <rect x={zoomX(0)} y={232} width={zoomX(0x10000) - zoomX(0)} height={12} fill="none" stroke="var(--viz-dim)" />
              <Label x={zoomX(0x10000) + 8} y={242} size={11} dim>window of seg 0x0000</Label>
              <rect x={zoomX(0x07c00)} y={254} width={zoomX(0x17c00) - zoomX(0x07c00)} height={12} fill="none" stroke="var(--viz-fg)" strokeWidth={1.6} />
              <Label x={zoomX(0x17c00) + 8} y={264} size={11}>window of seg 0x07C0</Label>
            </Appear>

            {/* segment base + offset arrow + pointer */}
            <motion.g initial={false} animate={{ opacity: BASE[s] >= 0 ? 1 : 0, x: bx }} transition={{ ...ease, duration: 0.8 }}>
              <rect x={-4} y={RY - 4} width={8} height={8} fill="var(--viz-fg)" />
            </motion.g>
            <motion.line y1={RY - 12} y2={RY - 12} stroke="var(--viz-fg)" strokeWidth={1.4} markerEnd={Math.abs(px - bx) > 12 ? 'url(#viz-arrow)' : undefined}
              initial={false} animate={{ x1: bx, x2: px, opacity: BASE[s] >= 0 && Math.abs(px - bx) > 4 ? 1 : 0 }} transition={{ ...ease, duration: 0.8 }} />
            <motion.g initial={false} animate={{ opacity: px >= 0 ? 1 : 0, x: px >= 0 ? px : 400 }} transition={{ ...ease, duration: s === 7 ? 1.4 : 0.8 }}>
              <rect x={-1.5} y={RY - 26} width={3} height={52} fill="var(--viz-fg)" filter="url(#viz-glow)" />
              <path d={`M-6 ${RY - 32} L6 ${RY - 32} L0 ${RY - 24} Z`} fill="var(--viz-fg)" />
            </motion.g>
            {px >= 0 && (
              <Swap x={s === 7 ? px + 10 : px > 700 ? px : px} y={s === 7 ? RY - 10 : RY - 38} size={12.5} anchor={s === 7 ? 'start' : px > 700 ? 'end' : 'middle'} text={ptrLabel} />
            )}
            <Label x={(bx + px) / 2} y={RY - 18} size={10.5} anchor="middle" dim on={BASE[s] >= 0 && Math.abs(px - bx) > 60}>+ offset</Label>

            {/* A20 wrap */}
            <motion.path d={`M${RX1 - 2} ${RY - 4} C ${RX1 - 60} 236, ${fullX(0x0ffef) + 60} 236, ${fullX(0x0ffef) + 4} ${RY - 30}`} fill="none" stroke="var(--viz-fg)" strokeWidth={1.5} strokeDasharray="5 5" markerEnd="url(#viz-arrow)"
              initial={false} animate={{ pathLength: s === 7 ? 1 : 0, opacity: s === 7 ? 1 : 0 }} transition={{ ...ease, duration: 1.2 }} />
            <Label x={400} y={246} size={11.5} anchor="middle" on={s === 7}>bit 20 lost: wraps around to the bottom</Label>
          </Scene>
        )
      }}
    </VizStage>
  )
}
