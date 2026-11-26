/* Linear framebuffer: address, pitch and 32-bit pixels; drawing a rectangle row by row; double buffering.
   Worked example: 1024 × 768 × 32 bpp, pitch 4096, framebuffer at 0xFD000000 (where QEMU's standard VGA
   usually places it). Pixel (100, 50) → 0xFD000000 + 50 × 4096 + 100 × 4 = 0xFD032190. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'framebuffer-pixels',
  title: 'Framebuffer: from (x, y) to a byte in memory',
  summary: 'How a linear framebuffer lays pixels out in memory (address, pitch, 32 bpp), how to draw a rectangle row by row, and why a back buffer stops flicker.',
  lessons: ['t12m1l1', 't12m1l2'],
  articles: ['Drawing In a Linear Framebuffer', 'Double Buffering', 'VESA Video Modes'],
  group: 'Devices',
  order: 1210,
}

const steps: VizStep[] = [
  { caption: 'The bootloader hands you a framebuffer: address, size, pitch, depth.', detail: 'From the VBE mode info block, the UEFI GOP (Mode->FrameBufferBase) or multiboot. The address is physical: map it before use.' },
  { caption: 'It is plain memory: row 0, then row 1, each pitch bytes long.', detail: 'Pitch = bytes from one row to the next. It can be larger than width × 4, so always step rows by pitch, never by width.' },
  { caption: 'At 32 bpp each pixel is 4 bytes, usually 0x00RRGGBB.', detail: 'In the usual mode (red at bit 16) the bytes in memory run blue, green, red, unused. Check the mode’s field positions or GOP PixelFormat before hard-coding it.' },
  { caption: 'Pixel (x, y) lives at fb + y × pitch + x × 4.', detail: '(100, 50): 0xFD000000 + 50 × 4096 + 100 × 4 = 0xFD000000 + 0x32190 = 0xFD032190.' },
  { caption: 'Draw a rectangle: fill one row, then move down one pitch.', detail: 'Two loops: rows outside, pixels inside. Writing whole rows in order is also the fastest way through memory.', ms: 3800 },
  { caption: 'Drawing straight to the screen shows half-finished frames.', detail: 'The display keeps reading the framebuffer while you draw. Top rows show the new frame, bottom rows the old one: tearing and flicker.', ms: 3800 },
  { caption: 'Double buffering: draw the next frame into a back buffer in RAM.', detail: 'The back buffer has the same size (pitch × height). The screen keeps showing the last finished frame meanwhile.', ms: 3800 },
  { caption: 'Then copy the finished frame to the framebuffer in one go.', detail: 'memcpy(fb, back, pitch * height) if both share a pitch, else copy row by row. No half-drawn objects; the copy can still race the display unless you sync to vertical retrace.', ms: 3800 },
]

const SX = 20 // screen
const SY = 120
const SW = 300
const SH = 225
const K = SW / 1024 // scale (same vertically: 225 / 768)
const BX = 470 // back buffer

const MEM: [string, string[]][] = [
  ['row 0   0xFD000000', ['px 0', 'px 1', '…', 'px 100', '…', 'px 1023']],
  ['row 1   0xFD001000', ['px 0', 'px 1', '…', 'px 100', '…', 'px 1023']],
  ['row 2   0xFD002000', ['px 0', 'px 1', '…', 'px 100', '…', 'px 1023']],
  ['…', []],
  ['row 50  0xFD032000', ['px 0', 'px 1', '…', 'px 100', '…', 'px 1023']],
  ['row 767 0xFD2FF000', ['px 0', 'px 1', '…', 'px 100', '…', 'px 1023']],
]

/** A rectangle drawn as 12 rows, each row sweeping in from the left. Coordinates are screen pixels. */
function RectRows({ ox, oy, px, py, show, stagger, dim }: {
  ox: number; oy: number; px: number; py: number; show: (row: number) => boolean; stagger: boolean; dim?: boolean
}) {
  const w = 400 * K
  const rh = (300 * K) / 12
  return (
    <g>
      {Array.from({ length: 12 }, (_, i) => (
        <motion.rect key={i} x={ox + px * K} y={oy + py * K + i * rh} height={rh - 0.8} initial={false}
          animate={{ width: show(i) ? w : 0, opacity: show(i) ? (dim ? 0.45 : 1) : 0 }}
          transition={{ duration: 0.25, delay: stagger && show(i) ? i * 0.16 : 0 }} fill="var(--viz-fg)" />
      ))}
    </g>
  )
}

