/* A bitmap page frame allocator. From "Page Frame Allocation" (bitmap of N/8 bytes, bit i of byte n = frame n*8+i,
   O(1) set, O(N) search, uint32_t compare to skip 32 used frames, stack alternative with O(1) alloc/free) and
   "Writing A Page Frame Allocator" (4 KiB frames, frames start after the kernel, return startframe + i*0x1000).
   Worked example: 128 MiB RAM = 32768 frames; kernel 0x00100000-0x00105FFF (frames 256-261), bitmap in frame 262. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Label, Appear, Pulse, Wire, Packet, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'frame-allocator-bitmap',
  title: 'Page frame allocator: the bitmap',
  summary: 'Physical RAM split into 4 KiB frames, tracked by one bit each: reserve what is taken, find the first free bit to allocate, clear it to free.',
  lessons: ['t6m1l3', 't6m1l2'],
  articles: ['Page Frame Allocation', 'Writing A Page Frame Allocator'],
  group: 'Memory',
  order: 613,
}

const steps: VizStep[] = [
  { caption: 'Physical RAM is handed out in 4 KiB pieces called frames.', detail: 'Frame n starts at n × 4096 (0x1000). This machine has 128 MiB, so 32768 frames. We zoom in on frames 248 to 279, around the 1 MiB mark.' },
  { caption: 'Keep one bit per frame: 0 = free, 1 = used.', detail: '32768 frames ÷ 8 = 4096 bytes, so the whole bitmap fits in one frame. Bit i of byte n describes frame n × 8 + i.' },
  { caption: 'Mark everything the memory map did not call usable as used.', detail: 'Every reserved entry and hole gets a 1. Most kernels also reserve all of the first 1 MiB (IVT, BIOS data, EBDA, VGA, ROMs), even the low RAM the map calls usable: frames 0 to 255.' },
  { caption: 'Mark the kernel, and the bitmap itself, as used.', detail: 'Here the kernel occupies 0x00100000 to 0x00105FFF: frames 256 to 261. The bitmap lives in frame 262. Skip this and alloc hands out your own code.' },
  { caption: 'alloc: scan for the first 0 bit.', detail: 'Test a whole uint32_t at a time: if it equals 0xFFFFFFFF, all 32 frames are used, so skip it. Remembering where the last search stopped also helps.' },
  { caption: 'Set the bit and return the frame address: index × 4096.', detail: 'Frame 263 → 263 × 4096 = 0x00107000. Setting a bit is O(1); the search is O(N) in the worst case.' },
  { caption: 'free: turn the address back into an index and clear the bit.', detail: '0x00107000 ÷ 4096 = 263 = byte 32, bit 7. The frame is free again, and the next alloc can return it.' },
  { caption: 'Another design: a stack of free frame addresses.', detail: 'alloc pops, free pushes: both O(1). But asking "is frame X free?" is slow, and 4 bytes per free frame costs 128 KiB here, against 4 KiB for the bitmap.', ms: 4200 },
]

const FIRST = 248
const PER_ROW = 16
const CW = 44
const GX = 48
const ROWS_Y = [112, 206]

function frameUsed(f: number, s: number) {
  if (f < 256) return s >= 2
  if (f <= 262) return s >= 3
  if (f === 263) return s === 5
  return false
}
function frameTag(f: number, s: number) {
  if (f < 256) return s >= 2 ? 'rsvd' : 'free'
  if (f <= 261) return s >= 3 ? 'kernel' : 'free'
  if (f === 262) return s >= 3 ? 'bitmap' : 'free'
  if (f === 263 && s === 5) return 'alloc'
  return 'free'
}
function byteVal(n: number, s: number) {
  let v = 0
  for (let i = 0; i < 8; i++) if (frameUsed(n * 8 + i, s)) v |= 1 << i
  return '0x' + v.toString(16).toUpperCase().padStart(2, '0')
}

type CodeProps = { lines: string[]; active: number[]; x: number; y: number; w: number; title: string }
function Code({ lines, active, x, y, w, title }: CodeProps) {
  const lh = 15
  return (
    <g>
      <Label x={x} y={y - 18} size={11} dim>{title}</Label>
      <rect x={x} y={y - 10} width={w} height={lines.length * lh + 10} fill="var(--viz-bg)" stroke="var(--viz-faint)" />
      {lines.map((l, i) => {
        const on = active.includes(i)
        return (
          <g key={i}>
            <motion.rect x={x + 1} y={y - 6 + i * lh} width={w - 2} height={lh} fill="var(--viz-fg)" initial={false} animate={{ opacity: on ? 0.12 : 0 }} transition={ease} />
            <motion.rect x={x + 1} y={y - 6 + i * lh} width={3} height={lh} fill="var(--viz-fg)" initial={false} animate={{ opacity: on ? 1 : 0 }} transition={ease} />
            <text x={x + 10} y={y + 5 + i * lh} fill="var(--viz-fg)" opacity={active.length && !on ? 0.55 : 1}
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', whiteSpace: 'pre', fontVariantLigatures: 'none', fontWeight: on ? 600 : 400 }}>{l}</text>
          </g>
        )
      })}
    </g>
  )
}

const INIT = [
  'memset(bitmap, 0, 4096);             // all free',
  'for (each range that is not type 1)',
  '  set_used(range);   // first 1 MiB too',
  'set_used(kernel_start, kernel_end);',
  'set_used(bitmap, bitmap + 4096);',
]
const ALLOC = [
  'uint32_t alloc_frame(void) {',
  '  for (i = 0; i < 32768; i++)',
  '    if (!(bitmap[i / 8] & (1 << (i % 8)))) {',
  '      bitmap[i / 8] |= 1 << (i % 8);',
  '      return i * 4096;',
  '    }',
]
const FREE = [
  'void free_frame(uint32_t addr) {',
  '  uint32_t i = addr / 4096;',
  '  bitmap[i / 8] &= ~(1 << (i % 8));',
  '}',
]
const STACK = [
  'uint32_t stack[...]; int top;',
  'alloc: return stack[--top];',
  'free:  stack[top++] = addr;',
]

export default function FrameAllocatorBitmap() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => (
        <Scene label={meta.summary}>
          {/* ---------- top: the whole of RAM and the zoom window ---------- */}
          <Label x={GX} y={30} size={12} weight={500}>frame n starts at n × 4096 (0x1000)</Label>
          <Label x={752} y={30} size={12} anchor="end" dim>RAM 128 MiB = 32768 frames</Label>
          <Label x={GX} y={50} size={12} weight={500} on={s >= 1}>bitmap: 32768 bits = 4096 bytes = exactly 1 frame</Label>
          <rect x={GX} y={60} width={704} height={10} fill="var(--viz-bg)" stroke="var(--viz-fg)" />
          {Array.from({ length: 31 }, (_, i) => (
            <line key={i} x1={GX + (i + 1) * 22} x2={GX + (i + 1) * 22} y1={60} y2={70} stroke="var(--viz-faint)" />
          ))}
          <rect x={GX + 4} y={57} width={6} height={16} fill="var(--viz-fg)" filter="url(#viz-glow)" />
          <line x1={GX + 4} y1={73} x2={GX} y2={108} stroke="var(--viz-dim)" strokeDasharray="3 3" />
          <line x1={GX + 10} y1={73} x2={752} y2={108} stroke="var(--viz-dim)" strokeDasharray="3 3" />
          <Label x={752} y={50} size={10.5} anchor="end" dim>zoom: frames 248–279 = 0x000F8000–0x00117FFF</Label>

          {/* ---------- frames + their bits ---------- */}
          {ROWS_Y.map((ry, r) => (
            <g key={r}>
              {Array.from({ length: PER_ROW }, (_, c) => {
                const f = FIRST + r * PER_ROW + c
                const x = GX + c * CW
                const tag = frameTag(f, s)
                const fill = (tag === 'kernel' || tag === 'bitmap' || tag === 'alloc')
                const rsvd = tag === 'rsvd'
                const hot = f === 263 && (s === 4 || s === 5 || s === 6)
                const used = frameUsed(f, s)
                return (
                  <g key={c}>
                    <Block x={x} y={ry} w={CW} h={36} state={hot && !fill ? 'on' : fill ? 'fill' : rsvd ? 'hatch' : 'off'} />
                    {hot && fill && <rect x={x} y={ry} width={CW} height={36} fill="none" stroke="var(--viz-fg)" strokeWidth={2.2} filter="url(#viz-glow)" />}
                    <text x={x + CW / 2} y={ry + 15} textAnchor="middle" fill={fill ? 'var(--viz-bg)' : 'var(--viz-fg)'}
                      style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{f}</text>
                    <text x={x + CW / 2} y={ry + 29} textAnchor="middle" fill={fill ? 'var(--viz-bg)' : 'var(--viz-dim)'}
                      style={{ fontSize: 10.5, fontFamily: 'var(--font-sans)' }}>{tag}</text>
                    {/* bit cell */}
                    <motion.g initial={false} animate={{ opacity: s >= 1 ? 1 : 0, y: s >= 1 ? 0 : -6 }} transition={{ ...ease, delay: c * 0.02 }}>
                      <motion.rect x={x} y={ry + 40} width={CW} height={22} initial={false} stroke="var(--viz-faint)"
                        animate={{ fill: used ? 'var(--viz-fg)' : 'var(--viz-bg)' }} transition={ease} />
                      <motion.text x={x + CW / 2} y={ry + 56} textAnchor="middle" initial={false}
                        animate={{ fill: used ? 'var(--viz-bg)' : 'var(--viz-fg)' }} transition={ease}
                        style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{used ? 1 : 0}</motion.text>
                    </motion.g>
                  </g>
                )
              })}
              {/* byte brackets */}
              <Appear on={s >= 1} dy={0}>
                {[0, 1].map((b) => {
                  const n = (FIRST + r * PER_ROW) / 8 + b
                  const x0 = GX + b * 8 * CW
                  const hot = (s === 5 || s === 6) && n === 32
                  return (
                    <g key={b}>
                      <path d={`M${x0 + 4} ${ry + 66} v5 H${x0 + 8 * CW - 4} v-5`} fill="none" stroke={hot ? 'var(--viz-fg)' : 'var(--viz-dim)'} />
                      <Label x={x0 + 4 * CW} y={ry + 84} size={11} anchor="middle" weight={hot ? 600 : 400} dim={!hot}>
                        {`bitmap[${n}] = ${byteVal(n, s)}   (bit 0 = frame ${n * 8})`}
                      </Label>
                    </g>
                  )
                })}
              </Appear>
            </g>
          ))}
          <Label x={GX - 6} y={ROWS_Y[0] + 56} size={10.5} anchor="end" on={s >= 1} dim>bit</Label>

          {/* scan cursor (alloc search) */}
          {s === 4 && (
            <motion.rect y={ROWS_Y[0] + 38} width={CW} height={26} fill="none" stroke="var(--viz-fg)" strokeWidth={2.4} filter="url(#viz-glow)"
              initial={{ x: GX }}
              animate={{ x: [...Array.from({ length: 16 }, (_, i) => GX + i * CW), GX + 15 * CW, GX + 15 * CW] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 0.6, ease: 'linear' }} />
          )}
          <Pulse x={GX + 15 * CW + CW / 2} y={ROWS_Y[0] + 18} on={s === 4 || s === 6} r={16} />

          {/* ---------- bottom: code ---------- */}
          <Appear on={s >= 1 && s <= 3}>
            <Code title="SETUP" lines={INIT} active={s === 1 ? [0] : s === 2 ? [1, 2] : s === 3 ? [3, 4] : []} x={GX} y={326} w={392} />
          </Appear>
          <Appear on={s === 4 || s === 5}>
            <Code title="ALLOC" lines={ALLOC} active={s === 4 ? [1, 2] : [3, 4]} x={GX} y={326} w={392} />
          </Appear>
          <Appear on={s === 6}>
            <Code title="FREE" lines={FREE} active={[1, 2]} x={GX} y={326} w={392} />
          </Appear>
          <Appear on={s === 7}>
            <Code title="FREE-FRAME STACK" lines={STACK} active={[1, 2]} x={GX} y={326} w={392} />
          </Appear>

          {/* ---------- bottom right: results ---------- */}
          <Appear on={s === 5}>
            <Label x={470} y={316} size={11} dim>RESULT</Label>
            <Block x={470} y={326} w={282} h={50} state="on" />
            <Label x={484} y={348} size={13} weight={600}>alloc_frame() → 0x00107000</Label>
            <Label x={484} y={366} size={11} dim>263 × 4096 = 0x107000</Label>
            <Label x={470} y={400} size={11} dim>bitmap[32]: 0x7F → 0xFF (bit 7 set)</Label>
          </Appear>
          <Packet on={s === 5} points={[[GX + 15 * CW + CW / 2, ROWS_Y[0] + 36], [GX + 15 * CW + CW / 2, 300], [611, 326]]} duration={1.2} label="0x107000" />

          <Appear on={s === 6}>
            <Label x={470} y={316} size={11} dim>FREE</Label>
            <Block x={470} y={326} w={282} h={50} state="on" />
            <Label x={484} y={348} size={13} weight={600}>free_frame(0x00107000)</Label>
            <Label x={484} y={366} size={11} dim>0x107000 / 4096 = 263</Label>
            <Label x={470} y={400} size={11} dim>263 = 32 × 8 + 7 → bitmap[32], bit 7</Label>
          </Appear>

          <Appear on={s === 7}>
            <Label x={470} y={316} size={11} dim>STACK OF FREE FRAMES</Label>
            {['0x00107000', '0x00108000', '0x00109000', '…'].map((a, i) => (
              <Block key={i} x={630} y={326 + i * 24} w={122} h={24} label={a} mono size={11.5} state={i === 0 ? 'on' : 'off'} />
            ))}
            <Wire from={[584, 338]} to={[626, 338]} />
            <Label x={580} y={342} size={11} anchor="end" weight={600}>top</Label>
            <Label x={470} y={372} size={11}>pop / push: O(1)</Label>
            <Label x={470} y={390} size={11} dim>4 B per free frame</Label>
            <Label x={470} y={408} size={11} dim>= 128 KiB vs 4 KiB</Label>
          </Appear>
        </Scene>
      )}
    </VizStage>
  )
}
