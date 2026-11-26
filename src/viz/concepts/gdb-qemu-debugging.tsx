/* Debugging a kernel with QEMU's built-in GDB stub (Kernel Debugging, GDB, QEMU articles):
   qemu -s -S (listen on TCP 1234, start paused) -> target remote :1234 -> symbol-file kernel.elf ->
   break -> continue -> info registers -> x/4wx $esp -> stepi.
   Worked example: boot code sets ESP = 0x00108000, pushes EBX (multiboot info) and EAX (magic 0x2BADB002),
   then calls kernel_main at 0x00101800. All values are consistent with that. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'gdb-qemu-debugging',
  title: 'GDB + QEMU: stop, look, step',
  summary: 'How QEMU waits for GDB on port 1234, and how break, continue, info registers, x and stepi let you predict a value and then check it.',
  lessons: ['t4m1l3', 'p6l6'],
  articles: ['Kernel Debugging', 'GDB', 'QEMU'],
  group: 'CPU',
  order: 413,
}

const steps: VizStep[] = [
  { caption: 'qemu -s -S: start paused and wait for GDB on TCP port 1234.', detail: '-s is short for -gdb tcp::1234. -S stops the CPU before the first instruction, so nothing runs until you say continue.' },
  { caption: 'In GDB, target remote :1234 connects to QEMU\'s built-in stub.', detail: 'Your kernel needs no debugger code: QEMU speaks GDB\'s remote protocol. The CPU is still at the reset vector: cs 0xf000, eip 0xfff0 (physical 0xFFFFFFF0).' },
  { caption: 'symbol-file kernel.elf loads function names and line numbers.', detail: 'Build with -g. GDB reads symbols from the unstripped ELF, even if QEMU boots a stripped or flat image.' },
  { caption: 'break *kernel_main sets a breakpoint on its very first instruction.', detail: 'The * means the exact address 0x101800 (line 12). Plain break kernel_main would stop after the prologue.' },
  { caption: 'continue runs the machine until it reaches kernel_main.', detail: 'BIOS, bootloader and your boot code all run at full speed, then the CPU stops at the breakpoint.' },
  { caption: 'info registers shows the CPU state at that instant.', detail: 'Boot code set esp = 0x108000, then pushed ebx, eax and the return address: 0x108000 − 3 × 4 = 0x107ff4. ebp = 0 because boot code cleared it.' },
  { caption: 'x/4wx $esp dumps four 32-bit words at the stack pointer.', detail: 'Predict first: return address, then the two values boot code pushed (multiboot magic 0x2BADB002, info pointer).' },
  { caption: 'stepi runs exactly one instruction, then stops again.', detail: 'The first instruction is push ebp (1 byte): eip moves by 1 and esp drops by 4. Each step checks one prediction.' },
  { caption: 'The loop: predict a value, run or step, observe, compare.', detail: 'A mismatch is the bug telling you where it is. Ctrl+C in GDB stops a hung kernel so you can look.', ms: 4200 },
]

type Line = { t: string; step: number; cmd?: boolean }
const LINES: Line[] = [
  { t: '(gdb) target remote :1234', step: 1, cmd: true },
  { t: 'Remote debugging using :1234', step: 1 },
  { t: '0x0000fff0 in ?? ()', step: 1 },
  { t: '(gdb) symbol-file kernel.elf', step: 2, cmd: true },
  { t: 'Reading symbols from kernel.elf...', step: 2 },
  { t: '(gdb) break *kernel_main', step: 3, cmd: true },
  { t: 'Breakpoint 1 at 0x101800: file kernel.c, line 12.', step: 3 },
  { t: '(gdb) continue', step: 4, cmd: true },
  { t: 'Breakpoint 1, kernel_main () at kernel.c:12', step: 4 },
  { t: '(gdb) info registers', step: 5, cmd: true },
  { t: 'eax 0x2badb002  ...  eip 0x101800 <kernel_main>', step: 5 },
  { t: '(gdb) x/4wx $esp', step: 6, cmd: true },
  { t: '0x107ff4: 0x0010000b 0x2badb002 0x00010000 0x00000000', step: 6 },
  { t: '(gdb) stepi', step: 7, cmd: true },
  { t: '0x00101801  12  {', step: 7 },
]
const MAXL = 11
const GX = 350
const LY0 = 86
const LH = 18

const STATUS = [
  'CPU paused · waiting on :1234',
  'paused · GDB attached',
  'paused · GDB attached',
  'paused · breakpoint set',
  'stopped at breakpoint 1',
  'stopped at 0x00101800',
  'stopped at 0x00101800',
  'stopped at 0x00101801',
  'stopped · your move',
]

const PREDICT: [string, string][] = [
  ['', ''], ['', ''], ['', ''], ['', ''],
  ['predict: it stops in kernel_main', 'observe: Breakpoint 1, kernel_main ✓'],
  ['predict: eip = 0x101800, esp = 0x107ff4', 'observe: eip 0x101800, esp 0x107ff4 ✓'],
  ['predict: [esp+4] = 0x2BADB002', 'observe: 0x2badb002 ✓'],
  ['predict: esp − 4, eip + 1', 'observe: esp 0x107ff0, eip 0x101801 ✓'],
  ['', ''],
]

export default function GdbQemuDebugging() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const vis = LINES.filter((l) => l.step <= s)
        const shift = Math.max(0, vis.length - MAXL)
        const stepped = s >= 7
        const regs: [string, string][] = [
          ['eip', stepped ? '0x101801  <kernel_main+1>' : '0x101800  <kernel_main>'],
          ['esp', stepped ? '0x107ff0' : '0x107ff4'],
          ['ebp', '0x00000000'],
          ['eax', '0x2badb002  multiboot magic'],
          ['eflags', '0x46  [ PF ZF ]'],
        ]
        return (
          <Scene label={meta.summary}>
            {/* ── QEMU window ── */}
            <Block x={20} y={40} w={280} h={122} state={s === 0 || s === 4 ? 'on' : 'off'} />
            <Label x={32} y={58} size={10.5} dim>QEMU · HOST SHELL</Label>
            <line x1={20} x2={300} y1={66} y2={66} stroke="var(--viz-faint)" />
            <Label x={32} y={86} size={11} weight={500}>$ qemu-system-i386 -s -S</Label>
            <Label x={32} y={104} size={11}>{'  -cdrom myos.iso'}</Label>
            <Block x={30} y={116} w={260} h={34} label={STATUS[s]} size={12} state={s === 4 ? 'fill' : 'off'} />
            <Pulse x={325} y={92} on={s === 0} r={12} />

            {/* ── link ── */}
            <Wire from={[GX, 84]} to={[302, 84]} on={s >= 1} />
            <Wire from={[300, 100]} to={[GX - 2, 100]} on={s >= 1} dim />
            <Label x={325} y={124} size={10.5} anchor="middle" on={s >= 1}>:1234</Label>
            <Packet on={s >= 1 && s <= 7} points={[[GX, 84], [300, 84]]} duration={0.9} />
            <Packet on={s >= 1 && s <= 7} points={[[300, 100], [GX, 100]]} duration={0.9} delay={0.6} />

            {/* ── GDB window ── */}
            <Block x={GX} y={40} w={430} h={272} state={s >= 1 && s <= 3 ? 'on' : 'off'} />
            <Label x={GX + 12} y={58} size={10.5} dim>GDB · HOST SHELL</Label>
            <line x1={GX} x2={780} y1={66} y2={66} stroke="var(--viz-faint)" />
            <Label x={GX + 12} y={LY0} size={11} on={s === 0} dim>$ gdb</Label>
            {LINES.map((l, i) => {
              const vi = vis.indexOf(l)
              const pos = vi >= 0 ? vi - shift : (LINES.indexOf(l) - shift)
              const shown = vi >= 0 && pos >= 0
              const fresh = l.step === s
              return (
                <motion.text key={i} x={GX + 12} initial={false}
                  animate={{ y: LY0 + Math.max(-1, pos) * LH, opacity: shown ? 1 : 0 }} transition={ease}
                  fill={l.cmd || fresh ? 'var(--viz-fg)' : 'var(--viz-dim)'}
                  style={{ fontSize: l.t.length > 46 ? 10.5 : 11, fontFamily: 'var(--font-mono)', fontWeight: l.cmd ? 500 : 400 }}>
                  {l.t}
                </motion.text>
              )
            })}
            <motion.text x={GX + 12} initial={false} animate={{ y: LY0 + Math.min(vis.length, MAXL) * LH, opacity: s >= 8 ? 1 : 0 }} transition={ease}
              fill="var(--viz-fg)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>(gdb) _</motion.text>

            {/* ── left bottom: symbols (2–4) then CPU state (5+) ── */}
            <Block x={20} y={180} w={280} h={250} state={s === 5 || s === 7 ? 'on' : 'off'} />
            <Appear on={s >= 2 && s <= 4}>
              <Label x={32} y={200} size={10.5} dim>kernel.elf · BUILT WITH -g</Label>
              <Label x={32} y={230} size={12} weight={500}>kernel_main</Label>
              <Label x={288} y={230} size={12} anchor="end">0x00101800</Label>
              <Label x={32} y={252} size={11} dim>kernel.c, line 12</Label>
              <Label x={32} y={284} size={11} dim>vga_init</Label>
              <Label x={288} y={284} size={11} anchor="end" dim>0x00101900</Label>
              <Label x={32} y={306} size={11} dim>_start</Label>
              <Label x={288} y={306} size={11} anchor="end" dim>0x00100000</Label>
              <Appear on={s >= 3}>
                <circle cx={38} cy={344} r={5} fill="var(--viz-fg)" />
                <Label x={52} y={348} size={12} weight={500}>breakpoint 1 @ 0x00101800</Label>
              </Appear>
              <Label x={52} y={372} size={12} on={s === 4} weight={500}>hit: eip = 0x00101800</Label>
            </Appear>
            <Pulse x={38} y={344} on={s === 3} r={10} />
            <Appear on={s <= 1}>
              <Label x={32} y={200} size={10.5} dim>CPU · BEFORE THE FIRST INSTRUCTION</Label>
              <Label x={34} y={232} size={12} dim>eip</Label>
              <Label x={100} y={232} size={12} weight={500}>0xfff0</Label>
              <Label x={34} y={262} size={12} dim>cs</Label>
              <Label x={100} y={262} size={12} weight={500}>0xf000</Label>
              <Label x={32} y={300} size={11} dim>reset vector: physical 0xFFFFFFF0</Label>
              <Label x={32} y={400} size={11} dim>no symbols yet: addresses only</Label>
            </Appear>
            <Appear on={s >= 5}>
              <Label x={32} y={200} size={10.5} dim>CPU STATE · info registers</Label>
              {regs.map(([n, v], i) => {
                const hot = (s === 5 && (i === 0 || i === 1)) || (s === 7 && (i === 0 || i === 1)) || (s === 6 && i === 1)
                return (
                  <g key={i}>
                    {hot && <rect x={24} y={214 + i * 30} width={272} height={26} fill="var(--viz-fg)" opacity={0.12} />}
                    <Label x={34} y={232 + i * 30} size={12} dim={!hot}>{n}</Label>
                    <Label x={100} y={232 + i * 30} size={12} weight={hot ? 500 : 400}>{v}</Label>
                  </g>
                )
              })}
              <Label x={32} y={400} size={10.5} dim>{stepped ? 'push ebp ran: 1 byte, 4 bytes pushed' : 'next instruction: push ebp'}</Label>
            </Appear>

            {/* ── right bottom: tip / memory + predictions / loop ── */}
            <Block x={GX} y={326} w={430} h={104} state={s === 6 || s === 8 ? 'on' : 'off'} />
            <Appear on={s <= 3}>
              <Label x={GX + 12} y={346} size={10.5} dim>TIP · PUT THESE IN .gdbinit</Label>
              <Label x={GX + 12} y={370} size={11.5}>file kernel.elf</Label>
              <Label x={GX + 12} y={390} size={11.5}>target remote localhost:1234</Label>
              <Label x={GX + 12} y={414} size={10.5} dim>GDB runs them every time it starts</Label>
            </Appear>
            <Appear on={s >= 4 && s <= 7}>
              <Label x={GX + 12} y={346} size={10.5} dim>{s === 6 ? 'MEMORY AT $esp = 0x107ff4' : 'PREDICT, THEN OBSERVE'}</Label>
              {s === 6 && (
                <g>
                  {['0x0010000b', '0x2badb002', '0x00010000', '0x00000000'].map((w, i) => (
                    <g key={i}>
                      <Block x={GX + 12 + i * 102} y={354} w={98} h={26} label={w} mono size={11.5} state={i === 1 ? 'on' : 'off'} />
                      <Label x={GX + 61 + i * 102} y={392} size={10} anchor="middle" dim>{['return addr', 'magic', 'mbi ptr', 'above stack'][i]}</Label>
                    </g>
                  ))}
                </g>
              )}
              <Label x={GX + 12} y={372} size={11.5} on={s !== 6}>{PREDICT[s][0]}</Label>
              <Label x={GX + 12} y={396} size={11.5} weight={500} delay={0.6} on={s !== 6}>{PREDICT[s][1]}</Label>
              <Label x={GX + 12} y={416} size={11} weight={500} on={s === 6}>{`${PREDICT[6][0]} · ${PREDICT[6][1]}`}</Label>
            </Appear>
            <Appear on={s === 8}>
              {['predict', 'run / stepi', 'observe', 'compare'].map((t, i) => (
                <Block key={i} x={GX + 12 + i * 104} y={342} w={92} h={34} label={t} size={12} state="off" />
              ))}
              {[0, 1, 2].map((i) => (
                <Wire key={i} from={[GX + 104 + i * 104, 359]} to={[GX + 114 + i * 104, 359]} on={s === 8} delay={0.2 * i} />
              ))}
              <Wire d={`M${GX + 370} 376 C ${GX + 370} 414, ${GX + 58} 414, ${GX + 58} 380`} on={s === 8} delay={0.6} />
              <Label x={GX + 214} y={422} size={10.5} anchor="middle" dim>repeat until they disagree</Label>
            </Appear>
            <Packet on={s === 8} points={[[GX + 58, 359], [GX + 162, 359], [GX + 266, 359], [GX + 370, 359], [GX + 370, 400], [GX + 214, 408], [GX + 58, 400], [GX + 58, 359]]} duration={4} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
