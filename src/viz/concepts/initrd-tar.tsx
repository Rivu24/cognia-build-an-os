/* initrd-tar: GRUB loads a tar archive as a multiboot module; the kernel walks 512-byte ustar headers to find
   "bin/sh". Worked example archive (offsets from mod_start):
     0x000 header "etc/motd" size "00000002001" (1025 B) -> data 0x200, 0x400, 0x600 (1 B + 511 B padding)
     0x800 header "bin/"     size "00000000000" type '5' -> no data
     0xA00 header "bin/sh"   size "00000001274" (700 B)  -> data 0xC00, 0xE00 (188 B + padding)
     0x1000 512 zero bytes = end of archive */
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'initrd-tar',
  title: 'Initrd: a tar archive in RAM',
  summary: 'GRUB loads a tar archive next to the kernel; the kernel walks its 512-byte ustar headers to find bin/sh, with no disk driver at all.',
  lessons: ['t8m2l1'],
  articles: ['Initrd', 'Tar', 'USTAR'],
  group: 'Storage',
  order: 821,
}

const steps: VizStep[] = [
  { caption: 'GRUB loads the initrd file into RAM as a multiboot module.', detail: 'The module line in grub.cfg names the file. GRUB copies it into memory next to the kernel before your kernel runs, so no disk driver is needed.' },
  { caption: 'The kernel finds it through the multiboot info: mod_start and mod_end.', detail: 'EBX points to the multiboot info. Its mods_addr field leads to the module list; each entry gives the start and end address of one module.' },
  { caption: 'Inside is a tar archive: a 512-byte header, then the file data.', detail: 'Every file gets one 512-byte header. Its contents follow straight after, padded with zeros up to the next 512-byte boundary.' },
  { caption: 'A header holds the full path at offset 0, the size at 124, the type at 156.', detail: "Type '0' is a normal file and '5' a directory. ustar archives also carry the magic \"ustar\" at offset 257. Bytes 500–511 are zero padding." },
  { caption: 'The size is ASCII octal: "00000002001" = 1025 bytes, so 3 data blocks.', detail: '2 × 8³ + 1 = 1025. 1025 bytes need ceil(1025 / 512) = 3 blocks; the last one holds 1 byte and 511 bytes of padding.' },
  { caption: 'To skip a file: next header = header + 512 + size rounded up to 512.', detail: '0x000 + 512 + 3 × 512 = 0x800. "bin/" is a directory (type 5) with size 0, so its next header follows right after, at 0xA00.' },
  { caption: 'The name matches "bin/sh": its data starts 512 bytes after the header.', detail: 'Size "00000001274" in octal is 700 bytes, stored at offset 0xC00. Hand that pointer and length to your program loader.' },
  { caption: 'A header of all zeros marks the end. The filesystem is read-only RAM.', detail: 'No disk driver, no allocation, no writes. That is enough to load the real disk driver and the first program before storage works.', ms: 4200 },
]

/* ---------- tar strip ---------- */
const SY = 222
const SH = 54
const BW = 81
const bx = (i: number) => 24 + i * 84
type Cell = { kind: 'hdr' | 'data' | 'zero'; name?: string; note?: string; used?: number; off: string }
const CELLS: Cell[] = [
  { kind: 'hdr', name: 'etc/motd', off: '0x000' },
  { kind: 'data', note: '512 B', off: '0x200' },
  { kind: 'data', note: '512 B', off: '0x400' },
  { kind: 'data', note: '1 B+pad', used: 1 / 512, off: '0x600' },
  { kind: 'hdr', name: 'bin/', off: '0x800' },
  { kind: 'hdr', name: 'bin/sh', off: '0xA00' },
  { kind: 'data', note: '512 B', off: '0xC00' },
  { kind: 'data', note: '188 B+pad', used: 188 / 512, off: '0xE00' },
  { kind: 'zero', off: '0x1000' },
]

type St = 'on' | 'off' | 'dim' | 'fill' | 'hatch'
function cellState(i: number, s: number): St {
  if (s === 2) return CELLS[i].kind === 'hdr' ? 'on' : 'off'
  if (s === 3) return i === 0 ? 'on' : 'dim'
  if (s === 4) return i <= 3 ? 'on' : 'dim'
  if (s === 5) return i === 0 || i === 4 ? 'on' : i === 5 ? 'off' : 'dim'
  if (s === 6) return i >= 5 && i <= 7 ? 'on' : 'dim'
  if (s === 7) return i === 8 ? 'on' : 'off'
  return 'off'
}

