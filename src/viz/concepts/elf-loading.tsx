/* Loading a static 32-bit ELF executable.
   Check the magic, read e_entry / e_phoff from the header, walk the program headers, and for every PT_LOAD
   map pages at p_vaddr, copy p_filesz bytes from p_offset and zero the rest up to p_memsz (.bss).
   Then map a user stack and iret to e_entry in ring 3. Worked example values are self-consistent. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'elf-loading',
  title: 'Loading an ELF program',
  summary: 'The loader checks the ELF magic, reads e_entry and the program headers, copies each PT_LOAD segment to p_vaddr, zeroes .bss up to p_memsz, maps a stack and jumps to e_entry in ring 3.',
  lessons: ['t8m2l2', 't8m2l3', 'p5l3'],
  articles: ['ELF', 'ELF Tutorial', 'Loading a Process'],
  group: 'User space',
  order: 825,
}

const steps: VizStep[] = [
  { caption: 'A program on disk is an ELF file. The loader reads it from offset 0.', detail: 'The ELF header is always at the very start. Everything else is found through offsets stored in it.' },
  { caption: 'Check the magic: 0x7F "E" "L" "F". Class 1 = 32-bit, data 1 = little endian.', detail: 'If the first four bytes do not match, it is not an ELF file: refuse it. Also check machine = 3 (x86) and type = 2 (executable).' },
  { caption: 'The header says where to start and where the program headers are.', detail: 'e_entry (bytes 24-27) = 0x08048080. e_phoff (bytes 28-31) = 0x34. e_phnum = 2 entries of 32 bytes each.' },
  { caption: 'Walk the program headers. Only PT_LOAD (type 1) segments get loaded.', detail: 'Each one says: reserve p_memsz bytes at virtual address p_vaddr, and copy p_filesz bytes into it from file offset p_offset.' },
  { caption: 'Segment #0: map pages at 0x08048000 as r-x, copy 0x200 bytes from offset 0.', detail: 'This segment starts at file offset 0, so the ELF header is mapped too. The pages are user-accessible and read-only.', ms: 3800 },
  { caption: 'Segment #1: map 0x08049000 as rw-, copy p_filesz = 0x100 bytes from offset 0x1000.', detail: 'This is .data: global variables that start with a value, like int x = 5.', ms: 3800 },
  { caption: 'p_memsz = 0x400 is bigger than p_filesz: zero the other 0x300 bytes. That is .bss.', detail: 'Globals without a value are not stored in the file at all. If the loader forgets to clear them, the program starts with garbage.', ms: 4000 },
  { caption: 'Map a user stack below the kernel. Its top, 0xBFFFF000, becomes the user ESP.', detail: 'The stack grows down, toward the program. The kernel lives above 0xC0000000 in this layout.' },
  { caption: 'Jump to e_entry in ring 3: iret with CS = 0x1B and EIP = 0x08048080.', detail: 'The same iret frame as in Getting to Ring 3: SS = 0x23, ESP = 0xBFFFF000, EFLAGS = 0x202, CS = 0x1B, EIP = e_entry.', ms: 4200 },
]

const FILE: { label: string; sub?: string; y: number; h: number; hatch?: boolean }[] = [
  { label: 'ELF header', sub: '0x0000', y: 48, h: 40 },
  { label: 'program headers', sub: '0x0034', y: 88, h: 36 },
  { label: 'code (.text)', sub: '0x0074', y: 124, h: 62 },
  { label: '', y: 186, h: 26, hatch: true },
  { label: 'data (.data)', sub: '0x1000', y: 212, h: 46 },
  { label: 'section headers', sub: 'not needed to run', y: 258, h: 40 },
]
const MAGIC = ['7F', '45', '4C', '46', '01', '01', '01', '00']
const FIELDS = ['e_type    = 2  (executable)', 'e_machine = 3  (x86)', 'e_entry   = 0x08048080', 'e_phoff   = 0x34', 'e_phnum   = 2']
const PHDR = [
  ['#0  PT_LOAD   flags R-X', 'offset 0x0000 → vaddr 0x08048000', 'filesz 0x200    memsz 0x200'],
  ['#1  PT_LOAD   flags RW-', 'offset 0x1000 → vaddr 0x08049000', 'filesz 0x100    memsz 0x400'],
]
const NOTES = [
  'file layout: header · program headers · code · data · section headers',
  'e_ident[0..3] = 7F 45 4C 46 · [4] class · [5] data · [6] version',
  'a loader only needs the program headers; section headers are for linkers',
  'p_type 1 = PT_LOAD · flags: 1 = execute, 2 = write, 4 = read',
  'memcpy(0x08048000, file + 0x0000, 0x200)',
  'memcpy(0x08049000, file + 0x1000, 0x100)',
  'memset(0x08049100, 0, 0x300)      // p_memsz - p_filesz',
  'map pages below 0xBFFFF000 (U, W) · ESP = 0xBFFFF000',
  'iret → CPL 3 · EIP = 0x08048080: the program is running',
]

const FX = 40 // file x
const FW = 180
const MX = 240 // middle x
const MW = 296
const VX = 560 // virtual memory x
const VW = 216

/** Data or control moving along a polyline; fades out on arrival, then repeats. */
function Flow({ pts, on, label, delay = 0, duration = 1.8 }: { pts: [number, number][]; on: boolean; label?: string; delay?: number; duration?: number }) {
  if (!on) return null
  const xs = [pts[0][0], ...pts.map((p) => p[0]), pts[pts.length - 1][0]]
  const ys = [pts[0][1], ...pts.map((p) => p[1]), pts[pts.length - 1][1]]
  const n = xs.length
  const times = xs.map((_, i) => (i === 0 ? 0 : i === n - 1 ? 1 : 0.08 + ((i - 1) / (n - 3)) * 0.82))
  const op = xs.map((_, i) => (i === 0 || i === n - 1 ? 0 : 1))
  return (
    <motion.g initial={{ x: xs[0], y: ys[0], opacity: 0 }} animate={{ x: xs, y: ys, opacity: op }}
      transition={{ duration, times, delay, repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}>
      <circle r={5} fill="var(--viz-fg)" filter="url(#viz-glow)" />
      {label && <text x={9} y={-7} fill="var(--viz-fg)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{label}</text>}
    </motion.g>
  )
}

/** Dotted guide showing the route data takes (file → memory), drawn under the moving dot. */
function Route({ pts, on }: { pts: [number, number][]; on: boolean }) {
  return (
    <motion.polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--viz-dim)" strokeWidth={1} strokeDasharray="2 4"
      initial={false} animate={{ opacity: on ? 1 : 0 }} transition={ease} />
  )
}

export default function ElfLoading() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const fileState = (i: number) => {
          if (i === 3) return 'hatch' as const
          if (s === 0) return 'off' as const
          if (s === 1 || s === 2) return i === 0 ? 'on' : 'dim'
          if (s === 3) return i === 1 ? 'on' : 'dim'
          if (s === 4) return i <= 2 ? 'on' : 'dim'
          if (s === 5) return i === 4 ? 'on' : 'dim'
          return i === 5 ? 'dim' : 'off'
        }
        const routeText: [number, number][] = [[FX + FW, 155], [230, 155], [230, 352], [548, 352], [548, 282], [VX, 282]]
        const routeData: [number, number][] = [[FX + FW, 235], [230, 235], [230, 352], [548, 352], [548, 228], [VX, 228]]
        return (
          <Scene label={meta.summary}>
            {/* ELF file on disk */}
            <Label x={FX} y={38} size={11} dim>ELF FILE ON DISK</Label>
            {FILE.map((r, i) => (
              <Block key={i} x={FX} y={r.y} w={FW} h={r.h} label={r.label || undefined} sub={r.sub} size={12} state={fileState(i)} />
            ))}

            {/* middle: what the loader reads */}
            <Appear on={s >= 1}>
              <Label x={MX} y={38} size={11} dim>e_ident (BYTES 0-7)</Label>
              {MAGIC.map((b, i) => (
                <Block key={i} x={MX + i * 37} y={46} w={37} h={28} label={b} mono size={12}
                  state={s === 1 ? (i < 4 ? 'fill' : i < 7 ? 'on' : 'off') : 'off'} />
              ))}
              <Label x={MX + 74} y={92} size={10.5} anchor="middle" dim={s !== 1}>0x7F 'E' 'L' 'F'</Label>
              <Label x={MX + 203} y={92} size={10.5} anchor="middle" dim={s !== 1}>32-bit · LE · v1</Label>
            </Appear>

            <Appear on={s >= 2}>
              {FIELDS.map((f, i) => (
                <Block key={i} x={MX} y={104 + i * 21} w={MW} h={21} label={f} mono size={11} align="start"
                  state={s === 2 && i >= 2 ? 'on' : s === 8 && i === 2 ? 'on' : s === 2 ? 'off' : 'dim'} />
              ))}
            </Appear>

            <Appear on={s >= 3}>
              {PHDR.map((p, i) => {
                const y = 222 + i * 62
                const on = s === 3 || (s === 4 && i === 0) || ((s === 5 || s === 6) && i === 1)
                return (
                  <g key={i}>
                    <Block x={MX} y={y} w={MW} h={58} state={on ? 'on' : s >= 7 ? 'dim' : 'off'} />
                    <Label x={MX + 12} y={y + 18} size={11.5} weight={500}>{p[0]}</Label>
                    <Label x={MX + 12} y={y + 35} size={11}>{p[1]}</Label>
                    <Label x={MX + 12} y={y + 51} size={11} dim={!(s === 6 && i === 1)}>{p[2]}</Label>
                  </g>
                )
              })}
            </Appear>

            {/* process address space (top = high addresses) */}
            <Label x={VX} y={38} size={11} dim>PROCESS ADDRESS SPACE</Label>
            <Block x={VX} y={48} w={VW} h={28} label="kernel (0xC0000000 and up)" size={11} state="hatch" />
            <rect x={VX} y={76} width={VW} height={236} fill="none" stroke="var(--viz-faint)" strokeDasharray="3 4" />
            <Appear on={s >= 7} dy={-10}>
              <Block x={VX} y={76} w={VW} h={44} label="user stack ↓" sub="top 0xBFFFF000" size={12} state={s === 7 ? 'on' : 'off'} />
            </Appear>
            <Appear on={s >= 6} dx={-10} dy={0}>
              <Block x={VX} y={168} w={VW} h={40} state={s === 6 ? 'on' : 'off'} />
              <motion.rect x={VX + 1} y={169} width={VW - 2} height={38} fill="var(--viz-faint)" initial={false}
                animate={{ scaleX: s >= 6 ? 1 : 0 }} transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.3 }} style={{ originX: 0, transformBox: 'fill-box' }} />
              <Label x={VX + 10} y={185} size={12} weight={500}>.bss = 00 00 00 …</Label>
              <Label x={VX + 10} y={200} size={10.5} dim>0x08049100 · 0x300 zero bytes</Label>
            </Appear>
            <Appear on={s >= 5} dx={-10} dy={0}>
              <Block x={VX} y={208} w={VW} h={40} state={s === 5 ? 'on' : 'off'} />
              <Label x={VX + 10} y={225} size={12} weight={500}>.data  rw-</Label>
              <Label x={VX + 10} y={240} size={10.5} dim>0x08049000 · 0x100 from file</Label>
            </Appear>
            <Appear on={s >= 4} dx={-10} dy={0}>
              <Block x={VX} y={248} w={VW} h={64} state={s === 4 || s === 8 ? 'on' : 'off'} />
              <Label x={VX + 10} y={268} size={12} weight={500}>header + .text  r-x</Label>
              <Label x={VX + 10} y={284} size={10.5} dim>0x08048000 · 0x200 from file</Label>
              <Label x={VX + 10} y={303} size={10.5} weight={500} on={s === 8}>← e_entry = 0x08048080</Label>
            </Appear>
            <Block x={VX} y={312} w={VW} h={26} label="unmapped (catches NULL)" size={11} state="hatch" />

            {/* routes and moving data */}
            <Flow on={s === 0} pts={[[230, 50], [230, 296]]} duration={2.4} />
            <Label x={MX + MW / 2 + 2} y={190} size={12} anchor="middle" on={s === 0}>the loader turns this file</Label>
            <Label x={MX + MW / 2 + 2} y={208} size={12} anchor="middle" on={s === 0}>into a running process →</Label>
            <Route pts={[[FX + FW, 68], [MX, 150]]} on={s === 2} />
            <Flow on={s === 2} pts={[[FX + FW, 68], [MX, 150]]} duration={1.2} />
            <Route pts={[[FX + FW, 106], [230, 106], [230, 250], [MX, 250]]} on={s === 3} />
            <Flow on={s === 3} pts={[[FX + FW, 106], [230, 106], [230, 250], [MX, 250]]} duration={1.4} />
            <Route pts={routeText} on={s === 4} />
            <Flow on={s === 4} pts={routeText} duration={2.2} />
            <Route pts={routeData} on={s === 5} />
            <Flow on={s === 5} pts={routeData} duration={2.2} />
            <Route pts={[[MX + MW, 156], [548, 156], [548, 299], [VX, 299]]} on={s === 8} />
            <Flow on={s === 8} pts={[[MX + MW, 156], [548, 156], [548, 299], [VX, 299]]} duration={1.6} />
            <Pulse x={VX + 196} y={98} on={s === 7} r={14} />

            {/* one-line explanation */}
            <Block x={24} y={366} w={752} h={56} state={s === 8 ? 'on' : 'off'} />
            <motion.g key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={ease}>
              <text x={40} y={399} fill="var(--viz-fg)" style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)' }}>{NOTES[s]}</text>
            </motion.g>
            <Label x={760} y={399} size={12} anchor="end" weight={500} on={s === 8}>CPL 3</Label>
          </Scene>
        )
      }}
    </VizStage>
  )
}
