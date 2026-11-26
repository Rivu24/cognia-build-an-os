/* VGA text mode buffer at 0xB8000 (Printing To Screen, Text UI, Bare Bones, Text Mode Cursor).
   80 x 25 cells, 2 bytes each: byte 0 = ASCII code, byte 1 = attribute (fg = low 4 bits, bg = high 4 bits).
   Bare Bones fills the screen with ' ' (0x20) and colour 0x07 (light grey on black) first.
   Worked values: (3,1) -> index 83 -> 0xB8000 + 166 = 0xB80A6; (0,1) -> index 80 -> 0xB80A0;
   cursor after "Hi\nOK" at (2,1) -> pos 82 = 0x0052 -> outb(0x3D4,0x0F) outb(0x3D5,0x52) outb(0x3D4,0x0E) outb(0x3D5,0x00). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'vga-text-buffer',
  title: 'VGA text mode: the buffer at 0xB8000',
  summary: 'How 80 × 25 screen cells map to 2-byte entries at 0xB8000, how the attribute byte sets colours, how index = y × 80 + x places text, and how the cursor and scrolling work.',
  lessons: ['t3m1l4', 't3m1l2'],
  articles: ['Printing To Screen', 'Text UI', 'Bare Bones', 'Text Mode Cursor'],
  group: 'Devices',
  order: 314,
}

const steps: VizStep[] = [
  { caption: 'In text mode the screen is 80 × 25 cells, and they live in memory at 0xB8000.', detail: 'No driver needed: write to that memory and the VGA card shows it. 80 × 25 × 2 = 4000 bytes per screen.' },
  { caption: 'Each cell is 2 bytes: the character, then its colour attribute.', detail: 'Bare Bones starts by filling every cell with a space (0x20) and colour 0x07. As a uint16_t: char | attr << 8 = 0x0720.' },
  { caption: 'Attribute 0x07: low 4 bits = foreground 7 (light grey), high 4 = background 0 (black).', detail: 'vga_entry_color(fg, bg) = fg | bg << 4. 0x1F is white on blue. Bit 7 can mean bright background or blinking.' },
  { caption: 'Write "Hi": bytes 0x48 0x07 0x69 0x07 at 0xB8000, and the letters appear.', detail: "'H' = 0x48 and 'i' = 0x69 in ASCII. The next free cell is (2, 0)." },
  { caption: 'Cell (x, y) is entry y × 80 + x. Its address is 0xB8000 + 2 × that index.', detail: '(3, 1): index = 1 × 80 + 3 = 83, byte offset 166 = 0xA6, so the cell is at 0xB80A6.', ms: 3800 },
  { caption: 'Newline is not a character the card knows. You set x = 0 and y = y + 1 yourself.', detail: 'Write 0x0A into the buffer and the card just draws a font symbol. Handle it in code, then "OK" lands at index 80, address 0xB80A0.' },
  { caption: 'The blinking cursor is separate: send its position to ports 0x3D4 / 0x3D5.', detail: 'pos = 1 × 80 + 2 = 82 = 0x0052. Index 0x0F selects the low byte, 0x0E the high byte.', ms: 3800 },
  { caption: 'Screen full? Scroll: copy rows 1–24 up one row, then clear row 24.', detail: '24 rows × 160 bytes move up; the last row is filled with 0x20, 0x07. Without this, Bare Bones wraps to row 0.', ms: 4200 },
]

/* ---------- memory panel ---------- */
type Row = { addr: string; kind: string; v0: string; v?: string; ch0?: string; ch?: string; at?: number }
const MEM: (Row | null)[] = [
  { addr: '0xB8000', kind: 'char (0,0)', v0: '20', v: '48', ch0: "' '", ch: "'H'", at: 3 },
  { addr: '0xB8001', kind: 'attr (0,0)', v0: '07' },
  { addr: '0xB8002', kind: 'char (1,0)', v0: '20', v: '69', ch0: "' '", ch: "'i'", at: 3 },
  { addr: '0xB8003', kind: 'attr (1,0)', v0: '07' },
  null,
  { addr: '0xB80A0', kind: 'char (0,1)', v0: '20', v: '4F', ch0: "' '", ch: "'O'", at: 5 },
  { addr: '0xB80A1', kind: 'attr (0,1)', v0: '07' },
  { addr: '0xB80A2', kind: 'char (1,1)', v0: '20', v: '4B', ch0: "' '", ch: "'K'", at: 5 },
  { addr: '0xB80A3', kind: 'attr (1,1)', v0: '07' },
]
const MX = 20
const MW = 250
const MY = 44
const MH = 24
const memC = (i: number) => MY + i * MH + MH / 2

