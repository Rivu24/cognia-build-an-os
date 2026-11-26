/* From gates to an adder. Follows Basic Theory Of Computer Science (Logic section): NOT = negation, OR = Boolean
   addition (1 + 1 = 1), AND = multiplication, XOR = not(a)·b + a·not(b); a half adder's high bit works like AND and its
   low bit like XOR (0+0 = 00, 0+1 = 01, 1+1 = 10). The 9 layers of abstraction are the article's list.
   Worked example, checked by hand: 0101 + 0011 (5 + 3).
     bit 0: 1 + 1 + cin 0 = sum 0, carry 1
     bit 1: 0 + 1 + cin 1 = sum 0, carry 1   (full adder example: HA1 0+1 → s 1 c 0; HA2 1+1 → s 0 c 1; OR(0,1) = 1)
     bit 2: 1 + 0 + cin 1 = sum 0, carry 1
     bit 3: 0 + 0 + cin 1 = sum 1, carry 0   → 1000 = 8
   Gates are drawn as IEC square symbols (& AND, ≥1 OR, =1 XOR, 1 with an output dot for NOT) to keep square corners.
   Motion is deliberately heavy: parts sink into place on a soft, massy spring and the carry takes its time. */
import { motion, type Transition } from 'motion/react'
import type { ReactNode } from 'react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'logic-gates-adder',
  title: 'From logic gates to an adder',
  summary: 'NOT, AND, OR and XOR acting on bits, two gates combined into a half adder (1 + 1 = 10), full adders chained into a 4-bit ripple adder (0101 + 0011 = 1000), and the layers of abstraction that grow on top.',
  lessons: ['p1l2'],
  articles: ['Basic Theory Of Computer Science'],
  group: 'Basics',
  order: 10,
}

const steps: VizStep[] = [
  { caption: 'A wire is LOW or HIGH, written 0 or 1. A NOT gate flips it: 1 in, 0 out.', detail: 'A logic gate takes bits in and gives one bit out. NOT is Boolean negation: NOT 0 = 1 and NOT 1 = 0.' },
  { caption: 'AND outputs 1 only when both inputs are 1.', detail: 'AND is Boolean multiplication: 0·0 = 0, 0·1 = 0, 1·0 = 0, 1·1 = 1. Four rows list every input pair, so the table is the whole gate.' },
  { caption: 'OR outputs 1 when either input is 1, and 1 OR 1 is still 1.', detail: 'OR is Boolean addition: 0+0 = 0, 0+1 = 1, 1+0 = 1, 1+1 = 1. A single wire cannot hold a 2, so there is no "2" here.' },
  { caption: 'XOR is OR without the 1,1 case: it outputs 1 when the inputs differ.', detail: 'XOR(a, b) = NOT(a)·b + a·NOT(b), so it is built from the three gates before it. 1 XOR 1 = 0.' },
  { caption: 'XOR and AND together make a half adder: 1 + 1 gives sum 0, carry 1.', detail: 'Adding two bits needs a 2-bit answer: 0+0 = 00, 0+1 = 01, 1+1 = 10. The low bit (sum) is XOR, the high bit (carry) is AND.', ms: 4200 },
  { caption: 'A full adder also takes a carry in: two half adders and an OR.', detail: 'Here a = 0, b = 1, carry in = 1. The first half adder gives 1, the second turns 1 + 1 into sum 0, carry 1. Once built, it is one box: FA.', ms: 4400 },
  { caption: 'Four full adders in a row add 4-bit numbers: 0101 + 0011 = 1000.', detail: '5 + 3 = 8. Each carry out feeds the adder to its left, so the carry ripples from bit 0 to bit 3 before the answer settles.', ms: 4600 },
  { caption: 'Each layer is built from the one below and hides its details.', detail: 'Gates and adders are the Logic layer. A kernel works down at the Architecture layer (instructions, visible registers) that applications never touch.', ms: 4800 },
]

/* ---------- motion: heavy, settling ---------- */
const heavy: Transition = { type: 'spring', stiffness: 46, damping: 13, mass: 1.6 }
const slowFade = (delay = 0): Transition => ({ duration: 0.95, ease: [0.45, 0, 0.2, 1], delay })

