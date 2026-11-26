/* IEEE 754 single precision, decoded by hand. Follows Floating Point Number: sign bit highest, then the exponent saved
   as a biased integer (bias = all bits set, one bit shorter than the exponent: 127 for 8 bits), then the mantissa with an
   implicit leading "1."; all-ones exponent = infinity/NaN; single = 8-bit exponent, 23-bit mantissa, about 7 digits.
   Every bit checked (DataView in node):
     0x40490FDB = 0 | 10000000 | 10010010000111111011011
       exponent 0x80 = 128, 128 − 127 = 1; fraction 0x490FDB = 4788187; mantissa 1 + 4788187 / 2^23 = 1.57079637…
       value 1.57079637… × 2 = 3.14159274…   (π = 3.14159265…, and float(π) is exactly 0x40490FDB)
     0.1 in binary: ×2 gives 0.2 0, 0.4 0, 0.8 0, 1.6 1, 1.2 1, then 0.4 again → 0.0 0011 0011 0011 …
     float(0.1) = 0x3DCCCCCD = 0 | 01111011 | 10011001100110011001101
       exponent 123 − 127 = −4; mantissa 1.60000002384…; value 0.100000001490116…
   Motion is heavy on purpose: the bits of each field fall out of the word into their decoder and settle. */
import { motion, type Transition } from 'motion/react'
import type { ReactNode } from 'react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Label, BitField, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'float-bits',
  title: 'Inside a 32-bit float',
  summary: 'The IEEE 754 single 0x40490FDB split into sign 0, exponent 128 − 127 = 1 and a mantissa 1.5707963…, giving 3.1415927, then why 0.1 repeats forever in binary and is stored as 0x3DCCCCCD.',
  lessons: ['p2l3'],
  articles: ['Floating Point Number'],
  group: 'Basics',
  order: 30,
}

const steps: VizStep[] = [
  { caption: 'A float is just 32 bits. This one is 0x40490FDB.', detail: 'Written in hex it looks like any integer. The bits only mean a real number because the IEEE 754 standard says how to read them.' },
  { caption: 'IEEE 754 single precision splits them 1 | 8 | 23: sign, exponent, fraction.', detail: 'The value is mantissa × 2^exponent, scientific notation in base 2. Double precision uses the same plan with 1 | 11 | 52.' },
  { caption: 'Bit 31 is the sign. 0 means positive.', detail: 'Flip only this bit and you get −3.1415927. Floats do not use two’s complement: the sign is one separate bit.' },
  { caption: 'The exponent bits 1000 0000 are 128. Subtract the bias, 127, to get 2¹.', detail: 'With the bias, stored 1 to 254 mean 2⁻¹²⁶ to 2¹²⁷, no sign needed. All ones (255) is kept for infinity and NaN; all zeros for tiny "subnormal" numbers.', ms: 4000 },
  { caption: 'The fraction gets a hidden "1." in front: 1.1001001… = 1.5707963…', detail: 'Each bit after the point is worth half the one before: 1/2, 1/4, 1/8 … Here 1 + 1/2 + 1/16 + 1/128 + … The leading 1 is never stored.', ms: 4000 },
  { caption: 'Put together: +1.5707963 × 2 = 3.1415927. It is π, nearly.', detail: 'π is 3.14159265…; the closest single-precision value is 3.14159274…. About 7 significant digits survive, as the article says.', ms: 3800 },
  { caption: '0.1 cannot be stored exactly: in binary its digits repeat forever.', detail: 'Double the fraction, write down the whole part, repeat. Row 6 is row 2 again, so the bits 0011 come round forever: 0.1 = 0.0 0011 0011 0011…', ms: 4800 },
  { caption: 'So 0.1 is rounded to 0x3DCCCCCD, which is really 0.100000001490116…', detail: 'Exponent 123 − 127 = −4, mantissa 1.6000000238… × 1/16. The 23 fraction bits cut the repeating 0011 short and round the last bit up.', ms: 4600 },
]

/* ---------- motion: heavy, settling ---------- */
const heavy: Transition = { type: 'spring', stiffness: 44, damping: 13, mass: 1.7 }
const slowFade = (delay = 0): Transition => ({ duration: 0.95, ease: [0.45, 0, 0.2, 1], delay })

function Faint({ on, hide, children, delay = 0 }: { on: boolean; hide?: boolean; children: ReactNode; delay?: number }) {
  return (
    <motion.g initial={false} animate={{ opacity: hide ? 0 : on ? 1 : 0.18, y: hide ? 12 : 0 }}
      transition={{ opacity: slowFade(on ? delay : 0), y: heavy }}>
      {children}
    </motion.g>
  )
}

