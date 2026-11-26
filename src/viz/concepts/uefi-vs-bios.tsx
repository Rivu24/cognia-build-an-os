/* Legacy BIOS boot vs UEFI boot, stage by stage.
   Sources: OSDev Wiki "UEFI" (UEFI vs. legacy BIOS: platform init, boot mechanism, system discovery, convenience functions;
   binary format PE32/PE32+; BOOTX64.EFI in /EFI/BOOT), "BIOS" (INT 0x10/0x13/0x15), "EFI System Partition",
   "UEFI App Bare Bones" (efi_main(ImageHandle, SystemTable)), "Uefi.inc" (map key for ExitBootServices),
   "GOP" (boot service gone after ExitBootServices, framebuffer stays). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'uefi-vs-bios',
  title: 'Legacy BIOS vs UEFI boot',
  summary: 'The two x86 boot paths side by side: BIOS hands a 512-byte MBR control in 16-bit real mode at 0x7C00; UEFI loads a PE32+ app from a FAT partition in long mode, offers Boot Services, and steps aside at ExitBootServices.',
  lessons: ['t15m2l1', 't15m2l2', 't15m2l3'],
  articles: ['UEFI', 'BIOS'],
  group: 'Platform',
  order: 1521,
}

const steps: VizStep[] = [
  { caption: 'Both firmwares first do the same job: set up RAM, buses and devices.', detail: 'Legacy BIOS and UEFI boards both have firmware in ROM. UEFI does the platform work to a standard, so it can be extended in a vendor-neutral way.' },
  { caption: 'BIOS hands over in 16-bit real mode; UEFI in long mode with paging on.', detail: 'On x86-64, UEFI has already enabled A20 and identity-mapped memory. With BIOS, A20 (test it first), a GDT, protected mode and long mode are your job.' },
  { caption: 'BIOS reads sector 0 of the disk; UEFI reads files from a FAT partition.', detail: 'The BIOS knows no filesystem: it takes 512 raw bytes. UEFI understands FAT and finds the EFI System Partition on a GPT or MBR disk.' },
  { caption: 'BIOS jumps into 512 raw bytes at 0x7C00; UEFI loads a PE32+ program.', detail: 'The default x86-64 file is \\EFI\\BOOT\\BOOTX64.EFI. It can be any size, goes wherever the firmware chooses, and starts at efi_main.', ms: 3800 },
  { caption: 'BIOS services are INT calls; UEFI services are functions in a table.', detail: 'BIOS: set AH, then INT 0x10, 0x13 or 0x15, each with its own register rules. UEFI: protocols found through the System Table, called like C functions.', ms: 3800 },
  { caption: 'Both give you a memory map: INT 0x15 E820, or GetMemoryMap().', detail: 'UEFI also returns a map key. Allocate or free memory after that and the key is stale: fetch the map again.' },
  { caption: 'Hand-off: BIOS loaders switch modes themselves; UEFI loaders call ExitBootServices.', detail: 'After ExitBootServices succeeds, boot services such as file I/O and GOP are gone (the GOP framebuffer stays). Then you jump to your kernel.', ms: 4200 },
]

type Side = [string, string]
const ROWS: { bios: Side; uefi: Side }[] = [
  { bios: ['POST: RAM, PCI, graphics', 'then the legacy boot path'], uefi: ['Platform init (standardized)', 'same work, extensible spec'] },
  { bios: ['Drops to 16-bit real mode', '1 MiB reachable, A20 unknown'], uefi: ['Long mode, paging on', 'identity-mapped, A20 already on'] },
  { bios: ['Reads sector 0 (the MBR)', '512 bytes, ends in 0x55 0xAA'], uefi: ['Reads the EFI System Partition', 'FAT filesystem, GPT or MBR disk'] },
  { bios: ['Copies it to 0x7C00, jumps', 'flat binary, DL = boot drive'], uefi: ['Loads \\EFI\\BOOT\\BOOTX64.EFI', 'PE32+, calls efi_main(Image, ST)'] },
  { bios: ['Services: software interrupts', 'INT 0x10 video, 0x13 disk, 0x15'], uefi: ['Boot Services via System Table', 'protocols: GOP, files, C calls'] },
  { bios: ['Memory map: INT 0x15, E820', 'call again for each entry'], uefi: ['Memory map: GetMemoryMap()', 'returns the map + a map key'] },
  { bios: ['You: A20, GDT, protected mode', 'then jump to the kernel'], uefi: ['ExitBootServices(Image, key)', 'firmware steps aside → kernel'] },
]

const BX = 44
const UX = 416
const LW = 340
const Y0 = 52
const RH = 44
const GAP = 9
const ry = (i: number) => Y0 + i * (RH + GAP)
const rmid = (i: number) => ry(i) + RH / 2

/** A small square cell that can fill (ink) with a delay, or show as hatched (reserved / gone). */
function Cell({ x, y, w, h = 16, label, on = false, hatch = false, dim = false, delay = 0 }: {
  x: number; y: number; w: number; h?: number; label?: string; on?: boolean; hatch?: boolean; dim?: boolean; delay?: number
}) {
  const t = { ...ease, delay }
  return (
    <g>
      <motion.rect x={x} y={y} width={w} height={h} initial={false} transition={t}
        animate={{ fill: on ? 'var(--viz-fg)' : hatch ? 'url(#viz-hatch)' : 'var(--viz-bg)', stroke: dim ? 'var(--viz-faint)' : 'var(--viz-fg)', opacity: dim ? 0.6 : 1 }} />
      {label && (
        <motion.text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" initial={false} transition={t}
          animate={{ fill: on ? 'var(--viz-bg)' : dim ? 'var(--viz-dim)' : 'var(--viz-fg)' }}
          style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
          {label}
        </motion.text>
      )}
    </g>
  )
}

