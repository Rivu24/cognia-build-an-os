/* vfs-layers: open() and read() travel down VFS -> filesystem driver -> block cache -> disk driver -> sectors,
   and open() leaves an fd in the process table pointing at an open-file object that holds the offset.
   Worked example: /mnt/disk is a FAT volume on the primary ATA disk; readme.txt starts at cluster 5, 1300 bytes. */
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'vfs-layers',
  title: 'VFS: from open() to sectors',
  summary: 'open("/mnt/disk/readme.txt") walks down VFS, the FAT driver, the block cache and the ATA driver, and comes back as fd 3 pointing at an open-file object.',
  lessons: ['t9m1l1', 't8m2l5'],
  articles: ['VFS', 'File Systems'],
  group: 'Storage',
  order: 911,
}

const steps: VizStep[] = [
  { caption: 'A program calls open("/mnt/disk/readme.txt"). The VFS takes the call.', detail: 'The program never sees FAT, sectors or ports. It sees one tree of paths, and the VFS sits between it and every filesystem driver.' },
  { caption: 'The VFS matches the path to a mount point: /mnt/disk is a FAT volume.', detail: 'The mount table says which filesystem lives where. The VFS keeps "/mnt/disk" and passes the rest, "readme.txt", to that driver.' },
  { caption: 'The FAT driver must read its directory to find "readme.txt".', detail: 'Only the filesystem driver knows the on-disk format. To search the directory it asks for the sectors that hold it.' },
  { caption: 'The block cache misses, so the ATA driver reads the sectors from disk.', detail: 'The cache keeps recently used sectors in RAM. On a miss the request goes down to the disk driver, which talks to the hardware.' },
  { caption: 'The sectors come back up. FAT finds README.TXT: cluster 5, 1300 bytes.', detail: 'The sectors are now cached, so the next lookup in this directory needs no disk access. The driver reports where the file lives and its size.' },
  { caption: 'The VFS makes an open-file object and returns fd 3, the lowest free slot.', detail: 'fd 0, 1 and 2 are taken by stdin, stdout and stderr. The open file holds the offset, so two opens of one file can read at different places.' },
  { caption: 'read(3, buf, 512): fd 3 → offset 0 → cluster 5 → sectors → buf.', detail: 'The same chain runs again. The VFS turns the offset into a block, the FAT driver maps it to a sector, and the offset then moves to 512.' },
  { caption: 'Each layer only talks to the one below it, so each one can be swapped.', detail: 'Mount ext2 instead of FAT, or use AHCI instead of ATA: programs keep calling the same open and read.', ms: 4200 },
]

const LX = 300
const LW = 230
const CX = LX + LW / 2