/** A panel's worked answer: hidden until its step, so the faint panels show the plan, not the result. */
function Reveal({ on, children, delay = 0 }: { on: boolean; children: ReactNode; delay?: number }) {
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0 }} transition={slowFade(on ? delay : 0)}>
      {children}
    </motion.g>
  )
}

/** Text that drops in again whenever its value changes. */
function Val({ x, y, v, size = 14, anchor = 'middle', weight = 500, dim, delay = 0 }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean; delay?: number }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ opacity: slowFade(delay), y: { ...heavy, delay } }}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>{v}</text>
    </motion.g>
  )
}

/* ---------- the two numbers ---------- */
type Num = { hex: string; bits: string; expDec: string; expMath: string; scale: string; sumLine: string; mant: string; result: string; check: string }
const bitsOf = (h: string) => parseInt(h, 16).toString(2).padStart(32, '0')
const PI: Num = {
  hex: '40490FDB', bits: bitsOf('40490FDB'),
  expDec: '= 0x80 = 128', expMath: '128 − 127 = 1', scale: '× 2¹ = × 2',
  sumLine: '1 + 1/2 + 1/16 + 1/128 + …', mant: '= 1.5707963…',
  result: '+1.5707963… × 2 = 3.1415927…', check: 'π is 3.14159265…  ·  the nearest float is 3.14159274…',
}
const TENTH: Num = {
  hex: '3DCCCCCD', bits: bitsOf('3DCCCCCD'),
  expDec: '= 0x7B = 123', expMath: '123 − 127 = −4', scale: '× 2⁻⁴ = × 1/16',
  sumLine: '1 + 1/2 + 1/16 + 1/32 + …', mant: '= 1.6000000238…',
  result: '+1.6000000238… × 1/16 = 0.100000001490116…', check: 'close to 0.1, but not 0.1: the error is about 1.5 billionths',
}

/* ---------- layout ---------- */
const BX = 48
const CW = 22
const BY = 78
const FIELDS: [number, number, string][] = [[0, 1, 'sign'], [1, 8, 'exponent · 8 bits'], [9, 23, 'fraction · 23 bits']]
const PY = 152 // panel top
const PH = 180
const SIGN = { x: 20, w: 130 }
const EXP = { x: 164, w: 236 }
const FRAC = { x: 414, w: 366 }
const cellX = (i: number) => BX + i * CW + CW / 2

// where each field's bits land inside its panel
const signTo = (): [number, number] => [SIGN.x + SIGN.w / 2, PY + 74]
const expTo = (j: number): [number, number] => [EXP.x + 46 + j * 18 + (j >= 4 ? 10 : 0), PY + 58]
const fracTo = (j: number): [number, number] => [FRAC.x + 46 + j * 12.4 + (j >= 3 ? 4 : 0) + (j >= 7 ? 4 : 0) + (j >= 11 ? 4 : 0) + (j >= 15 ? 4 : 0) + (j >= 19 ? 4 : 0), PY + 58]

/** One bit falling from the word into its decoder panel. */
function Drop({ i, v, to, on, hide, delay, size, weight = 600 }: { i: number; v: string; to: [number, number]; on: boolean; hide: boolean; delay: number; size: number; weight?: number }) {
  const fx = cellX(i) - to[0]
  const fy = BY + 20 - to[1]
  return (
    <motion.g initial={false} animate={{ x: on ? 0 : fx, y: on ? 0 : fy, opacity: hide ? 0 : on ? 1 : 0 }}
      transition={{ x: { ...heavy, delay: on ? delay : 0 }, y: { ...heavy, delay: on ? delay : 0 }, opacity: slowFade(on ? delay : 0) }}>
      <Val x={to[0]} y={to[1]} v={v} size={size} weight={weight} />
    </motion.g>
  )
}

/* ---------- step 6: why 0.1 repeats ---------- */
const DOUBLING: [string, string, string][] = [
  ['0.1', '0.2', '0'],
  ['0.2', '0.4', '0'],
  ['0.4', '0.8', '0'],
  ['0.8', '1.6', '1'],
  ['0.6', '1.2', '1'],
  ['0.2', '0.4', '0'],
]