/** Three nodes in a chain with arrows between them and labels underneath. A dot runs through them while live,
    or (with fill) the nodes fill one after another. */
function Chain({ gx, top, names, inside, live, fill }: {
  gx: number; top: number; names: string[]; inside?: string[]; live: boolean; fill?: boolean
}) {
  const cx = (j: number) => gx + j * 34 + 12
  return (
    <g>
      {names.map((n, j) => (
        <g key={n}>
          <Cell x={gx + j * 34} y={top + 8} w={24} label={inside?.[j]} on={!!fill} delay={live ? 0.3 + j * 0.5 : 0} />
          <Label x={cx(j)} y={top + 38} size={10.5} anchor="middle" dim>{n}</Label>
          {j < names.length - 1 && <Wire from={[gx + j * 34 + 24, top + 16]} to={[gx + j * 34 + 33, top + 16]} on width={1.2} />}
        </g>
      ))}
      {fill === undefined && <Packet on={live} r={3.5} duration={1.8} points={names.map((_, j) => [cx(j), top + 16] as [number, number])} />}
    </g>
  )
}

/** The small motion graphic in the empty right part of each row. k = 0 BIOS, 1 UEFI. */
function RowViz({ i, k, s }: { i: number; k: 0 | 1; s: number }) {
  const x = k === 0 ? BX : UX
  const gx = x + LW - 104
  const top = ry(i)
  const live = s === i
  const seen = s >= i
  switch (i) {
    case 0: // same platform work on both sides
      return (
        <g>
          {['RAM', 'PCI', 'GPU'].map((n, j) => (
            <Cell key={n} x={gx + j * 34} y={top + 14} w={28} label={n} on={live} delay={live ? 0.4 + j * 0.4 : 0} />
          ))}
        </g>
      )
    case 1: // register width
      return (
        <g>
          <rect x={x + LW - 92} y={top + 9} width={80} height={12} fill="none" stroke="var(--viz-dim)" />
          <motion.rect x={x + LW - 92} y={top + 9} height={12} fill="var(--viz-fg)" initial={false}
            animate={{ width: seen ? (k === 0 ? 20 : 80) : 0 }} transition={{ ...ease, duration: 1, delay: live ? 0.4 : 0 }} />
          <Label x={x + LW - 12} y={top + 37} size={10.5} anchor="end" dim>{k === 0 ? '16-bit' : '64-bit'}</Label>
        </g>
      )
    case 2: // raw sector vs filesystem
      if (k === 0)
        return (
          <g>
            {[0, 1, 2, 3].map((j) => (
              <Cell key={j} x={gx + j * 24} y={top + 8} w={22} label={j === 0 ? '0' : undefined} on={j === 0 && seen} dim={j > 0} delay={live ? 0.5 : 0} />
            ))}
            <Label x={gx} y={top + 38} size={10.5} dim>raw sector 0</Label>
          </g>
        )
      return (
        <g>
          <Label x={gx} y={top + 14} size={10.5} dim on={seen} delay={live ? 0.3 : 0}>/EFI</Label>
          <Label x={gx + 12} y={top + 26} size={10.5} dim on={seen} delay={live ? 0.7 : 0}>BOOT</Label>
          <Label x={gx + 24} y={top + 38} size={10.5} on={seen} weight={500} delay={live ? 1.1 : 0}>BOOTX64.EFI</Label>
          <motion.path d={`M${gx + 4} ${top + 17} L${gx + 4} ${top + 23} L${gx + 10} ${top + 23} M${gx + 16} ${top + 29} L${gx + 16} ${top + 35} L${gx + 22} ${top + 35}`}
            fill="none" stroke="var(--viz-dim)" initial={false} animate={{ pathLength: seen ? 1 : 0 }} transition={{ ...ease, delay: live ? 0.5 : 0 }} />
        </g>
      )
    case 3: // what gets loaded
      if (k === 0)
        return (
          <g>
            <Cell x={gx} y={top + 8} w={30} label="MBR" />
            <Wire from={[gx + 30, top + 16]} to={[gx + 56, top + 16]} on={seen} width={1.2} />
            <Cell x={gx + 58} y={top + 8} w={36} label="7C00" on={seen} delay={live ? 1 : 0} />
            <Packet on={live} r={3.5} duration={1.6} points={[[gx + 32, top + 16], [gx + 54, top + 16]]} />
            <Label x={gx} y={top + 38} size={10.5} dim>512 B, flat</Label>
          </g>
        )
      return (
        <g>
          {([['hdr', 24], ['.text', 36], ['.data', 34]] as const).map(([n, w], j, a) => {
            const off = a.slice(0, j).reduce((sum, e) => sum + e[1], 0)
            return (
              <Appear key={n} on={seen} dx={-6} dy={0} delay={live ? 0.3 + j * 0.35 : 0}>
                <Cell x={gx + off} y={top + 8} w={w} label={n} />
              </Appear>
            )
          })}
          <Label x={gx} y={top + 38} size={10.5} dim>PE32+, any size</Label>
        </g>
      )
    case 4: // INT through the IVT vs a call through the System Table
      return k === 0
        ? <Chain gx={gx} top={top} names={['INT', 'IVT', 'ROM']} live={live} />
        : <Chain gx={gx} top={top} names={['ST', 'BS', 'fn()']} live={live} />
    case 5: { // memory map: one entry per call vs the whole map + key
      const segs: [number, boolean][] = [[28, false], [14, true], [22, false], [12, true], [18, false]]
      let off = 0
      return (
        <g>
          {segs.map(([w, rsv], j) => {
            const el = (
              <Appear key={j} on={seen} dy={0} delay={live ? (k === 0 ? 0.4 + j * 0.45 : 0.5) : 0}>
                <Cell x={gx + off} y={top + 10} w={w} h={14} hatch={rsv} />
              </Appear>
            )
            off += w
            return el
          })}
          <Label x={gx} y={top + 38} size={10.5} dim on={seen} delay={live ? (k === 0 ? 0.4 : 1) : 0}>{k === 0 ? '1 entry/call' : 'whole map+key'}</Label>
        </g>
      )
    }
    case 6: // hand-off
      if (k === 0)
        return <Chain gx={gx} top={top} names={['real', 'prot', 'long']} inside={['16', '32', '64']} live={live} fill={seen} />
      return (
        <g>
          <motion.g initial={false} animate={{ opacity: seen ? 0.5 : 1 }} transition={{ ...ease, delay: live ? 0.9 : 0 }}>
            <Cell x={gx - 4} y={top + 8} w={42} h={18} label="boot" hatch={seen} dim={seen} delay={live ? 0.9 : 0} />
          </motion.g>
          <Cell x={gx + 44} y={top + 8} w={52} h={18} label="runtime" />
          <Label x={gx + 17} y={top + 39} size={10.5} anchor="middle" dim on={seen} delay={live ? 1.1 : 0}>gone</Label>
          <Label x={gx + 70} y={top + 39} size={10.5} anchor="middle" on={seen} delay={live ? 1.1 : 0}>stay</Label>
        </g>
      )
    default:
      return null
  }
}