function StripCell({ i, state }: { i: number; state: St }) {
  const c = CELLS[i]
  const x = bx(i)
  const dim = state === 'dim'
  const top = c.kind === 'hdr' ? 'header' : c.kind === 'data' ? 'data' : '0 … 0'
  const bottom = c.kind === 'hdr' ? c.name : c.kind === 'data' ? c.note : 'end'
  const usedW = c.used !== undefined ? Math.max(3, BW * c.used) : 0
  return (
    <motion.g initial={false} animate={{ opacity: dim ? 0.4 : 1 }} transition={ease}>
      <Block x={x} y={SY} w={BW} h={SH} state={dim ? 'off' : state} />
      {c.used !== undefined && <rect x={x + usedW} y={SY + 1.5} width={BW - usedW - 1.5} height={SH - 3} fill="url(#viz-hatch)" />}
      <Label x={x + BW / 2} y={SY + 24} anchor="middle" size={12} mono={false} weight={c.kind === 'hdr' ? 600 : 500}>{top}</Label>
      <Label x={x + BW / 2} y={SY + 41} anchor="middle" size={10.5} dim={c.kind !== 'hdr'}>{bottom}</Label>
    </motion.g>
  )
}

/* ---------- header fields (not to scale) ---------- */
type Field = { off: string; name: string; w: number; key?: 'name' | 'size' | 'type' | 'magic' }
const FIELDS: Field[] = [
  { off: '0', name: 'name', w: 90, key: 'name' },
  { off: '100', name: 'mode', w: 56 },
  { off: '108', name: 'uid', w: 48 },
  { off: '116', name: 'gid', w: 48 },
  { off: '124', name: 'size (octal)', w: 112, key: 'size' },
  { off: '136', name: 'mtime', w: 60 },
  { off: '148', name: 'chksum', w: 64 },
  { off: '156', name: 'type', w: 52, key: 'type' },
  { off: '157', name: 'linkname', w: 76 },
  { off: '257', name: 'magic', w: 80, key: 'magic' },
  { off: '263', name: 'version', w: 68 },
]
const HEADERS = {
  motd: { name: 'etc/motd', size: '00000002001', type: "'0'", magic: 'ustar' },
  dir: { name: 'bin/', size: '00000000000', type: "'5'", magic: 'ustar' },
  sh: { name: 'bin/sh', size: '00000001274', type: "'0'", magic: 'ustar' },
}

function fieldState(f: Field, s: number): St {
  if (!f.key || s === 7) return 'dim'
  if (s === 3) return 'on'
  if (s === 4) return f.key === 'size' ? 'on' : 'off'
  if (s === 5) return f.key === 'name' || f.key === 'type' ? 'on' : 'off'
  if (s === 6) return f.key === 'name' || f.key === 'size' ? 'on' : 'off'
  return 'off'
}

function Formula({ on, children }: { on: boolean; children: ReactNode }) {
  return <Label x={24} y={424} size={12} on={on}>{children}</Label>
}

