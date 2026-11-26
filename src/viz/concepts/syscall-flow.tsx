/* A system call through int 0x80, end to end:
   registers -> IDT gate 0x80 (DPL 3) -> TSS stack switch -> dispatcher -> syscall_table[eax] -> sys_write
   (validate the user pointer) -> result in eax -> iret back to ring 3. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'syscall-flow',
  title: 'A system call, step by step',
  summary: 'User code puts a call number in eax and arguments in ebx, ecx, edx, runs int 0x80, and the kernel dispatches through a table, checks the pointer, returns a value in eax and irets back.',
  lessons: ['t8m1l2'],
  articles: ['System Calls'],
  group: 'User space',
  order: 815,
}

const steps: VizStep[] = [
  { caption: 'User code wants to print. It cannot touch hardware, so it asks the kernel.', detail: 'A system call is a controlled door from ring 3 into ring 0. Here: write the 13 bytes of "Hello, world\\n" to file descriptor 1.' },
  { caption: 'Put the call number in eax (2 = write in this example) and arguments in ebx, ecx, edx.', detail: 'The numbers are your own ABI; here 1 = read and 2 = write. Linux on i386 passes arguments in ebx, ecx, edx, esi, edi, ebp.' },
  { caption: 'int 0x80: the CPU reads IDT entry 0x80. Its DPL is 3, so ring 3 may use it.', detail: 'The other gates have DPL 0. If user code tried int 0x20, the CPU would raise a General Protection Fault instead.' },
  { caption: 'Switch to ring 0: load SS0:ESP0 from the TSS, push the user SS, ESP, EFLAGS, CS, EIP.', detail: 'The kernel never runs on the user stack. The pushed frame is how it will find its way back.', ms: 3800 },
  { caption: 'The stub saves registers, checks eax < NR_syscalls and jumps to syscall_table[eax].', detail: 'eax >= NR_syscalls returns -ENOSYS (the wiki snippet uses ja, which lets eax = NR_syscalls through). Empty slots must point to an error function, never NULL.', ms: 3800 },
  { caption: 'sys_write checks every argument first. Is the buffer really user memory?', detail: 'The kernel can write anywhere, so a bad pointer could make it overwrite itself. Check that buf..buf+len is mapped and below the kernel (0xC0000000 here).', ms: 4000 },
  { caption: 'The checks pass: 13 bytes go to the terminal and the result, 13, goes in eax.', detail: 'The stub writes the result into the saved eax, so it comes back with all the other registers.' },
  { caption: 'iret pops EIP, CS, EFLAGS, ESP, SS: back in ring 3, right after int 0x80.', detail: 'User code reads eax = 13 bytes written. A negative value would be an error code.', ms: 4000 },
]

const CODE = [
  ['mov eax, 2', '; write'],
  ['mov ebx, 1', '; fd'],
  ['mov ecx, msg', '; buffer'],
  ['mov edx, 13', '; length'],
  ['int 0x80', '; enter kernel'],
  ['test eax, eax', '; result'],
]
const STUB = ['save registers', 'cmp eax, NR_syscalls', 'jae .badcode  ; -ENOSYS', 'jmp [syscall_table+4*eax]']
const TABLE = ['[0] ...', '[1] sys_read', '[2] sys_write']
const WRITE = ['fd 1 is open?', 'buf is mapped user memory?', 'buf + len <= 0xC0000000?', 'copy 13 bytes to terminal', 'return 13  → saved eax']
const IDT = [
  ['0x0E', 'page fault', 'DPL 0'],
  ['0x20', 'IRQ 0 timer', 'DPL 0'],
  ['0x80', 'syscall', 'DPL 3'],
]

/** A value that pops in whenever it changes. */
function Val({ x, y, v, size = 12, anchor = 'end' }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill="var(--viz-fg)" style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</text>
    </motion.g>
  )
}

