/* A first-fit kernel heap (kmalloc/kfree) on top of 4 KiB pages, as described in "Writing a memory manager"
   and "Memory Allocation". Worked example with an 8-byte header { uint32_t size; uint32_t free; } in front of
   every block; offsets are from heap_start, so every number can be checked by hand. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Packet, Label, Pulse, Appear, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'heap-allocator',
  title: 'A kernel heap: kmalloc and kfree',
  summary: 'kmalloc carves small blocks out of mapped pages: a header per block, first-fit search, splitting, freeing with merging, fragmentation and growing the heap by one more page.',
  lessons: ['t6m3l1'],
  articles: ['Memory Allocation', 'Writing a memory manager', 'Heap'],
  group: 'Memory',
  order: 670,
}

const steps: VizStep[] = [
  { caption: 'The heap starts as one mapped 4 KiB page holding a single free block.', detail: 'Every block begins with an 8-byte header: size (4 bytes) and a free flag (4 bytes). 4096 − 8 = 4088 bytes are usable.' },
  { caption: 'kmalloc(24) walks the blocks from the start: the first one that fits wins.', detail: 'Is the header free, and is size ≥ 24? 4088 ≥ 24, so yes. Otherwise the walk jumps to the next header at header + 8 + size.' },
  { caption: 'Split: 24 bytes become block A, the rest becomes a new free block.', detail: 'A new header goes right after A: 4088 − 24 − 8 = 4056 free. kmalloc returns heap_start + 8, the first byte after A’s header.' },
  { caption: 'kmalloc(100) and kmalloc(40) carve the free block again: B and C.', detail: 'Each split costs one more 8-byte header. What is left: 4056 − (100 + 8) − (40 + 8) = 3900 bytes.' },
  { caption: 'kfree(B): the header sits at B − 8. Set its free flag to 1.', detail: 'Nothing moves and nothing is erased. B’s 100 bytes are now a hole between two used blocks.' },
  { caption: 'Fragmentation: 4000 bytes are free, yet kmalloc(3950) finds no block.', detail: 'The free space is split into 100 and 3900. The walk visits every header and fails: no single block holds 3950 bytes.', ms: 3800 },
  { caption: 'kfree(A): A and its free neighbour B merge into one block.', detail: '24 + 8 + 100 = 132 bytes. The header between them is swallowed, so later walks have one hop fewer.' },
  { caption: 'Still no fit: map one more page and grow the last free block.', detail: 'The VMM takes a frame from the PMM and maps it after the heap. 3900 + 4096 = 7996 free, split for 3950, leaving 4038.', ms: 4000 },
]

const CALLS: [string, string][] = [
  ['heap_init()', 'page 0 mapped at heap_start'],
  ['kmalloc(24)', 'first block: free, 4088 ≥ 24 ✓'],
  ['kmalloc(24)', 'returns A = heap_start + 8'],
  ['kmalloc(100); kmalloc(40)', 'B = heap_start + 40,  C = heap_start + 148'],
  ['kfree(B)', 'header at B − 8 = heap_start + 32  →  free = 1'],
  ['kmalloc(3950)', '100 < 3950, 3900 < 3950  →  no fit'],
  ['kfree(A)', 'merge: 24 + 8 + 100 = 132'],
  ['kmalloc(3950)', 'map page 1, then D = heap_start + 196'],
]

type Seg = { x: number; w: number; used: boolean; size: number; show: boolean }
const H = (x: number): Seg => ({ x, w: 0, used: false, size: 0, show: false })
const U = (x: number, w: number, size: number): Seg => ({ x, w, used: true, size, show: true })
const F = (x: number, w: number, size: number): Seg => ({ x, w, used: false, size, show: true })

/* block layout per step (not to scale: page 0 = x 40..400, page 1 = x 400..760) */
const LAYOUT: Record<string, Seg[]> = {
  A: [H(40), H(40), U(40, 70, 24), U(40, 70, 24), U(40, 70, 24), U(40, 70, 24), F(40, 160, 132), F(40, 160, 132)],
  B: [H(110), H(110), H(110), U(110, 90, 100), F(110, 90, 100), F(110, 90, 100), H(200), H(200)],
  C: [H(200), H(200), H(200), U(200, 70, 40), U(200, 70, 40), U(200, 70, 40), U(200, 70, 40), U(200, 70, 40)],
  D: [H(270), H(270), H(270), H(270), H(270), H(270), H(270), U(270, 230, 3950)],
  free: [F(40, 360, 4088), F(40, 360, 4088), F(110, 290, 4056), F(270, 130, 3900), F(270, 130, 3900), F(270, 130, 3900), F(270, 130, 3900), F(500, 260, 4038)],
}
const OFFSET: Record<string, number[]> = { A: [0, 0, 0, 0, 0, 0, 0, 0], B: [32, 32, 32, 32, 32, 32, 32, 32], C: [140, 140, 140, 140, 140, 140, 140, 140], D: [188, 188, 188, 188, 188, 188, 188, 188], free: [0, 0, 32, 188, 188, 188, 188, 4146] }
const GLOW: string[][] = [[], ['free'], ['A'], ['B', 'C'], ['B'], ['B', 'free'], ['A'], ['D']]

