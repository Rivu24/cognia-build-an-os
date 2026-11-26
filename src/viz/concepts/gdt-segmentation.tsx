/* GDT and segment selectors (32-bit protected mode).
   Worked example a learner can check against the GDT Tutorial: selector 0x08 -> GDT entry 1 (kernel code,
   access 0x9A, flags 0xC), user selectors 0x1B / 0x23 (RPL 3), flat base 0 / limit 0xFFFFF with 4 KiB granularity. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'gdt-segmentation',
  title: 'GDT: from selector to segment',
  summary: 'How a 16-bit segment selector picks an 8-byte descriptor out of the GDT that GDTR points to, and what the descriptor says.',
  lessons: ['t4m2l1'],
  articles: ['Global Descriptor Table', 'GDT Tutorial', 'Segment Selector', 'Segmentation'],
  group: 'CPU',
  order: 421,
}

const steps: VizStep[] = [
  { caption: 'A segment register holds a 16-bit selector: index | TI | RPL.', detail: 'CS, DS, SS, ES, FS and GS hold selectors, not addresses. The CPU uses the selector to find a descriptor that describes the segment.' },
  { caption: 'Selector 0x08: index 1, TI 0 (use the GDT), RPL 0 (ring 0).', detail: 'Bits 15:3 are the index, bit 2 picks GDT (0) or LDT (1), bits 1:0 are the requested privilege level. Index × 8 = byte offset 0x08.' },
  { caption: 'GDTR tells the CPU where the GDT is: its base and its size.', detail: 'Size is the table length minus 1: 6 entries × 8 bytes = 48, so 0x002F. The base is a linear address (paging applies).' },
  { caption: 'The GDT: null first, then kernel code/data, user code/data, TSS.', detail: 'Entry 0 must be the null descriptor. Each entry is 8 bytes, so entry n sits at GDTR base + n × 8.' },
  { caption: 'GDTR base + 1 × 8 → entry 1: the kernel code descriptor.', detail: 'This lookup happens when a selector is loaded into a segment register. The result is cached in hidden CPU registers.' },
  { caption: 'A descriptor packs base, limit, access byte and flags.', detail: 'Access 0x9A = present, DPL 0, code/data, executable, readable. Flags 0xC = 4 KiB granularity, 32-bit.' },
  { caption: 'Flat model: base 0, limit 0xFFFFF in 4 KiB units = all 4 GiB.', detail: 'With G = 1 the limit counts 4 KiB pages: (0xFFFFF + 1) × 4 KiB = 4 GiB. Every segment covers everything; paging does the real protection.' },
  { caption: 'User selectors add RPL 3: 0x18 | 3 = 0x1B, 0x20 | 3 = 0x23.', detail: 'Entry 3 has access 0xFA: same as kernel code but DPL = 3, so ring 3 code may run in it. User data uses 0xF2.' },
  { caption: 'lgdt loads GDTR, a far jump reloads CS, mov reloads the rest.', detail: 'Nothing changes until segment registers are reloaded. mov cannot load CS, so use a far jump (jmp 0x08:label); DS, ES, FS, GS, SS take mov.', ms: 4200 },
]

/* rows of the GDT (32-bit, from the GDT Tutorial) */
const ROWS = [
  { off: '+0x00', use: 'null', sel: '—' },
  { off: '+0x08', use: 'kernel code', sel: '0x08' },
  { off: '+0x10', use: 'kernel data', sel: '0x10' },
  { off: '+0x18', use: 'user code', sel: '0x1B' },
  { off: '+0x20', use: 'user data', sel: '0x23' },
  { off: '+0x28', use: 'TSS', sel: '0x28' },
]
const TX = 560
const TY = 70
const RH = 30

const SEL_08 = '0000000000001000'
const SEL_1B = '0000000000011011'

const CODE = [
  ['lgdt [gdtr]', '; base + size → GDTR'],
  ['jmp  0x08:.reload_CS', '; far jump reloads CS'],
  ['.reload_CS:', ''],
  ['mov  ax, 0x10', '; kernel data selector'],
  ['mov  ds, ax', '; same for es, fs, gs, ss'],
]

