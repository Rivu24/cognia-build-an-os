/* One 32-bit value, 0x12345678, seen four ways: hex digits, decimal, binary nibbles, and the bytes in memory.
   Follows Hexadecimal Notation / Binary Notation (one hex digit = one 4-bit nibble, two digits = one byte) and
   Endianness (little-endian puts the least significant byte at the lowest address; x86 is little-endian).
   Address 0x1000 is a worked example. 0x12345678 = 305,419,896. -1 in two's complement = 0xFFFFFFFF. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'numbers-and-endianness',
  title: 'Hex, binary and byte order',
  summary: 'The value 0x12345678 as decimal, as binary nibbles and as four bytes, stored little-endian (78 56 34 12) on x86 versus big-endian, plus why -1 is 0xFFFFFFFF and why hex dumps look backwards.',
  lessons: ['t1m3l1', 'p2l1', 'p2l2'],
  articles: ['Hexadecimal Notation', 'Binary Notation', 'Endianness'],
  group: 'CPU',
  order: 131,
}

const steps: VizStep[] = [
  { caption: 'One 32-bit value: 0x12345678. In decimal that is 305,419,896.', detail: 'The 0x prefix means hexadecimal: digits 0–9 and A–F (10–15). Each place is worth 16 times the one to its right: 1·16⁷ + 2·16⁶ + … + 8·16⁰.' },
  { caption: 'Each hex digit is exactly 4 bits, a nibble. The last digit 8 is 1000.', detail: 'That is why hex is used: you can rewrite it as binary digit by digit, with no arithmetic. 0x12345678 = 0001 0010 0011 0100 0101 0110 0111 1000.' },
  { caption: 'Two hex digits make one byte: 12 34 56 78. 0x12 is the most significant byte.', detail: 'Byte 3 holds bits 31–24, byte 0 holds bits 7–0. One byte runs from 0x00 to 0xFF (0 to 255).' },
  { caption: 'x86 is little-endian: the lowest address gets the least significant byte, 0x78.', detail: 'Storing the value at address 0x1000 writes 78 at 0x1000, 56 at 0x1001, 34 at 0x1002 and 12 at 0x1003.', ms: 3800 },
  { caption: 'A big-endian CPU stores the bytes in reading order: 12 34 56 78.', detail: 'Big-endian is also called network byte order. PNG files and network headers use it, so x86 code must swap bytes when it reads them.' },
  { caption: 'Why little-endian? One address works for an 8-, 16- or 32-bit read.', detail: 'Read 8 bits at 0x1000 and you get the low byte, 0x78. On a big-endian CPU a 16-bit read there would give 0x1234, the upper half.', ms: 3800 },
  { caption: 'A hex dump lists bytes in address order, so x86 values look backwards.', detail: 'To read a 32-bit value from a dump, take its 4 bytes right to left: 78 56 34 12 is 0x12345678, and 00 10 00 00 is 0x00001000.', ms: 4000 },
  { caption: 'Negative numbers use two’s complement: −1 is stored as 0xFFFFFFFF.', detail: 'To negate, flip every bit and add 1: 0x00000001 → 0xFFFFFFFE → 0xFFFFFFFF. The same 32 bits read as unsigned are 4,294,967,295.', ms: 4000 },
]

const HEX = '12345678'
const BITS = HEX.split('').map((d) => parseInt(d, 16).toString(2).padStart(4, '0')).join('')
const NEG = '1'.repeat(32)

const X0 = 80 // left edge of the value rows
const CW = 20 // one bit
const NIBBLES: [number, number, string][] = HEX.split('').map((_, i) => [i * 4, 4, ''])
const BYTES: [number, number, string][] = [
  [0, 8, 'byte 3 · 0x12'],
  [8, 8, 'byte 2 · 0x34'],
  [16, 8, 'byte 1 · 0x56'],
  [24, 8, 'byte 0 · 0x78'],
]
const BYTES_NEG: [number, number, string][] = BYTES.map(([a, b, l]) => [a, b, l.replace(/0x../, '0xFF')])

// memory rows
const MX = 280, MW = 80
const BE_Y = 196, LE_Y = 252, RH = 40
const cellX = (i: number) => MX + i * MW
const cellMid = (i: number) => MX + i * MW + MW / 2
const byteMid = (k: number) => X0 + k * 160 + 80 // k = 0 for 0x12 (leftmost)

/** Text that fades in whenever its value changes. */
function Val({ x, y, v, size = 13, anchor = 'middle', weight = 500, dim }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>
        {v}
      </text>
    </motion.g>
  )
}