/** A group that sinks into place (drops a little, settles on a soft spring) when it enters. */
function Sink({ on, children, delay = 0, dy = -16, dx = 0, off = 0 }: { on: boolean; children: ReactNode; delay?: number; dy?: number; dx?: number; off?: number }) {
  const d = on ? delay : 0
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : off, x: on ? 0 : dx, y: on ? 0 : dy }}
      transition={{ x: { ...heavy, delay: d }, y: { ...heavy, delay: d }, opacity: slowFade(d) }}>
      {children}
    </motion.g>
  )
}

/** A bit value; fades in again whenever it changes. */
function Val({ x, y, v, size = 14, anchor = 'middle', weight = 500, dim, delay = 0 }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean; delay?: number }) {
  return (
    <motion.text key={v} x={x} y={y} textAnchor={anchor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={slowFade(delay)}
      fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>
      {v}
    </motion.text>
  )
}

/** IEC square gate symbol, 48 x 48. */
function Gate({ x, y, sym, not, on }: { x: number; y: number; sym: string; not?: boolean; on?: boolean }) {
  return (
    <g>
      <Block x={x} y={y} w={48} h={48} label={sym} mono size={15} state={on ? 'on' : 'off'} />
      {not && <circle cx={x + 52} cy={y + 24} r={4} fill="var(--viz-bg)" stroke="var(--viz-fg)" strokeWidth={1.4} />}
    </g>
  )
}

/* ---------- top band: the four gates ---------- */
const TY = 24
const TW = 180
const TXS = [25, 215, 405, 595]
type Tile = { name: string; sym: string; rule: string; ins: number[]; out: number; rows: number[][]; row: number }
const TILES: Tile[] = [
  { name: 'NOT', sym: '1', rule: 'flips the bit', ins: [1], out: 0, rows: [[0, 1], [1, 0]], row: 1 },
  { name: 'AND', sym: '&', rule: '1 if both are 1', ins: [1, 1], out: 1, rows: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]], row: 3 },
  { name: 'OR', sym: '≥1', rule: '1 if either is 1', ins: [1, 1], out: 1, rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]], row: 3 },
  { name: 'XOR', sym: '=1', rule: '1 if they differ', ins: [1, 1], out: 0, rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]], row: 3 },
]
const GY = TY + 30 // gate box top (54)
/** truth-table column centres (from the tile's left edge), keyed by column count */
const COLS: Record<number, number[]> = { 2: [24, 84], 3: [22, 50, 106] }
const inY = (t: Tile, k: number) => (t.ins.length === 1 ? GY + 24 : GY + 12 + k * 24)