function Repeating({ on }: { on: boolean }) {
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : 12 }} transition={{ opacity: slowFade(on ? 0.15 : 0), y: heavy }}>
      <Label x={20} y={PY + 16} size={11} dim>0.1 IN BINARY · DOUBLE, KEEP THE WHOLE PART, REPEAT</Label>
      {DOUBLING.map(([a, b, d], k) => {
        const y = PY + 50 + k * 27
        const again = k === 5
        return (
          <motion.g key={k} initial={false} animate={{ opacity: on ? (again ? 0.55 : 1) : 0, x: on ? 0 : -14 }}
            transition={{ opacity: slowFade(on ? 0.25 + k * 0.14 : 0), x: { ...heavy, delay: on ? 0.25 + k * 0.14 : 0 } }}>
            <text x={40} y={y} fill="var(--viz-fg)" style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }}>{`${a} × 2 = ${b}`}</text>
            <text x={206} y={y} fill="var(--viz-dim)" style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }}>→</text>
            <text x={234} y={y} fill="var(--viz-fg)" style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{d}</text>
            {(k === 3 || k === 4) && <text x={256} y={y} fill="var(--viz-dim)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>keep .{b.slice(2)}</text>}
          </motion.g>
        )
      })}
      {/* row 6 is row 2 again: loop back */}
      <Wire d={`M330 ${PY + 50 + 5 * 27 - 5} C 372 ${PY + 50 + 5 * 27 - 5}, 372 ${PY + 50 + 27 - 5}, 336 ${PY + 50 + 27 - 5}`} on={on} delay={1.1} />
      <Label x={380} y={PY + 50 + 3 * 27} size={11} on={on} delay={(on) ? 1.2 : 0}>same as row 2:</Label>
      <Label x={380} y={PY + 50 + 3 * 27 + 15} size={11} on={on} delay={(on) ? 1.2 : 0}>it loops forever</Label>
      {/* the digits read top to bottom */}
      <Label x={520} y={PY + 50} size={11} dim on={on}>read the bits top to bottom</Label>
      <motion.g initial={false} animate={{ opacity: on ? 1 : 0 }} transition={slowFade(on ? 0.5 : 0)}>
        <text x={520} y={PY + 92} fill="var(--viz-fg)" style={{ fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>0.0 0011 0011 0011…</text>
      </motion.g>
      <motion.path d={`M${520 + 13.2 * 4} ${PY + 102} L${520 + 13.2 * 4} ${PY + 110} L${520 + 13.2 * 8} ${PY + 110} L${520 + 13.2 * 8} ${PY + 102}`} fill="none" stroke="var(--viz-fg)" strokeWidth={1.4}
        initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.8, delay: on ? 1.0 : 0 }} />
      <Label x={520 + 13.2 * 6} y={PY + 128} size={11} anchor="middle" on={on} delay={(on) ? 1.1 : 0}>0011 repeats</Label>
      <Label x={520} y={PY + 160} size={11} dim on={on} delay={(on) ? 1.2 : 0}>23 fraction bits cannot hold “forever”,</Label>
      <Label x={520} y={PY + 175} size={11} dim on={on} delay={(on) ? 1.2 : 0}>so the value has to be rounded</Label>
    </motion.g>
  )
}

