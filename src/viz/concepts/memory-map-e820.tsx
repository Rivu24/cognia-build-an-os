/* The firmware memory map. Numbers are the example E820 output the "Detecting Memory (x86)" article shows for
   Bochs (32 MiB): 0x0/0x9FC00 type 1, 0x9FC00/0x400 type 2, 0xE8000/0x18000 type 2, 0x100000/0x1F00000 type 1,
   0xFFFC0000/0x40000 type 2. INT 15h EAX=0xE820 registers, the type list and the multiboot mmap_* fields
   (flags bit 6, entry = size + base + length + type) come from the same article and "Multiboot". */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'memory-map-e820',
  title: 'The memory map: what RAM can I use?',
  summary: 'The BIOS E820 memory map, passed on by GRUB, lists base, length and type for each region; only type 1 is free RAM, minus your own kernel.',
  lessons: ['t6m1l1'],
  articles: ['Detecting Memory (x86)', 'Multiboot'],
  group: 'Memory',
  order: 611,
}

const steps: VizStep[] = [
  { caption: 'Before using RAM, your kernel must learn which addresses are real, free memory.', detail: 'Physical memory has holes: video memory and ROMs below 1 MiB, devices mapped near 4 GiB. Probing by writing to memory is unsafe, so ask the firmware.' },
  { caption: 'The BIOS reports memory through INT 15h, EAX = 0xE820, one entry per call.', detail: "EDX = 0x534D4150 ('SMAP'), ECX = 24, ES:DI = buffer, EBX = 0 to start. Each call returns one entry and a new EBX; EBX = 0 again means the list is done." },
  { caption: 'GRUB makes those calls for you and passes the list in the multiboot info.', detail: 'Your kernel starts with EBX pointing at multiboot_info. If flags bit 6 is set, mmap_addr and mmap_length describe the entries (here 5 × 24 = 120 bytes).' },
  { caption: 'Each entry is a base address, a length and a type.', detail: 'Base and length are 64-bit, type is 32-bit. GRUB puts a size field in front: next entry = this + size + 4. The list may be unsorted.' },
  { caption: 'Entry 0: 639 KiB of usable RAM starting at address 0.', detail: 'Base 0x0, length 0x9FC00 = 654,336 bytes, type 1 = usable. (This whole map is the example Bochs reports for a 32 MiB machine.)' },
  { caption: 'Entries 1 and 2 are reserved: the EBDA and the BIOS area below 1 MiB.', detail: 'Type 2 = reserved, never allocate it. 0x9FC00 to 0x9FFFF is the EBDA; 0xE8000 to 0xFFFFF holds BIOS code. Avoid types 4 (ACPI NVS) and 5 (bad) too.' },
  { caption: 'Entry 3: 31 MiB of usable RAM from 1 MiB up.', detail: 'Base 0x100000, length 0x1F00000 = 31 MiB. Type 3 (ACPI reclaimable) can join the usable pool too, but only after you have finished reading the ACPI tables.' },
  { caption: 'Entry 4 is the BIOS ROM below 4 GiB. Gaps nobody listed are not RAM.', detail: 'Base 0xFFFC0000, length 0x40000 (256 KiB). Unlisted ranges, like 0xA0000 to 0xE7FFF (VGA, option ROMs) or everything above 32 MiB here, count as reserved.' },
  { caption: 'Only type 1 is free, and your own kernel sits inside it: mark it used.', detail: 'GRUB loaded the kernel at 1 MiB, inside entry 3. Mark its frames (and the multiboot info) as used before handing out memory, or you overwrite yourself.', ms: 4200 },
]

type Seg = { label: string; h: number; kind: 'usable' | 'reserved' | 'unlisted'; entry?: number; reveal: number }
// top (high address) to bottom (address 0)
const SEGS: Seg[] = [
  { label: 'BIOS ROM', h: 36, kind: 'reserved', entry: 4, reveal: 7 },
  { label: 'not RAM (unlisted)', h: 86, kind: 'unlisted', reveal: 7 },
  { label: 'usable · 31 MiB', h: 130, kind: 'usable', entry: 3, reveal: 6 },
  { label: 'BIOS', h: 30, kind: 'reserved', entry: 2, reveal: 5 },
  { label: 'VGA, ROMs (unlisted)', h: 30, kind: 'unlisted', reveal: 7 },
  { label: 'EBDA', h: 22, kind: 'reserved', entry: 1, reveal: 5 },
  { label: 'usable · 639 KiB', h: 42, kind: 'usable', entry: 0, reveal: 4 },
]
const BOUNDS = ['0xFFFFFFFF', '0xFFFC0000', '0x02000000', '0x00100000', '0x000E8000', '0x000A0000', '0x0009FC00', '0x00000000']
const BAR_X = 120
const BAR_W = 150
const BAR_Y = 40
const segY: number[] = []
{
  let y = BAR_Y
  for (const sg of SEGS) { segY.push(y); y += sg.h }
  segY.push(y)
}