function GateTile({ i, s }: { i: number; s: number }) {
  const t = TILES[i]
  const x0 = TXS[i]
  const active = s === i
  // gates the half adder (XOR, AND) and full adder (OR) reuse light up again when they are borrowed
  const borrowed = (s === 4 && (i === 1 || i === 3)) || (s === 5 && i === 2)
  const op = s === 7 ? 0 : active || borrowed ? 1 : s < 4 ? (s > i ? 0.6 : 0.4) : 0.3
  const shown = s >= i // a gate's inputs and table fill in when its step arrives
  const gx = x0 + 68
  const outX = x0 + (t.ins.length === 1 ? 124 : 116)
  return (
    <motion.g initial={false} animate={{ opacity: op, y: s === 7 ? 12 : 0 }} transition={{ opacity: slowFade(), y: heavy }}>
      <Block x={x0} y={TY} w={TW} h={180} state={active ? 'on' : 'off'} />
      <Label x={x0 + 12} y={TY + 19} size={14} mono={false} weight={600}>{t.name}</Label>
      <Label x={x0 + TW - 10} y={TY + 19} size={10.5} anchor="end" dim>{t.rule}</Label>
      {t.ins.map((b, k) => (
        <g key={k}>
          <Wire from={[x0 + 30, inY(t, k)]} to={[gx, inY(t, k)]} arrow={false} width={1.4} />
          <Val x={x0 + 19} y={inY(t, k) + 5} v={shown ? String(b) : '·'} size={15} />
        </g>
      ))}
      {/* bits flowing through the active gate (drawn first, so the gate box hides them inside) */}
      {t.ins.map((_, k) => (
        <Packet key={k} on={active} points={[[x0 + 30, inY(t, k)], [gx, inY(t, k)], [gx + 24, GY + 24], [x0 + 148, GY + 24]]} duration={2.2} delay={k * 0.15} r={4} />
      ))}
      <Gate x={gx} y={GY} sym={t.sym} not={t.name === 'NOT'} on={active} />
      <Wire from={[outX, GY + 24]} to={[x0 + 148, GY + 24]} arrow={false} width={1.4} />
      <Val x={x0 + 161} y={GY + 30} v={shown ? String(t.out) : '·'} size={17} weight={700} />
      {/* truth table */}
      {/* SVG collapses runs of spaces, so every column gets its own x */}
      {(t.ins.length === 1 ? ['in', 'out'] : ['a', 'b', 'out']).map((h, c, all) => (
        <Label key={h} x={x0 + COLS[all.length][c]} y={TY + 110} size={10.5} anchor="middle" dim>{h}</Label>
      ))}
      {t.rows.map((r, k) => {
        const y = TY + 128 + k * 16
        const here = shown && k === t.row
        const cols = COLS[r.length]
        return (
          <g key={k}>
            <motion.rect x={x0 + 8} y={y - 12} width={TW - 16} height={15} fill="var(--viz-fg)" initial={false}
              animate={{ opacity: here ? (active || borrowed ? 0.16 : 0.08) : 0 }} transition={slowFade(active ? 0.35 : 0)} />
            {r.map((v, c) => (
              <Label key={c} x={x0 + cols[c]} y={y} size={11.5} anchor="middle" dim={!here} weight={here && c === r.length - 1 ? 700 : 400}>{String(v)}</Label>
            ))}
            <Label x={x0 + (cols[cols.length - 1] + cols[cols.length - 2]) / 2} y={y} size={11.5} anchor="middle" dim>→</Label>
          </g>
        )
      })}
    </motion.g>
  )
}

/* ---------- bottom band ---------- */
const BAND = 240

/* steps 0–3: the same gates as signals over time (a timing diagram). Four time slots play the table rows in order. */
const WX = 120
const SLOT = 160
const A_T = [0, 0, 1, 1]
const B_T = [0, 1, 0, 1]
const OUT_T = [[1, 1, 0, 0], [0, 0, 0, 1], [0, 1, 1, 1], [0, 1, 1, 0]]
const OUT_NAME = ['NOT a', 'a AND b', 'a OR b', 'a XOR b']
const wave = (v: number[], yh: number, yl: number) => {
  const y = (b: number) => (b ? yh : yl)
  return v.map((b, k) => `${k === 0 ? 'M' : 'L'}${WX + k * SLOT} ${y(b)} L${WX + (k + 1) * SLOT} ${y(b)}`).join(' ')
}
const ROWS = { a: [262, 290], b: [312, 340], out: [366, 396] } as const

