/* One instruction, two spellings (Which assembler should I use?(x86), NASM, GAS).
   GAS article: AT&T operand order is source then destination; registers take a % prefix, constants a $ prefix.
   Encoding checked by hand (Intel SDM, 32-bit mode):
     mov eax, [ebx+4]  = movl 4(%ebx), %eax  ->  8B 43 04
       8B /r = MOV r32, r/m32.  ModRM 0x43 = 01 000 011: mod 01 (8-bit displacement follows), reg 000 = eax, rm 011 = ebx.
       disp8 04 = +4.
     mov eax, 5        = movl $5, %eax       ->  B8 05 00 00 00   (B8+r, r = 0 for eax; imm32 5 stored little-endian)
     movl 5, %eax (no $) is a load from address 5: A1 05 00 00 00 (MOV EAX, moffs32).
   Motion is deliberately slow and weighted: tokens slide on a heavy spring, bytes drop into place one by one. */
import { motion, type Transition } from 'motion/react'
import type { ReactNode } from 'react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'intel-vs-att-encoding',
  title: 'Intel versus AT&T syntax',
  summary: 'The same instruction written for NASM (Intel) and GAS (AT&T): reversed operands, % and $ prefixes, disp(base) and size suffixes, and the identical machine bytes 8B 43 04 both produce.',
  lessons: ['p4l3'],
  articles: ['Which assembler should I use?(x86)', 'NASM', 'GAS'],
  group: 'Basics',
  order: 60,
}

const steps: VizStep[] = [
  { caption: 'NASM uses Intel syntax: mov eax, [ebx+4]. Destination first.', detail: 'Read it as “eax = the 4 bytes at address ebx + 4”. The square brackets mean “the memory at this address”.', ms: 4600 },
  { caption: 'GAS uses AT&T syntax. First change: the source comes first, the destination last.', detail: 'The GAS article: “source and then destination”. Read an AT&T line with Intel habits and every copy runs backwards.', ms: 5000 },
  { caption: 'Every register name gets a % in front: eax becomes %eax.', detail: 'AT&T is unambiguous on purpose: % always means a register, $ always means a constant.', ms: 4400 },
  { caption: 'Memory is written disp(base): [ebx+4] becomes 4(%ebx).', detail: 'The number in front of the parentheses is added to the register inside them. Both mean the address ebx + 4.', ms: 4600 },
  { caption: 'A suffix names the size: movl moves a long, 32 bits.', detail: 'b = 8, w = 16, l = 32, q = 64 bits. GAS can often infer the size from %eax, but the suffix makes it explicit.', ms: 4400 },
  { caption: 'Both lines assemble to the same three bytes: 8B 43 04.', detail: 'The CPU never sees syntax, only bytes. objdump -d of the NASM object and of the GAS object prints the same 8B 43 04.', ms: 5000 },
  { caption: 'The bytes, decoded: opcode 8B, ModRM 0x43, displacement 04.', detail: 'ModRM 0x43 is 01 000 011 in binary: mod 01 = an 8-bit displacement follows, reg 000 = eax, rm 011 = ebx.', ms: 5600 },
  { caption: 'Constants get $: mov eax, 5 is movl $5, %eax, bytes B8 05 00 00 00.', detail: 'B8 + 0 selects eax and 5 follows as 4 little-endian bytes. Forget the $ and movl 5, %eax loads from address 5 instead.', ms: 6000 },
]

/* a heavy, slightly overdamped spring: things arrive with weight and settle, they do not snap */
const heavy: Transition = { type: 'spring', stiffness: 62, damping: 16, mass: 1.35 }
const slow: Transition = { duration: 1.1, ease: [0.16, 1, 0.3, 1] }

const CW = 14.4 // JetBrains Mono advance at 24px (0.6 em)
const FS = 24
const X0 = 190
const Y_INTEL = 80
const Y_ATT = 182
const colX = (c: number) => X0 + c * CW