const ENTRIES = [
  { base: '0x0000000000000000', len: '0x000000000009FC00', type: '1 usable' },
  { base: '0x000000000009FC00', len: '0x0000000000000400', type: '2 reserved' },
  { base: '0x00000000000E8000', len: '0x0000000000018000', type: '2 reserved' },
  { base: '0x0000000000100000', len: '0x0000000001F00000', type: '1 usable' },
  { base: '0x00000000FFFC0000', len: '0x0000000000040000', type: '2 reserved' },
]
const ENTRY_STEP = [4, 5, 5, 6, 7]
const T_X = 330
const T_Y = 232
const T_H = 24

function segOfEntry(e: number) {
  return SEGS.findIndex((sg) => sg.entry === e)
}

export default function MemoryMapE820() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => (
        <Scene label={meta.summary}>
          {/* ---------- physical address space bar ---------- */}
          <Label x={BAR_X - 64} y={28} size={11} dim>PHYSICAL ADDRESSES (not to scale)</Label>
          {SEGS.map((sg, i) => {
            const revealed = s >= sg.reveal
            const current = sg.entry !== undefined ? ENTRY_STEP[sg.entry] === s : s === 7 && sg.kind === 'unlisted'
            const state = !revealed ? 'off' : current && sg.kind === 'usable' ? 'on' : sg.kind === 'usable' ? 'off' : 'hatch'
            return (
              <g key={i}>
                <Block x={BAR_X} y={segY[i]} w={BAR_W} h={sg.h} state={state} />
                {current && sg.kind !== 'usable' && (
                  <rect x={BAR_X} y={segY[i]} width={BAR_W} height={sg.h} fill="none" stroke="var(--viz-fg)" strokeWidth={2.2} filter="url(#viz-glow)" />
                )}
                <Label x={BAR_X + BAR_W / 2} y={segY[i] + sg.h / 2 + 4} size={sg.h < 26 ? 10.5 : 11.5} anchor="middle" mono={false}
                  on={revealed} weight={sg.kind === 'usable' ? 600 : 400}>{sg.label}</Label>
              </g>
            )
          })}
          {BOUNDS.map((b, i) => (
            <Label key={b} x={BAR_X - 8} y={segY[i] + (i === 0 ? 8 : i === BOUNDS.length - 1 ? 0 : 4)} size={10} anchor="end"
              dim={!(s >= 4)}>{b}</Label>
          ))}
          <Label x={BAR_X + BAR_W / 2} y={232} size={40} anchor="middle" on={s < 4} dim weight={300}>?</Label>
          <Pulse x={BAR_X + BAR_W / 2} y={218} on={s === 0} r={24} />

          {/* kernel inside entry 3 */}
          <Appear on={s >= 8} dy={0}>
            <Block x={BAR_X + 6} y={segY[3] - 30} w={BAR_W - 12} h={26} label="kernel" size={12} state="fill" />
          </Appear>
          <Pulse x={BAR_X + BAR_W / 2} y={segY[3] - 17} on={s === 8} r={16} />

          {/* ---------- firmware -> GRUB -> kernel ---------- */}
          <Block x={330} y={46} w={130} h={52} label="BIOS" sub="INT 15h, E820" size={13} state={s === 1 ? 'on' : 'off'} />
          <Wire from={[460, 72]} to={[508, 72]} on={s >= 1} />
          <Block x={510} y={46} w={110} h={52} label="GRUB" sub="multiboot" size={13} state={s === 2 ? 'on' : 'off'} />
          <Wire from={[620, 72]} to={[668, 72]} on={s >= 2} />
          <Block x={670} y={46} w={100} h={52} label="kernel" sub="kmain(mbi)" size={13} state={s === 3 || s === 8 ? 'on' : 'off'} />
          <Packet on={s === 1} points={[[462, 72], [486, 72], [508, 72]]} duration={0.9} label="entry" />
          <Packet on={s === 2} points={[[622, 72], [646, 72], [668, 72]]} duration={1.0} label="mbi" />

          <Appear on={s >= 1}>
            {['EAX = 0xE820', "EDX = 0x534D4150 'SMAP'", 'EBX = 0 → … → 0 (done)', 'ES:DI → 24-byte buffer'].map((t, i) => (
              <Label key={i} x={330} y={122 + i * 15} size={10.5} dim={s !== 1}>{t}</Label>
            ))}
          </Appear>
          <Appear on={s >= 2}>
            {['EBX → multiboot_info', 'flags bit 6 = 1', 'mmap_addr → entries', 'mmap_length = 120'].map((t, i) => (
              <Label key={i} x={616} y={122 + i * 15} size={10.5} dim={s !== 2}>{t}</Label>
            ))}
          </Appear>

          {/* ---------- entry layout + table ---------- */}
          <Appear on={s >= 3}>
            <Label x={T_X} y={192} size={10.5} dim>ENTRY</Label>
            {[['size', 4], ['base (8 bytes)', 8], ['length (8 bytes)', 8], ['type', 4]].map(([t, n], i, arr) => {
              const unit = 15
              const x0 = T_X + 44 + arr.slice(0, i).reduce((a, c) => a + (c[1] as number) * unit, 0)
              return <Block key={i} x={x0} y={178} w={(n as number) * unit} h={20} label={t as string} mono size={10.5} state={s === 3 && i > 0 ? 'on' : 'off'} />
            })}
            <Label x={T_X + 8} y={222} size={10.5} dim>#</Label>
            <Label x={T_X + 28} y={222} size={10.5} dim>base</Label>
            <Label x={T_X + 160} y={222} size={10.5} dim>length</Label>
            <Label x={T_X + 292} y={222} size={10.5} dim>type</Label>
            {ENTRIES.map((e, i) => {
              const cur = ENTRY_STEP[i] === s
              const known = s >= ENTRY_STEP[i]
              const usable = e.type.startsWith('1')
              const y = T_Y + i * T_H
              const strong = cur || (s === 8 && usable)
              return (
                <motion.g key={i} initial={false} animate={{ opacity: s >= 4 && !strong && !(known && usable) ? 0.5 : 1 }} transition={ease}>
                  <Block x={T_X} y={y} w={440} h={T_H} state={strong ? 'on' : 'off'} />
                  <Label x={T_X + 8} y={y + 16} size={11}>{i}</Label>
                  <Label x={T_X + 28} y={y + 16} size={11}>{e.base}</Label>
                  <Label x={T_X + 160} y={y + 16} size={11}>{e.len}</Label>
                  <Label x={T_X + 292} y={y + 16} size={11} weight={usable ? 600 : 400}>{e.type}</Label>
                </motion.g>
              )
            })}
          </Appear>
          <Wire d={`M765 98 L765 ${T_Y - 4}`} on={s >= 3} dashed dim={s !== 3} />
          <Packet on={s === 3} points={[[765, 98], [765, T_Y - 4]]} duration={1} />

          {/* table row -> bar segment links */}
          {ENTRIES.map((_, i) => {
            const si = segOfEntry(i)
            const y1 = T_Y + i * T_H + T_H / 2
            const y2 = segY[si] + SEGS[si].h / 2
            return <Wire key={i} d={`M${T_X} ${y1} C 300 ${y1}, 300 ${y2}, ${BAR_X + BAR_W + 2} ${y2}`} on={ENTRY_STEP[i] === s} />
          })}

          {/* legend */}
          <Appear on={s >= 4}>
            <Label x={T_X} y={378} size={10.5} dim>TYPES  1 usable · 2 reserved · 3 ACPI reclaimable</Label>
            <Label x={T_X + 52} y={394} size={10.5} dim>4 ACPI NVS · 5 bad RAM · unlisted = reserved</Label>
          </Appear>
          <Appear on={s >= 8}>
            <Label x={T_X} y={420} size={12} weight={600}>free RAM = type 1 − kernel − multiboot info</Label>
          </Appear>
        </Scene>
      )}
    </VizStage>
  )
}