function Signals({ s }: { s: number }) {
  const on = s <= 3
  const g = Math.min(s, 3)
  const out = OUT_T[g]
  const row = (name: string, v: number[], [yh, yl]: readonly [number, number], opts: { bold?: boolean; dim?: boolean }) => (
    <motion.g initial={false} animate={{ opacity: opts.dim ? 0.3 : 1 }} transition={slowFade()}>
      <Label x={25} y={(yh + yl) / 2 + 5} size={13} mono={false} weight={600}>{name}</Label>
      <Label x={WX - 8} y={yh + 4} size={10.5} anchor="end" dim>1</Label>
      <Label x={WX - 8} y={yl + 4} size={10.5} anchor="end" dim>0</Label>
      <line x1={WX} x2={WX + 4 * SLOT} y1={yl} y2={yl} stroke="var(--viz-faint)" strokeDasharray="2 4" />
      <motion.path d={wave(v, yh, yl)} fill="none" stroke="var(--viz-fg)" strokeWidth={opts.bold ? 2.6 : 1.6}
        initial={false} animate={{ d: wave(v, yh, yl) }} transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
        filter={opts.bold ? 'url(#viz-glow)' : undefined} />
      {v.map((b, k) => (
        <Val key={`${k}${b}`} x={WX + k * SLOT + SLOT / 2} y={(yh + yl) / 2 + 5} v={String(b)} size={12} dim={!opts.bold} delay={opts.bold ? 0.25 + k * 0.12 : 0} />
      ))}
    </motion.g>
  )
  return (
    <Sink on={on} dy={14}>
      <Label x={25} y={BAND} size={11} dim>THE SAME GATE AS SIGNALS OVER TIME · HIGH = 1, LOW = 0</Label>
      {/* the slot that matches the highlighted table row */}
      <motion.rect x={WX} y={252} width={SLOT} height={154} fill="var(--viz-fg)" initial={false}
        animate={{ x: (g === 0 ? 2 : 3) * SLOT, opacity: on ? 0.07 : 0 }} transition={{ x: heavy, opacity: slowFade() }} />
      {row('a', A_T, ROWS.a, {})}
      {row('b', B_T, ROWS.b, { dim: g === 0 })}
      {row(OUT_NAME[g], out, ROWS.out, { bold: true })}
      {/* a slow read head sweeping through time */}
      {on && (
        <motion.line x1={WX} x2={WX} y1={252} y2={406} stroke="var(--viz-fg)" strokeWidth={1} strokeDasharray="3 3"
          initial={{ x: 0, opacity: 0 }} animate={{ x: [0, 4 * SLOT], opacity: [0, 0.9, 0.9, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear', times: [0, 0.05, 0.95, 1] }} />
      )}
      <Label x={WX + 2 * SLOT} y={424} size={10.5} anchor="middle" dim>four time slots = the four rows of the table</Label>
    </Sink>
  )
}

/** Half adder: inputs at x 165, gates at x 330. XOR in 283/307 out 295; AND in 363/387 out 375. */
function HalfAdder({ s }: { s: number }) {
  const on = s === 4
  return (
    <Sink on={on} dy={14}>
      <Label x={25} y={BAND} size={11} dim>HALF ADDER · built from XOR + AND</Label>
      <Label x={118} y={288} size={13} mono={false} weight={600}>a</Label>
      <Label x={118} y={392} size={13} mono={false} weight={600}>b</Label>
      <Val x={148} y={288} v="1" size={17} weight={700} />
      <Val x={148} y={392} v="1" size={17} weight={700} />
      <Wire d="M165 283 L330 283" on={on} arrow={false} width={1.4} />
      <Wire d="M230 283 L230 363 L330 363" on={on} arrow={false} width={1.4} delay={0.15} />
      <Wire d="M165 387 L330 387" on={on} arrow={false} width={1.4} />
      <Wire d="M270 387 L270 307 L330 307" on={on} arrow={false} width={1.4} delay={0.15} />
      <circle cx={230} cy={283} r={3} fill="var(--viz-fg)" />
      <circle cx={270} cy={387} r={3} fill="var(--viz-fg)" />
      <Wire d="M378 295 L466 295" on={on} arrow={false} width={1.4} delay={0.45} />
      <Wire d="M378 375 L466 375" on={on} arrow={false} width={1.4} delay={0.45} />
      <Label x={476} y={300} size={14}>sum = 0</Label>
      <Label x={476} y={380} size={14} weight={600}>carry = 1</Label>
      <Label x={392} y={262} size={10.5} dim>XOR</Label>
      <Label x={392} y={418} size={10.5} dim>AND</Label>
      {/* the answer */}
      <Block x={612} y={262} w={160} h={142} state={on ? 'on' : 'off'} />
      <Label x={692} y={292} size={14} anchor="middle" dim>1 + 1</Label>
      <Label x={692} y={336} size={30} anchor="middle" weight={700}>= 10</Label>
      <Label x={692} y={362} size={11} anchor="middle" dim>carry 1 · sum 0</Label>
      <Label x={692} y={386} size={11} anchor="middle" dim>binary 10 = two</Label>
      <Packet on={on} points={[[165, 283], [330, 283], [354, 295], [466, 295]]} duration={2.4} r={4} />
      <Packet on={on} points={[[165, 387], [330, 387], [354, 375], [466, 375]]} duration={2.4} delay={0.2} r={4} />
    </Sink>
  )
}

/** The XOR and AND gates fly down from their tiles into the half adder. */
function BorrowedGate({ s, from, to, sym }: { s: number; from: [number, number]; to: [number, number]; sym: string }) {
  const away = s < 4
  return (
    <motion.g initial={false}
      animate={{ x: away ? from[0] - to[0] : 0, y: away ? from[1] - to[1] : 0, opacity: s === 4 ? 1 : 0 }}
      transition={{ x: heavy, y: heavy, opacity: slowFade(s === 4 ? 0.05 : 0) }}>
      <Gate x={to[0]} y={to[1]} sym={sym} on={s === 4} />
    </motion.g>
  )
}

/** Full adder for bit 1 of the example: a = 0, b = 1, cin = 1 → sum 0, carry out 1. */
function FullAdder({ s }: { s: number }) {
  const on = s === 5
  return (
    <Sink on={on} dy={14}>
      <Label x={25} y={BAND} size={11} dim>FULL ADDER · two half adders + OR</Label>
      {/* drawn first: the boxes hide it in transit. It follows the carry: carry in → second HA → OR → carry out */}
      <Packet on={on} points={[[116, 392], [290, 392], [370, 360], [410, 360], [410, 300], [440, 300], [484, 290], [528, 290]]} duration={3.4} delay={0.9} r={4} />
      <Label x={30} y={285} size={13} mono={false} weight={600}>a</Label>
      <Label x={30} y={315} size={13} mono={false} weight={600}>b</Label>
      <Label x={30} y={397} size={13} mono={false} weight={600}>carry in</Label>
      <Val x={84} y={285} v="0" size={15} weight={700} />
      <Val x={84} y={315} v="1" size={15} weight={700} />
      <Val x={104} y={397} v="1" size={15} weight={700} />
      <Wire d="M96 280 L140 280" on={on} arrow={false} width={1.4} />
      <Wire d="M96 310 L140 310" on={on} arrow={false} width={1.4} />
      <Wire d="M116 392 L290 392" on={on} arrow={false} width={1.4} />
      {/* each half adder: c (carry) out on top, s (sum) out below, so no wires cross */}
      <Block x={140} y={262} w={80} h={66} label="HA" state={on ? 'on' : 'off'} />
      <Label x={212} y={284} size={10.5} anchor="end" dim>c</Label>
      <Label x={212} y={314} size={10.5} anchor="end" dim>s</Label>
      <Label x={180} y={344} size={10.5} anchor="middle" dim>half adder</Label>
      <Wire d="M220 280 L440 280" on={on} arrow={false} width={1.4} delay={0.35} />
      <Label x={404} y={274} size={11} on={on} delay={on ? 0.6 : 0}>0</Label>
      <Wire d="M220 310 L255 310 L255 360 L290 360" on={on} arrow={false} width={1.4} delay={0.35} />
      <Label x={232} y={304} size={11} on={on} delay={on ? 0.6 : 0}>1</Label>
      <Block x={290} y={342} w={80} h={66} label="HA" state={on ? 'on' : 'off'} />
      <Label x={362} y={364} size={10.5} anchor="end" dim>c</Label>
      <Label x={362} y={396} size={10.5} anchor="end" dim>s</Label>
      <Label x={330} y={424} size={10.5} anchor="middle" dim>half adder</Label>
      <Wire d="M370 360 L410 360 L410 300 L440 300" on={on} arrow={false} width={1.4} delay={0.75} />
      <Label x={380} y={354} size={11} on={on} delay={on ? 1.0 : 0}>1</Label>
      <Block x={440} y={268} w={44} h={44} label="≥1" mono size={13} />
      <Wire d="M484 290 L528 290" on={on} arrow={false} width={1.4} delay={1.05} />
      <Wire d="M370 392 L528 392" on={on} arrow={false} width={1.4} delay={0.75} />
      <Label x={536} y={295} size={13} weight={600} on={on} delay={on ? 1.3 : 0}>carry out 1</Label>
      <Label x={536} y={397} size={13} on={on} delay={on ? 1.0 : 0}>sum 0</Label>
      {/* the same thing as one box */}
      <Label x={710} y={262} size={10.5} anchor="middle" dim>as one box</Label>
      <Block x={670} y={290} w={80} h={70} label="FA" sub="full adder" state={on ? 'on' : 'off'} />
      {[690, 730].map((x) => <Wire key={x} from={[x, 274]} to={[x, 290]} arrow={false} width={1.2} />)}
      <Label x={683} y={284} size={10.5} anchor="end" dim>a</Label>
      <Label x={737} y={284} size={10.5} dim>b</Label>
      <Wire from={[774, 340]} to={[750, 340]} arrow={false} width={1.2} />
      <Label x={776} y={332} size={10.5} anchor="end" dim>cin</Label>
      <Wire from={[670, 340]} to={[650, 340]} arrow={false} width={1.2} />
      <Label x={666} y={332} size={10.5} anchor="end" dim>cout</Label>
      <Wire from={[710, 360]} to={[710, 376]} arrow={false} width={1.2} />
      <Label x={710} y={392} size={10.5} anchor="middle" dim>sum</Label>
    </Sink>
  )
}

/* ripple adder: bit 3 on the left, bit 0 on the right */
const RX = [130, 290, 450, 610]
const RW = 100
const RY = 318
const CY = 360
const A_BITS = '0101'
const B_BITS = '0011'
const S_BITS = '1000'
const CARRY_INTO = ['1', '1', '1', '0'] // carry into bit 3, 2, 1, 0 (bit 0 gets 0)

function Ripple({ s }: { s: number }) {
  const on = s === 6
  // order of arrival: bit 0 first (index 3), bit 3 last (index 0)
  const lag = (col: number) => 0.3 + (3 - col) * 0.45
  return (
    <Sink on={on} dy={14}>
      <Label x={25} y={BAND} size={11} dim>4-BIT RIPPLE ADDER · carry flows right to left</Label>
      <Packet on={on} points={[[752, CY], [92, CY]]} duration={2.6} delay={0.3} r={4.5} />
      <Label x={40} y={281} size={13} mono={false} weight={600}>A</Label>
      <Label x={40} y={303} size={13} mono={false} weight={600}>B</Label>
      <Label x={40} y={417} size={13} mono={false} weight={600}>sum</Label>
      <Label x={712} y={281} size={12} dim>= 5</Label>
      <Label x={712} y={303} size={12} dim>= 3</Label>
      {RX.map((x, col) => {
        const cx = x + RW / 2
        return (
          <g key={col}>
            <Val x={cx} y={281} v={A_BITS[col]} size={15} />
            <Val x={cx} y={303} v={B_BITS[col]} size={15} />
            <Wire from={[cx, 308]} to={[cx, RY]} arrow={false} width={1.2} />
            <Block x={x} y={RY} w={RW} h={54} label="FA" size={13} state={on && col === 3 ? 'on' : 'off'} />
            <Wire from={[cx, RY + 54]} to={[cx, 396]} on={on} arrow={false} width={1.2} delay={lag(col) + 0.1} />
            <motion.g initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : -8 }}
              transition={{ opacity: slowFade(on ? lag(col) + 0.15 : 0), y: { ...heavy, delay: on ? lag(col) + 0.15 : 0 } }}>
              <text x={cx} y={418} textAnchor="middle" fill="var(--viz-fg)" style={{ fontSize: 19, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{S_BITS[col]}</text>
            </motion.g>
            <Label x={cx} y={436} size={10.5} anchor="middle" dim>{`bit ${3 - col}`}</Label>
            {/* carry into this column from its right */}
            <Wire from={[col === 3 ? 752 : RX[col + 1], CY]} to={[x + RW, CY]} on={on} width={1.4} delay={lag(col)} />
            <Label x={col === 3 ? 734 : x + RW + 30} y={CY - 7} size={11} anchor="middle" weight={600} on={on} delay={on ? lag(col) : 0}>{CARRY_INTO[col]}</Label>
          </g>
        )
      })}
      <Wire from={[RX[0], CY]} to={[92, CY]} on={on} width={1.4} delay={lag(-1)} />
      <Label x={110} y={CY - 7} size={11} anchor="middle" on={on} delay={on ? lag(-1) : 0}>0</Label>
      <Label x={712} y={417} size={12} on={on} delay={on ? lag(-1) + 0.3 : 0}>= 8</Label>
    </Sink>
  )
}

/* ---------- layers of abstraction ---------- */
const LAYERS: [string, string][] = [
  ['Application Software', 'programs using OS features'],
  ['Operating System', 'drives hardware, gives an API'],
  ['Architecture (ISA)', 'instructions, visible registers'],
  ['Microarchitecture', 'builds the ISA out of logic'],
  ['Logic', 'gates → adders, multiplexers'],
  ['Digital Circuits', 'LOW / HIGH become 0 / 1'],
  ['Analog Circuits', 'circuits built from devices'],
  ['Devices', 'transistors, diodes'],
  ['Physics', 'the laws devices obey'],
]
const LX = 232
const LW = 316
const LY0 = 28
const LH = 40
const NOTES: Record<number, string> = { 0: '← sees only the OS API', 1: '← your kernel lives here', 2: '← kernels use it directly', 4: '← what you just built' }

function Layers({ s }: { s: number }) {
  const on = s === 7
  return (
    <g>
      {LAYERS.map(([name, sub], i) => {
        const lit = i === 1 || i === 2 || i === 4
        return (
          <Sink key={i} on={on} delay={0.2 + (LAYERS.length - 1 - i) * 0.1} dy={-22}>
            <Block x={LX} y={LY0 + i * LH} w={LW} h={LH} label={name} sub={sub} align="start" size={13} state={lit ? 'on' : i === 0 || i === 5 ? 'off' : 'dim'} />
          </Sink>
        )
      })}
      {Object.entries(NOTES).map(([k, t]) => (
        <Label key={k} x={LX + LW + 14} y={LY0 + +k * LH + 24} size={11} on={on} delay={on ? 0.9 + +k * 0.12 : 0} dim={+k === 0}>{t}</Label>
      ))}
      {/* who reaches how far down */}
      <Sink on={on} delay={1.1} dx={-10} dy={0}>
        <path d={`M${LX - 12} ${LY0 + 4} L${LX - 18} ${LY0 + 4} L${LX - 18} ${LY0 + LH - 4} L${LX - 12} ${LY0 + LH - 4}`} fill="none" stroke="var(--viz-dim)" strokeWidth={1.2} />
        <Label x={LX - 26} y={LY0 + 18} size={11} anchor="end" mono={false} dim>application</Label>
        <Label x={LX - 26} y={LY0 + 32} size={11} anchor="end" mono={false} dim>developer</Label>
        <path d={`M${LX - 12} ${LY0 + LH + 4} L${LX - 18} ${LY0 + LH + 4} L${LX - 18} ${LY0 + 3 * LH - 4} L${LX - 12} ${LY0 + 3 * LH - 4}`} fill="none" stroke="var(--viz-fg)" strokeWidth={1.6} />
        <Label x={LX - 26} y={LY0 + 2 * LH - 6} size={12} anchor="end" mono={false} weight={600}>OS developer</Label>
        <Label x={LX - 26} y={LY0 + 2 * LH + 10} size={11} anchor="end" mono={false} dim>reaches down</Label>
        <Label x={LX - 26} y={LY0 + 2 * LH + 24} size={11} anchor="end" mono={false} dim>to the ISA</Label>
      </Sink>
      <Label x={LX + LW / 2} y={LY0 + 9 * LH + 26} size={11} anchor="middle" on={on} delay={on ? 1.4 : 0} dim>each layer uses the one below and hides how it works</Label>
      <Pulse x={LX + LW - 22} y={LY0 + 4 * LH + 20} on={on} r={10} />
    </g>
  )
}

export default function LogicGatesAdder() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => (
        <Scene label={meta.summary}>
          {TILES.map((_, i) => <GateTile key={i} i={i} s={s} />)}
          <Signals s={s} />
          <HalfAdder s={s} />
          <BorrowedGate s={s} sym="=1" from={[TXS[3] + 68, GY]} to={[330, 271]} />
          <BorrowedGate s={s} sym="&" from={[TXS[1] + 68, GY]} to={[330, 351]} />
          <FullAdder s={s} />
          <Ripple s={s} />
          <Layers s={s} />
        </Scene>
      )}
    </VizStage>
  )
}
