/* ext2: from the superblock to the data of /home/a.txt.
   Worked example (a small revision-0 style volume): 1 KiB blocks (superblock field 24 = 0), 8192 blocks and
   2048 inodes per group, 128-byte inodes. Group 0 starts at block 1 (block 0 is the boot block); the descriptor
   table is block 2. Block numbers of bitmaps, inode tables and data are an example layout a learner can recompute:
   group of inode n = (n - 1) / 2048, index = (n - 1) % 2048, block = table + index * 128 / 1024. */
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'ext2-inode-blocks',
  title: 'ext2: superblock, inodes and blocks',
  summary: 'How an ext2 driver reads the superblock at byte 1024, the block group descriptors and inode tables, starts at inode 2 and follows directory entries and block pointers to the data of /home/a.txt.',
  lessons: ['t9m3l3'],
  articles: ['Ext2'],
  group: 'Storage',
  order: 933,
}

const steps: VizStep[] = [
  { caption: 'An ext2 volume is cut into block groups. Each has bitmaps, an inode table and data blocks.', detail: 'Here blocks are 1 KiB and each group holds 8192 blocks. Block 0 is left for a boot record, so group 0 starts at block 1.' },
  { caption: 'The superblock is always at byte 1024. Magic 0xEF53 at offset 56 says "this is ext2".', detail: 'Offset 24 holds log2(block size) - 10: 0 means 1024 << 0 = 1024 bytes. Offsets 32 and 40: blocks and inodes per group. Inodes are 128 bytes.', ms: 4200 },
  { caption: 'The block group descriptor table comes next: block 2 when blocks are 1 KiB.', detail: 'One 32-byte descriptor per group: block bitmap at offset 0, inode bitmap at 4, first block of the inode table at 8.' },
  { caption: 'Every path lookup starts at inode 2, the root directory. Inode numbers start at 1.', detail: 'group = (2 - 1) / 2048 = 0, index = 1. Descriptor 0 says the inode table is at block 5, so inode 2 sits in block 5 at byte 1 x 128 = 128.', ms: 4200 },
  { caption: 'Root’s data block holds directory entries: name → inode number. "home" is inode 4100.', detail: 'Each entry: inode (4 bytes), entry size (2), name length (1), type (1), then the name. Sizes round up to 4; the last entry runs to the end of the block.', ms: 4200 },
  { caption: 'Inode 4100: group = 4099 / 2048 = 2, index = 4099 % 2048 = 3.', detail: 'Descriptor 2 says group 2’s inode table starts at block 16387. Index 3 x 128 = byte 384, still inside that first block.', ms: 4000 },
  { caption: 'home’s directory block lists "a.txt" → inode 4105: group 2, index 8.', detail: '8 x 128 = 1024 bytes into the table, so inode 4105 is the first inode of the next block, 16388.' },
  { caption: 'An inode holds 12 direct block pointers. a.txt is 2500 bytes, so it uses three.', detail: 'The inode has the size, type and permissions, but no name: names live only in directories. Unused pointers are 0.' },
  { caption: 'Larger files use indirect blocks: singly, doubly and triply indirect pointers.', detail: 'A 1 KiB block holds 256 four-byte pointers. 12 direct = 12 KiB, then +256 KiB, +64 MiB and +16 GiB through each extra level.', ms: 4200 },
]

/** Parts not yet reached stay visible but faint. */
function Faint({ on, children }: { on: boolean; children: ReactNode }) {
  return <motion.g initial={false} animate={{ opacity: on ? 1 : 0.25 }} transition={ease}>{children}</motion.g>
}

