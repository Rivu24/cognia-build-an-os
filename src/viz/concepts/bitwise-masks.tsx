/* Binary, hex and bit masks by hand. Follows Binary Notation (each position is a power of two; take each nibble and
   convert it individually) and Hexadecimal Notation (16 digits, A–F = 10–15, one hex digit = 4 bits, two = one byte).
   All values checked by hand:
     0x2F = 0010 1111 = 32 + 8 + 4 + 2 + 1 = 2·16 + 15 = 47
     200 = 12·16 + 8 = 0xC8 = 1100 1000 = 128 + 64 + 8
     0x00403007 = 0000 0000 0100 0000 0011 0000 0000 0111
     0x00403007 >> 12 = 0x00000403;  0x403 & 0x3FF = 0x003 = 3   (bits 21–12: a 32-bit page-table index)
     0x27 | (1 << 3) = 0x27 | 0x08 = 0x2F;  0x2F & ~(1 << 3) = 0x2F & 0xF7 = 0x27   (8-bit view)
   Motion is heavy on purpose: bits slide on a massy spring and settle; the mask sweeps slowly. */
import { motion, type Transition } from 'motion/react'
import type { ReactNode } from 'react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'bitwise-masks',
  title: 'Binary, hex and bit masks',
  summary: 'Hex digits as 4-bit nibbles (0x2F = 0010 1111 = 47, 200 = 0xC8), then pulling a field out of 0x00403007 with >> 12 and & 0x3FF, and setting and clearing bit 3 with | (1 << 3) and & ~(1 << 3).',
  lessons: ['p2l1'],
  articles: ['Binary Notation', 'Hexadecimal Notation'],
  group: 'Basics',
  order: 20,
}

const steps: VizStep[] = [
  { caption: 'Hex is shorthand for binary: each hex digit is exactly 4 bits. 0x2F = 0010 1111.', detail: '2 is 0010 and F (15) is 1111. Swap digit by digit with the table below; no arithmetic needed. Two hex digits make one byte.' },
  { caption: 'Each bit has a place value. Add the set ones: 32 + 8 + 4 + 2 + 1 = 47.', detail: 'Places double from right to left: 1, 2, 4 … 128. In hex: 2 × 16 + 15 = 47. One number, three spellings: 0x2F, 0010 1111, 47.', ms: 3800 },
  { caption: 'The other way: 200 = 12 × 16 + 8, so 200 is 0xC8, which is 1100 1000.', detail: 'Divide by 16: 12 (C) remainder 8. Check it in binary: 128 + 64 + 8 = 200.', ms: 3800 },
  { caption: 'A 32-bit value, 0x00403007. We want only bits 21 to 12, a 10-bit field.', detail: 'Hardware packs several fields into one word. Paging is one example: bits 21–12 of an address are the page-table index.' },
  { caption: 'x >> 12 slides every bit 12 places right. The low 12 bits fall off.', detail: 'Zeros come in on the left: 0x00403007 >> 12 = 0x00000403. The field now starts at bit 0. 12 bits = 3 hex digits, so the 007 is gone.', ms: 4000 },
  { caption: '& 0x3FF keeps the low 10 bits and clears the rest. The field is 0x003 = 3.', detail: '0x3FF is ten 1 bits. AND gives 1 only where both bits are 1, so the mask lets the field through and zeroes the 1 at bit 10.', ms: 4000 },
  { caption: 'Set bit 3 with x | (1 << 3). OR with a single 1 turns that bit on, nothing else.', detail: '1 << 3 moves a 1 three places left: 0000 1000 = 0x08. 0x27 | 0x08 = 0x2F. A bit that is already 1 stays 1.', ms: 3800 },
  { caption: 'Clear bit 3 with x & ~(1 << 3). NOT flips the mask, AND turns just that bit off.', detail: '~0x08 = 1111 0111 = 0xF7 (8-bit view). 0x2F & 0xF7 = 0x27, back where we started.', ms: 4200 },
]