export default function VfsLayers() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const vfsSub = ['path → mount → driver', '"/mnt/disk" + "readme.txt"', 'lookup "readme.txt"', 'lookup "readme.txt"', 'lookup "readme.txt"', 'new open file → fd 3', 'offset 0 → block 0', 'one API for every FS'][s]
        const fatOn = s === 2 || s === 4 || s === 6
        const cacheOn = s === 3 || s === 6
        const ataOn = s === 3 || s === 6
        return (
          <Scene label={meta.summary}>
            {/* ---------- process ---------- */}
            <Label x={20} y={18} size={11} dim>PROCESS (user space)</Label>
            <Block x={20} y={28} w={250} h={100} state={s === 0 || s === 6 ? 'on' : 'off'} />
            <Label x={32} y={54} size={12}>fd = open(</Label>
            <Label x={48} y={74} size={12}>"/mnt/disk/readme.txt");</Label>
            <Label x={48} y={92} size={12} weight={s === 5 ? 700 : 400} dim={s > 5} on={s >= 5}>// fd == 3</Label>
            <Label x={32} y={108} size={12} on={s >= 6} weight={s === 6 ? 700 : 400}>read(fd, buf, 512);</Label>
            <Packet on={s === 0} points={[[220, 66], [262, 62], [LX, 58]]} duration={1.4} label="open" />
            <Packet on={s === 5} points={[[LX, 52], [240, 86], [150, 86]]} duration={1.6} delay={0.6} label="3" />

            {/* fd table */}
            <Label x={20} y={160} size={11} dim>FD TABLE (kernel, per process)</Label>
            {['0  stdin', '1  stdout', '2  stderr', s >= 5 ? '3  open file' : '3  free'].map((t, i) => (
              <Block key={i} x={20} y={168 + i * 26} w={130} h={26} label={t} mono size={12} align="start"
                state={i === 3 ? (s === 5 || s === 6 ? 'on' : s >= 5 ? 'off' : 'dim') : 'dim'} />
            ))}
            <Wire d="M150 259 L 186 259 L 186 296" on={s >= 5} />
            <Pulse x={36} y={259} on={s === 5} r={11} />

            {/* open-file object */}
            <Appear on={s >= 5}>
              <Block x={20} y={300} w={230} h={110} state={s === 5 || s === 6 ? 'on' : 'off'} />
              <Label x={32} y={322} size={11} dim>OPEN FILE</Label>
              <Label x={32} y={346} size={12}>vnode  readme.txt</Label>
              <Label x={32} y={368} size={12} weight={s === 6 ? 700 : 400}>offset {s >= 6 ? '512' : '0'}</Label>
              <Label x={32} y={390} size={12}>mode   O_RDONLY</Label>
            </Appear>
            <Wire d={`M${LX} 80 C 284 80, 284 352, 252 352`} on={s === 5} dashed />
            <Packet on={s === 6} points={[[120, 108], [100, 259], [120, 330]]} duration={1.4} />

            {/* ---------- the layers ---------- */}
            <Label x={LX} y={18} size={11} dim>KERNEL</Label>
            <Block x={LX} y={28} w={LW} h={60} label="VFS" sub={vfsSub} size={15} state={s <= 1 || s === 5 || s === 7 ? 'on' : 'off'} />
            <Block x={LX} y={112} w={LW} h={52} label="FAT driver" sub={s === 7 ? 'or ext2, ISO 9660, tarfs…' : 'mounted at /mnt/disk'} size={14} state={fatOn || s === 7 ? 'on' : s <= 1 ? 'dim' : 'off'} />
            <Block x={LX} y={188} w={LW} h={52} label="block cache" sub="recent sectors in RAM" size={14} state={cacheOn ? 'on' : s <= 2 ? 'dim' : 'off'} />
            <Block x={LX} y={264} w={LW} h={52} label="ATA PIO driver" sub={s === 7 ? 'or AHCI, NVMe, floppy…' : 'ports 0x1F0–0x1F7'} size={14} state={ataOn || s === 7 ? 'on' : s <= 2 ? 'dim' : 'off'} />
            <Wire from={[CX - 15, 88]} to={[CX - 15, 110]} dim={!(s === 2 || s === 6)} />
            <Wire from={[CX - 15, 164]} to={[CX - 15, 186]} dim={!(s === 3 || s === 6)} />
            <Wire from={[CX - 15, 240]} to={[CX - 15, 262]} dim={!(s === 3 || s === 6)} />
            <Wire from={[CX - 15, 316]} to={[CX - 15, 338]} dim={!(s === 3 || s === 6)} />
            <Wire from={[CX + 25, 338]} to={[CX + 25, 318]} on={s === 4 || s === 6} />
            <Wire from={[CX + 25, 262]} to={[CX + 25, 242]} on={s === 4 || s === 6} />
            <Wire from={[CX + 25, 186]} to={[CX + 25, 166]} on={s === 4 || s === 6} />

            {/* disk */}
            <Block x={LX} y={340} w={LW} h={72} state={s === 3 || s === 4 || s === 6 ? 'on' : 'off'} />
            <Label x={LX + 10} y={358} size={11} dim>disk (ata0) · 512-byte sectors</Label>
            {Array.from({ length: 8 }, (_, i) => (
              <Block key={i} x={LX + 10 + i * 27} y={368} w={24} h={30}
                state={(i === 2 && (s === 3 || s === 4)) || (i === 5 && s === 6) ? 'fill' : 'off'} />
            ))}
            <Label x={LX + 10 + 2 * 27 + 12} y={426} size={10.5} anchor="middle" on={s === 3 || s === 4}>dir</Label>
            <Label x={LX + 10 + 5 * 27 + 12} y={426} size={10.5} anchor="middle" on={s === 6}>data</Label>

            {/* packets down / up the stack */}
            <Packet on={s === 2} points={[[CX - 15, 88], [CX - 15, 112]]} duration={1.2} label="readme.txt" />
            <Packet on={s === 3} points={[[CX - 15, 164], [CX - 15, 240], [CX - 15, 316], [CX - 15, 368]]} duration={2.2} />
            <Packet on={s === 4} points={[[CX + 25, 368], [CX + 25, 316], [CX + 25, 240], [CX + 25, 164]]} duration={2.2} />
            <Packet on={s === 6} points={[[CX - 15, 88], [CX - 15, 164], [CX - 15, 240], [CX - 15, 316], [CX - 15, 368], [CX + 25, 368], [CX + 25, 164], [CX + 25, 88]]} duration={3} delay={0.4} />
            <Packet on={s === 6} points={[[LX, 46], [262, 80], [200, 104]]} duration={1.2} delay={2.6} repeat label="512 B" />

            {/* ---------- per-layer details ---------- */}
            <Label x={560} y={18} size={11} dim>MOUNT TABLE</Label>
            <Block x={560} y={28} w={220} h={28} state={s === 1 ? 'dim' : 'off'} />
            <Label x={570} y={46} size={11.5} dim={s === 1}>/</Label>
            <Label x={650} y={46} size={11.5} dim={s === 1}>initrd (tar)</Label>
            <Block x={560} y={56} w={220} h={28} mono size={11.5} align="start" state={s === 1 ? 'on' : 'off'} />
            <Label x={570} y={74} size={11.5} weight={s === 1 ? 700 : 400}>/mnt/disk</Label>
            <Label x={650} y={74} size={11.5}>FAT on ata0</Label>
            <Wire from={[LX + LW, 58]} to={[556, 70]} on={s === 1} />
            <Pulse x={600} y={70} on={s === 1} r={12} />

            <Appear on={s >= 2}>
              <Block x={560} y={112} w={220} h={52} label={s >= 4 ? 'README.TXT' : 'search root dir…'} sub={s >= 4 ? 'first cluster 5 · 1300 B' : 'for "README.TXT"'} mono size={13} state={s === 4 ? 'on' : fatOn ? 'off' : 'dim'} />
            </Appear>
            <Wire from={[LX + LW, 138]} to={[556, 138]} on={s === 4} />

            <Appear on={s >= 3}>
              {['dir', 'FAT', 'data'].map((t, i) => {
                const sub = i === 0 ? (s === 3 ? 'miss' : 'cached') : i === 2 ? (s === 6 ? 'miss' : s === 7 ? 'cached' : 'empty') : 'empty'
                const on = (i === 0 && (s === 3 || s === 4)) || (i === 2 && s === 6)
                return <Block key={t} x={560 + i * 75} y={188} w={70} h={52} label={t} sub={sub} size={13} state={on ? 'on' : sub === 'empty' ? 'dim' : 'off'} />
              })}
            </Appear>

            <Appear on={s >= 3}>
              <Block x={560} y={264} w={220} h={52} label="READ SECTORS 0x20" sub="outb 0x1F7 · inw 0x1F0" mono size={13} state={ataOn ? 'on' : 'dim'} />
            </Appear>
            <Wire from={[LX + LW, 290]} to={[556, 290]} on={ataOn} dim />

            <Appear on={s >= 6}>
              <Label x={560} y={362} size={11} dim>READ PATH</Label>
              <Label x={560} y={384} size={12}>offset 0 → cluster 5</Label>
              <Label x={560} y={404} size={12}>→ sector → buf[0..511]</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
