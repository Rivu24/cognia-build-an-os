/* libc layers: printf("hi %d\n", 4) from a user program down to the screen.
   Portable libc code (formatting, stdio buffering) sits on a thin OS-specific layer of system call stubs.
   That layer is what you write when porting Newlib (newlib/libc/sys/myos/syscalls.c, 17 glue calls).
   Register use follows Linux i386 for the example (eax = 4 is write there); your own ABI may differ. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'libc-layers',
  title: 'printf, down through libc to the screen',
  summary: 'printf formats "hi 4\\n" inside libc, stdio buffers it, a newline flushes it through write(1, buf, 5) and int 0x80 to sys_write and the terminal driver; only the syscall stubs are OS-specific.',
  lessons: ['t8m3l1', 't14m1l2', 'p5l4'],
  articles: ['C Library', 'Porting Newlib', 'Creating a C Library'],
  group: 'User space',
  order: 831,
}

const steps: VizStep[] = [
  { caption: 'A user program calls printf("hi %d\\n", 4). printf lives in libc, not in the kernel.', detail: 'libc is linked into every program. The program runs in ring 3: it cannot touch the screen, so somewhere below a system call must happen.' },
  { caption: 'libc formats the text: %d with 4 gives "hi 4\\n", five bytes.', detail: 'This is plain C code (vfprintf). It makes no system call and is the same on every OS.' },
  { caption: 'The five bytes go into stdout’s buffer. Nothing reaches the screen yet.', detail: 'stdio collects bytes so it can make fewer system calls. A stdout that is a terminal is line-buffered (Newlib asks isatty(1) to decide).' },
  { caption: 'The ‘\\n’ ends a line, so stdio flushes: it calls write(1, buf, 5).', detail: 'fd 1 is standard output. If stdout were a file or a pipe, it would be fully buffered and wait until the buffer fills or the program calls fflush or exit.', ms: 3800 },
  { caption: 'write() is a tiny stub: arguments into registers, then int 0x80 into the kernel.', detail: 'Here eax = 4 (write in Linux i386 numbering), ebx = fd, ecx = buffer, edx = count. Your own kernel picks its own numbers.', ms: 3800 },
  { caption: 'The kernel’s sys_write checks fd 1 and the buffer, then hands 5 bytes to the terminal.', detail: 'fd 1 of this process refers to the console. The pointer must be user memory, or a bad program could make the kernel read anywhere.' },
  { caption: 'The terminal driver writes the characters into video memory: "hi 4" appears.', detail: 'In VGA text mode each character is 2 bytes at 0xB8000 (character, colour). ‘\\n’ moves the cursor to the next line. write returns 5.' },
  { caption: 'Only the stubs at the bottom of libc are OS-specific. That is what porting Newlib means.', detail: 'Newlib needs 17 glue calls (_exit, read, write, sbrk, isatty, fstat…) plus crt0 with _start, which calls main and then exit. The rest builds unchanged.', ms: 4600 },
]

const LX = 20, LW = 330, CX = LX + LW / 2
const L = [
  { y: 30, h: 48 },
  { y: 92, h: 48 },
  { y: 154, h: 48 },
  { y: 216, h: 48 },
  { y: 312, h: 44 },
  { y: 370, h: 44 },
]
const RX = 390
const BUF = ['h', 'i', '␣', '4', '\\n', '', '', '']
const REGS = [['eax = 4', 'SYS_write'], ['ebx = 1', 'fd: stdout'], ['ecx = buf', 'the 5 bytes'], ['edx = 5', 'count']]
const GLUE = ['_exit', 'close', 'fstat', 'isatty', 'read', 'sbrk', 'write', '+10 more']

/** Text that fades in whenever it changes. */
function Swap({ x, y, v, size = 11, dim, anchor = 'start', weight = 400 }: { x: number; y: number; v: string; size?: number; dim?: boolean; anchor?: 'start' | 'middle' | 'end'; weight?: number }) {
  return (
    <motion.text key={v} x={x} y={y} textAnchor={anchor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={ease}
      fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>
      {v}
    </motion.text>
  )
}

export default function LibcLayers() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const port = s === 7
        const layerState = (i: number): 'on' | 'off' | 'dim' => {
          if (port) return i === 3 ? 'on' : i <= 2 ? 'off' : 'dim'
          const active = [0, 1, 2, 3, 3, 4, 5][s]
          return i === active ? 'on' : i < active ? 'off' : 'dim'
        }
        const sub = [
          port ? 'portable: same on every OS' : 'your program',
          port ? 'portable: same on every OS' : 'libc: turns %d into text',
          port ? 'portable: same on every OS' : 'libc: collects bytes',
          port ? 'OS-specific: the part you port' : 'libc: system call stub',
          'kernel: checks fd and pointer',
          'kernel: fd 1 → console',
        ]
        const title = ['printf("hi %d\\n", 4);', 'vfprintf()', 'stdout  (FILE *)', 'write(1, buf, 5)', 'sys_write(1, buf, 5)', 'terminal driver']
        return (
          <Scene label={meta.summary}>
            <Label x={LX} y={22} size={11} dim>USER SPACE · RING 3</Label>
            {L.map((l, i) => (
              <Block key={i} x={LX} y={l.y} w={LW} h={l.h} label={title[i]} sub={sub[i]} mono size={13} state={layerState(i)} />
            ))}
            {/* layer-to-layer wires */}
            {[0, 1, 2, 4].map((i) => (
              <Wire key={i} from={[CX, L[i].y + L[i].h]} to={[CX, L[i + 1].y - 2]} dim={!port && s <= i} width={1.2} />
            ))}
            <Wire from={[CX, L[3].y + L[3].h]} to={[CX, L[4].y - 2]} dim={s < 4 || port} width={1.2} />

            {/* privilege boundary */}
            <line x1={20} x2={780} y1={286} y2={286} stroke="var(--viz-dim)" strokeDasharray="6 6" />
            <Label x={780} y={280} size={10.5} anchor="end" dim>privilege boundary</Label>
            <Label x={LX} y={304} size={11} dim>KERNEL · RING 0</Label>
            <Label x={CX + 10} y={300} size={11} weight={600} on={s === 4}>int 0x80</Label>

            {/* --- formatting --- */}
            <motion.g initial={false} animate={{ opacity: port ? 0.3 : 1 }} transition={ease}>
            <Label x={RX} y={L[1].y + 6} size={11} dim>FORMAT</Label>
            <Label x={RX} y={L[1].y + 30} size={13}>"hi %d\n" + 4</Label>
            <Label x={RX + 140} y={L[1].y + 30} size={13} on={s >= 1} weight={600}>→ "hi 4\n"</Label>
            <Label x={780} y={L[1].y + 6} size={11} anchor="end" on={s >= 1} dim>5 bytes</Label>
            <Pulse x={RX + 42} y={L[1].y + 26} on={s === 1} r={12} />

            {/* --- stdout buffer --- */}
            <Label x={RX} y={L[2].y - 2} size={10.5} dim>STDOUT BUFFER</Label>
            {BUF.map((c, i) => (
              <g key={i}>
                <Block x={RX + i * 34} y={L[2].y + 6} w={34} h={40} state={s === 3 && i === 4 ? 'on' : 'off'} />
                <Label x={RX + i * 34 + 17} y={L[2].y + 31} size={13} anchor="middle" on={c !== '' && s >= 2 && s <= 6} delay={s === 2 ? 0.3 + i * 0.12 : 0}>{c}</Label>
              </g>
            ))}
            <Swap x={780} y={L[2].y + 22} v={s === 3 ? '‘\\n’ → flush' : 'line-buffered'} anchor="end" weight={s === 3 ? 600 : 400} dim={s !== 3 && s !== 2} />
            <Label x={780} y={L[2].y + 38} size={10.5} anchor="end" dim>isatty(1) = 1</Label>
            </motion.g>

            {/* --- registers for the stub, swapped for the port list in the last step --- */}
            <Appear on={!port}>
              {REGS.map(([r, d], i) => (
                <Block key={r} x={RX + i * 98} y={L[3].y} w={94} h={L[3].h} label={r} sub={d} mono size={12} state={s === 4 ? 'on' : s > 4 ? 'off' : 'dim'} />
              ))}
            </Appear>
            <Appear on={port}>
              <Label x={RX} y={280} size={10.5}>newlib/libc/sys/myos/syscalls.c</Label>
              {GLUE.map((g, i) => (
                <Block key={g} x={RX + (i % 4) * 98} y={L[3].y + Math.floor(i / 4) * 25} w={94} h={23} label={g} mono size={11} state={i === 6 ? 'on' : i === 7 ? 'dim' : 'off'} />
              ))}
            </Appear>

            {/* --- screen --- */}
            <motion.g initial={false} animate={{ opacity: port ? 0.3 : 1 }} transition={ease}>
            <Block x={RX} y={312} w={390} h={102} state={s === 6 ? 'on' : 'off'} />
            <Label x={RX + 12} y={330} size={10.5} dim>SCREEN · VGA text memory at 0xB8000</Label>
            <Label x={RX + 12} y={362} size={18} weight={500} on={s >= 6}>hi 4</Label>
            <motion.rect x={RX + 12} y={378} width={10} height={18} fill="var(--viz-fg)" initial={false}
              animate={{ opacity: s >= 6 ? [1, 0, 1] : 0 }} transition={{ duration: 1, repeat: s >= 6 ? Infinity : 0 }} />
            <Label x={RX + 380} y={404} size={10.5} anchor="end" dim on={s >= 6}>write returned 5</Label>
            </motion.g>

            {/* --- motion: what flows where --- */}
            <Packet on={s === 0} points={[[CX, L[0].y + L[0].h], [CX, L[1].y]]} duration={1} />
            <Packet on={s === 1} points={[[LX + LW, L[1].y + 24], [RX + 60, L[1].y + 24]]} duration={1.1} />
            <Packet on={s === 2} points={[[RX + 230, L[1].y + 36], [RX + 230, L[2].y - 12], [RX + 80, L[2].y - 12], [RX + 80, L[2].y + 6]]} duration={1.4} label="5 B" />
            <Packet on={s === 3} points={[[RX, L[2].y + 26], [370, L[2].y + 26], [370, L[3].y + 24], [LX + LW, L[3].y + 24]]} duration={1.5} label="5 B" />
            <Packet on={s === 4} points={[[CX, L[3].y + L[3].h], [CX, L[4].y]]} duration={1.2} />
            <Packet on={s === 5} points={[[CX, L[4].y + L[4].h], [CX, L[5].y]]} duration={1} />
            <Packet on={s === 6} points={[[LX + LW, L[5].y + 22], [RX, L[5].y + 22], [RX + 30, 356]]} duration={1.2} label="hi 4" />
          </Scene>
        )
      }}
    </VizStage>
  )
}