/* ---------- motion: heavy, settling ---------- */
const heavy: Transition = { type: 'spring', stiffness: 44, damping: 13, mass: 1.7 }
const slowFade = (delay = 0): Transition => ({ duration: 0.95, ease: [0.45, 0, 0.2, 1], delay })

function Sink({ on, children, delay = 0, dy = 14 }: { on: boolean; children: ReactNode; delay?: number; dy?: number }) {
  const d = on ? delay : 0
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : dy }} transition={{ y: { ...heavy, delay: d }, opacity: slowFade(d) }}
      style={{ pointerEvents: on ? 'auto' : 'none' }}>
      {children}
    </motion.g>
  )
}

/** Text that drops in again whenever its value changes. */
function Val({ x, y, v, size = 14, anchor = 'middle', weight = 500, dim, delay = 0, invert }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean; delay?: number; invert?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ opacity: slowFade(delay), y: { ...heavy, delay } }}>
      <text x={x} y={y} textAnchor={anchor} fill={invert ? 'var(--viz-bg)' : dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight, transition: 'fill .6s' }}>
        {v}
      </text>
    </motion.g>
  )
}

/** One bit cell in BitField style, but able to fill, glow and re-drop its digit. */
function Cell({ x, y, w, h, v, size, fill, glow, delay = 0 }: { x: number; y: number; w: number; h: number; v: string; size: number; fill?: boolean; glow?: boolean; delay?: number }) {
  return (
    <g>
      <motion.rect x={x} y={y} width={w} height={h} stroke={glow ? 'var(--viz-fg)' : 'var(--viz-faint)'} initial={false}
        animate={{ fill: fill ? 'var(--viz-fg)' : 'var(--viz-bg)', strokeWidth: glow ? 2 : 1 }} transition={slowFade(delay)}
        filter={glow ? 'url(#viz-glow)' : undefined} />
      <Val x={x + w / 2} y={y + h / 2 + size * 0.36} v={v} size={size} delay={delay} invert={fill} />
    </g>
  )
}

const hex = (v: number, n: number) => v.toString(16).toUpperCase().padStart(n, '0')
const bin = (v: number, n: number) => v.toString(2).padStart(n, '0')

/* =================== phase A: one byte, hex ↔ binary ↔ decimal =================== */
const AX = 176
const AW = 56 // one bit
const PLACES = [128, 64, 32, 16, 8, 4, 2, 1]