export default function InitrdTar() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const hdr = s <= 4 ? HEADERS.motd : s === 5 ? HEADERS.dir : HEADERS.sh
        let fx = 24
        return (
          <Scene label={meta.summary}>
            {/* grub.cfg */}
            <Label x={20} y={18} size={11} dim>GRUB · grub.cfg</Label>
            <Block x={20} y={28} w={250} h={96} state={s === 0 ? 'on' : s >= 2 ? 'dim' : 'off'} />
            <Label x={32} y={52} size={12} dim={s >= 2}>menuentry "myos" {'{'}</Label>
            <Label x={50} y={72} size={12} dim={s >= 2}>multiboot /boot/myos.bin</Label>
            <Label x={50} y={92} size={12} weight={s === 0 ? 700 : 400} dim={s >= 2}>module /boot/myos.initrd</Label>
            <Label x={32} y={112} size={12} dim={s >= 2}>{'}'}</Label>
            <Pulse x={256} y={88} on={s === 0} r={10} />

            {/* physical RAM */}
            <Label x={300} y={18} size={11} dim>PHYSICAL RAM</Label>
            <Block x={300} y={30} w={40} h={50} state="hatch" />
            <Block x={340} y={30} w={130} h={50} label="kernel" sub="0x00100000" size={13} state={s >= 2 ? 'dim' : 'off'} />
            <Block x={470} y={30} w={70} h={50} state="dim" />
            {/* empty slot, then the module lands in it once the packet arrives (step 0) */}
            <Block x={540} y={30} w={150} h={50} state="dim" />
            <motion.g key={s === 0 ? 'loading' : 'loaded'} initial={s === 0 ? { opacity: 0 } : false} animate={{ opacity: 1 }}
              transition={{ ...ease, delay: s === 0 ? 1.5 : 0 }}>
              <Block x={540} y={30} w={150} h={50} label="initrd" sub="myos.initrd (tar)" size={13} state={s <= 1 ? 'on' : 'off'} />
            </motion.g>
            <Block x={690} y={30} w={90} h={50} state="dim" />
            <Label x={540} y={18} size={10.5} anchor="middle" on={s >= 1}>mod_start</Label>
            <Label x={690} y={18} size={10.5} anchor="middle" on={s >= 1}>mod_end</Label>
            <Packet on={s === 0} points={[[262, 88], [420, 120], [566, 52]]} duration={1.8} label="module" />

            {/* multiboot info */}
            <Label x={292} y={155} size={11} anchor="end" on={s >= 1} dim>EBX →</Label>
            <Appear on={s >= 1}>
              <Block x={300} y={128} w={210} h={44} label="multiboot info" sub="mods_addr → mod_start/end" size={13} state={s === 1 ? 'on' : 'dim'} />
            </Appear>
            <Wire d="M510 150 L 560 150 L 560 84" on={s >= 1} dim={s >= 2} />
            <Pulse x={540} y={30} on={s === 1} r={9} />

            {/* why: no disk driver yet */}
            <Appear on={s <= 1}>
              <Block x={210} y={250} w={380} h={74} state="dim" />
              <Label x={400} y={280} size={13} anchor="middle" mono={false} weight={500}>The kernel has no disk driver yet.</Label>
              <Label x={400} y={302} size={11.5} anchor="middle" dim>So its first files must already be in RAM.</Label>
            </Appear>

            {/* zoom into the module */}
            <Wire from={[650, 84]} to={[650, 214]} on={s >= 2} dashed dim arrow />
            <Label x={658} y={156} size={10.5} dim on={s >= 2}>open it up</Label>

            {/* tar strip */}
            <Appear on={s >= 2}>
              <Label x={24} y={212} size={11} dim>TAR ARCHIVE</Label>
              {CELLS.map((_, i) => <StripCell key={i} i={i} state={cellState(i, s)} />)}
              {CELLS.map((c, i) => (
                <Label key={i} x={bx(i) + 2} y={292} size={10.5} dim={!(s === 5 && (i === 0 || i === 4 || i === 5)) && !(s === 6 && i === 6)}>{c.off}</Label>
              ))}
              <Label x={778} y={306} size={10.5} anchor="end" dim>offsets from mod_start</Label>
            </Appear>

            {/* walk: header to header */}
            <Wire d={`M100 ${SY} C 160 186, 340 186, 400 ${SY}`} on={s === 5} />
            <Wire d={`M412 ${SY} C 430 198, 466 198, 482 ${SY}`} on={s === 5} delay={0.5} />
            <Label x={250} y={182} size={10.5} anchor="middle" on={s === 5}>skip 512 + 3·512</Label>
            <Packet on={s === 5} points={[[64, SY - 6], [250, 192], [400, SY - 6], [446, 202], [484, SY - 6]]} duration={2.4} />
            <Pulse x={484} y={SY + SH / 2} on={s === 6} r={16} />
            <Wire d={`M526 ${SY - 4} C 540 200, 580 200, 594 ${SY - 4}`} on={s === 6} />
            <Label x={560} y={194} size={10.5} anchor="middle" on={s === 6}>+512 → data</Label>
            <Pulse x={bx(8) + BW / 2} y={SY + SH / 2} on={s === 7} r={16} />

            {/* one header, field by field */}
            <Appear on={s >= 3}>
              <Label x={24} y={326} size={11} dim>ONE HEADER = 512 BYTES (fields not to scale)</Label>
              {FIELDS.map((f) => {
                const x = fx
                fx += f.w
                const val = f.key ? hdr[f.key] : '…'
                return (
                  <g key={f.off}>
                    <Label x={x + 3} y={343} size={10.5} dim>{f.off}</Label>
                    <Block x={x} y={348} w={f.w} h={44} label={val} sub={f.name} mono size={12} state={fieldState(f, s)} />
                  </g>
                )
              })}
            </Appear>

            {/* the arithmetic for this step */}
            <Formula on={s === 2}>header (512 B) → data, padded to 512 → next header → …</Formula>
            <Formula on={s === 3}>name = "etc/motd"   size = "00000002001"   type = '0' (normal file)</Formula>
            <Formula on={s === 4}>"00000002001" (octal) = 2·512 + 1 = 1025 bytes → 3 data blocks</Formula>
            <Formula on={s === 5}>next = 0x000 + 512 + 3·512 = 0x800 → "bin/" (size 0) → next = 0xA00</Formula>
            <Formula on={s === 6}>match: data = 0xA00 + 512 = 0xC00, size "00000001274" = 700 bytes</Formula>
            <Formula on={s === 7}>512 zero bytes = end of archive · read-only, all in RAM, no disk driver</Formula>
          </Scene>
        )
      }}
    </VizStage>
  )
}
