/* Getting to ring 3 with iret, and coming back through the TSS.
   The kernel fakes an interrupt-return frame (SS, ESP, EFLAGS, CS, EIP) whose selectors have RPL 3, then irets.
   When an interrupt later arrives in ring 3 the CPU loads SS0:ESP0 from the TSS and pushes the same five values. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Label, Appear, Pulse, ease, spring } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'ring3-entry-tss',
  title: 'Entering ring 3 (iret + TSS)',
  summary: 'The kernel builds an iret frame with ring 3 selectors 0x1B and 0x23 and irets into user mode; an interrupt in ring 3 makes the CPU load SS0:ESP0 from the TSS.',
  lessons: ['t8m1l1'],
  articles: ['Getting to Ring 3', 'Task State Segment'],
  group: 'User space',
  order: 810,
}

const steps: VizStep[] = [
  { caption: 'The kernel runs in ring 0. Now it wants to run a user program in ring 3.', detail: 'There is no "go to ring 3" instruction. The trick: make the CPU believe it is returning from an interrupt that came from ring 3.' },
  { caption: 'First, the ring 3 selectors: GDT entry 3 is user code, entry 4 is user data.', detail: '(3 × 8) | 3 = 0x1B and (4 × 8) | 3 = 0x23. The low two bits (RPL) ask for ring 3, and both have DPL 3. Entry 5 is the TSS, loaded once with ltr 0x28.' },
  { caption: 'Build an iret frame on the kernel stack: push SS = 0x23, then the user ESP.', detail: 'Before this the kernel loads ds, es, fs, gs with 0x23. iret will load SS itself from the frame.' },
  { caption: 'Push EFLAGS = 0x202 (IF = 1), CS = 0x1B and EIP = the user entry point.', detail: 'IF is bit 9 of EFLAGS. With IF = 1 the timer can still interrupt the user program, so the kernel gets control back.' },
  { caption: 'iret pops all five. CS ends in 3, so the CPU is now in ring 3: user mode.', detail: 'EIP = 0x08048080, ESP = 0xBFFFF000. If this code now tries cli or hlt, the CPU raises a General Protection Fault.', ms: 4000 },
  { caption: 'An interrupt fires while user code runs. The CPU loads SS0:ESP0 from the TSS.', detail: 'The user stack cannot be trusted, so the CPU switches to the kernel stack stored in the TSS. Without a TSS there is no way back to ring 0.', ms: 4000 },
  { caption: 'It pushes the user SS, ESP, EFLAGS, CS, EIP there and runs the handler in ring 0.', detail: 'The same five values we pushed by hand, so the handler can return to user mode with iret. An interrupt gate also clears IF.', ms: 4000 },
  { caption: 'Every task needs its own kernel stack, so set tss.esp0 on every task switch.', detail: 'If two user tasks shared one ESP0, an interrupt in one would overwrite the frame the other saved there.', ms: 4200 },
]

const SLOT_NAMES = ['SS', 'ESP', 'EFLAGS', 'CS', 'EIP']
const BUILT = ['0x23', '0xBFFFF000', '0x202', '0x1B', '0x08048080']
const FROM_IRQ = ['0x23', '0xBFFFEFE0', '0x202', '0x1B', '0x080480A4']
const REG_NAMES = ['CS', 'EIP', 'SS', 'ESP', 'EFLAGS']
const REGS: string[][] = [
  ['0x08', 'jump_usermode', '0x10', '0xC0105000', '0x002'],
  ['0x08', 'jump_usermode', '0x10', '0xC0105000', '0x002'],
  ['0x08', 'jump_usermode', '0x10', '0xC0104FF8', '0x002'],
  ['0x08', 'jump_usermode', '0x10', '0xC0104FEC', '0x002'],
  ['0x1B', '0x08048080', '0x23', '0xBFFFF000', '0x202'],
  ['0x1B', '0x080480A4', '0x10', '0xC0105000', '0x202'],
  ['0x08', 'irq_handler', '0x10', '0xC0104FEC', '0x002'],
  ['0x08', 'irq_handler', '0x10', '0xC0104FEC', '0x002'],
]
const GDT = [
  ['null', '0x00'],
  ['kernel code', '0x08'],
  ['kernel data', '0x10'],
  ['user code', '0x18 | 3 = 0x1B'],
  ['user data', '0x20 | 3 = 0x23'],
  ['TSS', '0x28'],
]
const NOTES = [
  'ring 0 = kernel, any instruction allowed · ring 3 = user, privileged instructions fault',
  'selector = GDT index × 8 | RPL   (RPL = the low 2 bits = requested ring)',
  'the stack grows down: SS is pushed first, so it sits at the highest address',
  'iret pops in reverse order: EIP, CS, EFLAGS, then ESP and SS (ring change)',
  'CS & 3 = 3 → CPL 3. hlt faults; so do cli, in, out, since IOPL = 0',
  'the CPU finds the TSS via TR (loaded once with ltr 0x28): SS = tss.ss0, ESP = tss.esp0',
  'this frame mirrors the one we built by hand, so the handler can iret back',
  '',
]

/** A value that pops in whenever it changes. */
function Val({ x, y, v, size = 12, anchor = 'end', dim }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; dim?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</text>
    </motion.g>
  )
}

