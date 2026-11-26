/* The x86 real mode memory map (first MiB) and the extended memory above it.
   Sources: OSDev Wiki "Memory Map (x86)" (overview table, BDA fields, EBDA rules, extended memory table),
   "Interrupt Vector Table" (256 x 4 bytes, segment:offset), "Printing To Screen" (0xB8000, char + attribute). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, BitField } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'x86-low-memory-map',
  title: 'The first MiB of an x86 PC',
  summary: 'A walk up the real mode memory map: IVT, BDA, free conventional memory, the boot sector at 0x7C00, EBDA, video memory at 0xA0000 (text at 0xB8000), the ROM area, and extended memory from 0x100000 where your kernel goes.',
  lessons: ['t6m1l1', 't1m2l3'],
  articles: ['Memory Map (x86)'],
  group: 'Memory',
  order: 611,
}

const steps: VizStep[] = [
  { caption: 'Real mode can address 1 MiB. This is what fills it when the BIOS hands over.', detail: '640 KiB of low memory (RAM) at the bottom, 384 KiB of upper memory reserved for video and ROMs above it. Not to scale.' },
  { caption: '0x00000–0x003FF: the IVT, 256 interrupt vectors of 4 bytes each.', detail: 'Each entry is the segment:offset of a handler. INT 0x10 reads entry 0x10 × 4 = 0x40 and jumps into the video BIOS. Keep it intact in real mode.', ms: 4000 },
  { caption: '0x00400–0x004FF: the BIOS Data Area, the BIOS’s own variables.', detail: 'Serial and parallel port numbers, low memory size, display mode. IRQ0 rewrites the tick count at 0x46C about 18 times a second: do not store data here.' },
  { caption: '0x00500–0x7FFFF is free conventional memory: about 510 KiB.', detail: 'Two free runs: 0x00500–0x07BFF (29.75 KiB) and 0x07E00–0x7FFFF (480.5 KiB). Stacks, a stage-2 loader and disk buffers go here.' },
  { caption: 'Inside it, 0x07C00–0x07DFF holds the 512-byte boot sector now running.', detail: 'The BIOS put it there. Treat it as in use until execution has moved on to a second stage or to the kernel.' },
  { caption: 'The EBDA sits right below 0xA0000. Never overwrite it.', detail: 'Its size varies (at most 128 KiB). The BDA word at 0x413 holds KiB of usable low memory: 639 → 639 × 1024 = 0x9FC00 is where the EBDA starts.', ms: 4000 },
  { caption: '0xA0000–0xBFFFF is video memory, not RAM. Colour text mode is at 0xB8000.', detail: 'Two bytes per character: the ASCII code, then an attribute. Writing 0x48 (H), 0x07 to 0xB8000 puts a light grey H in the top-left corner.', ms: 4000 },
  { caption: '0xC0000–0xFFFFF holds ROMs: video BIOS, expansion ROMs, motherboard BIOS.', detail: 'Mapped from hardware or shadowed and set read-only by the BIOS. It is not RAM you can use.' },
  { caption: 'From 0x100000 (1 MiB) up is extended memory. GRUB loads your kernel here.', detail: 'It has holes and reserved ranges, so ask for a map: INT 15h, EAX=0xE820, or the Multiboot map from GRUB. Bare Bones links the kernel at 2 MiB.', ms: 4200 },
]

type St = 'on' | 'off' | 'dim' | 'fill' | 'hatch'
type Row = { label: string; y: number; h: number; base: St; addr?: string; focus: number[] }
const MX = 130
const MW = 230
// top (high addresses) to bottom (0); addr = start address, drawn at the row's bottom edge
const ROWS: Row[] = [
  { label: 'extended memory', y: 34, h: 56, base: 'off', addr: '0x100000', focus: [8] },
  { label: 'motherboard BIOS', y: 90, h: 26, base: 'hatch', addr: '0xF0000', focus: [7] },
  { label: 'BIOS expansions', y: 116, h: 26, base: 'hatch', addr: '0xC8000', focus: [7] },
  { label: 'video BIOS', y: 142, h: 22, base: 'hatch', addr: '0xC0000', focus: [7] },
  { label: 'video memory', y: 164, h: 44, base: 'hatch', addr: '0xA0000', focus: [6] },
  { label: 'EBDA', y: 208, h: 34, base: 'off', addr: '0x80000', focus: [5] },
  { label: 'free', y: 242, h: 60, base: 'off', addr: '0x07E00', focus: [3] },
  { label: 'boot sector', y: 302, h: 28, base: 'off', addr: '0x07C00', focus: [4] },
  { label: 'free', y: 330, h: 36, base: 'off', addr: '0x00500', focus: [3] },
  { label: 'BDA', y: 366, h: 26, base: 'off', addr: '0x00400', focus: [2] },
  { label: 'IVT', y: 392, h: 30, base: 'off', addr: '0x00000', focus: [1] },
]
const mid = (i: number) => ROWS[i].y + ROWS[i].h / 2

const PX = 470 // detail panel x
const HEAD: [string, string, string][] = [
  ['THE FIRST MiB', '0x00000 – 0xFFFFF', '1 MiB = 2^20 bytes: all real mode can address'],
  ['INTERRUPT VECTOR TABLE', '0x00000 – 0x003FF', '1 KiB = 256 vectors × 4 bytes'],
  ['BIOS DATA AREA', '0x00400 – 0x004FF', '256 bytes, partly standardized'],
  ['CONVENTIONAL MEMORY', '0x00500 – 0x7FFFF', 'usable RAM (minus the boot sector)'],
  ['YOUR BOOT SECTOR', '0x07C00 – 0x07DFF', '512 bytes, loaded by the BIOS'],
  ['EXTENDED BIOS DATA AREA', '0x80000 – 0x9FFFF', 'up to 128 KiB, size varies'],
  ['VIDEO MEMORY', '0xA0000 – 0xBFFFF', '128 KiB, hardware mapped'],
  ['ROM AREA', '0xC0000 – 0xFFFFF', '256 KiB of ROM and shadow RAM'],
  ['EXTENDED MEMORY', '0x100000 and up', 'not standardized, not contiguous'],
]

function Lines({ rows, y0 = 136, gap = 24, on, size = 12 }: { rows: [string, string][]; y0?: number; gap?: number; on: boolean; size?: number }) {
  return (
    <>
      {rows.map(([a, b], i) => (
        <g key={a + b}>
          <Label x={PX} y={y0 + i * gap} size={size} on={on} delay={on ? 0.15 + i * 0.12 : 0}>{a}</Label>
          <Label x={PX + 92} y={y0 + i * gap} size={size} on={on} delay={on ? 0.15 + i * 0.12 : 0} dim>{b}</Label>
        </g>
      ))}
    </>
  )
}

export default function X86LowMemoryMap() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => (
        <Scene label={meta.summary}>
          {/* ===== the map ===== */}
          <Label x={MX} y={24} size={10.5} dim>PHYSICAL MEMORY (NOT TO SCALE)</Label>
          {ROWS.map((r, i) => {
            const active = r.focus.includes(s)
            return (
              <motion.g key={i} initial={false} animate={{ opacity: s === 0 || active ? 1 : 0.5 }} transition={{ duration: 0.5 }}>
                <Block x={MX} y={r.y} w={MW} h={r.h} label={r.label} size={r.h < 26 ? 11 : 12} state={active ? 'on' : r.base} />
              </motion.g>
            )
          })}
          {ROWS.map((r, i) => (
            <Label key={`a${i}`} x={MX - 8} y={r.y + r.h + 4} size={10} anchor="end" dim={!(r.focus.includes(s) || (i < ROWS.length - 1 && ROWS[i + 1].focus.includes(s)))}>{r.addr}</Label>
          ))}
          {/* text mode marker inside video memory: 0xB8000 is 3/4 of the way up 0xA0000-0xBFFFF */}
          <Appear on={s === 6} dy={0}>
            <line x1={MX + 150} x2={MX + MW} y1={175} y2={175} stroke="var(--viz-fg)" strokeDasharray="3 3" />
            <Label x={MX + MW + 14} y={188} size={10.5}>0xB8000</Label>
          </Appear>

          {/* braces: low and upper memory (explained in step 0 only; hidden later so packets and labels do not collide) */}
          <motion.g initial={false} animate={{ opacity: s === 0 ? 1 : 0 }} transition={{ duration: 0.4 }}>
            <line x1={MX + MW + 8} x2={MX + MW + 8} y1={210} y2={420} stroke="var(--viz-dim)" />
            <line x1={MX + MW + 8} x2={MX + MW + 8} y1={92} y2={206} stroke="var(--viz-dim)" />
            <Label x={MX + MW + 14} y={312} size={10.5} dim>640 KiB</Label>
            <Label x={MX + MW + 14} y={326} size={10.5} dim>low</Label>
            <Label x={MX + MW + 14} y={104} size={10.5} dim>384 KiB</Label>
            <Label x={MX + MW + 14} y={118} size={10.5} dim>upper</Label>
          </motion.g>

          {/* ===== detail panel header ===== */}
          {HEAD.map(([t, range, sub], i) => (
            <Appear key={t} on={s === i} dx={12} dy={0}>
              <Label x={PX} y={50} size={10.5} dim>{t}</Label>
              <Label x={PX} y={78} size={17} weight={500}>{range}</Label>
              <Label x={PX} y={100} size={11.5} dim>{sub}</Label>
            </Appear>
          ))}

          {/* step 0: proportions + legend */}
          <Appear on={s === 0}>
            <Block x={PX} y={130} w={190} h={40} label="640 KiB RAM" size={12} />
            <Block x={PX + 190} y={130} w={114} h={40} label="384 KiB" size={12} state="hatch" />
            <Label x={PX} y={188} size={10.5} dim>low memory</Label>
            <Label x={PX + 190} y={188} size={10.5} dim>upper memory</Label>
            <Block x={PX} y={230} w={22} h={16} />
            <Label x={PX + 32} y={243} size={11.5}>RAM (some of it in use)</Label>
            <Block x={PX} y={260} w={22} h={16} state="hatch" />
            <Label x={PX + 32} y={273} size={11.5}>hardware mapped / ROM</Label>
            <Label x={PX} y={318} size={11.5} dim>the map is read bottom to top:</Label>
            <Label x={PX} y={336} size={11.5} dim>address 0 is at the bottom</Label>
          </Appear>

          {/* step 1: IVT */}
          <Appear on={s === 1}>
            <Lines on={s === 1} rows={[['INT 0x00', '@ 0x0000 divide by 0'], ['INT 0x02', '@ 0x0008 NMI'], ['INT 0x03', '@ 0x000C breakpoint'], ['INT 0x10', '@ 0x0040 BIOS video'], ['INT 0xFF', '@ 0x03FC last vector']]} />
            <Label x={PX} y={272} size={10.5} dim>ONE ENTRY (4 BYTES)</Label>
            <BitField x={PX} y={284} cellW={70} h={30} bits={['seg', 'seg', 'off', 'off']} fields={[[0, 2, 'segment: bytes 2–3'], [2, 2, 'offset: bytes 0–1']]} active={0} showIndex={false} />
            <Label x={PX} y={372} size={11.5}>handler = segment × 16 + offset</Label>
          </Appear>
          <Pulse x={PX + 30} y={208} on={s === 1} r={12} />
          <Wire d={`M${MX + MW} ${mid(10)} L445 ${mid(10)} L445 ${mid(3)} L${MX + MW + 2} ${mid(3)}`} on={s === 1} dashed dim />
          <Packet on={s === 1} points={[[MX + MW, mid(10)], [445, mid(10)], [445, mid(3)], [MX + MW, mid(3)]]} duration={2.2} label="INT 0x10" />

          {/* step 2: BDA */}
          <Appear on={s === 2}>
            <Lines on={s === 2} rows={[['0x0400', 'COM1–COM4 I/O ports'], ['0x0408', 'LPT1–LPT3 I/O ports'], ['0x040E', 'EBDA base >> 4 (usually)'], ['0x0413', 'KiB before the EBDA'], ['0x0449', 'display mode'], ['0x046C', 'IRQ0 timer ticks']]} />
            <Label x={PX} y={300} size={11.5}>the BIOS updates these all the time</Label>
          </Appear>
          <motion.rect x={PX - 6} y={136 + 5 * 24 - 16} width={300} height={22} fill="none" stroke="var(--viz-fg)" initial={false}
            animate={{ opacity: s === 2 ? [0.2, 1, 0.2] : 0 }} transition={s === 2 ? { duration: 1.1, repeat: Infinity } : { duration: 0.3 }} />

          {/* step 3: conventional memory */}
          <Appear on={s === 3}>
            <Lines on={s === 3} rows={[['0x00500', '– 0x07BFF  29.75 KiB'], ['0x07E00', '– 0x7FFFF  480.5 KiB']]} />
            <Label x={PX} y={210} size={11.5}>yours to use in real mode:</Label>
            <Label x={PX} y={230} size={11.5}>stack, stage 2, disk buffers</Label>
            <Label x={PX} y={268} size={11} dim>leave real mode for good and</Label>
            <Label x={PX} y={286} size={11} dim>0x0–0x4FF can be reused too</Label>
          </Appear>

          {/* step 4: boot sector */}
          <Appear on={s === 4}>
            <Block x={PX} y={130} w={300} h={44} label="0x7C00: your code, running now" size={12.5} state="on" />
            <Label x={PX} y={206} size={12}>[ORG 0x7C00] in your assembly</Label>
            <Label x={PX} y={226} size={12}>makes labels match this address</Label>
            <Label x={PX} y={264} size={11} dim>ends at 0x7DFF: 0x7C00 + 512 − 1</Label>
          </Appear>

          {/* step 5: EBDA */}
          <Appear on={s === 5}>
            <Lines on={s === 5} gap={26} rows={[['read', 'word at 0x413 = 639'], ['× 1024', '639 × 1024 = 654336'], ['= hex', '0x9FC00']]} />
            <Block x={PX} y={226} w={300} h={40} label="EBDA: 0x9FC00 – 0x9FFFF (1 KiB)" size={12} state="on" />
            <Label x={PX} y={292} size={11} dim>older PCs: 1 KiB; newer firmware: more</Label>
            <Label x={PX} y={312} size={11} dim>or ask INT 0x12 (AX = KiB)</Label>
          </Appear>
          <Wire d={`M${MX + MW} ${mid(9)} L445 ${mid(9)} L445 ${mid(5)} L${MX + MW + 2} ${mid(5)}`} on={s === 5} dashed dim />
          <Packet on={s === 5} points={[[MX + MW, mid(9)], [445, mid(9)], [445, mid(5)], [MX + MW, mid(5)]]} duration={2} label="0x413" />

          {/* step 6: text mode */}
          <Appear on={s === 6}>
            <Label x={PX} y={130} size={10.5} dim>80 × 25 TEXT SCREEN</Label>
            <Block x={PX} y={138} w={300} h={130} />
            {Array.from({ length: 10 }).map((_, i) => (
              <line key={i} x1={PX + 30 + i * 27} x2={PX + 30 + i * 27} y1={139} y2={267} stroke="var(--viz-faint)" strokeOpacity={0.5} />
            ))}
            <Label x={PX + 8} y={164} size={18} weight={500} delay={0.9} on={s === 6}>H</Label>
            <Label x={PX + 35} y={164} size={18} weight={500} delay={1.4} on={s === 6}>i</Label>
            <BitField x={PX} y={296} cellW={75} h={28} bits={["'H'", '0x07', "'i'", '0x07']} fields={[[0, 2, '0xB8000'], [2, 2, '0xB8002']]} active={0} showIndex={false} />
            <Label x={PX} y={386} size={11} dim>byte 1: ASCII code · byte 2: attribute</Label>
          </Appear>
          <Packet on={s === 6} points={[[MX + MW, 175], [PX - 20, 175], [PX - 20, 160], [PX + 14, 160]]} duration={1.6} label="0x48" />

          {/* step 7: ROMs */}
          <Appear on={s === 7}>
            <Lines on={s === 7} rows={[['0xC0000', 'video BIOS (32 KiB)'], ['0xC8000', 'expansion ROMs (160 KiB)'], ['0xF0000', 'motherboard BIOS (64 KiB)']]} />
            <Label x={PX} y={232} size={11.5}>reads return ROM contents,</Label>
            <Label x={PX} y={250} size={11.5}>writes do not stick</Label>
            <Label x={PX} y={288} size={11} dim>sizes of the first two are typical,</Label>
            <Label x={PX} y={306} size={11} dim>not fixed</Label>
          </Appear>

          <Packet on={s === 7} points={[[PX - 4, 344], [445, 344], [445, mid(1)], [MX + MW + 4, mid(1)], [445, mid(1)]]} duration={2.4} label="write?" />

          {/* step 8: extended memory */}
          <Appear on={s === 8}>
            <Lines on={s === 8} size={11} gap={22} rows={[['0x00100000', '  RAM, free if it exists'], ['0x00F00000', '  maybe ISA hole (1 MiB)'], ['0x01000000', '  more RAM'], ['0xC0000000', '  often PCI, APICs, BIOS']]} />
            <Block x={PX} y={238} w={300} h={44} label="kernel.elf" sub="Bare Bones: linked at 2 MiB" size={13} state="fill" />
            <Label x={PX} y={312} size={11.5}>get the real layout from</Label>
            <Label x={PX} y={330} size={11.5}>INT 15h, EAX = 0xE820</Label>
            <Label x={PX} y={348} size={11.5}>or GRUB’s Multiboot memory map</Label>
          </Appear>
          <Packet on={s === 8} points={[[PX, 260], [MX + MW + 40, 260], [MX + MW + 40, 62], [MX + MW, 62]]} duration={2} label="load" />
          <Pulse x={MX + MW / 2} y={62} on={s === 8} r={18} />
        </Scene>
      )}
    </VizStage>
  )
}
