/* Long mode: switching in (PAE, CR3, EFER.LME, CR0.PG, far jump) and the 4-level walk of a canonical 48-bit address.
   Worked example: a higher-half kernel address 0xFFFFFFFF80201ABC that maps to physical 0x00201ABC
   (indexes 511 | 510 | 1 | 1, offset 0xABC). CR3 = 0x1000 as in the "Setting Up Long Mode" example. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'long-mode-4-level-paging',
  title: 'Long mode and 4-level paging',
  summary: 'How a kernel enters long mode (PAE, CR3, EFER.LME, CR0.PG, far jump) and how the MMU walks PML4, PDPT, PD and PT to translate a canonical 48-bit address.',
  lessons: ['t15m1l1', 't15m1l5', 't15m1l2'],
  articles: ['Setting Up Long Mode', 'X86-64', 'Paging'],
  group: 'Platform',
  order: 1510,
}

const steps: VizStep[] = [
  { caption: 'To enter long mode, set CR4.PAE and load CR3 with the PML4 address.', detail: 'Long mode always uses PAE-style paging with a fourth level on top. Here the PML4 sits at physical 0x1000.' },
  { caption: 'Set EFER.LME, then turn on CR0.PG: the CPU is in compatibility mode.', detail: 'EFER is MSR 0xC0000080; LME is bit 8 (rdmsr, or, wrmsr). PG is CR0 bit 31. Code still runs as 32-bit here.' },
  { caption: 'A far jump to a 64-bit code segment lands in 64-bit mode.', detail: 'Load a GDT with a long-mode code descriptor and jmp GDT.Code:Realm64. Registers are now 64 bits wide.' },
  { caption: 'Pointers are 64 bits, but only the low 48 bits are translated.', detail: 'First x86-64 CPUs (and most today) use 48-bit virtual addresses: 256 TiB of address space.' },
  { caption: 'Bits 63 to 48 must copy bit 47: the address must be canonical.', detail: 'Upper bits all 0 = lower half, all 1 = higher half. Anything in between is a non-canonical hole and cannot be used.' },
  { caption: 'The 48 bits split 9 | 9 | 9 | 9 | 12.', detail: 'Four 9-bit indexes (each table has 512 eight-byte entries) and a 12-bit offset inside a 4 KiB page.' },
  { caption: 'CR3 → PML4[511] → PDPT[510] → PD[1] → PT[1].', detail: 'Each entry holds the physical address of the next table plus flags. An entry with P = 0 stops the walk with a page fault.', ms: 4200 },
  { caption: 'PT[1] gives frame 0x00201000; add offset 0xABC → 0x00201ABC.', detail: 'Only the low 12 bits pass through unchanged. Four memory reads per miss, which is why the TLB matters even more here.' },
  { caption: 'Kernels live in the higher half, at 0xFFFFFFFF80000000.', detail: 'That is the top 2 GiB: PML4[511], PDPT[510]. Put the same PML4[511] entry in every process and the kernel is mapped everywhere.', ms: 4000 },
]

const BITS = '111111111111111110000000001000000001101010111100' // low 48 bits of 0xFFFFFFFF80201ABC
const FIELDS: [number, number, string][] = [
  [0, 9, 'PML4 = 511'],
  [9, 9, 'PDPT = 510'],
  [18, 9, 'PD = 1'],
  [27, 9, 'PT = 1'],
  [36, 12, 'offset = 0xABC'],
]

const BX = 60 // bits x
const BY = 40
const CW = 15
const CH = 26

/** 48 address bits with field boxes; several fields can be active at once. */
function AddrBits({ fields, active, hot }: { fields: [number, number, string][]; active: number[]; hot?: number }) {
  const inActive = (i: number) => active.some((f) => fields[f] && i >= fields[f][0] && i < fields[f][0] + fields[f][1]) || hot === i
  return (
    <g>
      {fields.map(([st, len, lab], i) => (
        <g key={i}>
          <motion.rect x={BX + st * CW} y={BY - 4} width={len * CW} height={CH + 8} fill="none" initial={false}
            animate={{ stroke: active.includes(i) ? 'var(--viz-fg)' : 'var(--viz-faint)', strokeWidth: active.includes(i) ? 2 : 1 }}
            filter={active.includes(i) ? 'url(#viz-glow)' : undefined} />
          <Label x={BX + (st + len / 2) * CW} y={BY + CH + 22} anchor="middle" size={11} dim={!active.includes(i)}>{lab}</Label>
        </g>
      ))}
      {BITS.split('').map((b, i) => (
        <g key={i}>
          <motion.rect x={BX + i * CW} y={BY} width={CW} height={CH} stroke="var(--viz-faint)" initial={false}
            animate={{ fill: inActive(i) ? 'var(--viz-fg)' : 'var(--viz-bg)' }} transition={ease} />
          <motion.text x={BX + i * CW + CW / 2} y={BY + CH / 2 + 4} textAnchor="middle" initial={false}
            animate={{ fill: inActive(i) ? 'var(--viz-bg)' : 'var(--viz-fg)' }} style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{b}</motion.text>
        </g>
      ))}
    </g>
  )
}