function ByteView({ s }: { s: number }) {
  const v = s === 2 ? 0xc8 : 0x2f
  const h = hex(v, 2)
  const b = bin(v, 8)
  const sumOn = s >= 1
  const terms = PLACES.filter((_, i) => b[i] === '1')
  return (
    <Sink on={s <= 2}>
      <Label x={20} y={30} size={11} dim>ONE BYTE</Label>
      <Label x={780} y={30} size={11} anchor="end" dim>{s === 2 ? 'decimal → hex → binary' : 'hex → binary → decimal'}</Label>
      {/* hex digits */}
      <Label x={20} y={86} size={12} dim>hex</Label>
      <Label x={AX - 12} y={90} size={22} anchor="end" dim>0x</Label>
      {[0, 1].map((k) => (
        <g key={k}>
          <Block x={AX + k * 4 * AW} y={44} w={4 * AW} h={66} state={s === 0 || s === 2 ? 'on' : 'off'} />
          <Val x={AX + k * 4 * AW + 2 * AW} y={92} v={h[k]} size={40} weight={600} delay={k * 0.15} />
          <Val x={AX + k * 4 * AW + 4 * AW - 10} y={104} v={`= ${parseInt(h[k], 16)}`} size={11} anchor="end" dim delay={k * 0.15} />
        </g>
      ))}
      {/* digit → nibble fan-out */}
      {[0, 1].map((k) =>
        [0, 1, 2, 3].map((j) => (
          <Wire key={`${k}${j}`} from={[AX + k * 4 * AW + 2 * AW, 112]} to={[AX + (k * 4 + j) * AW + AW / 2, 142]} arrow={false} width={1} dim on={s !== 1} delay={0.1 + j * 0.06} />
        )),
      )}
      {/* bits */}
      <Label x={20} y={176} size={12} dim>binary</Label>
      {b.split('').map((d, i) => (
        <Cell key={i} x={AX + i * AW} y={146} w={AW} h={48} v={d} size={24} fill={s >= 1 && d === '1'} delay={0.2 + i * 0.07} />
      ))}
      <Label x={AX + 2 * AW} y={212} size={10.5} anchor="middle" dim>nibble · 4 bits</Label>
      <Label x={AX + 6 * AW} y={212} size={10.5} anchor="middle" dim>nibble · 4 bits</Label>
      <line x1={AX + 4 * AW} x2={AX + 4 * AW} y1={140} y2={200} stroke="var(--viz-fg)" strokeWidth={2} />
      {/* place values */}
      <Label x={20} y={246} size={12} dim on={sumOn}>place</Label>
      {PLACES.map((p, i) => (
        <motion.g key={i} initial={false} animate={{ opacity: sumOn ? (b[i] === '1' ? 1 : 0.28) : 0, y: sumOn ? 0 : -8 }}
          transition={{ opacity: slowFade(sumOn ? 0.15 + (7 - i) * 0.09 : 0), y: { ...heavy, delay: sumOn ? 0.15 + (7 - i) * 0.09 : 0 } }}>
          <text x={AX + i * AW + AW / 2} y={246} textAnchor="middle" fill="var(--viz-fg)" style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: b[i] === '1' ? 600 : 400 }}>{p}</text>
        </motion.g>
      ))}
      <Label x={AX + 2 * AW} y={278} size={20} anchor="middle" weight={600} on={s === 0} delay={(s === 0) ? 0.5 : 0}>2 → 0010</Label>
      <Label x={AX + 6 * AW} y={278} size={20} anchor="middle" weight={600} on={s === 0} delay={(s === 0) ? 0.65 : 0}>F → 1111</Label>
      {/* the sum */}
      <Sink on={sumOn} delay={0.6}>
        <Val x={400} y={292} v={`${terms.join(' + ')} = ${v}`} size={22} weight={600} delay={0.7} />
        <Val x={400} y={318} v={s === 2 ? '200 ÷ 16 = 12 (C) remainder 8  →  0xC8' : 'in hex: 2 × 16 + 15 = 47'} size={13} dim delay={0.8} />
      </Sink>
      {/* the 16-row conversion table, as one strip */}
      <Label x={20} y={360} size={11} dim>THE NIBBLE TABLE</Label>
      {Array.from({ length: 16 }, (_, n) => {
        const here = h.includes(hex(n, 1))
        return (
          <g key={n}>
            <motion.rect x={40 + n * 45} y={370} width={45} height={50} initial={false} fill="var(--viz-fg)"
              animate={{ opacity: here ? 0.14 : 0 }} transition={slowFade(here ? 0.3 : 0)} />
            <rect x={40 + n * 45} y={370} width={45} height={50} fill="none" stroke="var(--viz-faint)" />
            <Label x={40 + n * 45 + 22.5} y={390} size={14} anchor="middle" weight={here ? 700 : 400} dim={!here}>{hex(n, 1)}</Label>
            <Label x={40 + n * 45 + 22.5} y={410} size={10.5} anchor="middle" dim={!here}>{bin(n, 4)}</Label>
          </g>
        )
      })}
      {[0, 1].map((k) => (
        <Packet key={k} on={s === 0 || s === 2} points={[[AX + k * 4 * AW + 2 * AW, 112], [AX + k * 4 * AW + 2 * AW, 130], [AX + (k * 4 + 1.5) * AW + AW / 2, 142]]} duration={1.6} delay={k * 0.3} r={4} />
      ))}
    </Sink>
  )
}