/** A value sliding from one place to another; fades out on arrival, then repeats. */
function Token({ from, to, on, label, delay = 0, every = 2.4 }: { from: [number, number]; to: [number, number]; on: boolean; label?: string; delay?: number; every?: number }) {
  if (!on) return null
  return (
    <motion.g initial={{ x: from[0], y: from[1], opacity: 0 }}
      animate={{ x: [from[0], from[0], to[0], to[0]], y: [from[1], from[1], to[1], to[1]], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.1, times: [0, 0.1, 0.85, 1], delay, repeat: Infinity, repeatDelay: every - 1.1, ease: 'easeInOut' }}>
      <circle r={4.5} fill="var(--viz-fg)" filter="url(#viz-glow)" />
      {label && <text y={-9} textAnchor="middle" fill="var(--viz-fg)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{label}</text>}
    </motion.g>
  )
}

const SX = 66 // kernel stack x
const SW = 164
const CX = 262 // cpu x
const CW = 258
const RX = 556 // right column x
const RW = 220
const rowY = (i: number) => 56 + i * 34

export default function Ring3EntryTss() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const cpl = s === 4 || s === 5 ? 3 : 0
        const regs = REGS[s]
        const slotVals = s >= 5 ? FROM_IRQ : BUILT
        const slotShown = (i: number) => (s === 2 ? i <= 1 : s === 3 || s === 4 ? true : s >= 6)
        const slotState = (i: number) => (s === 4 ? 'dim' : s === 7 ? 'off' : (s === 2 && i <= 1) || (s === 3 && i >= 2) || s === 6 ? 'on' : 'off')
        const espY = [56, 56, rowY(1) + 17, rowY(4) + 17, 56, 56, rowY(4) + 17, rowY(4) + 17][s]
        const regOn = (i: number) =>
          s === 4 ? true : s === 5 ? i === 2 || i === 3 : s === 6 ? i === 0 || i === 1 || i === 3 || i === 4 : (s === 2 || s === 3) && i === 3

        return (
          <Scene label={meta.summary}>
            {/* kernel stack */}
            <Label x={SX} y={38} size={11} dim>KERNEL STACK ↓</Label>
            <rect x={SX} y={56} width={SW} height={170} fill="none" stroke="var(--viz-faint)" strokeDasharray="3 4" />
            {SLOT_NAMES.map((n, i) => (
              <Appear key={i} on={slotShown(i)} dy={-14} delay={s === 3 ? (i - 2) * 0.25 : s === 6 ? i * 0.2 : s === 2 ? i * 0.3 : 0}>
                <Block x={SX} y={rowY(i)} w={SW} h={34} state={slotState(i)} />
                <Label x={SX + 10} y={rowY(i) + 21} size={11} dim>{n}</Label>
                <Val x={SX + SW - 10} y={rowY(i) + 22} v={slotVals[i]} dim={s === 4} />
              </Appear>
            ))}
            <motion.g initial={false} animate={{ y: espY }} transition={spring}>
              <Label x={SX - 6} y={4} size={10.5} anchor="end">esp →</Label>
            </motion.g>

            {/* CPU registers */}
            <Label x={CX} y={38} size={11} dim>CPU REGISTERS</Label>
            <Val x={CX + CW} y={38} v={`CPL = ${cpl}`} size={12} />
            {REG_NAMES.map((n, i) => (
              <g key={n}>
                <Block x={CX} y={rowY(i)} w={CW} h={34} state={regOn(i) ? 'on' : 'off'} />
                <Label x={CX + 12} y={rowY(i) + 21} size={11} dim>{n}</Label>
                <Val x={CX + CW - 12} y={rowY(i) + 22} v={regs[i]} />
              </g>
            ))}

            {/* iret: frame → registers */}
            {[4, 3, 2, 1, 0].map((slot, k) => {
              const reg = REG_NAMES.indexOf(SLOT_NAMES[slot])
              return <Token key={slot} on={s === 4} from={[SX + SW, rowY(slot) + 17]} to={[CX, rowY(reg) + 17]} delay={k * 0.25} every={3} />
            })}
            {/* interrupt: registers → kernel stack */}
            {[0, 1, 2, 3, 4].map((slot, k) => (
              <Token key={'p' + slot} on={s === 6} from={[CX, rowY(REG_NAMES.indexOf(SLOT_NAMES[slot])) + 17]} to={[SX + SW, rowY(slot) + 17]} delay={k * 0.2} every={3} />
            ))}

            {/* privilege rings */}
            <Label x={RX} y={38} size={11} dim>PRIVILEGE</Label>
            <Block x={RX} y={56} w={RW} h={40} label="ring 0 · kernel" size={13} state={cpl === 0 ? 'on' : 'dim'} align="start" />
            <Block x={RX} y={104} w={RW} h={40} label="ring 3 · user" size={13} state={cpl === 3 ? 'on' : 'dim'} align="start" />
            <motion.circle cx={RX + RW - 22} r={7} fill="var(--viz-fg)" filter="url(#viz-glow)" initial={false} animate={{ cy: cpl === 3 ? 124 : 76 }} transition={spring} />
            <Pulse x={RX + RW - 22} y={cpl === 3 ? 124 : 76} on={s >= 4 && s <= 6} r={12} />

            {/* TSS */}
            <Appear on={s >= 1} dx={10} dy={0}>
              <Label x={RX} y={172} size={11} dim>TSS · loaded with ltr 0x28</Label>
              <Block x={RX} y={180} w={RW} h={32} state={s === 5 || s === 7 ? 'on' : s < 5 ? 'dim' : 'off'} />
              <Label x={RX + 12} y={200} size={11} dim>ESP0 (+0x04)</Label>
              <Val x={RX + RW - 12} y={201} v={s === 7 ? '0xC0109000' : '0xC0105000'} />
              <Block x={RX} y={212} w={RW} h={32} state={s === 5 ? 'on' : s < 5 ? 'dim' : 'off'} />
              <Label x={RX + 12} y={232} size={11} dim>SS0 (+0x08)</Label>
              <Val x={RX + RW - 12} y={233} v="0x10" />
            </Appear>
            <Token on={s === 5} from={[RX, 196]} to={[CX + CW, rowY(3) + 17]} delay={0.2} label="ESP0" />
            <Token on={s === 5} from={[RX, 228]} to={[CX + CW, rowY(2) + 17]} delay={0.9} label="SS0" />
            <Label x={CX + CW / 2} y={254} size={11.5} anchor="middle" weight={500} on={s === 5}>IRQ arrives while in ring 3</Label>

            {/* GDT (hidden on the last step so the task B wire does not cross it) */}
            <Appear on={s <= 6}>
            <Label x={24} y={278} size={11} dim>GDT</Label>
            {GDT.map(([n, sel], i) => (
              <Block key={i} x={24 + i * 125.3} y={286} w={125.3} h={50} label={n} sub={sel} size={12}
                state={(s === 1 && (i === 3 || i === 4)) || (s >= 2 && s <= 3 && (i === 3 || i === 4)) || (s === 5 && i === 5) ? 'on' : s === 0 ? 'off' : s === 7 ? 'dim' : i === 3 || i === 4 || (i === 5 && (s === 1 || s >= 5)) ? 'off' : 'dim'} />
            ))}
            </Appear>

            {/* one-line explanation */}
            <Appear on={s <= 6}>
              <Block x={24} y={358} w={752} h={56} state="off" />
              <motion.g key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={ease}>
                <text x={40} y={391} fill="var(--viz-fg)" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{NOTES[s]}</text>
              </motion.g>
            </Appear>

            {/* one kernel stack per task */}
            <Appear on={s === 7}>
              <Block x={24} y={358} w={220} h={56} label="task A kernel stack" sub="top 0xC0105000" size={12} state="dim" />
              <Label x={264} y={380} size={11.5}>on every switch to B:</Label>
              <Label x={264} y={400} size={11.5} weight={500}>tss.esp0 = 0xC0109000</Label>
              <Block x={540} y={358} w={236} h={56} label="task B kernel stack" sub="top 0xC0109000" size={12} state="on" />
            </Appear>
            <Wire from={[650, 246]} to={[650, 354]} on={s === 7} dashed />
          </Scene>
        )
      }}
    </VizStage>
  )
}