/* header zoom: [block name, size, free flag, note] */
const FOCUS: [string, number, number, string][] = [
  ['the free block', 4088, 1, ''],
  ['the free block', 4088, 1, '4088 ≥ 24 ✓'],
  ['block A', 24, 0, ''],
  ['block C', 40, 0, ''],
  ['block B', 100, 1, 'free flag flipped'],
  ['the last block', 3900, 1, '3900 < 3950 ✗'],
  ['the merged free block', 132, 1, ''],
  ['block D', 3950, 0, ''],
]

/* [free bytes, largest free block, bytes in use] */
const STATS: [number, number, number][] = [
  [4088, 4088, 0], [4088, 4088, 0], [4056, 4056, 24], [3900, 3900, 164], [4000, 3900, 64], [4000, 3900, 64], [4032, 3900, 40], [4170, 4038, 3990],
]

const HY = 140 // header band top
const BY = 164 // payload top
const BH = 52 // payload height

function HeapBlock({ id, seg, glow, off }: { id: string; seg: Seg; glow: boolean; off: number }) {
  const cx = seg.x + seg.w / 2
  const name = id === 'free' ? 'free' : seg.used ? id : id === 'A' && seg.size === 132 ? 'A+B (free)' : `${id} (free)`
  return (
    <motion.g initial={false} animate={{ opacity: seg.show ? 1 : 0 }} transition={ease}>
      {/* header band */}
      <motion.rect initial={false} y={HY} height={24} animate={{ x: seg.x, width: seg.w, strokeWidth: glow ? 2.2 : 1 }} transition={ease}
        fill="var(--viz-bg)" stroke="var(--viz-fg)" filter={glow ? 'url(#viz-glow)' : undefined} />
      <motion.text initial={false} y={HY + 16} textAnchor="middle" animate={{ x: cx }} transition={ease}
        fill="var(--viz-fg)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
        {seg.size} · {seg.used ? 'used' : 'free'}
      </motion.text>
      {/* payload */}
      <motion.rect initial={false} y={BY} height={BH}
        animate={{ x: seg.x, width: seg.w, fill: seg.used ? 'var(--viz-fg)' : 'var(--viz-bg)', strokeWidth: glow ? 2.2 : 1 }} transition={ease}
        stroke="var(--viz-fg)" filter={glow ? 'url(#viz-glow)' : undefined} />
      <motion.text initial={false} y={BY + 24} textAnchor="middle" animate={{ x: cx, fill: seg.used ? 'var(--viz-bg)' : 'var(--viz-dim)' }} transition={ease}
        style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
        {name}
      </motion.text>
      <motion.text initial={false} y={BY + 40} textAnchor="middle" animate={{ x: cx, fill: seg.used ? 'var(--viz-bg)' : 'var(--viz-dim)' }} transition={ease}
        style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
        {seg.size} B
      </motion.text>
      {/* offset of the header from heap_start */}
      <motion.text initial={false} y={BY + BH + 16} textAnchor="start" animate={{ x: seg.x + 2 }} transition={ease}
        fill="var(--viz-dim)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
        +{off}
      </motion.text>
    </motion.g>
  )
}

function StatRow({ y, label, value, on }: { y: number; label: string; value: number; on?: boolean }) {
  const bw = (value / 8192) * 150
  return (
    <g>
      <Label x={420} y={y + 4} size={11} mono={false} dim={!on} weight={on ? 600 : 400}>{label}</Label>
      <rect x={560} y={y - 6} width={150} height={12} fill="none" stroke="var(--viz-faint)" />
      <motion.rect x={560} y={y - 6} height={12} initial={false} animate={{ width: bw }} transition={{ duration: 0.9, ease: [0.2, 0.75, 0.2, 1] }}
        fill="var(--viz-fg)" filter={on ? 'url(#viz-glow)' : undefined} />
      <text x={760} y={y + 4} textAnchor="end" fill="var(--viz-fg)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{value}</text>
    </g>
  )
}