/* ---------- zoomed screen ---------- */
const ZX = 330
const ZY = 52
const ZW = 36
const ZH = 40
const cellC = (x: number, y: number): [number, number] => [ZX + x * ZW + ZW / 2, ZY + y * ZH + ZH / 2]
const TEXT: [number, number, string, number][] = [
  [0, 0, 'H', 3], [1, 0, 'i', 3], [0, 1, 'O', 5], [1, 1, 'K', 5],
]

/* ---------- thumbnail of the whole screen ---------- */
const TX = 330
const TY = 232
const CW = 3
const CHh = 7
const FILL = Array.from({ length: 25 }, (_, r) => (r === 0 ? 2 : r === 1 ? 2 : 10 + ((r * 37) % 62)))

function Val({ x, y, v, size = 12, anchor = 'start', dim, weight = 400 }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; dim?: boolean; weight?: number }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>{v}</text>
    </motion.g>
  )
}

export default function VgaTextBuffer() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const formula = s === 4 ? { xy: '(3, 1)', idx: '1*80 + 3 = 83', off: '0xB8000 + 2*83', addr: '= 0xB80A6' }
          : { xy: '(0, 1)', idx: '1*80 + 0 = 80', off: '0xB8000 + 2*80', addr: '= 0xB80A0' }
        const cell0 = s >= 3 ? ['0x48', "'H'", '0x0748'] : ['0x20', "' '", '0x0720']
        const next: [number, number] = s >= 5 ? [2, 1] : [2, 0]
        return (
          <Scene label={meta.summary}>
            {/* ---------- memory ---------- */}
            <Label x={MX} y={32} size={11} dim>MEMORY FROM 0xB8000</Label>
            {MEM.map((r, i) => {
              const y = MY + i * MH
              if (!r) return <Label key={i} x={MX + MW / 2} y={y + 16} size={11} anchor="middle" dim>… 156 more bytes (rest of row 0) …</Label>
              const written = r.at !== undefined && s >= r.at
              const isAttr = r.kind.startsWith('attr')
              const hot = (s === 1 && i <= 1) || (s === 2 && isAttr && i <= 3) || (written && s === r.at) || (s === 5 && i >= 5 && isAttr)
              const st = hot ? 'on' : s >= 1 && !written && !(s === 1 && i <= 1) && !(s === 2 && isAttr) ? 'dim' : 'off'
              return (
                <g key={i}>
                  <Block x={MX} y={y} w={MW} h={MH} state={st} />
                  <Label x={MX + 8} y={y + 16} size={11} dim>{r.addr}</Label>
                  <Val x={MX + 80} y={y + 16} v={`0x${written && r.v ? r.v : r.v0}`} size={12} weight={500} />
                  {r.ch0 && <Val x={MX + 120} y={y + 16} v={written ? r.ch! : r.ch0} size={12} />}
                  <Label x={MX + 160} y={y + 16} size={10.5} dim>{r.kind}</Label>
                </g>
              )
            })}
            <Wire d={`M${MX + MW} 150 C 300 150, 300 300, ${TX - 4} 300`} on={s === 0} dashed />

            {/* ---------- attribute byte ---------- */}
            <Appear on={s >= 1}>
              <Label x={MX} y={284} size={11} dim>ATTRIBUTE BYTE = 0x07</Label>
              <BitField x={36} y={302} cellW={26} h={28} bits="00000111" fields={s >= 2 ? [[0, 4, 'bg 0 black'], [4, 4, 'fg 7 light grey']] : []} active={s === 2 ? 1 : undefined} />
              <Label x={MX} y={384} size={10.5} dim on={s >= 2}>0x07 light grey on black (default)</Label>
              <Label x={MX} y={400} size={10.5} dim on={s >= 2}>0x1F white on blue · 0x00 invisible</Label>
            </Appear>

            {/* ---------- zoomed screen ---------- */}
            <Label x={ZX} y={32} size={11} dim>SCREEN, TOP-LEFT CORNER (ZOOMED)</Label>
            {Array.from({ length: 10 }, (_, x) => (
              <Label key={x} x={ZX + x * ZW + ZW / 2} y={ZY - 6} size={10.5} anchor="middle" dim>{x}</Label>
            ))}
            <Label x={ZX + 10 * ZW + 6} y={ZY + 24} size={10.5} dim>… x=79</Label>
            {[0, 1, 2].map((y) => (
              <Label key={y} x={ZX - 6} y={ZY + y * ZH + 24} size={10.5} anchor="end" dim>y={y}</Label>
            ))}
            <motion.g initial={false} animate={{ opacity: s === 7 ? 0.35 : 1 }} transition={ease}>
              {Array.from({ length: 30 }, (_, k) => {
                const x = k % 10
                const y = Math.floor(k / 10)
                const hot = (s === 1 && x === 0 && y === 0) || (s === 4 && x === 3 && y === 1)
                return <Block key={k} x={ZX + x * ZW} y={ZY + y * ZH} w={ZW} h={ZH} state={hot ? 'on' : 'off'} />
              })}
              {TEXT.map(([x, y, ch, at]) => {
                const [cx, cy] = cellC(x, y)
                // step 8 scrolls with the thumbnail: every row moves up one, row 0 ("Hi") falls off the top
                const scroll = s === 7
                const scrollT = { duration: 0.9, delay: scroll ? 0.8 : 0, ease: [0.2, 0.75, 0.2, 1] as [number, number, number, number] }
                return (
                  <motion.g key={ch} initial={false} animate={{ y: scroll ? -ZH : 0 }} transition={scrollT}>
                    <motion.text x={cx} y={cy + 8} textAnchor="middle" initial={false}
                      animate={{ opacity: s >= at && !(scroll && y === 0) ? 1 : 0, scale: s >= at ? 1 : 0.4 }}
                      transition={scroll ? scrollT : { ...ease, delay: (x * 0.35) + 0.5 }}
                      style={{ fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 600, transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' }} fill="var(--viz-fg)">{ch}</motion.text>
                  </motion.g>
                )
              })}
              {/* next write position (software) */}
              <motion.rect initial={false}
                animate={s === 5
                  ? { x: [ZX + 2 * ZW + 4, ZX + 4, ZX + 4, ZX + 2 * ZW + 4], y: [ZY + 4, ZY + 4, ZY + ZH + 4, ZY + ZH + 4], opacity: 1 }
                  : { x: ZX + next[0] * ZW + 4, y: ZY + next[1] * ZH + 4, opacity: s >= 3 && s <= 5 ? 1 : 0 }}
                transition={s === 5 ? { duration: 2.2, times: [0, 0.3, 0.5, 1], ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.8 } : { type: 'spring', stiffness: 140, damping: 18 }}
                width={ZW - 8} height={ZH - 8} fill="none" stroke="var(--viz-fg)" strokeDasharray="3 3" />
              {/* hardware cursor */}
              {s === 6 && (
                <motion.rect x={ZX + 2 * ZW + 6} y={ZY + ZH + ZH - 9} width={ZW - 12} height={4} fill="var(--viz-fg)"
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 1, repeat: Infinity, times: [0, 0.1, 0.6, 0.7] }} />
              )}
            </motion.g>
            <Pulse x={cellC(3, 1)[0]} y={cellC(3, 1)[1]} on={s === 4} r={16} />
            <Label x={ZX} y={ZY + 3 * ZH + 20} size={11} on={s === 5}>'\n' → x = 0, y = y + 1 (dashed box = next write)</Label>

            {/* data moving into cells */}
            <Packet on={s === 3} points={[[MX + MW, memC(0)], [cellC(0, 0)[0], ZY + 0 * ZH + 6]]} duration={1} label="H" />
            <Packet on={s === 3} points={[[MX + MW, memC(2)], [cellC(1, 0)[0], ZY + 0 * ZH + 6]]} duration={1} delay={0.35} label="i" />
            <Packet on={s === 5} points={[[MX + MW, memC(5)], [cellC(0, 1)[0], ZY + 1 * ZH + 6]]} duration={1} delay={0.6} label="O" />
            <Packet on={s === 5} points={[[MX + MW, memC(7)], [cellC(1, 1)[0], ZY + 1 * ZH + 6]]} duration={1} delay={0.95} label="K" />

            {/* ---------- whole screen thumbnail ---------- */}
            <Label x={TX} y={TY - 10} size={11} dim>WHOLE SCREEN · 80 × 25 CELLS</Label>
            <defs>
              <clipPath id="vga-thumb-clip"><rect x={TX} y={TY} width={80 * CW} height={25 * CHh} /></clipPath>
            </defs>
            <rect x={TX} y={TY} width={80 * CW} height={25 * CHh} fill="var(--viz-bg)" stroke="var(--viz-fg)" />
            <g clipPath="url(#vga-thumb-clip)">
              <motion.g initial={false} animate={{ y: s === 7 ? -CHh : 0 }} transition={{ duration: 0.9, delay: s === 7 ? 0.8 : 0, ease: [0.2, 0.75, 0.2, 1] }}>
                {FILL.map((w, r) => {
                  const shown = r === 0 ? s >= 3 : r === 1 ? s >= 5 : s === 7
                  return (
                    <motion.rect key={r} x={TX + 2} y={TY + r * CHh + 1.5} width={w * CW} height={CHh - 3} fill="var(--viz-fg)"
                      initial={false} animate={{ opacity: shown ? (r === 0 && s === 7 ? 0.5 : 0.85) : 0 }} transition={ease} />
                  )
                })}
              </motion.g>
            </g>
            <motion.rect x={TX} y={TY} width={10 * CW} height={3 * CHh} fill="none" stroke="var(--viz-fg)" strokeWidth={1.5}
              initial={false} animate={{ opacity: s < 7 ? 1 : 0 }} filter="url(#viz-glow)" />
            <Label x={TX + 10 * CW + 6} y={TY + 14} size={10.5} dim on={s < 7}>← zoomed part</Label>
            <Pulse x={TX + 120} y={TY + 88} r={30} on={s === 0} />
            <Appear on={s === 7} delay={1.2}>
              <rect x={TX + 1} y={TY + 24 * CHh} width={80 * CW - 2} height={CHh} fill="none" stroke="var(--viz-fg)" strokeDasharray="3 2" />
            </Appear>
            <Label x={TX} y={TY + 25 * CHh + 16} size={10.5} on={s === 7} delay={1.2}>row 24 cleared to 0x20, 0x07</Label>

            {/* ---------- right panel: one cell ---------- */}
            <Appear on={s >= 1 && s <= 3}>
              <Label x={588} y={222} size={11} dim>CELL (0,0) = 2 BYTES</Label>
              <Block x={588} y={232} w={92} h={44} label={cell0[0]} sub={`char ${cell0[1]}`} mono size={13} state={s === 3 ? 'on' : 'off'} />
              <Block x={684} y={232} w={92} h={44} label="0x07" sub="attr" mono size={13} state={s === 2 ? 'on' : 'off'} />
              <Label x={588} y={292} size={10.5} dim>0xB8000 = char, 0xB8001 = attr</Label>
              <Val x={588} y={312} v={`as uint16_t: ${cell0[2]}`} size={12} />
            </Appear>

            {/* ---------- right panel: index formula ---------- */}
            <Appear on={s === 4 || s === 5}>
              <Label x={588} y={222} size={11} dim>WHERE IS CELL (x, y)?</Label>
              <Block x={588} y={232} w={192} h={108} state="on" />
              <Val x={600} y={254} v={`(x, y) = ${formula.xy}`} size={12} />
              <Val x={600} y={276} v={`index = ${formula.idx}`} size={12} />
              <Val x={600} y={300} v={formula.off} size={12} />
              <Val x={600} y={324} v={formula.addr} size={14} weight={600} />
            </Appear>

            {/* ---------- right panel: cursor ports ---------- */}
            <Appear on={s === 6}>
              <Label x={588} y={222} size={11} dim>MOVE THE CURSOR TO (2, 1)</Label>
              <Label x={588} y={244} size={12} weight={500}>pos = 1*80 + 2 = 0x52</Label>
              {[['0x3D4', '0x0F', 'select low byte'], ['0x3D5', '0x52', 'low byte of pos'], ['0x3D4', '0x0E', 'select high byte'], ['0x3D5', '0x00', 'high byte of pos']].map(([p, v, c], i) => (
                <g key={i}>
                  <Label x={588} y={270 + i * 34} size={12} delay={0.3 + i * 0.35}>outb({p}, {v})</Label>
                  <Label x={588} y={284 + i * 34} size={10.5} dim delay={0.3 + i * 0.35}>{c}</Label>
                </g>
              ))}
            </Appear>
            <Packet on={s === 6} points={[[772, 300], [772, 182], [cellC(2, 1)[0], 182], [cellC(2, 1)[0], ZY + 2 * ZH - 2]]} duration={1.6} delay={1.6} r={4} />

            {/* ---------- right panel: scrolling ---------- */}
            <Appear on={s === 7}>
              <Label x={588} y={222} size={11} dim>SCROLL ONE LINE</Label>
              <Label x={588} y={248} size={12}>copy rows 1–24</Label>
              <Label x={588} y={266} size={12}>→ rows 0–23</Label>
              <Label x={588} y={284} size={10.5} dim>(24 × 160 = 3840 bytes)</Label>
              <Label x={588} y={316} size={12}>fill row 24 with</Label>
              <Label x={588} y={334} size={12}>0x20, 0x07</Label>
              <Label x={588} y={366} size={10.5} dim>then y = 24, x = 0</Label>
            </Appear>
            <Wire from={[TX + 80 * CW + 8, TY + 150]} to={[TX + 80 * CW + 8, TY + 40]} on={s === 7} delay={0.6} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