/* =================== phase B: extract a field from a 32-bit word =================== */
const BX = 152
const CW = 19
const BITS32 = bin(0x00403007, 32)
const SHIFTED = bin(0x00403007 >>> 12, 32)
const MASK = bin(0x3ff, 32)
const RESULT = bin((0x00403007 >>> 12) & 0x3ff, 32)
const R1 = 82
const R2 = 176
const R3 = 262
const R4 = 344

function Extract({ s }: { s: number }) {
  const on = s >= 3 && s <= 5
  const shifted = s >= 4
  const masked = s >= 5
  const hx = hex(0x00403007, 8)
  return (
    <Sink on={on}>
      <Label x={20} y={30} size={11} dim>PULL A FIELD OUT OF A WORD</Label>
      <Label x={780} y={30} size={11} anchor="end" dim>(x &gt;&gt; 12) &amp; 0x3FF</Label>
      {/* hex digits above their nibbles */}
      {hx.split('').map((d, k) => (
        <Label key={k} x={BX + (k * 4 + 2) * CW} y={60} size={13} anchor="middle" weight={500}>{d}</Label>
      ))}
      <Label x={20} y={R1 + 18} size={12} weight={600}>x</Label>
      <Label x={36} y={R1 + 18} size={11} dim>0x00403007</Label>
      <BitField x={BX} y={R1} bits={BITS32} cellW={CW} h={26}
        fields={s === 3 ? [[10, 10, 'bits 21–12: the field we want']] : [[10, 10, '']]} active={s === 3 ? 0 : undefined} />

      {/* row 2: the same bits, sliding right */}
      <motion.g initial={false} animate={{ opacity: shifted ? 1 : 0.16 }} transition={slowFade()}>
        <Label x={20} y={R2 + 18} size={12} weight={600}>x &gt;&gt; 12</Label>
        <Val x={20} y={R2 + 36} v="0x00000403" size={11} dim anchor="start" />
        {Array.from({ length: 32 }, (_, i) => (
          <rect key={i} x={BX + i * CW} y={R2} width={CW} height={26} fill="var(--viz-bg)" stroke="var(--viz-faint)" />
        ))}
        {/* incoming zeros on the left */}
        {Array.from({ length: 12 }, (_, i) => (
          <motion.text key={`z${i}`} x={BX + i * CW + CW / 2} y={R2 + 17} textAnchor="middle" fill="var(--viz-dim)" initial={false}
            animate={{ opacity: shifted ? 1 : 0 }} transition={slowFade(shifted ? 0.9 + (11 - i) * 0.03 : 0)}
            style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>0</motion.text>
        ))}
        {/* the original bits, moving as one heavy block */}
        <motion.g initial={false} animate={{ x: shifted ? 12 * CW : 0 }} transition={{ ...heavy, delay: shifted ? 0.25 : 0 }}>
          {BITS32.split('').map((d, i) => {
            const falls = i >= 20
            const keep = i >= 10 && i < 20
            return (
              <motion.g key={i} initial={false}
                animate={{ opacity: falls && shifted ? 0 : 1, y: falls && shifted ? 22 : 0 }}
                transition={{ opacity: { duration: 0.9, delay: shifted ? 0.5 : 0 }, y: { duration: 0.9, ease: [0.5, 0, 0.9, 0.5], delay: shifted ? 0.45 : 0 } }}>
                <motion.rect x={BX + i * CW + 1} y={R2 + 1} width={CW - 2} height={24} initial={false}
                  animate={{ fill: keep && masked ? 'var(--viz-fg)' : 'var(--viz-bg)', opacity: keep && masked ? 1 : 0 }} transition={slowFade(0.6)} />
                <motion.text x={BX + i * CW + CW / 2} y={R2 + 17} textAnchor="middle" initial={false}
                  animate={{ fill: keep && masked ? 'var(--viz-bg)' : 'var(--viz-fg)', opacity: masked && !keep ? 0.3 : 1 }} transition={slowFade(masked ? 0.6 : 0)}
                  style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>{d}</motion.text>
              </motion.g>
            )
          })}
        </motion.g>
        {/* the field outline follows the bits */}
        <motion.rect x={BX + 10 * CW} y={R2 - 4} width={10 * CW} height={34} fill="none" stroke="var(--viz-fg)" strokeWidth={1.6} initial={false}
          animate={{ x: shifted ? 12 * CW : 0, opacity: shifted ? 1 : 0 }} transition={{ x: { ...heavy, delay: shifted ? 0.25 : 0 }, opacity: slowFade(0.3) }} />
        <Label x={BX + 27 * CW} y={R2 + 48} size={11} anchor="middle" on={shifted}>field now at bits 9–0</Label>
        <Label x={BX + 6 * CW} y={R2 + 48} size={10.5} anchor="middle" dim on={shifted}>zeros come in</Label>
        {/* the falling-off note */}
        <Label x={20} y={R2 + 54} size={10.5} dim on={s === 4} delay={(s === 4) ? 1 : 0}>007 fell off</Label>
        {/* the AND mask sweeps across the part it clears */}
        <motion.rect x={BX} y={R2} height={26} fill="url(#viz-hatch)" initial={false}
          animate={{ width: masked ? 22 * CW : 0 }} transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1], delay: masked ? 0.1 : 0 }} />
      </motion.g>
      <Wire d={`M${BX + 10 * CW} ${R1 + 32} C ${BX + 10 * CW} ${R1 + 70}, ${BX + 22 * CW} ${R1 + 50}, ${BX + 22 * CW} ${R2 - 8}`} on={s === 4} dashed delay={0.2} />
      <Label x={BX + 22 * CW + 14} y={R2 - 14} size={11} on={s === 4} weight={600} delay={(s === 4) ? 0.3 : 0}>12 places →</Label>

      {/* row 3: the mask */}
      <motion.g initial={false} animate={{ opacity: masked ? 1 : 0.12, y: masked ? 0 : -10 }} transition={{ opacity: slowFade(masked ? 0.2 : 0), y: { ...heavy, delay: masked ? 0.2 : 0 } }}>
        <Label x={20} y={R3 + 18} size={12} weight={600}>&amp; 0x3FF</Label>
        <Label x={20} y={R3 + 36} size={11} dim>mask</Label>
        <BitField x={BX} y={R3} bits={MASK} cellW={CW} h={26} fields={[[22, 10, 'ten 1s: lets the field through']]} active={0} showIndex={false} />
      </motion.g>

      {/* row 4: the result */}
      <motion.g initial={false} animate={{ opacity: masked ? 1 : 0.12, y: masked ? 0 : -10 }} transition={{ opacity: slowFade(masked ? 0.9 : 0), y: { ...heavy, delay: masked ? 0.9 : 0 } }}>
        <line x1={BX} x2={BX + 32 * CW} y1={R4 - 14} y2={R4 - 14} stroke="var(--viz-fg)" />
        <Label x={20} y={R4 + 18} size={12} weight={600}>result</Label>
        <BitField x={BX} y={R4} bits={RESULT} cellW={CW} h={26} fields={[[22, 10, '= 0x003 = 3']]} active={0} showIndex={false} />
        <Label x={20} y={R4 + 36} size={13} weight={700}>3</Label>
      </motion.g>
      <Label x={400} y={430} size={11} anchor="middle" dim on={masked} delay={(masked) ? 1.1 : 0}>bits 21–12 of 0x00403007 = 3, the same page-table index the MMU reads</Label>
      <Pulse x={BX + 31 * CW - CW / 2} y={R4 + 13} on={masked} r={12} />
    </Sink>
  )
}