const TABLES: { x: number; name: string; rows: string[]; sel: number; next: string }[] = [
  { x: 140, name: 'PML4', rows: ['[0]', '[1]', '…', '[511]'], sel: 3, next: '→ PDPT' },
  { x: 270, name: 'PDPT', rows: ['[0]', '…', '[510]', '[511]'], sel: 2, next: '→ PD' },
  { x: 400, name: 'PD', rows: ['[0]', '[1]', '…', '[511]'], sel: 1, next: '→ PT' },
  { x: 530, name: 'PT', rows: ['[0]', '[1]', '…', '[511]'], sel: 1, next: '→ 0x00201000' },
]
const TY = 162
const RH = 30

const MODE = [
  { label: 'CR4.PAE = 1', sub: 'bit 5' },
  { label: 'CR3 = PML4', sub: '0x1000' },
  { label: 'EFER.LME = 1', sub: 'MSR 0xC0000080 b8' },
  { label: 'CR0.PG = 1', sub: 'bit 31' },
  { label: 'jmp 64-bit CS', sub: 'far jump' },
]
const modeStep = [0, 0, 1, 1, 2] // which caption step turns each box on

export default function LongMode4LevelPaging() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const walk = s >= 6
        const tableState = (ti: number, ri: number) => {
          if (s <= 2) return ti === 0 && s === 0 ? 'off' : 'dim'
          if (walk && ri === TABLES[ti].sel) return s === 6 || (s === 8 && ti <= 1) ? 'on' : 'fill'
          return walk ? 'dim' : 'off'
        }
        const active = s === 6 ? [0, 1, 2, 3] : s === 7 ? [4] : s === 8 ? [0, 1] : []
        return (
          <Scene label={meta.summary}>
            {/* CPU mode banner (steps 0-2) */}
            <Appear on={s <= 2}>
              <Label x={20} y={18} size={11} dim>CPU MODE</Label>
              <Label x={400} y={66} size={16} anchor="middle" weight={500} on={s === 0}>32-bit protected mode, paging off</Label>
              <Label x={400} y={66} size={16} anchor="middle" weight={500} on={s === 1}>long mode: compatibility submode (32-bit code)</Label>
              <Label x={400} y={66} size={16} anchor="middle" weight={500} on={s === 2}>long mode: 64-bit submode</Label>
              <Label x={400} y={92} size={11.5} anchor="middle" dim on={s === 2}>rax, rsp, rip … are now 64 bits</Label>
            </Appear>

            {/* the 64-bit virtual address */}
            <Appear on={s >= 3}>
              <Label x={20} y={18} size={11} dim>64-BIT VIRTUAL ADDRESS</Label>
              <Label x={780} y={18} size={13} anchor="end" weight={500}>0xFFFFFFFF80201ABC</Label>
              <Label x={20} y={32} size={10.5} dim>63</Label>
              <Label x={BX + 2} y={32} size={10.5} dim>47</Label>
              <Label x={780} y={32} size={10.5} anchor="end" dim>0</Label>
              <Block x={20} y={BY} w={40} h={CH} label="FFFF" mono size={11} state={s === 4 ? 'on' : s === 3 ? 'off' : 'dim'} />
              <Label x={40} y={BY + CH + 22} size={11} anchor="middle" dim={s !== 4}>sign</Label>
              <AddrBits fields={s >= 5 ? FIELDS : [[0, 48, 'translated: bits 47 … 0']]} active={s === 3 ? [0] : active} hot={s === 4 ? 0 : undefined} />
            </Appear>
            <Pulse x={40} y={BY + 13} on={s === 4} />
            <Label x={68} y={122} size={11.5} on={s === 4}>bit 47 = 1, so bits 63 … 48 must all be 1 (0xFFFF)</Label>

            {/* walk */}
            <Block x={20} y={196} w={90} h={50} label="CR3" sub="0x1000" mono state={s === 0 || s === 6 ? 'on' : s <= 2 ? 'off' : walk ? 'fill' : 'off'} />
            {TABLES.map((t, ti) => (
              <g key={t.name}>
                <Label x={t.x} y={TY - 10} size={11} dim>{t.name}</Label>
                {t.rows.map((r, ri) => (
                  <Block key={ri} x={t.x} y={TY + ri * RH} w={100} h={RH} mono size={11} label={r} state={tableState(ti, ri)} />
                ))}
                <Label x={t.x} y={TY + 4 * RH + 20} size={10.5} on={walk} delay={0.35 * ti}>{t.next}</Label>
              </g>
            ))}
            <Wire from={[110, 221]} to={[137, TY + 15]} on={s === 0 || walk} />
            {TABLES.map((t, ti) => {
              const y0 = TY + t.sel * RH + RH / 2
              const nx = ti < 3 ? TABLES[ti + 1].x - 3 : 657
              const ny = ti < 3 ? TY + 15 : 230
              return <Wire key={ti} d={`M${t.x + 100} ${y0} C ${t.x + 116} ${y0}, ${nx - 16} ${ny}, ${nx} ${ny}`} on={walk} delay={0.35 * (ti + 1)} />
            })}
            <Label x={660} y={TY - 10} size={11} dim>PHYSICAL RAM</Label>
            <Block x={660} y={TY} w={120} h={38} state="hatch" />
            <Block x={660} y={TY + 38} w={120} h={56} label="frame" sub="0x00201000" mono state={s >= 7 ? 'on' : walk ? 'off' : 'dim'} />
            <Block x={660} y={TY + 94} w={120} h={26} state="hatch" />
            <Appear on={s >= 7}>
              <line x1={666} x2={774} y1={TY + 86} y2={TY + 86} stroke="var(--viz-fg)" strokeDasharray="3 3" />
              <Label x={720} y={TY + 4 * RH + 20} size={12} anchor="middle" weight={500}>0x00201ABC</Label>
              <Label x={720} y={TY + 4 * RH + 36} size={10.5} anchor="middle" dim>frame + 0xABC</Label>
            </Appear>
            <Packet on={s === 6} duration={2.6} label="walk"
              points={[[65, 221], [190, TY + 3 * RH + 15], [320, TY + 2 * RH + 15], [450, TY + RH + 15], [580, TY + RH + 15], [720, TY + 66]]} />
            <Packet on={s === 7} duration={1.6} r={4} points={[[768, TY + 42], [768, TY + 86]]} />

            {/* entering long mode */}
            <Appear on={s <= 2}>
              <Label x={20} y={346} size={11} dim>ENTERING LONG MODE (FROM PROTECTED MODE)</Label>
              {MODE.map((m, i) => {
                const st = modeStep[i] === s ? 'on' : modeStep[i] < s ? 'fill' : 'dim'
                return <Block key={i} x={20 + i * 156} y={360} w={136} h={52} label={m.label} sub={m.sub} mono size={12} state={st} />
              })}
              {[0, 1, 2, 3].map((i) => (
                <Wire key={i} from={[156 + i * 156, 386]} to={[174 + i * 156, 386]} on={modeStep[i + 1] <= s} />
              ))}
            </Appear>
            <Packet on={s === 2} duration={2.2} points={[[88, 386], [244, 386], [400, 386], [556, 386], [712, 386]]} />
            <Pulse x={88} y={386} on={s === 0} />
            <Pulse x={244} y={386} on={s === 0} />

            {/* canonical address space */}
            <Appear on={s >= 3}>
              <Label x={20} y={346} size={11} dim>THE 64-BIT ADDRESS SPACE (48-BIT CANONICAL)</Label>
              <Block x={20} y={356} w={280} h={40} label="lower half (user)" size={12} state={s === 4 ? 'on' : 'off'} />
              <Block x={300} y={356} w={200} h={40} state="hatch" />
              <Label x={400} y={381} size={11.5} anchor="middle" dim>non-canonical hole</Label>
              <Block x={500} y={356} w={280} h={40} state={s === 4 || s === 8 ? 'on' : 'off'} />
              <Label x={512} y={s === 8 ? 373 : 380} size={12} mono={false} weight={500}>higher half (kernel)</Label>
              <Label x={512} y={389} size={10.5} on={s === 8}>0xFFFFFFFF80000000 = top 2 GiB</Label>
              <Label x={20} y={414} size={10.5} dim>0x0000000000000000</Label>
              <Label x={300} y={414} size={10.5} anchor="end" dim>0x00007FFFFFFFFFFF</Label>
              <Label x={500} y={414} size={10.5} dim>0xFFFF800000000000</Label>
              <Label x={780} y={414} size={10.5} anchor="end" dim>0xFFFFFFFFFFFFFFFF</Label>
            </Appear>
            <Appear on={s === 8}>
              <rect x={762} y={360} width={14} height={32} fill="var(--viz-fg)" />
            </Appear>
            <Pulse x={769} y={376} on={s === 3 || s === 8} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
