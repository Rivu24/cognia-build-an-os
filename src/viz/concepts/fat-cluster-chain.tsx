/* fat-cluster-chain: FAT16 volume layout, BPB numbers, an 8.3 directory entry, following the cluster chain
   3 -> 4 -> 7 -> 0xFFFF in the FAT, cluster -> sector arithmetic, and what a write must update.
   Worked example BPB: 512 B/sector, 4 sectors/cluster, 4 reserved, 2 FATs, 512 root entries, 32 sectors/FAT.
   root_dir_sectors = 512*32/512 = 32; first_data_sector = 4 + 2*32 + 32 = 100; sector(c) = (c-2)*4 + 100. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'fat-cluster-chain',
  title: 'FAT: following a cluster chain',
  summary: 'How a FAT16 driver finds a file: BPB sizes, the 32-byte directory entry, the chain 3 → 4 → 7 → end in the FAT, cluster-to-sector maths, and what a write must update.',
  lessons: ['t9m3l1', 't9m3l2'],
  articles: ['FAT'],
  group: 'Storage',
  order: 931,
}

const steps: VizStep[] = [
  { caption: 'A FAT volume has four regions: reserved sectors, the FATs, root directory, data.', detail: 'This is FAT16. The boot sector is the first reserved sector. Files and subdirectories live in the data area, cut into clusters numbered from 2.' },
  { caption: "The boot sector's BPB gives the size of every region.", detail: 'Offsets 0x0B to 0x16: 512 bytes per sector, 4 sectors per cluster, 4 reserved sectors, 2 FATs, 512 root entries, 32 sectors per FAT.' },
  { caption: 'From the BPB: the data area starts at sector 4 + 2 × 32 + 32 = 100.', detail: 'The root directory holds 512 entries × 32 bytes = 32 sectors. first_data_sector = reserved + FAT count × FAT size + root dir sectors.' },
  { caption: 'The 32-byte entry for README.TXT: 8.3 name, first cluster 3, size 5000.', detail: 'The name is 11 bytes, "README  TXT", padded with spaces. FAT16 keeps the first cluster at offset 26; the high half at offset 20 is 0.' },
  { caption: 'Cluster to sector: (3 − 2) × 4 + 100 = sector 104. Read 4 sectors there.', detail: 'Clusters start at 2, so cluster 2 is the first cluster of the data area. These sector numbers count from the start of the partition.' },
  { caption: 'Follow the chain in the FAT: FAT[3] = 4, FAT[4] = 7, FAT[7] = 0xFFFF = end.', detail: 'Each FAT entry holds the number of the next cluster. A value of 0xFFF8 or more ends the chain; 0 means the cluster is free.' },
  { caption: 'So the file is clusters 3, 4, 7: 2048 + 2048 + 904 = 5000 bytes.', detail: 'A cluster is 4 × 512 = 2048 bytes. The clusters need not be next to each other, and the last one is only partly used.' },
  { caption: 'Append 2000 bytes: fill cluster 7, then link a free cluster into the chain.', detail: 'FAT[8] is 0, so cluster 8 is free. Write the data into clusters 7 and 8 first, then set FAT[7] = 8 and FAT[8] = 0xFFFF (new end). Cluster 8 holds the last 856 bytes.' },
  { caption: 'Copy the change into FAT 2, then write the new size into the directory entry.', detail: 'Size goes last: a crash before it only leaks cluster 8, which a disk check can reclaim. Writing the size first would claim bytes the chain does not hold.', ms: 4400 },
]

type St = 'on' | 'off' | 'dim' | 'fill' | 'hatch'
const SY = 34
const SH = 50
const CW = 52.5
const cx = (c: number) => 360 + (c - 2) * CW
const sectorOf = (c: number) => (c - 2) * 4 + 100

const BPB: [string, string, string][] = [
  ['0x0B', 'bytes per sector', '512'],
  ['0x0D', 'sectors per cluster', '4'],
  ['0x0E', 'reserved sectors', '4'],
  ['0x10', 'number of FATs', '2'],
  ['0x11', 'root dir entries', '512'],
  ['0x16', 'sectors per FAT', '32'],
]

const FAT0 = ['0xFFF8', '0xFFFF', '0xFFFF', '0x0004', '0x0007', '0x0006', '0xFFFF', '0xFFFF', '0x0000', '0x0000']
const fatX = (i: number) => 300 + i * 48

export default function FatClusterChain() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const wrote = s >= 7
        const fat = FAT0.map((v, i) => (wrote && i === 7 ? '0x0008' : wrote && i === 8 ? '0xFFFF' : v))
        const chain = wrote ? [3, 4, 7, 8] : [3, 4, 7]
        const regionState = (k: 'res' | 'fat1' | 'fat2' | 'root'): St => {
          if (s === 0) return 'on'
          if (s === 1) return k === 'res' ? 'on' : 'off'
          if (s === 3) return k === 'root' ? 'on' : 'off'
          if (s === 5 || s === 7) return k === 'fat1' ? 'on' : 'off'
          if (s === 8) return k === 'fat2' || k === 'root' ? 'on' : 'off'
          return 'off'
        }
        const clusterState = (c: number): St => {
          if (s === 0) return 'on'
          if (s < 4) return 'off'
          if (s === 4) return c === 3 ? 'on' : 'dim'
          if (s === 5) return chain.includes(c) ? 'on' : 'dim'
          if (s === 6) return chain.includes(c) ? 'fill' : 'dim'
          if (s === 7) return c === 8 ? 'on' : chain.includes(c) ? 'fill' : 'dim'
          return chain.includes(c) ? 'fill' : 'dim'
        }
        const bpbHot = (i: number) => s === 1 || (s === 2 && i !== 1) || (s === 4 && i === 1)
        let dx = 300
        return (
          <Scene label={meta.summary}>
            {/* ---------- volume strip ---------- */}
            <Label x={20} y={24} size={11} dim>FAT16 VOLUME</Label>
            <Label x={360} y={24} size={11} dim>DATA AREA · clusters of 4 sectors</Label>
            <Block x={20} y={SY} w={92} h={SH} label="reserved" sub="boot sector" size={13} state={regionState('res')} />
            <Block x={112} y={SY} w={76} h={SH} label="FAT 1" size={13} state={regionState('fat1')} />
            <Block x={188} y={SY} w={76} h={SH} label="FAT 2" size={13} state={regionState('fat2')} />
            <Block x={264} y={SY} w={96} h={SH} label="root dir" sub="512 × 32 B" size={13} state={regionState('root')} />
            {[2, 3, 4, 5, 6, 7, 8, 9].map((c) => (
              <Block key={c} x={cx(c)} y={SY} w={CW} h={SH} label={String(c)} sub={s >= 4 ? String(sectorOf(c)) : undefined} mono size={13} state={clusterState(c)} />
            ))}
            {([[20, '0'], [112, '4'], [188, '36'], [264, '68'], [360, '100']] as [number, string][]).map(([x, t]) => (
              <Label key={t} x={x + 3} y={SY + SH + 14} size={10.5} on={s >= 2} weight={s === 2 ? 700 : 400} dim={s !== 2}>{t}</Label>
            ))}
            <Label x={780} y={SY + SH + 14} size={10.5} anchor="end" on={s >= 4} dim>sector under each cluster</Label>
            <Pulse x={cx(3) + CW / 2} y={SY + SH / 2} on={s === 4} r={16} />
            <Pulse x={cx(8) + CW / 2} y={SY + SH / 2} on={s === 7} r={16} />
            <Packet on={s === 8} points={[[130, SY + 40], [248, SY + 40]]} duration={1.2} />

            {/* what each region is for (step 0) */}
            <Appear on={s === 0}>
              <Wire d={`M150 ${SY + SH + 2} L 150 176`} />
              <Wire d={`M312 ${SY + SH + 2} C 312 130, 400 130, 400 176`} delay={0.2} />
              <Wire d={`M570 ${SY + SH + 2} C 570 130, 650 130, 650 176`} delay={0.4} />
              <Block x={20} y={178} w={250} h={60} label="FAT = a map" sub="entry n → the cluster after n" size={14} state="on" />
              <Block x={290} y={178} w={220} h={60} label="root directory" sub="one 32-byte entry per file" size={14} state="on" />
              <Block x={530} y={178} w={250} h={60} label="data area" sub="file contents, in clusters" size={14} state="on" />
              <Label x={400} y={290} size={12} anchor="middle" dim>To read a file: find its entry, then follow its clusters through the FAT.</Label>
            </Appear>

            {/* ---------- BPB ---------- */}
            <Wire from={[66, SY + SH + 2]} to={[66, 110]} on={s === 1} />
            <Packet on={s === 1} points={[[66, SY + SH], [66, 112]]} duration={1} />
            <Appear on={s >= 1}>
              <Label x={20} y={124} size={11} dim>BOOT SECTOR · BPB</Label>
              {BPB.map(([o, n, v], i) => (
                <g key={o}>
                  <Block x={20} y={132 + i * 24} w={250} h={24} state={bpbHot(i) ? 'on' : s >= 3 ? 'dim' : 'off'} />
                  <Label x={28} y={148 + i * 24} size={10.5} dim>{o}</Label>
                  <Label x={70} y={148 + i * 24} size={11.5} mono={false}>{n}</Label>
                  <Label x={262} y={148 + i * 24} size={12} anchor="end" weight={600}>{v}</Label>
                </g>
              ))}
            </Appear>

            {/* formulas */}
            <Label x={20} y={300} size={11} on={s >= 2 && s <= 6} dim={s !== 2}>root_dir = 512 × 32 / 512 = 32</Label>
            <Label x={20} y={320} size={11} on={s >= 2 && s <= 6} dim={s !== 2} weight={s === 2 ? 700 : 400}>first_data = 4 + 2 × 32 + 32 = 100</Label>
            <Label x={20} y={348} size={11} on={s >= 4 && s <= 6} dim={s !== 4}>sector = (cluster − 2) × 4 + 100</Label>
            <Label x={20} y={368} size={11} on={s >= 4 && s <= 6} dim={s !== 4} weight={s === 4 ? 700 : 400}>cluster 3 → (3 − 2) × 4 + 100 = 104</Label>

            {/* write checklist */}
            <Appear on={s >= 7}>
              <Label x={20} y={300} size={11} dim>WRITE: APPEND 2000 BYTES</Label>
              <Label x={20} y={324} size={11.5} weight={s === 7 ? 700 : 400}>1. FAT[8] == 0 → cluster 8 is free</Label>
              <Label x={20} y={346} size={11.5} weight={s === 7 ? 700 : 400}>2. write data to clusters 7, 8</Label>
              <Label x={20} y={368} size={11.5} weight={s === 7 ? 700 : 400}>3. FAT 1: FAT[7] = 8, FAT[8] = 0xFFFF</Label>
              <Label x={20} y={390} size={11.5} weight={s === 8 ? 700 : 400} dim={s < 8}>4. FAT 2: the same change</Label>
              <Label x={20} y={412} size={11.5} weight={s === 8 ? 700 : 400} dim={s < 8}>5. dir entry size = 7000 (last)</Label>
            </Appear>

            {/* ---------- directory entry ---------- */}
            <Wire d={`M290 ${SY + SH + 2} L 290 168 L 298 168`} on={s === 3} />
            <Packet on={s === 3} points={[[290, SY + SH], [290, 168], [300, 168]]} duration={1.2} />
            <Appear on={s >= 3}>
              <Label x={300} y={124} size={11} dim>ROOT DIRECTORY ENTRY · 32 BYTES</Label>
              {([
                ['0', 'name 8.3', 'README  TXT', 140, 'name'],
                ['11', 'attr', '0x20', 50, ''],
                ['12', '', '…', 50, ''],
                ['20', 'clus hi', '0x0000', 60, ''],
                ['22', '', '…', 50, ''],
                ['26', 'clus lo', '3', 60, 'lo'],
                ['28', 'size', s >= 8 ? '7000' : '5000', 70, 'size'],
              ] as [string, string, string, number, string][]).map(([o, n, v, w, k]) => {
                const x = dx
                dx += w
                const hot = (s === 3 && k !== '') || (s === 5 && k === 'lo') || (s === 8 && k === 'size')
                return (
                  <g key={o}>
                    <Label x={x + 3} y={143} size={10.5} dim>{o}</Label>
                    <Block x={x} y={148} w={w} h={44} label={v} sub={n || undefined} mono size={12} state={hot ? 'on' : k === '' ? 'dim' : 'off'} />
                  </g>
                )
              })}
            </Appear>
            <Wire d="M680 194 C 680 218, 468 214, 468 234" on={s === 5} dashed />

            {/* ---------- FAT ---------- */}
            <Appear on={s >= 5}>
              <Label x={300} y={228} size={11} dim>FAT 1 (16-bit entries)</Label>
              {fat.map((v, i) => {
                const inChain = chain.includes(i)
                const changed = wrote && (i === 7 || i === 8)
                const st: St = s === 7 && changed ? 'fill' : (s === 5 || s === 7) && inChain ? 'on' : i < 2 ? 'dim' : 'off'
                return (
                  <g key={i}>
                    <Label x={fatX(i) + 24} y={246} size={10.5} anchor="middle" dim={!inChain}>[{i}]</Label>
                    <Block x={fatX(i)} y={252} w={48} h={40} label={v} mono size={11} state={st} />
                  </g>
                )
              })}
              <Wire d={`M${fatX(3) + 24} 294 C ${fatX(3) + 24} 318, ${fatX(4) + 24} 318, ${fatX(4) + 24} 295`} delay={0.2} />
              <Wire d={`M${fatX(4) + 24} 294 C ${fatX(4) + 24} 330, ${fatX(7) + 24} 330, ${fatX(7) + 24} 295`} delay={0.6} />
              <Wire d={`M${fatX(7) + 24} 294 C ${fatX(7) + 24} 318, ${fatX(8) + 24} 318, ${fatX(8) + 24} 295`} on={wrote} delay={0.3} />
              <Label x={wrote ? fatX(8) + 24 : fatX(7) + 24} y={338} size={10.5} anchor="middle">end (≥ 0xFFF8)</Label>
            </Appear>
            <Packet on={s === 5} duration={2.6}
              points={[[fatX(3) + 24, 294], [fatX(3) + 48, 314], [fatX(4) + 24, 294], [fatX(5) + 48, 324], [fatX(7) + 24, 294], [fatX(7) + 24, 330]]} />

            {/* ---------- the file, in order ---------- */}
            <Appear on={s >= 6}>
              {chain.map((c, i) => {
                const used = c === 7 ? (wrote ? 2048 : 904) : c === 8 ? 856 : 2048
                const x = 300 + i * 120
                return (
                  <g key={c}>
                    <Label x={x} y={362} size={10.5} dim={!(s === 7 && c === 8)}>cluster {c}</Label>
                    <rect x={x} y={368} width={112} height={26} fill="var(--viz-bg)" stroke="var(--viz-fg)" />
                    <motion.rect x={x + 3} y={371} height={20} fill="var(--viz-fg)" initial={{ width: 0 }}
                      animate={{ width: (106 * used) / 2048 }} transition={{ ...ease, duration: 1.2 }} />
                    <Label x={x} y={410} size={10.5} dim>{used} B</Label>
                  </g>
                )
              })}
              <Label x={780} y={428} size={11.5} anchor="end" weight={600}>{wrote ? '7000 B = 3 × 2048 + 856' : '5000 B = 2048 + 2048 + 904'}</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