/* =================== phase C: set and clear one bit =================== */
const CX = [128, 512] // left: set, right: clear
const CCW = 30
const CR = [96, 168, 262] // rows: x, mask, result
const FLAGS = 0x27
const SET = FLAGS | 0x08 // 0x2F

function SetClear({ s }: { s: number }) {
  const on = s >= 6
  const clr = s >= 7
  const col = (side: number) => CX[side] + 4 * CCW // bit 3 column x
  return (
    <Sink on={on}>
      <Label x={20} y={30} size={11} dim>SET AND CLEAR ONE BIT · 8-BIT VIEW</Label>
      {/* column headers */}
      {[0, 1].map((side) => (
        <g key={side}>
          <Label x={CX[side] + 4 * CCW} y={58} size={14} anchor="middle" mono={false} weight={600}>{side === 0 ? 'set bit 3' : 'clear bit 3'}</Label>
          {Array.from({ length: 8 }, (_, i) => (
            <Label key={i} x={CX[side] + i * CCW + CCW / 2} y={CR[0] - 8} size={10.5} anchor="middle" dim>{7 - i}</Label>
          ))}
          {/* bit 3 column highlight */}
          <motion.rect x={col(side) - 3} y={CR[0] - 4} width={CCW + 6} height={CR[2] + 38 - CR[0]} fill="none" stroke="var(--viz-fg)" strokeWidth={1.6}
            initial={false} animate={{ opacity: (side === 0 && s === 6) || (side === 1 && clr) ? 1 : 0 }} transition={slowFade(1.0)} filter="url(#viz-glow)" />
          <line x1={CX[side]} x2={CX[side] + 8 * CCW} y1={CR[2] - 18} y2={CR[2] - 18} stroke="var(--viz-fg)" />
        </g>
      ))}

      {/* ---- left: x | (1 << 3) ---- */}
      <motion.g initial={false} animate={{ opacity: clr ? 0.4 : 1 }} transition={slowFade()}>
        <Label x={CX[0] - 12} y={CR[0] + 21} size={13} anchor="end" weight={600}>x</Label>
        <Label x={CX[0] - 12} y={CR[0] + 37} size={10.5} anchor="end" dim>0x27</Label>
        {bin(FLAGS, 8).split('').map((d, i) => <Cell key={i} x={CX[0] + i * CCW} y={CR[0]} w={CCW} h={32} v={d} size={15} />)}
        <Label x={CX[0] - 12} y={CR[1] + 21} size={13} anchor="end" weight={600}>| 1 &lt;&lt; 3</Label>
        <Label x={CX[0] - 12} y={CR[1] + 37} size={10.5} anchor="end" dim>0x08</Label>
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i}>
            <rect x={CX[0] + i * CCW} y={CR[1]} width={CCW} height={32} fill="var(--viz-bg)" stroke="var(--viz-faint)" />
            {i !== 4 && i !== 7 && <text x={CX[0] + i * CCW + CCW / 2} y={CR[1] + 21} textAnchor="middle" fill="var(--viz-dim)" style={{ fontSize: 15, fontFamily: 'var(--font-mono)' }}>0</text>}
          </g>
        ))}
        {/* the zero left behind at bit 0, and the 1 that slides from bit 0 to bit 3 */}
        <motion.text x={CX[0] + 7 * CCW + CCW / 2} y={CR[1] + 21} textAnchor="middle" fill="var(--viz-dim)" initial={false} animate={{ opacity: on ? 1 : 0 }} transition={slowFade(0.9)}
          style={{ fontSize: 15, fontFamily: 'var(--font-mono)' }}>0</motion.text>
        <motion.text x={CX[0] + 4 * CCW + CCW / 2} y={CR[1] + 21} textAnchor="middle" fill="var(--viz-fg)" initial={false} animate={{ x: on ? 0 : 3 * CCW }}
          transition={{ ...heavy, delay: on ? 0.35 : 0 }} style={{ fontSize: 15, fontFamily: 'var(--font-mono)', fontWeight: 700 }} filter="url(#viz-glow)">1</motion.text>
        <Label x={CX[0] - 12} y={CR[2] + 21} size={13} anchor="end" weight={600}>=</Label>
        <Label x={CX[0] - 12} y={CR[2] + 37} size={10.5} anchor="end" dim>0x2F</Label>
        {bin(SET, 8).split('').map((d, i) => (
          <Cell key={i} x={CX[0] + i * CCW} y={CR[2]} w={CCW} h={32} v={on ? d : ' '} size={15} fill={i === 4 && s === 6} delay={0.7 + i * 0.03} />
        ))}
        <Label x={CX[0] + 4 * CCW} y={CR[2] + 56} size={11} anchor="middle" dim>other bits pass through</Label>
      </motion.g>

      {/* ---- right: x & ~(1 << 3) ---- */}
      <motion.g initial={false} animate={{ opacity: clr ? 1 : 0.22 }} transition={slowFade()}>
        <Label x={CX[1] - 12} y={CR[0] + 21} size={13} anchor="end" weight={600}>x</Label>
        <Label x={CX[1] - 12} y={CR[0] + 37} size={10.5} anchor="end" dim>0x2F</Label>
        {bin(SET, 8).split('').map((d, i) => <Cell key={i} x={CX[1] + i * CCW} y={CR[0]} w={CCW} h={32} v={d} size={15} />)}
        <Label x={CX[1] - 12} y={CR[1] + 21} size={13} anchor="end" weight={600}>&amp; ~(1 &lt;&lt; 3)</Label>
        <Label x={CX[1] - 12} y={CR[1] + 37} size={10.5} anchor="end" dim>{clr ? '0xF7' : '0x08'}</Label>
        {/* the mask flips bit by bit, a slow wave from left to right */}
        {bin(clr ? 0xf7 : 0x08, 8).split('').map((d, i) => <Cell key={i} x={CX[1] + i * CCW} y={CR[1]} w={CCW} h={32} v={d} size={15} delay={0.3 + i * 0.08} glow={clr && i === 4} />)}
        <Label x={CX[1] - 12} y={CR[2] + 21} size={13} anchor="end" weight={600}>=</Label>
        <Label x={CX[1] - 12} y={CR[2] + 37} size={10.5} anchor="end" dim>0x27</Label>
        {bin(FLAGS, 8).split('').map((d, i) => (
          <Cell key={i} x={CX[1] + i * CCW} y={CR[2]} w={CCW} h={32} v={clr ? d : ' '} size={15} fill={clr && i === 4} delay={0.7 + i * 0.03} />
        ))}
        <Label x={CX[1] + 4 * CCW} y={CR[2] + 56} size={11} anchor="middle" dim>only bit 3 goes to 0</Label>
      </motion.g>

      {/* the C you would write */}
      <Block x={128} y={362} w={624} h={56} state="off" />
      <Label x={148} y={386} size={13} weight={s === 6 ? 600 : 400} dim={s !== 6}>{'flags |= (1 << 3);'}</Label>
      <Label x={148} y={406} size={13} weight={s === 7 ? 600 : 400} dim={s !== 7}>{'flags &= ~(1 << 3);'}</Label>
      <Label x={330} y={386} size={13} dim>{'// set'}</Label>
      <Label x={330} y={406} size={13} dim>{'// clear'}</Label>
      <Label x={736} y={396} size={11} anchor="end" dim>kernels write device registers this way</Label>
    </Sink>
  )
}

export default function BitwiseMasks() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => (
        <Scene label={meta.summary}>
          {/* no programming ligatures: a beginner must see << and |= as typed */}
          <g style={{ fontVariantLigatures: 'none', fontFeatureSettings: '"liga" 0, "calt" 0' }}>
            <ByteView s={s} />
            <Extract s={s} />
            <SetClear s={s} />
          </g>
        </Scene>
      )}
    </VizStage>
  )
}
