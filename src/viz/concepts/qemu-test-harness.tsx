/* An automated boot test with QEMU. Flags from the QEMU article (-serial, -no-reboot) plus -display none and the
   isa-debug-exit device described in lesson t4m3l3 (not on the wiki): with -device isa-debug-exit,iobase=0xf4,iosize=0x04,
   writing v to port 0xf4 makes QEMU exit with status (v << 1) | 1. So 0x10 → 33 (pass), 0x11 → 35 (fail).
   `timeout 10s` turns a hang into status 124. The wrapper maps 33 to 0 and everything else to 1. COM1 = port 0x3F8. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'qemu-test-harness',
  title: 'make test: a headless QEMU harness',
  summary: 'make test boots the kernel in QEMU with no display, logs PASS/FAIL to a serial file, and ends the run through isa-debug-exit at port 0xf4, whose exit status (value << 1) | 1 a wrapper turns into pass or fail.',
  lessons: ['t4m3l3', 't4m3l2', 'p6l5'],
  articles: ['Unit Testing', 'QEMU'],
  group: 'CPU',
  order: 433,
}

const steps: VizStep[] = [
  { caption: 'make test boots the kernel in QEMU with no window, inside timeout 10s.', detail: '-display none: nothing to look at, so it runs on a build server. -no-reboot: a triple fault stops QEMU instead of rebooting in a loop.' },
  { caption: '-serial file:serial.log sends every byte written to COM1 into a file.', detail: 'COM1 is I/O port 0x3F8. The file stays after QEMU exits, so you can read exactly which test failed and what it printed.' },
  { caption: 'The kernel runs its tests and prints PASS or FAIL for each one to serial.', detail: 'Print the test name before running it: if a test hangs or crashes, the last line in the log tells you which one it was.', ms: 3800 },
  { caption: '-device isa-debug-exit adds a tiny exit device at I/O port 0xf4.', detail: 'iobase=0xf4 picks the port, iosize=0x04 makes it 4 bytes wide. The device is made for tests: writing to it ends QEMU on the spot.' },
  { caption: 'All tests passed, so the kernel writes 0x10 to port 0xf4. QEMU exits at once.', detail: 'outb(0xf4, 0x10). No shutdown code, no ACPI: one port write ends the run.' },
  { caption: 'QEMU’s exit status is (value << 1) | 1. For 0x10 that is 33.', detail: '0x10 << 1 = 0x20 = 32, and | 1 gives 33. The status is always odd, so the guest can never produce 0 (success) by itself.', ms: 3800 },
  { caption: 'A test fails: the kernel writes 0x11 instead, and QEMU exits with 35.', detail: '0x11 << 1 = 0x22 = 34, | 1 = 35. serial.log shows which test printed FAIL.', ms: 3800 },
  { caption: 'If the kernel hangs, timeout kills QEMU after 10 s. That counts as a fail too.', detail: 'timeout exits with 124. A triple fault with -no-reboot stops QEMU without touching port 0xf4. Neither is 33.', ms: 3800 },
  { caption: 'The wrapper maps 33 to 0 and anything else to 1, so make sees pass or fail.', detail: 'Exit code 0 means success to make, shell scripts and CI. Now every checkpoint can become a test that runs in seconds. Crash drills such as the SSP trip get a boot of their own.', ms: 4000 },
]

const CMD = [
  'timeout 10s qemu-system-i386 -cdrom myos.iso',
  '  -display none  -no-reboot',
  '  -serial file:serial.log',
  '  -device isa-debug-exit,iobase=0xf4,iosize=0x04',
]
const CMD_HOT: Record<number, number[]> = { 0: [0, 1], 1: [2], 3: [3], 7: [0] }

const TESTS = ['kprintf_format', 'memcmp_basic', 'pmm_alloc_free']

// columns
const LX = 20, LW = 460
const RX = 500, RW = 280
// QEMU box parts
const QY = 156
const TX = 36, TW = 250
const tY = (i: number) => QY + 40 + i * 28
const DX = 312, DW = 152
const COM_Y = QY + 40, EXIT_Y = QY + 168

/** Text that fades in whenever its value changes. */
function Val({ x, y, v, size = 13, anchor = 'start', weight = 500, dim, inv }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean; inv?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill={inv ? 'var(--viz-bg)' : dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>{v}</text>
    </motion.g>
  )
}