/** Control flowing along a polyline; fades out on arrival, then repeats. */
function Flow({ pts, on, label, delay = 0, duration = 1.6 }: { pts: [number, number][]; on: boolean; label?: string; delay?: number; duration?: number }) {
  if (!on) return null
  const xs = [pts[0][0], ...pts.map((p) => p[0]), pts[pts.length - 1][0]]
  const ys = [pts[0][1], ...pts.map((p) => p[1]), pts[pts.length - 1][1]]
  const n = xs.length
  const times = xs.map((_, i) => (i === 0 ? 0 : i === n - 1 ? 1 : 0.08 + ((i - 1) / (n - 3)) * 0.82))
  const op = xs.map((_, i) => (i === 0 || i === n - 1 ? 0 : 1))
  return (
    <motion.g initial={{ x: xs[0], y: ys[0], opacity: 0 }} animate={{ x: xs, y: ys, opacity: op }}
      transition={{ duration, times, delay, repeat: Infinity, repeatDelay: 0.7, ease: 'easeInOut' }}>
      <circle r={5} fill="var(--viz-fg)" filter="url(#viz-glow)" />
      {label && <text x={9} y={-7} fill="var(--viz-fg)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{label}</text>}
    </motion.g>
  )
}

const lineState = (on: boolean, used: boolean, active: boolean) => (on ? 'on' : active || used ? 'off' : 'dim') as 'on' | 'off' | 'dim'

export default function SyscallFlow() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const kernel = s >= 2 && s <= 6
        const regs = [
          ['eax', s === 0 ? '—' : s === 7 ? '13' : '2'],
          ['ebx', s === 0 ? '—' : '1'],
          ['ecx', s === 0 ? '—' : '0x0804A000'],
          ['edx', s === 0 ? '—' : '13'],
        ]
        return (
          <Scene label={meta.summary}>
            {/* ===== ring 3 ===== */}
            <Label x={24} y={22} size={11} dim>RING 3 · USER</Label>
            <Val x={776} y={22} v={`CPL = ${s >= 3 && s <= 6 ? 0 : 3}`} />
            {CODE.map(([c, cm], i) => (
              <g key={i}>
                <Block x={24} y={32 + i * 22} w={250} h={22} state={lineState(s === 1 ? i <= 3 : s === 2 ? i === 4 : s === 7 ? i === 5 : false, s > 1, !kernel)} />
                <Label x={34} y={47 + i * 22} size={11.5}>{c}</Label>
                <Label x={160} y={47 + i * 22} size={11} dim>{cm}</Label>
              </g>
            ))}

            {regs.map(([n, v], i) => (
              <g key={n}>
                <Block x={296} y={32 + i * 30} w={200} h={30} state={(s === 1 && i <= 3) || (s === 7 && i === 0) ? 'on' : kernel ? 'dim' : 'off'} />
                <Label x={308} y={52 + i * 30} size={11} dim>{n}</Label>
                <Val x={484} y={52 + i * 30} v={v} />
              </g>
            ))}

            <Block x={520} y={32} w={256} h={50} label={'msg = "Hello, world\\n"'} sub="0x0804A000 · 13 bytes" mono size={12}
              state={s === 5 ? 'on' : kernel ? 'dim' : 'off'} />
            <Block x={520} y={96} w={256} h={56} state={s === 6 ? 'on' : 'off'} />
            <Label x={532} y={114} size={10.5} dim>TERMINAL</Label>
            <Label x={532} y={138} size={13} weight={500} on={s >= 6}>Hello, world</Label>
            <motion.rect x={634} y={128} width={7} height={13} fill="var(--viz-fg)" initial={false}
              animate={{ opacity: s >= 6 ? [1, 0, 1] : 0 }} transition={{ duration: 1, repeat: Infinity }} />

            {/* privilege boundary */}
            <line x1={24} x2={776} y1={182} y2={182} stroke="var(--viz-dim)" strokeDasharray="6 6" />
            <Label x={776} y={196} size={10.5} anchor="end" dim>privilege boundary</Label>

            {/* ===== ring 0 ===== */}
            <Label x={24} y={200} size={11} dim>RING 0 · KERNEL</Label>

            <Label x={24} y={216} size={11} dim>IDT</Label>
            {IDT.map(([v, n, d], i) => (
              <g key={v}>
                <Block x={24} y={222 + i * 28} w={220} h={28} state={i === 2 && s === 2 ? 'on' : i === 2 && s >= 2 ? 'off' : 'dim'} />
                <Label x={34} y={240 + i * 28} size={11}>{v}</Label>
                <Label x={80} y={240 + i * 28} size={11} dim={i !== 2}>{n}</Label>
                <Label x={234} y={240 + i * 28} size={11} anchor="end" weight={i === 2 ? 500 : 400}>{d}</Label>
              </g>
            ))}
            <Label x={134} y={318} size={10.5} anchor="middle" on={s === 2}>DPL 3 ≥ CPL 3: allowed</Label>

            <Block x={24} y={330} w={220} h={40} label="TSS" sub="ss0 = 0x10 · esp0" size={12} state={s === 3 ? 'on' : s > 3 ? 'off' : 'dim'} />
            <Block x={24} y={380} w={220} h={44} label="kernel stack" sub="SS ESP EFLAGS CS EIP" size={12} state={s === 3 || s === 7 ? 'on' : s > 3 ? 'off' : 'dim'} />

            <Label x={270} y={216} size={11} dim>SYSCALL STUB</Label>
            {STUB.map((c, i) => (
              <Block key={i} x={270} y={222 + i * 26} w={226} h={26} label={c} mono size={11} align="start" state={s === 4 ? 'on' : s > 4 ? 'off' : 'dim'} />
            ))}
            <Label x={270} y={344} size={11} dim>syscall_table</Label>
            {TABLE.map((c, i) => (
              <Block key={i} x={270} y={352 + i * 24} w={226} h={24} label={c} mono size={11} align="start" state={i === 2 && (s === 4 || s === 5) ? 'on' : s >= 4 && i === 2 ? 'off' : 'dim'} />
            ))}

            <Label x={520} y={216} size={11} dim>SYS_WRITE(FD, BUF, LEN)</Label>
            {WRITE.map((c, i) => (
              <g key={i}>
                <Block x={520} y={222 + i * 26} w={256} h={26} label={c} mono size={11} align="start"
                  state={(s === 5 && i <= 2) || (s === 6 && i >= 3) ? 'on' : (s >= 5 && i <= 2) || (s >= 6) ? 'off' : 'dim'} />
                <Label x={764} y={239 + i * 26} size={11} anchor="end" weight={500} on={i <= 2 && s >= 5} delay={s === 5 ? 0.5 + i * 0.4 : 0}>ok</Label>
              </g>
            ))}
            <Block x={520} y={370} w={256} h={54} label="iret → ring 3" sub="pops EIP, CS, EFLAGS, ESP, SS" size={13} state={s === 7 ? 'on' : 'dim'} />

            {/* pointer validation: the kernel looks back at the user buffer */}
            <Wire d="M520 261 C 506 220, 506 110, 518 62" on={s === 5} dashed />

            {/* control flow */}
            <Flow on={s === 2} pts={[[274, 131], [285, 131], [285, 290], [244, 290]]} label="int 0x80" />
            <Flow on={s === 3} pts={[[244, 290], [257, 290], [257, 350], [244, 350], [257, 350], [257, 402], [244, 402]]} duration={2} />
            <Flow on={s === 4} pts={[[244, 290], [258, 290], [258, 235], [270, 235]]} duration={1} />
            <Flow on={s === 4} pts={[[436, 326], [436, 412]]} delay={1.2} duration={0.9} label="eax = 2" />
            <Flow on={s === 5} pts={[[496, 412], [508, 412], [508, 235], [520, 235]]} duration={1.2} />
            <Flow on={s === 6} pts={[[520, 313], [508, 313], [508, 124], [520, 124]]} duration={1.3} label="13 B" />
            <Flow on={s === 7} pts={[[520, 397], [508, 397], [508, 172], [285, 172], [274, 153]]} duration={2} />
            <Pulse x={134} y={290} on={s === 2} r={16} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