/** Text that fades in whenever it changes. */
function Swap({ x, y, v, size = 12, anchor = 'start', dim, weight = 400 }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; dim?: boolean; weight?: number }) {
  return (
    <motion.text key={v} x={x} y={y} textAnchor={anchor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={ease}
      fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>
      {v}
    </motion.text>
  )
}

// ---- disk bar segments: [x, w, label, block numbers, key] ----
const BAR_Y = 36, BAR_H = 38
const SEG: [number, number, string, string, string][] = [
  [20, 42, 'boot', '0', 'boot'],
  [62, 50, 'super', '1', 'sb'],
  [112, 48, 'BGDT', '2', 'bgdt'],
  [160, 52, 'bitmaps', '3–4', 'bm0'],
  [212, 88, 'inode table', '5–260', 'it0'],
  [300, 100, 'data', '261…', 'd0'],
  [400, 160, 'group 1', '8193–16384', 'g1'],
  [560, 50, 'bitmaps', '16385–86', 'bm2'],
  [610, 80, 'inode table', '16387…', 'it2'],
  [690, 70, 'data', '16643…', 'd2'],
]
const segMid = (k: string) => { const g = SEG.find((x) => x[4] === k)!; return g[0] + g[1] / 2 }

const SB = [['24', 'block size', '0 → 1024'], ['32', 'blocks/group', '8192'], ['40', 'inodes/group', '2048'], ['56', 'magic', '0xEF53'], ['88', 'inode size', '128']]
const BGD = [['BGD[0]', 'inode table @ 5'], ['BGD[1]', 'inode table @ 8197'], ['BGD[2]', 'inode table @ 16387']]

// the inode shown, per step
const INODE = (s: number) => (s <= 4 ? { n: 2, kind: 'directory', size: '1024 B', direct: ['261'] } : s <= 6 ? { n: 4100, kind: 'directory', size: '1024 B', direct: ['16643'] } : { n: 4105, kind: 'regular file', size: '2500 B', direct: ['16644', '16645', '16646'] })
const LOOK = (s: number) => {
  if (s < 3) return { n: 'n', lines: ['group = (n − 1) / 2048', 'index = (n − 1) % 2048', 'block = table + index × 128 / 1024'] }
  if (s <= 4) return { n: '2', lines: ['group = (2 − 1) / 2048 = 0', 'index = (2 − 1) % 2048 = 1', 'block 5, byte 128'] }
  if (s === 5) return { n: '4100', lines: ['group = 4099 / 2048 = 2', 'index = 4099 % 2048 = 3', 'block 16387, byte 384'] }
  return { n: '4105', lines: ['group = 4104 / 2048 = 2', 'index = 4104 % 2048 = 8', 'block 16388, byte 0'] }
}
const ROOT_DIR = [['2', '12', '1', 'dir', '.'], ['2', '12', '2', 'dir', '..'], ['11', '20', '10', 'dir', 'lost+found'], ['4100', '980', '4', 'dir', 'home']]
const HOME_DIR = [['4100', '12', '1', 'dir', '.'], ['2', '12', '2', 'dir', '..'], ['4105', '1000', '5', 'file', 'a.txt']]
const COLS = [410, 470, 520, 566, 620] // inode, size, len, type, name

export default function Ext2InodeBlocks() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const segState = (k: string): 'on' | 'off' | 'dim' => {
          const hot: Record<number, string[]> = { 1: ['sb'], 2: ['bgdt'], 3: ['it0'], 4: ['d0'], 5: ['it2'], 6: ['d2'], 7: ['d2', 'it2'], 8: ['d2'] }
          if (s === 0) return k === 'boot' ? 'dim' : 'off'
          return hot[s]?.includes(k) ? 'on' : 'off'
        }
        const ino = INODE(s)
        const look = LOOK(s)
        const dir = s <= 5 ? ROOT_DIR : HOME_DIR
        const hotEntry = s === 4 ? 3 : s === 6 ? 2 : -1
        return (
          <Scene label={meta.summary}>
            {/* ---------- disk ---------- */}
            <Label x={62} y={26} size={11} dim>group 0 · blocks 1–8192</Label>
            <Label x={560} y={26} size={11} dim>group 2 · 16385–24576</Label>
            {SEG.map(([x, w, lab, nums, k]) => (
              <g key={k}>
                <Block x={x} y={BAR_Y} w={w} h={BAR_H} label={lab} size={k === 'g1' ? 12 : 10.5} state={k === 'g1' ? 'dim' : segState(k)} />
                <Label x={x + w / 2} y={BAR_Y + BAR_H + 14} size={10} anchor="middle" dim>{nums}</Label>
              </g>
            ))}
            <Label x={770} y={BAR_Y + 24} size={12} anchor="middle" dim>…</Label>
            <Pulse x={segMid('sb')} y={BAR_Y + BAR_H / 2} on={s === 1} r={16} />

            {/* ---------- superblock ---------- */}
            <Faint on={s >= 1}>
              <Label x={20} y={114} size={11} dim>SUPERBLOCK · byte 1024</Label>
              {SB.map(([o, n, v], i) => (
                <g key={o}>
                  <Block x={20} y={122 + i * 26} w={240} h={26} state={s === 1 && i === 3 ? 'on' : s === 3 && i === 2 ? 'on' : 'off'} />
                  <Label x={28} y={139 + i * 26} size={10.5} dim>{o}</Label>
                  <Label x={54} y={139 + i * 26} size={11.5}>{n}</Label>
                  <Label x={252} y={139 + i * 26} size={11.5} anchor="end" weight={600}>{v}</Label>
                </g>
              ))}
            </Faint>

            {/* ---------- block group descriptors ---------- */}
            <Faint on={s >= 2}>
              <Label x={280} y={114} size={11} dim>DESCRIPTORS · block 2</Label>
              {BGD.map(([g, v], i) => (
                <g key={g}>
                  <Block x={280} y={122 + i * 26} w={220} h={26} state={(s === 3 || s === 4) && i === 0 ? 'on' : s >= 5 && s <= 6 && i === 2 ? 'on' : 'off'} />
                  <Label x={290} y={139 + i * 26} size={11} dim>{g}</Label>
                  <Label x={490} y={139 + i * 26} size={11.5} anchor="end" weight={500}>{v}</Label>
                </g>
              ))}
              <Label x={280} y={216} size={10.5} dim>32 bytes each · table at offset 8</Label>
            </Faint>

            {/* ---------- inode ---------- */}
            <Faint on={s >= 3}>
              <Block x={520} y={104} w={260} h={152} state={s === 3 || s === 5 || s === 7 ? 'on' : 'off'} />
              <Swap x={530} y={122} v={`INODE ${ino.n} · ${ino.kind}`} size={11.5} weight={600} />
              <Swap x={770} y={122} v={ino.size} size={10.5} anchor="end" dim />
              {Array.from({ length: 12 }, (_, i) => (
                <g key={i}>
                  <Block x={530 + (i % 6) * 40} y={130 + Math.floor(i / 6) * 24} w={40} h={24} state={ino.direct[i] ? (s === 7 ? 'on' : 'off') : 'dim'} />
                  <Swap x={550 + (i % 6) * 40} y={146 + Math.floor(i / 6) * 24} v={ino.direct[i] ?? '0'} size={10.5} anchor="middle" dim={!ino.direct[i]} />
                </g>
              ))}
              {[['singly', '256 blocks'], ['doubly', '65536 blocks'], ['triply', '16777216 blocks']].map(([n, c], i) => (
                <g key={n}>
                  <Block x={530} y={184 + i * 22} w={240} h={22} state={s === 8 ? 'on' : 'dim'} />
                  <Label x={540} y={199 + i * 22} size={11}>{n} indirect</Label>
                  <Label x={760} y={199 + i * 22} size={10.5} anchor="end" dim={s !== 8}>{s === 8 ? c : '0 (unused)'}</Label>
                </g>
              ))}
            </Faint>

            {/* ---------- lookup ---------- */}
            <Label x={20} y={284} size={11} dim>LOOKUP /home/a.txt</Label>
            {[['/', 'inode 2', 3], ['home', 'inode 4100', 5], ['a.txt', 'inode 4105', 7]].map(([p, n, at], i) => (
              <g key={p as string}>
                <Block x={20 + i * 122} y={292} w={100} h={40} label={p as string} sub={s >= (at as number) - (i === 0 ? 0 : 1) ? (n as string) : '?'} mono size={13}
                  state={s === at || (i === 1 && s === 4) || (i === 2 && s === 6) ? 'on' : s > (at as number) ? 'off' : 'dim'} />
                {i < 2 && <path d={`M${122 + i * 122} 312 h16`} stroke="var(--viz-dim)" strokeWidth={1.2} markerEnd="url(#viz-arrow-dim)" />}
              </g>
            ))}
            <Swap x={20} y={360} v={`inode ${look.n}`} size={12} weight={600} />
            {look.lines.map((l, i) => (
              <Swap key={i} x={20} y={384 + i * 22} v={l} size={12} dim={s < 3} weight={i === 2 && s >= 3 ? 600 : 400} />
            ))}

            {/* ---------- directory block / file data / capacity ---------- */}
            <Appear on={s <= 6}>
              <Swap x={400} y={284} v={s <= 5 ? 'DIRECTORY BLOCK 261 · /' : 'DIRECTORY BLOCK 16643 · /home'} size={11} dim />
              <Faint on={s >= 4}>
                {['inode', 'size', 'len', 'type', 'name'].map((h, i) => (
                  <Label key={h} x={COLS[i]} y={308} size={10.5} dim>{h}</Label>
                ))}
                {[0, 1, 2, 3].map((r) => {
                  const e = dir[r]
                  return (
                    <g key={r}>
                      <Block x={400} y={316 + r * 26} w={380} h={26} state={r === hotEntry ? 'on' : e ? 'off' : 'dim'} />
                      {e && e.map((c, i) => (
                        <Swap key={`${s <= 5}-${i}`} x={COLS[i]} y={333 + r * 26} v={c} size={11.5} weight={i === 4 || i === 0 ? 600 : 400} dim={i === 1 || i === 2} />
                      ))}
                    </g>
                  )
                })}
              </Faint>
            </Appear>
            <Appear on={s === 7}>
              <Label x={400} y={284} size={11} dim>DATA OF a.txt · 2500 bytes</Label>
              {[['16644', 'bytes 0–1023'], ['16645', '1024–2047'], ['16646', '2048–2499']].map(([b, r], i) => (
                <Block key={b} x={400 + i * 128} y={300} w={120} h={56} label={`block ${b}`} sub={r} mono size={12} state="on" />
              ))}
              <Label x={400} y={384} size={11.5}>3 blocks of 1 KiB: the last one is part empty.</Label>
              <Label x={400} y={406} size={11.5} dim>i_block[0..2] point at them, [3..11] = 0.</Label>
            </Appear>
            <Appear on={s === 8}>
              <Label x={400} y={284} size={11} dim>HOW BIG A FILE CAN GET (1 KiB blocks)</Label>
              <Label x={400} y={308} size={11.5}>one block = 1024 / 4 = 256 pointers</Label>
              {[['12 direct', '12', '12 KiB'], ['+ singly', '256', '256 KiB'], ['+ doubly', '256 × 256', '64 MiB'], ['+ triply', '256 × 256 × 256', '16 GiB']].map(([n, c, v], i) => (
                <g key={n}>
                  <Block x={400} y={318 + i * 28} w={380} h={28} state={i === 0 ? 'off' : 'on'} />
                  <Label x={412} y={337 + i * 28} size={11.5}>{n}</Label>
                  <Label x={530} y={337 + i * 28} size={11} dim>{c} blocks</Label>
                  <Label x={768} y={337 + i * 28} size={11.5} anchor="end" weight={600}>{v}</Label>
                </g>
              ))}
            </Appear>

            {/* ---------- motion ---------- */}
            <Packet on={s === 1} points={[[segMid('sb'), BAR_Y + BAR_H], [segMid('sb'), 100], [140, 100], [140, 122]]} duration={1.3} label="read 1024 B" />
            <Packet on={s === 2} points={[[segMid('bgdt'), BAR_Y + BAR_H], [segMid('bgdt'), 100], [390, 100], [390, 122]]} duration={1.3} />
            <Packet on={s === 3} points={[[490, 135], [510, 135], [510, 96], [segMid('it0'), 96], [segMid('it0'), BAR_Y + BAR_H]]} duration={1.6} />
            <Packet on={s === 4} points={[[550, 142], [515, 142], [515, 96], [segMid('d0'), 96], [segMid('d0'), BAR_Y + BAR_H]]} duration={1.6} />
            <Packet on={s === 5} points={[[490, 187], [510, 187], [510, 96], [segMid('it2'), 96], [segMid('it2'), BAR_Y + BAR_H]]} duration={1.6} />
            <Packet on={s === 6} points={[[550, 142], [515, 142], [515, 96], [segMid('d2'), 96], [segMid('d2'), BAR_Y + BAR_H]]} duration={1.4} />
            {[0, 1, 2].map((i) => (
              <Packet key={i} on={s === 7} points={[[550 + i * 40, 130], [550 + i * 40, 96], [segMid('d2') - 20 + i * 20, 96], [segMid('d2') - 20 + i * 20, BAR_Y + BAR_H]]} duration={1.4} delay={i * 0.25} />
            ))}
          </Scene>
        )
      }}
    </VizStage>
  )
}