/** One token of code that slides to a new column and fades its text when the spelling changes. */
function Tok({ col, y, text, on = true, hl, dim, delay = 0 }: { col: number; y: number; text: string; on?: boolean; hl?: boolean; dim?: boolean; delay?: number }) {
  return (
    <motion.g initial={false} animate={{ x: colX(col), opacity: on ? (dim ? 0.35 : 1) : 0 }} transition={{ x: { ...heavy, delay }, opacity: { ...slow, delay } }}>
      <motion.text key={text} x={0} y={y} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={slow}
        fill="var(--viz-fg)" style={{ fontSize: FS, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
        {text}
      </motion.text>
      <motion.rect x={0} y={y + 8} height={2} fill="var(--viz-fg)" initial={false}
        animate={{ width: hl ? text.length * CW : 0, opacity: hl ? 1 : 0 }} transition={{ ...slow, delay: delay + 0.15 }} />
    </motion.g>
  )
}

/** A whole group that drops into place from above on the heavy spring. */
function Drop({ on, children, delay = 0, dy = -16 }: { on: boolean; children: ReactNode; delay?: number; dy?: number }) {
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : dy }} transition={{ y: { ...heavy, delay: on ? delay : 0 }, opacity: { ...slow, delay: on ? delay : 0, duration: on ? 1.1 : 0.5 } }}>
      {children}
    </motion.g>
  )
}

/* ---- the AT&T line, column by column, for each step ---- */
type AttLayout = { mov: number; l: boolean; mem: [string, number]; comma: number; pct: number | null; eax: number }
const ATT: AttLayout[] = [
  { mov: 0, l: false, mem: ['[ebx+4]', 9], comma: 7, pct: null, eax: 4 }, // 0: still a copy of the Intel line
  { mov: 0, l: false, mem: ['[ebx+4]', 4], comma: 11, pct: null, eax: 13 }, // 1: operands swapped
  { mov: 0, l: false, mem: ['[%ebx+4]', 4], comma: 12, pct: 14, eax: 15 }, // 2: % prefixes
  { mov: 0, l: false, mem: ['4(%ebx)', 4], comma: 11, pct: 13, eax: 14 }, // 3: disp(base)
  { mov: 0, l: true, mem: ['4(%ebx)', 5], comma: 12, pct: 14, eax: 15 }, // 4: size suffix
  { mov: 0, l: true, mem: ['4(%ebx)', 5], comma: 12, pct: 14, eax: 15 },
  { mov: 0, l: true, mem: ['4(%ebx)', 5], comma: 12, pct: 14, eax: 15 },
  { mov: 0, l: true, mem: ['$5', 5], comma: 7, pct: 9, eax: 10 }, // 7: immediate
]

const RULES = [
  'source first, destination last',
  '% before every register',
  'memory as disp(base)',
  'size suffix: b w l q',
  '$ before every constant',
]
// which rule a step introduces
const RULE_AT = [-1, 0, 1, 2, 3, -1, -1, 4]

const BX = 190, BW = 60, BG = 66, BY = 246, BH = 48
const byteX = (i: number) => BX + i * BG