export default function HeapAllocator() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const [fname, fsize, fflag, fnote] = FOCUS[s]
        const [free, largest, used] = STATS[s]
        return (
          <Scene label={meta.summary}>
            {/* current call and its result */}
            {CALLS.map(([c, r], i) => (
              <g key={i}>
                <Label x={40} y={34} size={16} weight={600} on={s === i}>{c}</Label>
                <Label x={760} y={34} size={11.5} anchor="end" dim on={s === i}>{r}</Label>
              </g>
            ))}

            {/* pages under the heap */}
            <Label x={40} y={66} size={10.5} dim>heap_start</Label>
            <Label x={400} y={66} size={10.5} dim anchor="middle">+4096</Label>
            <Label x={760} y={66} size={10.5} dim anchor="end">+8192</Label>
            <Block x={40} y={74} w={360} h={28} label="page 0 · mapped" size={11} mono state="off" />
            <Block x={400} y={74} w={360} h={28} label={s >= 7 ? 'page 1 · mapped' : 'page 1 · not mapped'} size={11} mono state={s >= 7 ? 'on' : 'dim'} />
            <Packet on={s === 7} points={[[580, 88], [580, 128], [630, 152]]} duration={1.4} label="map" />

            <Label x={40} y={130} size={10.5} dim>BLOCKS: 8-byte header + payload (not to scale)</Label>
            {(['free', 'A', 'B', 'C', 'D'] as const).map((id) => (
              <HeapBlock key={id} id={id} seg={LAYOUT[id][s]} glow={GLOW[s].includes(id)} off={OFFSET[id][s]} />
            ))}
            <Pulse x={220} y={152} on={s === 1} />
            <Packet on={s === 5} points={[[75, 152], [155, 152], [235, 152], [335, 152], [392, 152]]} duration={2.6} />

            {/* fragmentation: two holes */}
            <Appear on={s === 5} dy={4}>
              <path d="M110 246 V252 H200 V246" fill="none" stroke="var(--viz-fg)" />
              <path d="M270 246 V252 H400 V246" fill="none" stroke="var(--viz-fg)" />
              <Label x={155} y={268} size={10.5} anchor="middle">100</Label>
              <Label x={335} y={268} size={10.5} anchor="middle">3900</Label>
              <Label x={420} y={268} size={11} weight={600}>4000 free in two holes: neither holds 3950</Label>
            </Appear>
            <Appear on={s === 2}>
              <path d="M75 264 V222" fill="none" stroke="var(--viz-fg)" strokeWidth={1.6} markerEnd="url(#viz-arrow)" />
              <Label x={86} y={264} size={11} weight={600}>returned pointer = heap_start + 8</Label>
            </Appear>

            {/* header zoom */}
            <Label x={40} y={302} size={10.5} dim>HEADER OF {fname.toUpperCase()}</Label>
            <Block x={40} y={312} w={120} h={42} label="size" sub={String(fsize)} mono size={12} state={s === 2 || s === 6 || s === 7 ? 'on' : 'off'} />
            <Block x={160} y={312} w={80} h={42} label="free" sub={String(fflag)} mono size={12} state={s === 4 ? 'on' : 'off'} />
            <Block x={240} y={312} w={120} h={42} label="payload →" size={12} state="hatch" />
            <Label x={100} y={372} size={10.5} dim anchor="middle">4 bytes</Label>
            <Label x={200} y={372} size={10.5} dim anchor="middle">4 bytes</Label>
            <Label x={240} y={372} size={10.5}>ptr = header + 8</Label>
            <Label x={40} y={398} size={10.5} dim>next header = header + 8 + size</Label>
            {FOCUS.map((f, i) => (
              <Label key={i} x={360} y={398} size={11} anchor="end" weight={600} on={s === i && f[3] !== ''}>{f[3]}</Label>
            ))}

            {/* numbers */}
            <Label x={420} y={302} size={10.5} dim>HEAP NUMBERS (bytes, bar = 8192)</Label>
            <StatRow y={326} label="free" value={free} on={s === 5} />
            <StatRow y={356} label="largest free block" value={largest} on={s === 5 || s === 7} />
            <StatRow y={386} label="in use" value={used} />
            <Appear on={s === 5} dy={0}>
              <line x1={560 + (3950 / 8192) * 150} x2={560 + (3950 / 8192) * 150} y1={344} y2={368} stroke="var(--viz-fg)" strokeWidth={2} />
              <Label x={560 + (3950 / 8192) * 150 + 6} y={344} size={10.5}>3950 needed</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