export default function FloatBits() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const tenth = s === 7
        const n = tenth ? TENTH : PI
        const why = s === 6
        const split = s >= 1
        const active = s === 2 ? 0 : s === 3 ? 1 : s === 4 ? 2 : undefined
        const fracBits = n.bits.slice(9)
        return (
          <Scene label={meta.summary}>
            {/* ===== the word ===== */}
            <motion.g initial={false} animate={{ opacity: why ? 0.25 : 1 }} transition={slowFade()}>
            <Label x={20} y={28} size={11} dim>IEEE 754 SINGLE PRECISION · 32 BITS</Label>
            <Val x={780} y={30} v={`0x${n.hex}${tenth ? '  (0.1)' : ''}`} size={16} anchor="end" weight={600} />
            {n.hex.split('').map((d, k) => (
              <Val key={k} x={BX + (k * 4 + 2) * CW} y={62} v={d} size={13} dim={!split} delay={k * 0.04} />
            ))}
            <BitField x={BX} y={BY} bits={n.bits} cellW={CW} h={30} fields={split ? FIELDS : []} active={active} />
            <Pulse x={cellX(0)} y={BY + 15} on={s === 2} r={14} />
            <Label x={470} y={30} size={14} anchor="middle" weight={700} on={s === 1} delay={(s === 1) ? 0.3 : 0}>1 + 8 + 23 = 32</Label>
            </motion.g>

            {/* ===== decoder panels ===== */}
            <Faint on={s >= 2} hide={why}>
              <Block x={SIGN.x} y={PY} w={SIGN.w} h={PH} state={s === 2 ? 'on' : 'off'} />
              <Label x={SIGN.x + 12} y={PY + 20} size={11} dim>SIGN</Label>
              <Reveal on={s >= 2} delay={0.7}>
                <Label x={SIGN.x + SIGN.w / 2} y={PY + 112} size={13} anchor="middle" weight={600}>positive</Label>
                <Label x={SIGN.x + SIGN.w / 2} y={PY + 132} size={11} anchor="middle" dim>(1 = negative)</Label>
                <Label x={SIGN.x + SIGN.w / 2} y={PY + 166} size={22} anchor="middle" weight={700}>+</Label>
              </Reveal>
            </Faint>
            <Faint on={s >= 3} hide={why}>
              <Block x={EXP.x} y={PY} w={EXP.w} h={PH} state={s === 3 ? 'on' : 'off'} />
              <Label x={EXP.x + 12} y={PY + 20} size={11} dim>EXPONENT</Label>
              <Reveal on={s >= 3}>
                <Val x={EXP.x + 118} y={PY + 88} v={n.expDec} size={14} delay={0.8} />
                <Val x={EXP.x + 118} y={PY + 118} v={n.expMath} size={14} delay={1.05} />
                <Label x={EXP.x + 118} y={PY + 134} size={10.5} anchor="middle" dim>stored − bias</Label>
                <Val x={EXP.x + 118} y={PY + 166} v={n.scale} size={18} weight={700} delay={1.3} />
              </Reveal>
            </Faint>
            <Faint on={s >= 4} hide={why}>
              <Block x={FRAC.x} y={PY} w={FRAC.w} h={PH} state={s === 4 ? 'on' : 'off'} />
              <Label x={FRAC.x + 12} y={PY + 20} size={11} dim>MANTISSA · hidden 1 + fraction</Label>
              <Reveal on={s >= 4}>
                <Label x={FRAC.x + 18} y={PY + 58} size={14} weight={700}>1.</Label>
                <motion.rect x={FRAC.x + 14} y={PY + 42} width={22} height={22} fill="none" stroke="var(--viz-fg)" strokeDasharray="2 3" initial={false}
                  animate={{ opacity: s === 4 ? 1 : 0 }} transition={slowFade(s === 4 ? 1.1 : 0)} />
                <Label x={FRAC.x + 14} y={PY + 80} size={10.5} dim>not stored</Label>
                <Val x={FRAC.x + 183} y={PY + 112} v={n.sumLine} size={13} delay={1.0} />
                <Val x={FRAC.x + 183} y={PY + 152} v={n.mant} size={20} weight={700} delay={1.3} />
              </Reveal>
              <Label x={FRAC.x + FRAC.w - 12} y={PY + 80} size={10.5} anchor="end" on={tenth} delay={(tenth) ? 1.0 : 0}>last bit rounded up ↑</Label>
            </Faint>
            {/* the bits themselves fall into the panels */}
            <Drop i={0} v={n.bits[0]} to={signTo()} on={s >= 2} hide={why} delay={0.1} size={34} weight={700} />
            {n.bits.slice(1, 9).split('').map((b, j) => (
              <Drop key={`e${j}`} i={1 + j} v={b} to={expTo(j)} on={s >= 3} hide={why} delay={0.15 + j * 0.08} size={18} />
            ))}
            {fracBits.split('').map((b, j) => (
              <Drop key={`f${j}`} i={9 + j} v={b} to={fracTo(j)} on={s >= 4} hide={why} delay={0.15 + j * 0.04} size={14} />
            ))}

            {/* ===== result ===== */}
            <Faint on={s >= 5} hide={why}>
              <Block x={20} y={348} w={760} h={82} state={s === 5 || s === 7 ? 'on' : 'off'} />
              <Label x={36} y={368} size={11} dim>VALUE = sign × mantissa × 2^exponent</Label>
              <Reveal on={s >= 5}>
                <Val x={400} y={398} v={n.result} size={22} weight={700} delay={0.6} />
                <Val x={400} y={420} v={n.check} size={11.5} dim delay={0.9} />
              </Reveal>
            </Faint>
            <Wire d={`M${SIGN.x + SIGN.w / 2} ${PY + PH} L${SIGN.x + SIGN.w / 2} 346`} on={s === 5} arrow={false} width={1} dim />
            <Wire d={`M${EXP.x + EXP.w / 2} ${PY + PH} L${EXP.x + EXP.w / 2} 346`} on={s === 5} arrow={false} width={1} dim delay={0.1} />
            <Wire d={`M${FRAC.x + FRAC.w / 2} ${PY + PH} L${FRAC.x + FRAC.w / 2} 346`} on={s === 5} arrow={false} width={1} dim delay={0.2} />

            {/* ===== step 6 ===== */}
            <Repeating on={why} />
            <Label x={400} y={418} size={12} anchor="middle" on={why} delay={(why) ? 1.3 : 0}>Like 1/3 = 0.333… in decimal: 1/10 never ends in binary, since 10 is not a power of 2.</Label>
          </Scene>
        )
      }}
    </VizStage>
  )
}