export default function IntelVsAttEncoding() {
  return (
    <VizStage meta={meta} steps={steps} interval={4600}>
      {(s) => {
        const a = ATT[s]
        const imm = s === 7
        const bytes = imm ? ['B8', '05', '00', '00', '00'] : ['8B', '43', '04']
        return (
          <Scene label={meta.summary}>
            {/* ===== Intel row ===== */}
            <Label x={24} y={Y_INTEL - 22} size={11} dim>INTEL SYNTAX</Label>
            <Label x={24} y={Y_INTEL - 2} size={13} weight={600} mono={false}>NASM</Label>
            <Tok col={0} y={Y_INTEL} text="mov" />
            <Tok col={4} y={Y_INTEL} text="eax" hl={s === 0} />
            <Tok col={7} y={Y_INTEL} text="," />
            <Tok col={9} y={Y_INTEL} text={imm ? '5' : '[ebx+4]'} hl={s === 0 || imm} />
            <Label x={colX(5.5)} y={Y_INTEL + 30} size={11} anchor="middle" dim on={s <= 1}>destination</Label>
            <Label x={colX(12.5)} y={Y_INTEL + 30} size={11} anchor="middle" dim on={s <= 1}>source</Label>

            {/* ===== AT&T row: starts as a faint copy, then is rewritten rule by rule ===== */}
            <Label x={24} y={Y_ATT - 22} size={11} dim>AT&amp;T SYNTAX</Label>
            <Label x={24} y={Y_ATT - 2} size={13} weight={600} mono={false}>GAS</Label>
            <Tok col={a.mov} y={Y_ATT} text="mov" dim={s === 0} />
            <Tok col={3} y={Y_ATT} text="l" on={a.l} hl={s === 4} />
            <Tok col={a.mem[1]} y={Y_ATT} text={a.mem[0]} dim={s === 0} hl={s === 1 || s === 2 || s === 3 || imm} />
            <Tok col={a.comma} y={Y_ATT} text="," dim={s === 0} />
            <Tok col={a.pct ?? a.eax} y={Y_ATT} text="%" on={a.pct !== null} hl={s === 2} />
            <Tok col={a.eax} y={Y_ATT} text="eax" dim={s === 0} hl={s === 1} delay={0.12} />
            <Label x={colX(a.mem[1] + a.mem[0].length / 2)} y={Y_ATT + 30} size={11} anchor="middle" dim on={s >= 1 && s <= 4}>source</Label>
            <Label x={colX(a.eax + 1.5)} y={Y_ATT + 30} size={11} anchor="middle" dim on={s >= 1 && s <= 4}>destination</Label>
            {/* the swap itself: the two operands trade places along these arcs */}
            <Wire d={`M${colX(5.5)} ${Y_ATT - 30} C ${colX(6)} ${Y_ATT - 62}, ${colX(13)} ${Y_ATT - 62}, ${colX(14.2)} ${Y_ATT - 30}`} on={s === 1} dashed width={1.2} />
            <Wire d={`M${colX(12.5)} ${Y_ATT + 40} C ${colX(11)} ${Y_ATT + 58}, ${colX(8)} ${Y_ATT + 58}, ${colX(7.4)} ${Y_ATT + 40}`} on={s === 1} dashed width={1.2} delay={0.2} />

            {/* ===== the rules, collected one per step ===== */}
            <Label x={500} y={44} size={11} dim>AT&amp;T RULES</Label>
            {RULES.map((r, i) => {
              const learned = RULE_AT.slice(0, s + 1).includes(i)
              return (
                <Drop key={i} on={learned} delay={0.1}>
                  <Block x={500} y={54 + i * 34} w={276} h={28} align="start" size={12.5}
                    label={`${i + 1}.  ${r}`} state={RULE_AT[s] === i ? 'on' : s === 5 || s === 6 ? 'dim' : 'off'} />
                </Drop>
              )
            })}

            {/* ===== machine code ===== */}
            <Label x={24} y={BY + 20} size={11} dim>MACHINE CODE</Label>
            <Label x={24} y={BY + 38} size={11} dim on={s >= 5}>{imm ? '5 bytes' : '3 bytes'}</Label>
            {/* both source lines feed the same assembler output */}
            <Wire d={`M${X0 - 8} ${Y_INTEL - 8} H172 V${BY + BH / 2} H${BX - 6}`} on={s >= 5} />
            <Wire d={`M${X0 - 8} ${Y_ATT - 8} H172`} on={s >= 5} arrow={false} delay={0.25} />
            <Packet on={s === 5} points={[[X0 - 8, Y_INTEL - 8], [172, Y_INTEL - 8], [172, BY + BH / 2], [BX - 6, BY + BH / 2]]} duration={2.4} label="nasm" />
            <Packet on={s === 5} points={[[X0 - 8, Y_ATT - 8], [172, Y_ATT - 8], [172, BY + BH / 2], [BX - 6, BY + BH / 2]]} duration={2.0} delay={0.5} label="as" />
            {/* empty slots wait faintly from the start; the bytes drop in, one by one, when the assembler runs */}
            {[0, 1, 2, 3, 4].map((i) => (
              <Appear key={`slot${i}`} on={s < 5 && i < 3} dy={0}>
                <Block x={byteX(i)} y={BY} w={BW} h={BH} state="dim" />
                <Label x={byteX(i) + BW / 2} y={BY + 31} size={18} anchor="middle" dim>??</Label>
              </Appear>
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <Drop key={i} on={s >= 5 && i < bytes.length} delay={0.35 + i * 0.14} dy={-22}>
                <Block x={byteX(i)} y={BY} w={BW} h={BH} state={s === 5 || imm || (s === 6 && i === 1) ? 'on' : 'off'} />
                <motion.text key={bytes[i] ?? 'x'} x={byteX(i) + BW / 2} y={BY + 32} textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={slow}
                  fill="var(--viz-fg)" style={{ fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {bytes[i] ?? ''}
                </motion.text>
              </Drop>
            ))}
            {/* role of each byte */}
            <Appear on={s === 6}>
              {['opcode', 'ModRM', 'disp8'].map((t, i) => (
                <Label key={t} x={byteX(i) + BW / 2} y={BY + BH + 20} size={11} anchor="middle" dim={i !== 1}>{t}</Label>
              ))}
            </Appear>
            <Appear on={imm}>
              <Label x={byteX(0) + BW / 2} y={BY + BH + 20} size={11} anchor="middle">B8 + 0</Label>
              <line x1={byteX(1)} x2={byteX(4) + BW} y1={BY + BH + 10} y2={BY + BH + 10} stroke="var(--viz-dim)" />
              <Label x={(byteX(1) + byteX(4) + BW) / 2} y={BY + BH + 26} size={11} anchor="middle" dim>imm32 = 5, little-endian</Label>
            </Appear>

            {/* ===== step 6: decode the ModRM byte ===== */}
            <Wire from={[byteX(1) + BW / 2, BY + BH + 28]} to={[byteX(1) + BW / 2, 342]} on={s === 6} />
            <Drop on={s === 6} delay={0.4} dy={14}>
              <Label x={24} y={372} size={11} dim>MODRM 0x43</Label>
              <Label x={24} y={390} size={11} dim>in binary</Label>
              <BitField x={byteX(1) + BW / 2 - 112} y={352} bits="01000011" cellW={28} h={28} showIndex={false}
                fields={[[0, 2, 'mod'], [2, 3, 'reg'], [5, 3, 'rm']]} active={undefined} />
              <Label x={byteX(1) + BW / 2 - 112 + 28} y={424} size={11} anchor="middle" dim>disp8</Label>
              <Label x={byteX(1) + BW / 2 - 112 + 3.5 * 28} y={424} size={11} anchor="middle" weight={600}>eax</Label>
              <Label x={byteX(1) + BW / 2 - 112 + 6.5 * 28} y={424} size={11} anchor="middle" weight={600}>ebx</Label>
            </Drop>
            <Drop on={s === 6} delay={0.7} dy={14}>
              <Label x={470} y={364} size={13}>8B → mov r32, r/m32</Label>
              <Label x={470} y={390} size={13}>43 → dest eax, base ebx</Label>
              <Label x={470} y={416} size={13}>04 → address = ebx + 4</Label>
            </Drop>

            {/* ===== step 7: the missing-$ trap ===== */}
            <Drop on={imm} delay={0.6} dy={14}>
              <Label x={24} y={366} size={11} dim>WITHOUT THE $</Label>
              <Block x={190} y={346} w={586} h={78} state="off" />
              <Label x={206} y={376} size={16} weight={500}>movl 5, %eax</Label>
              <Label x={420} y={376} size={16} weight={500}>A1 05 00 00 00</Label>
              <Label x={206} y={404} size={12} dim mono={false}>no error, but it reads the 4 bytes at memory address 5 instead of loading 5</Label>
            </Drop>
          </Scene>
        )
      }}
    </VizStage>
  )
}