export default function QemuTestHarness() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const fail = s === 6
        const hang = s === 7
        const code = fail ? '0x11' : '0x10'
        const result = (i: number) => (s < 2 ? '' : hang && i === 2 ? '…' : fail && i === 2 ? 'FAIL' : 'PASS')
        const status = s < 5 ? (s === 4 ? '…' : '—') : fail ? '35' : hang ? '124' : '33'
        const logLines = s < 2 ? [] : TESTS.map((t, i) => `${t}: ${result(i)}`).filter((_, i) => !(hang && i === 2)).concat(hang ? ['pmm_alloc_free: …'] : [])
        return (
          <Scene label={meta.summary}>
            {/* ===== host: the command ===== */}
            <Label x={LX} y={24} size={11} dim>HOST · make test</Label>
            {CMD.map((c, i) => (
              <Block key={i} x={LX} y={32 + i * 24} w={LW} h={24} state={(CMD_HOT[s] ?? []).includes(i) ? 'on' : s >= 2 && s !== 3 && s !== 7 ? 'dim' : 'off'} />
            ))}
            {CMD.map((c, i) => (
              <Label key={i} x={LX + 10} y={48 + i * 24} size={11.5} weight={i === 0 ? 500 : 400}>{c}</Label>
            ))}

            {/* ===== QEMU guest ===== */}
            <rect x={LX} y={QY} width={LW} height={232} fill="none" stroke="var(--viz-fg)" />
            <Label x={LX + 12} y={QY + 22} size={11} dim>QEMU · no display · guest kernel</Label>
            <Wire from={[LX + LW / 2, 128]} to={[LX + LW / 2, QY - 2]} on={s === 0} />

            {TESTS.map((t, i) => (
              <g key={t}>
                <Block x={TX} y={tY(i)} w={TW} h={28} state={s === 2 || (fail && i === 2) || (hang && i === 2) ? 'on' : s < 2 ? 'dim' : 'off'} />
                <Label x={TX + 10} y={tY(i) + 18} size={11.5}>{`test ${t}`}</Label>
                <Val x={TX + TW - 10} y={tY(i) + 18} anchor="end" v={result(i)} size={11.5} weight={600} />
              </g>
            ))}
            <Block x={TX} y={EXIT_Y} w={TW} h={40} label={`outb(0xf4, ${code});`} sub={fail ? '// a test failed' : '// all passed'} mono size={12}
              state={s === 4 || s === 6 ? 'on' : hang ? 'dim' : s >= 4 ? 'off' : 'dim'} />
            <Label x={TX + TW / 2} y={EXIT_Y + 58} size={11} anchor="middle" weight={600} on={hang}>never reached: stuck in pmm_alloc_free</Label>

            <Block x={DX} y={COM_Y} w={DW} h={44} label="COM1" sub="port 0x3F8" mono size={12} state={s === 1 || s === 2 ? 'on' : 'off'} />
            <Appear on={s >= 3}>
              <Block x={DX} y={EXIT_Y} w={DW} h={40} label="isa-debug-exit" sub="port 0xf4" mono size={12} state={s >= 3 && s <= 6 ? 'on' : 'off'} />
            </Appear>
            <Pulse x={DX + DW / 2} y={EXIT_Y + 20} on={s === 3} r={18} />

            {/* ===== host: serial.log ===== */}
            <Label x={RX} y={24} size={11} dim>HOST FILE · serial.log</Label>
            <Block x={RX} y={32} w={RW} h={96} state={s === 1 || s === 6 ? 'on' : 'off'} />
            {logLines.map((l, i) => (
              <Val key={i} x={RX + 12} y={56 + i * 22} v={l} size={11.5} weight={l.includes('FAIL') ? 700 : 400} />
            ))}
            <Wire d={`M${DX + DW} ${COM_Y + 22} H${RX - 8} V80 H${RX - 2}`} on={s >= 1} width={1.2} />

            {/* ===== exit status ===== */}
            <Label x={RX} y={160} size={11} dim>QEMU EXIT STATUS</Label>
            <Block x={RX} y={168} w={RW} h={92} state={s >= 5 && s <= 7 ? 'on' : 'off'} />
            <Appear on={s === 5 || s === 6}>
              <Val x={RX + 14} y={194} v={`(${code} << 1) | 1`} size={13} weight={400} />
              <Val x={RX + 14} y={216} v={fail ? '= 0x22 | 1 = 0x23' : '= 0x20 | 1 = 0x21'} size={12} weight={400} dim />
            </Appear>
            <Appear on={hang}>
              <Label x={RX + 14} y={194} size={13}>timeout: 10 s passed</Label>
              <Label x={RX + 14} y={216} size={12} dim>QEMU killed, no port write</Label>
            </Appear>
            <Label x={RX + 14} y={194} size={12} dim on={s < 5 || s === 8}>{s === 8 ? 'pass 33 · fail 35 · hang 124' : 'still running'}</Label>
            <Val x={RX + RW - 14} y={248} anchor="end" v={status} size={24} weight={600} />
            <Wire d={`M${DX + DW} ${EXIT_Y + 20} H${RX - 20} V244 H${RX - 2}`} on={s >= 4 && s !== 7} width={1.2} />

            {/* ===== wrapper ===== */}
            <Label x={RX} y={292} size={11} dim>WRAPPER (make test)</Label>
            <Block x={RX} y={300} w={RW} h={52} state={s === 8 ? 'on' : 'off'} />
            <Label x={RX + 12} y={321} size={11.5}>[ $status -eq 33 ] &amp;&amp; exit 0</Label>
            <Label x={RX + 12} y={341} size={11.5}>exit 1</Label>
            <Wire from={[RX + RW / 2, 262]} to={[RX + RW / 2, 298]} on={s >= 5} width={1.2} />
            <Block x={RX} y={360} w={RW} h={36} state={s >= 5 ? 'fill' : 'dim'} />
            <motion.g initial={false} animate={{ opacity: s >= 5 ? 1 : 0 }} transition={ease}>
              <Val x={RX + RW / 2} y={383} anchor="middle" size={13} weight={600} inv
                v={s < 5 ? '' : fail || hang ? 'exit 1 · FAIL' : 'exit 0 · PASS'} />
            </motion.g>

            {/* ===== motion ===== */}
            {TESTS.map((t, i) => (
              <Packet key={t} on={s === 2} points={[[TX + TW, tY(i) + 14], [DX - 12, tY(i) + 14], [DX - 12, COM_Y + 22], [DX, COM_Y + 22]]} duration={1.2} delay={i * 0.5} />
            ))}
            <Packet on={s === 1 || s === 2} points={[[DX + DW, COM_Y + 22], [RX - 8, COM_Y + 22], [RX - 8, 80], [RX, 80]]} duration={1.2} delay={s === 2 ? 0.6 : 0} label="bytes" />
            <Packet on={s === 4 || s === 6} points={[[TX + TW, EXIT_Y + 20], [DX, EXIT_Y + 20]]} duration={1} label={code} />
            <Packet on={s === 5 || s === 6} points={[[DX + DW, EXIT_Y + 20], [RX - 20, EXIT_Y + 20], [RX - 20, 244], [RX, 244]]} duration={1.4} delay={s === 6 ? 1 : 0} label={s === 6 ? '35' : '33'} />
            <Packet on={s === 8} points={[[RX + RW - 22, 262], [RX + RW - 22, 300], [RX + RW - 22, 360]]} duration={1.4} label="33" />
            <Pulse x={LX + 60} y={44} on={hang} r={14} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