function rowState(s: number, i: number): 'on' | 'off' | 'dim' {
  if (s === 4 || s === 5 || s === 6) return i === 1 ? 'on' : 'dim'
  if (s === 7) return i === 3 || i === 4 ? 'on' : 'dim'
  if (s === 8) return i === 1 || i === 2 ? 'on' : 'dim'
  return 'off'
}

export default function GdtSegmentation() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const user = s === 7
        const bits = user ? SEL_1B : SEL_08
        const fields: [number, number, string][] = s >= 1
          ? [[0, 13, user ? 'index = 3' : 'index = 1'], [13, 1, 'TI=0'], [14, 2, user ? 'RPL=3' : 'RPL=0']]
          : [[0, 13, 'index (15:3)'], [13, 1, 'TI'], [14, 2, 'RPL']]
        const access = user ? '11111010' : '10011010'
        return (
          <Scene label={meta.summary}>
            {/* ── selector ── */}
            <Label x={30} y={18} size={11} dim>SEGMENT SELECTOR · 16 BITS</Label>
            <BitField x={30} y={40} bits={bits} fields={fields} active={s === 1 || s === 4 ? 0 : s === 7 ? 2 : undefined} cellW={24} h={26} />
            <Label x={428} y={62} size={20} weight={500}>{user ? '0x001B' : '0x0008'}</Label>
            <Label x={30} y={112} size={11} on={s >= 1} dim>
              {user ? 'index 3 × 8 = byte offset 0x18 · RPL 3 = ring 3' : 'index 1 × 8 = byte offset 0x08'}
            </Label>

            {/* ── segment registers (intro) ── */}
            <Appear on={s <= 1}>
              <Label x={30} y={226} size={11} dim>SEGMENT REGISTERS HOLD SELECTORS, NOT ADDRESSES</Label>
              {['CS', 'DS', 'ES', 'FS', 'GS', 'SS'].map((r, i) => (
                <Block key={r} x={30 + i * 78} y={162} w={70} h={44} label={r} sub={i === 0 ? '0x08' : '0x10'} mono size={13} state={i === 0 ? 'on' : 'dim'} />
              ))}
              <Wire d="M65 162 C 65 130, 100 110, 110 80" on={s === 0} dashed />
            </Appear>

            {/* ── GDTR ── */}
            <Appear on={s >= 2}>
              <Block x={30} y={128} w={240} h={52} label="GDTR" sub="base 0x00105000 · size 0x002F" mono state={s === 2 || s === 8 ? 'on' : 'off'} />
            </Appear>
            <Wire d={`M270 154 C 430 154, 440 85, ${TX - 4} 85`} on={s >= 3} />

            {/* ── GDT table ── */}
            <Appear on={s >= 3} dx={12} dy={0}>
              <Label x={TX} y={TY - 10} size={11} dim>GDT IN MEMORY</Label>
              <Label x={770} y={TY - 10} size={11} dim anchor="end">SELECTOR</Label>
              {ROWS.map((r, i) => {
                const st = rowState(s, i)
                return (
                  <g key={i}>
                    <Block x={TX} y={TY + i * RH} w={210} h={RH} state={i === 0 && st === 'off' ? 'hatch' : st} />
                    <Label x={TX + 8} y={TY + i * RH + 19} size={10.5} dim>{r.off}</Label>
                    <Label x={TX + 58} y={TY + i * RH + 19} size={12} mono={false} weight={500}>{r.use}</Label>
                    <Label x={762} y={TY + i * RH + 19} size={12} anchor="end" weight={500}>{r.sel}</Label>
                  </g>
                )
              })}
            </Appear>
            <Packet on={s === 4} points={[[186, 53], [150, 154], [TX - 12, 85], [TX - 12, 115]]} duration={2.4} />

            {/* ── descriptor detail ── */}
            <Appear on={s >= 5 && s <= 7}>
              <Label x={30} y={226} size={11} dim>{user ? 'ENTRY 3 AT GDTR + 0x18 · 8 BYTES' : 'ENTRY 1 AT GDTR + 0x08 · 8 BYTES'}</Label>
              <Block x={30} y={238} w={130} h={44} label="base" sub="0x00000000" size={12} state={s === 6 ? 'on' : 'off'} />
              <Block x={168} y={238} w={110} h={44} label="limit" sub="0xFFFFF" size={12} state={s === 6 ? 'on' : 'off'} />
              <Block x={286} y={238} w={110} h={44} label="access" sub={user ? '0xFA' : '0x9A'} size={12} state={s === 5 || s === 7 ? 'on' : 'off'} />
              <Block x={404} y={238} w={100} h={44} label="flags" sub="0xC" size={12} state={s === 6 ? 'on' : 'off'} />
              <BitField x={30} y={322} bits={access} cellW={34} h={24}
                fields={[[0, 1, 'P'], [1, 2, 'DPL'], [3, 1, 'S'], [4, 1, 'E'], [5, 1, 'DC'], [6, 1, 'RW'], [7, 1, 'A']]}
                active={user ? 1 : undefined} />
              <BitField x={368} y={322} bits="1100" cellW={34} h={24} fields={[[0, 1, 'G'], [1, 1, 'DB'], [2, 1, 'L'], [3, 1, '–']]} active={s === 6 ? 0 : undefined} />
              <Label x={30} y={404} size={11.5}>
                {s === 6 ? 'G=1: limit counts 4 KiB units · DB=1: 32-bit segment' : `present · ring ${user ? 3 : 0} · code/data · executable · readable`}
              </Label>
            </Appear>

            {/* ── flat model ── */}
            <Appear on={s >= 6}>
              <Label x={TX} y={300} size={11} dim>LINEAR ADDRESS SPACE</Label>
              <Block x={TX} y={312} w={210} h={34} state={s === 6 ? 'on' : 'off'} />
              <motion.rect x={TX} y={312} height={34} initial={false} animate={{ width: s >= 6 ? 210 : 0 }} transition={{ ...ease, duration: 1.4 }} fill="var(--viz-fg)" opacity={0.16} />
              <Label x={TX + 105} y={334} size={11} anchor="middle">one segment, 0 → 4 GiB</Label>
              <Label x={TX} y={364} size={10.5} dim>0x00000000</Label>
              <Label x={770} y={364} size={10.5} dim anchor="end">0xFFFFFFFF</Label>
              <Label x={TX} y={392} size={11}>(0xFFFFF + 1) × 4 KiB</Label>
              <Label x={TX} y={412} size={11} weight={500}>= 4 GiB, base 0</Label>
            </Appear>

            {/* ── lgdt + reload ── */}
            <Appear on={s === 8}>
              <Block x={30} y={214} w={490} h={208} />
              <Label x={44} y={236} size={11} dim>BOOT CODE (NASM)</Label>
              <ScanBar on={s === 8} x={34} y0={246} step={30} n={CODE.length} w={330} />
              {CODE.map(([c, cm], i) => (
                <g key={i}>
                  <Label x={44} y={266 + i * 30} size={12.5} weight={500}>{c}</Label>
                  <Label x={44 + 172} y={266 + i * 30} size={10.5} dim>{cm}</Label>
                </g>
              ))}
              <Block x={394} y={290} w={112} h={44} label="CS" sub="0x08" mono size={13} state="on" />
              <Block x={394} y={350} w={112} h={44} label="DS…SS" sub="0x10" mono size={13} state="on" />
            </Appear>
            <Packet on={s === 8} points={[[250, 246], [230, 184]]} duration={1.2} />
          </Scene>
        )
      }}
    </VizStage>
  )
}

/** A highlight bar that walks down the lines of a code listing, looping. */
function ScanBar({ on, x, y0, step, n, w }: { on: boolean; x: number; y0: number; step: number; n: number; w: number }) {
  if (!on) return null
  const ys = Array.from({ length: n }, (_, i) => y0 + i * step)
  return (
    <motion.rect x={x} width={w} height={step - 4} fill="var(--viz-fg)" opacity={0.1}
      initial={{ y: ys[0] }} animate={{ y: ys }} transition={{ duration: n * 0.8, ease: 'linear', repeat: Infinity, repeatDelay: 0.4 }} />
  )
}