export default function NumbersAndEndianness() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const neg = s === 7
        const digits = neg ? 'FFFFFFFF' : HEX
        const le = neg ? ['FF', 'FF', 'FF', 'FF'] : ['78', '56', '34', '12']
        const be = neg ? ['FF', 'FF', 'FF', 'FF'] : ['12', '34', '56', '78']
        const fields = s === 1 ? NIBBLES : s >= 2 ? (neg ? BYTES_NEG : BYTES) : []
        const active = s === 1 ? 7 : s === 3 ? 3 : s === 4 ? 0 : undefined
        return (
          <Scene label={meta.summary}>
            {/* ===== the value ===== */}
            <Label x={20} y={24} size={11} dim>32-BIT VALUE</Label>
            <Val x={720} y={24} anchor="end" size={12} v={neg ? 'signed −1 · unsigned 4,294,967,295' : 'decimal 305,419,896'} />
            <Label x={20} y={60} size={11} dim>hex</Label>
            <Label x={58} y={60} size={14} dim>0x</Label>
            {digits.split('').map((d, i) => (
              <g key={i}>
                <Block x={X0 + i * 80} y={34} w={80} h={40} state={(s === 1 && i === 7) || neg ? 'on' : 'off'} />
                <Val x={X0 + i * 80 + 40} y={62} v={d} size={22} />
              </g>
            ))}

            <Appear on={s >= 1}>
              <Label x={20} y={118} size={11} dim>binary</Label>
              <BitField x={X0} y={100} bits={neg ? NEG : BITS} cellW={CW} h={26} fields={fields} active={active} />
            </Appear>
            {/* nibble ↔ digit ties */}
            {HEX.split('').map((_, i) => (
              <Wire key={i} from={[X0 + i * 80 + 40, 76]} to={[X0 + i * 80 + 40, 92]} on={s === 1} arrow={false} width={1} delay={i * 0.06} />
            ))}
            <Pulse x={X0 + 7 * 80 + 40} y={54} on={s === 1} r={18} />

            {/* ===== memory ===== */}
            <Appear on={s >= 3}>
              <Label x={20} y={182} size={11} dim>MEMORY</Label>
              {[0, 1, 2, 3].map((i) => (
                <Label key={i} x={cellMid(i)} y={188} size={11} anchor="middle" dim>{`0x${(0x1000 + i).toString(16).toUpperCase()}`}</Label>
              ))}
              <Label x={616} y={188} size={10.5} dim>addresses grow →</Label>
            </Appear>

            {/* big-endian row (top) */}
            <Appear on={s >= 4}>
              <Label x={20} y={BE_Y + 17} size={12} mono={false} weight={600}>Big-endian</Label>
              <Label x={20} y={BE_Y + 32} size={10.5} dim>network byte order</Label>
              {be.map((b, i) => (
                <g key={i}>
                  <Block x={cellX(i)} y={BE_Y} w={MW} h={RH} state={s === 4 && i === 0 ? 'on' : s === 5 || s === 6 ? 'dim' : 'off'} />
                  <Val x={cellMid(i)} y={BE_Y + 25} v={b} size={15} />
                </g>
              ))}
              <Label x={616} y={BE_Y + 25} size={11} dim={s !== 4}>0x1000 ← high byte</Label>
            </Appear>

            {/* little-endian row (bottom) */}
            <Appear on={s >= 3}>
              <Label x={20} y={LE_Y + 17} size={12} mono={false} weight={600}>Little-endian</Label>
              <Label x={20} y={LE_Y + 32} size={10.5} dim>x86, x86-64</Label>
              {le.map((b, i) => (
                <g key={i}>
                  <Block x={cellX(i)} y={LE_Y} w={MW} h={RH} state={(s === 3 && i === 0) || (s === 5 && i === 0) ? 'on' : s === 6 ? 'off' : 'off'} />
                  <Val x={cellMid(i)} y={LE_Y + 25} v={b} size={15} />
                </g>
              ))}
              <Label x={616} y={LE_Y + 25} size={11} dim={s !== 3}>0x1000 ← low byte</Label>
            </Appear>

            {/* bytes travelling from the value into memory */}
            {[0, 1, 2, 3].map((k) => (
              <Packet key={`le${k}`} on={s === 3} points={[[byteMid(3 - k), 130], [byteMid(3 - k), 166], [cellMid(k), 166], [cellMid(k), LE_Y + 6]]}
                duration={1.6} delay={k * 0.25} label={['78', '56', '34', '12'][k]} />
            ))}
            {[0, 1, 2, 3].map((k) => (
              <Packet key={`be${k}`} on={s === 4} points={[[byteMid(k), 130], [byteMid(k), 166], [cellMid(k), 166], [cellMid(k), BE_Y + 6]]}
                duration={1.4} delay={k * 0.25} label={['12', '34', '56', '78'][k]} />
            ))}

            {/* ===== step 5: one address, three widths ===== */}
            <Appear on={s === 5}>
              <Label x={20} y={318} size={11} dim>READ AT 0x1000</Label>
              {[
                [1, '8-bit', '0x78'],
                [2, '16-bit', '0x5678'],
                [4, '32-bit', '0x12345678'],
              ].map(([n, w, v], j) => (
                <g key={j}>
                  <Block x={MX} y={304 + j * 30} w={MW * (n as number)} h={20} state="on" />
                  <Label x={MX + 8} y={318 + j * 30} size={11}>{w as string}</Label>
                  <Label x={616} y={318 + j * 30} size={13} weight={500}>{`→ ${v}`}</Label>
                </g>
              ))}
              <Label x={20} y={420} size={11} dim>same start address, no adjustment needed</Label>
            </Appear>

            {/* ===== step 6: a hex dump ===== */}
            <Appear on={s === 6}>
              <Label x={20} y={318} size={11} dim>HEX DUMP (hexdump -C)</Label>
              <Block x={150} y={326} w={560} h={40} state="off" />
              <Label x={164} y={351} size={13} dim>00001000</Label>
              {['78', '56', '34', '12', '00', '10', '00', '00'].map((b, i) => (
                <Label key={i} x={262 + i * 34 + (i >= 4 ? 10 : 0)} y={351} size={13} weight={500}>{b}</Label>
              ))}
              <Label x={560} y={351} size={13} dim>|xV4.....|</Label>
              <Wire from={[372, 384]} to={[262, 384]} />
              <Wire from={[518, 384]} to={[408, 384]} />
              <Label x={317} y={404} size={13} anchor="middle" weight={500}>0x12345678</Label>
              <Label x={463} y={404} size={13} anchor="middle" weight={500}>0x00001000</Label>
              <Label x={390} y={428} size={11} anchor="middle" dim>read each 4-byte group right to left</Label>
            </Appear>

            {/* ===== step 7: two's complement ===== */}
            <Appear on={neg}>
              <Label x={20} y={318} size={11} dim>TWO’S COMPLEMENT</Label>
              {[
                ['value +1', '0x00000001', 400],
                ['flip every bit', '0xFFFFFFFE', 400],
                ['add 1  →  −1', '0xFFFFFFFF', 600],
              ].map(([a, b, w], j) => (
                <g key={j}>
                  <Label x={150} y={344 + j * 26} size={13} weight={w as number} dim={j < 2}>{a as string}</Label>
                  <Label x={330} y={344 + j * 26} size={13} weight={w as number}>{b as string}</Label>
                </g>
              ))}
              <Label x={616} y={368} size={11} dim>all four bytes FF,</Label>
              <Label x={616} y={384} size={11} dim>so both orders match</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