export default function UefiVsBios() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => (
        <Scene label={meta.summary}>
          {/* headers */}
          <Label x={BX} y={36} size={12} weight={500}>LEGACY BIOS</Label>
          <Label x={BX + LW} y={36} size={10.5} anchor="end" dim>real mode · MBR · INT calls</Label>
          <Label x={UX} y={36} size={12} weight={500}>UEFI</Label>
          <Label x={UX + LW} y={36} size={10.5} anchor="end" dim>long mode · FAT ESP · PE32+</Label>

          {/* rails: control flows down each side to the current stage */}
          <line x1={BX - 12} x2={BX - 12} y1={Y0} y2={ry(6) + RH} stroke="var(--viz-faint)" />
          <line x1={UX + LW + 12} x2={UX + LW + 12} y1={Y0} y2={ry(6) + RH} stroke="var(--viz-faint)" />
          <Wire d={`M${BX - 12} ${Y0} L${BX - 12} ${rmid(s)}`} on arrow={false} width={2} />
          <Wire d={`M${UX + LW + 12} ${Y0} L${UX + LW + 12} ${rmid(s)}`} on arrow={false} width={2} />
          <Packet points={[[BX - 12, s === 0 ? Y0 : rmid(s - 1)], [BX - 12, rmid(s)], [BX + 4, rmid(s)]]} duration={1.4} />
          <Packet points={[[UX + LW + 12, s === 0 ? Y0 : rmid(s - 1)], [UX + LW + 12, rmid(s)], [UX + LW - 4, rmid(s)]]} duration={1.4} />

          {ROWS.map((r, i) => {
            const st = i === s ? 'on' : 'off'
            return (
              <Appear key={i} on={i <= s} dy={10}>
                <motion.g initial={false} animate={{ opacity: i === s ? 1 : 0.55 }} transition={ease}>
                  <Block x={BX} y={ry(i)} w={LW} h={RH} label={r.bios[0]} sub={r.bios[1]} align="start" size={13} state={st} />
                  <Block x={UX} y={ry(i)} w={LW} h={RH} label={r.uefi[0]} sub={r.uefi[1]} align="start" size={13} state={st} />
                  <RowViz i={i} k={0} s={s} />
                  <RowViz i={i} k={1} s={s} />
                </motion.g>
              </Appear>
            )
          })}

          {/* stage numbers between the lanes */}
          <line x1={400} x2={400} y1={Y0} y2={ry(6) + RH} stroke="var(--viz-faint)" strokeDasharray="2 4" />
          {ROWS.map((_, i) => (
            <Block key={i} x={389} y={rmid(i) - 11} w={22} h={22} label={`${i + 1}`} mono size={11} state={i === s ? 'fill' : i < s ? 'off' : 'dim'} />
          ))}

          {/* stage 7: what is left after the hand-off */}
          <Appear on={s === 6} delay={s === 6 ? 0.6 : 0}>
            <Label x={UX + LW - 12} y={ry(6) + RH + 18} size={10.5} anchor="end">the GOP framebuffer stays usable</Label>
            <Label x={BX} y={ry(6) + RH + 18} size={10.5}>BIOS INT calls need real mode (or VM86)</Label>
          </Appear>
        </Scene>
      )}
    </VizStage>
  )
}