export default function FramebufferPixels() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const memOn = s >= 1 && s <= 4
        const info = [
          { label: 'address', sub: '0xFD000000', on: s === 0 || s === 3 },
          { label: 'width', sub: '1024 px', on: s === 0 },
          { label: 'height', sub: '768 rows', on: s === 0 },
          { label: 'pitch', sub: '4096 bytes', on: s === 0 || s === 1 || s === 3 },
          { label: 'bpp', sub: '32 = 4 bytes', on: s === 0 || s === 2 },
        ]
        // which frame the screen shows: A = old position, B = new position
        const screenA = (i: number) => (s === 4 ? true : s === 5 ? i >= 6 : s === 6)
        const screenB = (i: number) => (s === 5 ? i < 6 : s === 7)
        return (
          <Scene label={meta.summary}>
            {/* mode info */}
            <Label x={20} y={18} size={11} dim>FRAMEBUFFER INFO (FROM VBE / GOP / MULTIBOOT)</Label>
            {info.map((b, i) => (
              <Block key={i} x={20 + i * 152} y={28} w={144} h={48} label={b.label} sub={b.sub} size={13} state={b.on ? 'on' : s === 0 ? 'off' : 'dim'} />
            ))}

            <Appear on={s === 0}>
              <Label x={470} y={220} size={12}>length = pitch × height</Label>
              <Label x={470} y={242} size={12}>= 4096 × 768 = 3 MiB of plain memory</Label>
              <Label x={470} y={268} size={11} dim>the graphics card scans it out to the screen</Label>
            </Appear>

            {/* the screen */}
            <Label x={SX} y={110} size={11} dim>SCREEN 1024 × 768 (FRONT BUFFER)</Label>
            <Block x={SX} y={SY} w={SW} h={SH} state={s === 5 ? 'on' : 'off'} />
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <line key={i} x1={SX} x2={SX + SW} y1={SY + (i * SH) / 8} y2={SY + (i * SH) / 8} stroke="var(--viz-faint)" />
            ))}
            <RectRows ox={SX} oy={SY} px={240} py={260} show={screenA} stagger={s === 4} dim={s === 5 || s === 6} />
            <RectRows ox={SX} oy={SY} px={440} py={260} show={screenB} stagger={false} />
            <Packet on={s === 1} duration={2.4} r={4}
              points={[[SX + 2, SY + 3], [SX + SW - 2, SY + 3], [SX + 2, SY + 9], [SX + SW - 2, SY + 9], [SX + 2, SY + 15], [SX + SW - 2, SY + 15]]} />
            <Appear on={s === 3}>
              <line x1={SX + 100 * K} x2={SX + 100 * K} y1={SY} y2={SY + SH} stroke="var(--viz-dim)" strokeDasharray="3 3" />
              <line x1={SX} x2={SX + SW} y1={SY + 50 * K} y2={SY + 50 * K} stroke="var(--viz-dim)" strokeDasharray="3 3" />
              <rect x={SX + 100 * K - 3} y={SY + 50 * K - 3} width={6} height={6} fill="var(--viz-fg)" />
              <Label x={SX + 100 * K + 8} y={SY + 50 * K + 18} size={11.5} weight={500}>(100, 50)</Label>
            </Appear>
            <Pulse x={SX + 100 * K} y={SY + 50 * K} on={s === 3} />
            {s === 5 && (
              <motion.g initial={{ y: 0 }} animate={{ y: [0, SH] }} transition={{ duration: 2.2, ease: 'linear', repeat: Infinity }}>
                <rect x={SX - 6} y={SY - 6} width={SW + 12} height={12} fill="var(--viz-glow)" />
                <rect x={SX - 6} y={SY - 1.5} width={SW + 12} height={3} fill="var(--viz-fg)" />
              </motion.g>
            )}
            {s === 7 && (
              <motion.rect x={SX} width={SW} height={10} fill="var(--viz-glow)" initial={{ y: SY }} animate={{ y: [SY, SY + SH - 10] }}
                transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.4 }} />
            )}

            {/* text under the screen */}
            <Appear on={s === 4}>
              <Label x={20} y={372} size={11}>for (y = top; y {'<'} top + h; y++)</Label>
              <Label x={36} y={390} size={11}>for (x = left; x {'<'} left + w; x++)</Label>
              <Label x={52} y={408} size={11}>*(uint32_t*)(fb + y*pitch + x*4) = c;</Label>
            </Appear>
            <Label x={20} y={372} size={11} on={s === 5}>top rows: new frame (you are still drawing)</Label>
            <Label x={20} y={390} size={11} dim on={s === 5}>bottom rows: old frame (not yet redrawn)</Label>
            <Label x={20} y={408} size={11} dim on={s === 5}>the bright line = display reading memory</Label>
            <Label x={20} y={372} size={11} on={s === 6}>screen: still the last whole frame</Label>
            <Label x={20} y={372} size={11} on={s === 7}>memcpy(fb, back, pitch * height);</Label>
            <Label x={20} y={390} size={11} dim on={s === 7}>3 MiB copied: no half-drawn objects</Label>

            {/* memory layout */}
            <Appear on={memOn} dx={10} dy={0}>
              <Label x={360} y={110} size={11} dim>MEMORY: ONE ROW AFTER ANOTHER</Label>
              {MEM.map(([lab, cells], r) => (
                <g key={r}>
                  <Label x={360} y={120 + r * 30 + 19} size={10.5} dim={!(s === 3 && r === 4) && !(s === 1 && r <= 1)}>{lab}</Label>
                  {cells.length === 0 ? (
                    <Block x={490} y={120 + r * 30} w={290} h={26} state="hatch" />
                  ) : (
                    cells.map((c, ci) => (
                      <Block key={ci} x={490 + ci * 48.33} y={120 + r * 30} w={48.33} h={26} mono size={10.5} label={c}
                        state={(s === 3 && r === 4 && ci === 3) || (s === 2 && r === 0 && ci === 0) ? 'on' : s === 1 && r <= 1 ? 'off' : s === 3 && r === 4 ? 'off' : 'dim'} />
                    ))
                  )}
                </g>
              ))}
              <Label x={490} y={316} size={10.5} dim on={s === 1}>row n starts at fb + n × pitch (0x1000 = 4096)</Label>
            </Appear>
            <Packet on={s === 1} duration={2.4} r={4} points={[[490, 133], [780, 133], [490, 163], [780, 163], [490, 193], [780, 193]]} />

            {/* pixel bytes */}
            <Appear on={s === 2}>
              <Label x={490} y={320} size={11} dim>PX 0 OF ROW 0 IN MEMORY (4 BYTES)</Label>
              {['BB', 'GG', 'RR', '00'].map((b, i) => (
                <Block key={i} x={490 + i * 64} y={328} w={64} h={32} label={b} mono size={13} state={i === 3 ? 'hatch' : 'on'} />
              ))}
              {['+0', '+1', '+2', '+3'].map((b, i) => <Label key={i} x={522 + i * 64} y={376} size={10.5} anchor="middle" dim>{b}</Label>)}
              <Label x={490} y={402} size={12} weight={500}>as a uint32_t: 0x00RRGGBB (usual)</Label>
              <Label x={490} y={420} size={10.5} dim>white = 0x00FFFFFF · black = 0x00000000</Label>
            </Appear>

            {/* address formula */}
            <Appear on={s === 3}>
              <Label x={360} y={330} size={11.5}>fb + y × pitch + x × 4</Label>
              <Label x={360} y={352} size={11.5}>= 0xFD000000 + 50 × 4096 + 100 × 4</Label>
              <Label x={360} y={374} size={11.5}>= 0xFD000000 + 0x32190</Label>
              <Label x={360} y={400} size={14} weight={500}>= 0xFD032190</Label>
            </Appear>

            {/* back buffer */}
            <Label x={420} y={210} size={11.5} on={s === 5}>you write rows ↓</Label>
            <Label x={420} y={232} size={11.5} dim on={s === 5}>the display reads rows ↓</Label>
            <Label x={420} y={254} size={11.5} dim on={s === 5}>at its own pace: they collide</Label>
            <Appear on={s >= 6} dx={10} dy={0}>
              <Label x={BX} y={110} size={11} dim>BACK BUFFER (ORDINARY RAM)</Label>
              <Block x={BX} y={SY} w={SW} h={SH} state={s === 6 ? 'on' : 'off'} />
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <line key={i} x1={BX} x2={BX + SW} y1={SY + (i * SH) / 8} y2={SY + (i * SH) / 8} stroke="var(--viz-faint)" />
              ))}
              <Label x={BX} y={372} size={11} on={s === 6}>draw_background(); draw_windows(); …</Label>
              <Label x={BX} y={390} size={11} dim on={s === 6}>nobody sees these half-done rows</Label>
            </Appear>
            <RectRows ox={BX} oy={SY} px={440} py={260} show={() => s >= 6} stagger={s === 6} />
            <Wire d={`M${BX - 4} ${SY + SH / 2} L${SX + SW + 6} ${SY + SH / 2}`} on={s === 7} />
            <Label x={(BX + SX + SW) / 2} y={SY + SH / 2 - 10} size={11} anchor="middle" on={s === 7}>copy</Label>
            <Packet on={s === 7} duration={1.4} points={[[BX, SY + SH / 2 + 16], [SX + SW, SY + SH / 2 + 16]]} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
