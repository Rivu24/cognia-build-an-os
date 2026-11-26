/* Where a C program's data lives. Follows Program Memory Allocation Types (read-only memory: code in .text, constants
   and literals in .rodata; global memory: initialised globals in the image, .bss is only a size the loader clears;
   lexically allocated memory as activation records on a stack that grows down; dynamic memory from the heap until freed)
   and Stack (x86 stack grows down; ESP = top of stack, EBP = current frame; CALL pushes the return address, the callee
   does PUSH EBP / MOV EBP, ESP, then makes room for locals; MOV ESP, EBP / POP EBP / RET undo it; elements are 4 bytes).
   No absolute addresses are shown on purpose: the articles give none for a user process, and the order is what matters.
   The heap growing up toward a downward stack is the classic single-threaded layout; real systems vary.
   Motion is heavy on purpose: regions stack up like blocks, each variable is carried to its region and set down. */
import { motion, type Transition } from 'motion/react'
import type { ReactNode } from 'react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Label } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'program-memory-layout',
  title: 'Where a program’s data lives',
  summary: 'A process address space from .text, .rodata, .data and .bss up through the heap and the stack: each variable of a small C program is carried to its region, then a call pushes a stack frame (return address, saved EBP, local) and the return pops it.',
  lessons: ['p2l4'],
  articles: ['Program Memory Allocation Types', 'Stack'],
  group: 'Basics',
  order: 40,
}

const steps: VizStep[] = [
  { caption: 'A running program gets one address space, split into regions.', detail: 'Low addresses at the bottom. The four fixed regions are laid out from the executable file; the heap and the stack change size while the program runs.' },
  { caption: 'The compiled code goes in .text. The string literal "hello" goes in .rodata.', detail: 'Both are read-only memory. Most systems protect them, so writing there causes a protection fault instead of silently changing your code.', ms: 3800 },
  { caption: 'count = 5 has a starting value, so it is stored in .data.', detail: 'Global memory has a fixed size known at launch. The 5 is part of the executable image and is copied in when the program loads.' },
  { caption: 'total has no starting value, so it lands in .bss and begins as 0.', detail: 'The file stores only the size of .bss; the loader clears that much memory. A huge zeroed array costs nothing on disk.' },
  { caption: 'malloc(64) carves a block out of the heap, which grows up.', detail: 'Heap memory lives until free() is called, whatever function asked for it. Lose the pointer p and you can never free it: a leak.', ms: 3800 },
  { caption: 'buf[16] is a local: it lives in main’s frame on the stack, which grows down.', detail: 'Locals appear when a function starts and vanish when it returns. p, the pointer itself, is a local too; only the 64 bytes are on the heap.', ms: 3800 },
  { caption: 'Calling f() pushes a new frame: return address, saved EBP, then its local n.', detail: 'call pushes the return address; f runs push ebp; mov ebp, esp; then moves ESP down 4 for n. Each push moves ESP 4 bytes lower.', ms: 4600 },
  { caption: 'When f returns, its frame is popped and ESP climbs back to main’s frame.', detail: 'mov esp, ebp; pop ebp; ret. The bytes are not wiped, only given up, which is why a pointer to a returned local is a bug.', ms: 4400 },
]

/* ---------- motion: heavy, settling ---------- */
const heavy: Transition = { type: 'spring', stiffness: 42, damping: 12.5, mass: 1.8 }
const slowFade = (delay = 0): Transition => ({ duration: 0.95, ease: [0.45, 0, 0.2, 1], delay })

/* ---------- source code ---------- */
const CODE = [
  'int count = 5;',
  'static int total;',
  'void f(void) { int n = 1; }',
  'int main(void) {',
  '    char buf[16];',
  '    int *p = malloc(64);',
  '    puts("hello");',
  '    f();',
  '    return 0;',
  '}',
]
const CX0 = 36
const CY0 = 62
const LH = 20
const CHW = 7.8 // mono 13 px
const lineY = (i: number) => CY0 + i * LH
const lineEnd = (i: number) => CX0 + CODE[i].length * CHW
/** code lines lit in each step */
const LIT: number[][] = [[], [3, 6], [0], [1], [5], [4], [7, 2], [7]]

/* ---------- address space ---------- */
const MX = 420
const MW = 180
type Region = { key: string; y: number; h: number; name: string; d1: string; d2: string; hatch?: boolean }
const REGIONS: Region[] = [
  { key: 'stack', y: 30, h: 80, name: 'stack', d1: 'locals, return addresses', d2: 'grows down ↓' },
  { key: 'gap', y: 110, h: 90, name: 'unused', d1: 'room for both', d2: 'to grow', hatch: true },
  { key: 'heap', y: 200, h: 70, name: 'heap', d1: 'malloc() and free()', d2: 'grows up ↑' },
  { key: 'bss', y: 270, h: 40, name: '.bss', d1: 'globals that start at 0', d2: 'file stores only the size' },
  { key: 'data', y: 310, h: 40, name: '.data', d1: 'globals with a value', d2: 'copied from the file' },
  { key: 'rodata', y: 350, h: 40, name: '.rodata', d1: 'constants, literals', d2: 'read-only' },
  { key: 'text', y: 390, h: 40, name: '.text', d1: 'machine code', d2: 'read-only' },
]
const FOCUS: string[][] = [[], ['text', 'rodata'], ['data'], ['bss'], ['heap'], ['stack'], ['stack'], ['stack']]
const regionMid = (k: string) => {
  const r = REGIONS.find((q) => q.key === k)!
  return r.y + r.h / 2
}

/** A variable carried from its line of code to its region, then set down there. */
function Chip({ text, line, to, on, delay = 0, w }: { text: string; line: number; to: [number, number]; on: boolean; delay?: number; w?: number }) {
  const cw = w ?? text.length * 7 + 16
  const from: [number, number] = [lineEnd(line) + 10 + cw / 2, lineY(line) - 4]
  const d = on ? delay : 0
  return (
    <motion.g initial={false} animate={{ x: on ? 0 : from[0] - to[0], y: on ? 0 : from[1] - to[1], opacity: on ? 1 : 0 }}
      transition={{ x: { ...heavy, delay: d }, y: { ...heavy, delay: d }, opacity: { duration: on ? 0.3 : 0.4, delay: d } }}>
      <rect x={to[0] - cw / 2} y={to[1] - 11} width={cw} height={22} fill="var(--viz-fg)" />
      <text x={to[0]} y={to[1] + 4} textAnchor="middle" fill="var(--viz-bg)" style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{text}</text>
    </motion.g>
  )
}

function Fade({ on, children, delay = 0, dy = 10 }: { on: boolean; children: ReactNode; delay?: number; dy?: number }) {
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : dy }} transition={{ opacity: slowFade(on ? delay : 0), y: { ...heavy, delay: on ? delay : 0 } }}>
      {children}
    </motion.g>
  )
}

/* ---------- stack zoom (steps 6–7) ---------- */
const ZX = 70
const ZW = 180
const ZY = 300
const SH = 26
/* push: ESP moves down first, then the value is written (Stack article). Pop: the same slots in reverse. */
const STEP = 0.62 // seconds per push or pop: slow, one slot at a time
const SLOTS = [
  { label: 'return address', push: 'call f', pop: 'ret' },
  { label: 'saved EBP (main’s)', push: 'push ebp', pop: 'pop ebp' },
  { label: 'n = 1', push: 'sub esp, 4', pop: 'mov esp, ebp' },
]

function StackZoom({ s }: { s: number }) {
  const on = s >= 6
  const pushed = s === 6
  const popped = s === 7
  const espPath = pushed ? [0, SH, 2 * SH, 3 * SH] : popped ? [3 * SH, 2 * SH, SH, 0] : 0
  return (
    <Fade on={on}>
      <Label x={20} y={ZY - 14} size={11} dim>STACK ZOOM · 4-byte slots · lower addresses ↓</Label>
      <Block x={ZX} y={ZY} w={ZW} h={SH} label="main’s frame: buf, p" size={12} state={popped ? 'on' : 'off'} />
      {SLOTS.map((sl, k) => {
        // pushed top to bottom; popped bottom to top. A popped slot stays faint: given up, not wiped.
        const d = pushed ? STEP * (k + 0.8) : popped ? STEP * (2 - k + 0.5) : 0
        return (
          <motion.g key={k} initial={false}
            animate={{ opacity: pushed ? 1 : popped ? 0.5 : 0, y: on ? 0 : -14 }}
            transition={{ opacity: slowFade(d), y: { ...heavy, delay: d } }}>
            <Block x={ZX} y={ZY + SH * (k + 1)} w={ZW} h={SH} label={sl.label} size={12} mono={k === 2} state={!popped && k === 2 ? 'on' : 'off'} />
          </motion.g>
        )
      })}
      {/* the instruction that wrote each slot, swapped for the one that gives it back */}
      {SLOTS.map((sl, k) => {
        const d = pushed ? STEP * (k + 0.8) : popped ? STEP * (2 - k + 0.5) : 0
        const y = ZY + SH * (k + 1) + 17
        return (
          <g key={k}>
            <Label x={ZX + ZW + 10} y={y} size={11} dim on={pushed} delay={pushed ? d : 0}>{sl.push}</Label>
            <Label x={ZX + ZW + 10} y={y} size={11} weight={600} on={popped} delay={popped ? d : 0}>{sl.pop}</Label>
          </g>
        )
      })}
      {/* f's frame outline, once all three slots have landed */}
      <Fade on={pushed} delay={STEP * 3 + 0.4} dy={0}>
        <rect x={ZX - 4} y={ZY + SH - 3} width={ZW + 8} height={3 * SH + 6} fill="none" stroke="var(--viz-fg)" strokeDasharray="4 3" strokeWidth={1.2} />
      </Fade>
      {/* ESP walks down one slot per push, then climbs back one slot per pop */}
      <motion.g initial={false} animate={{ y: espPath }}
        transition={on ? { duration: STEP * 3, times: [0, 0.33, 0.66, 1], ease: [0.65, 0, 0.35, 1], delay: 0.3 } : { ...heavy }}>
        <Label x={ZX - 8} y={ZY + SH / 2 + 4} size={11} anchor="end" weight={700}>ESP →</Label>
      </motion.g>
      {/* EBP points at the saved EBP while f runs */}
      <Fade on={pushed} delay={STEP * 2 + 0.4} dy={0}>
        <Label x={ZX - 8} y={ZY + 2 * SH + SH / 2 + 4} size={11} anchor="end" dim>EBP →</Label>
      </Fade>
      <Val x={ZX} y={ZY + 4 * SH + 24} v={pushed ? 'f’s frame: 3 slots, 12 bytes' : 'popped: the bytes stay, unused'} />
    </Fade>
  )
}

/** Text that settles in again whenever it changes. */
function Val({ x, y, v }: { x: number; y: number; v: string }) {
  return (
    <motion.text key={v} x={x} y={y} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={slowFade(1.2)}
      fill="var(--viz-fg)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v}</motion.text>
  )
}

export default function ProgramMemoryLayout() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const focus = FOCUS[s]
        return (
          <Scene label={meta.summary}>
            <g style={{ fontVariantLigatures: 'none', fontFeatureSettings: '"liga" 0, "calt" 0' }}>
              {/* ===== source ===== */}
              <Label x={20} y={28} size={11} dim>YOUR PROGRAM · prog.c</Label>
              <Block x={20} y={40} w={280} h={212} state="off" />
              {CODE.map((t, i) => {
                const lit = LIT[s].includes(i)
                return (
                  <g key={i}>
                    <motion.rect x={21} y={lineY(i) - 14} width={278} height={LH} fill="var(--viz-fg)" initial={false}
                      animate={{ opacity: lit ? 0.14 : 0 }} transition={slowFade()} />
                    <motion.rect x={21} y={lineY(i) - 14} width={3} height={LH} fill="var(--viz-fg)" initial={false}
                      animate={{ opacity: lit ? 1 : 0 }} transition={slowFade()} />
                    {/* SVG collapses spaces, so indentation becomes an x offset */}
                    <Label x={CX0 + (t.length - t.trimStart().length) * CHW} y={lineY(i)} size={13} dim={s > 0 && !lit} weight={lit ? 600 : 400}>{t.trimStart()}</Label>
                  </g>
                )
              })}

              {/* ===== address space ===== */}
              <Label x={MX - 10} y={42} size={10.5} anchor="end" dim>high addresses</Label>
              <Label x={MX - 10} y={428} size={10.5} anchor="end" dim>low addresses</Label>
              <line x1={MX - 30} x2={MX - 30} y1={56} y2={410} stroke="var(--viz-faint)" markerEnd="url(#viz-arrow-dim)" transform={`rotate(180 ${MX - 30} 233)`} />
              {/* regions settle in from the bottom up, like blocks being stacked, when the scene first appears */}
              {REGIONS.slice().reverse().map((r, k) => {
                const on = focus.includes(r.key)
                return (
                  <motion.g key={r.key} initial={{ opacity: 0, y: -28 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ y: { ...heavy, delay: 0.15 + k * 0.1 }, opacity: slowFade(0.15 + k * 0.1) }}>
                    <Block x={MX} y={r.y} w={MW} h={r.h} state={r.hatch ? 'hatch' : on ? 'on' : 'off'} />
                    <Label x={MX + 10} y={r.y + (r.key === 'stack' || r.key === 'heap' ? 18 : r.h / 2 + 5)} size={13} weight={600} mono={r.key !== 'stack' && r.key !== 'heap' && r.key !== 'gap'} dim={r.hatch}>{r.name}</Label>
                    <Label x={MX + MW + 12} y={r.y + r.h / 2 - 3} size={11} dim={!on}>{r.d1}</Label>
                    <Label x={MX + MW + 12} y={r.y + r.h / 2 + 12} size={11} dim>{r.d2}</Label>
                  </motion.g>
                )
              })}
              {/* growth arrows in the gap */}
              <motion.g initial={false} animate={{ y: s >= 5 ? [0, 6, 0] : 0 }} transition={{ duration: 2.4, repeat: s >= 5 ? Infinity : 0, ease: 'easeInOut' }}>
                <path d={`M${MX + 90} 116 L${MX + 90} 140`} stroke="var(--viz-fg)" strokeWidth={1.6} markerEnd="url(#viz-arrow)" />
              </motion.g>
              <motion.g initial={false} animate={{ y: s >= 4 ? [0, -6, 0] : 0 }} transition={{ duration: 2.4, repeat: s >= 4 ? Infinity : 0, ease: 'easeInOut' }}>
                <path d={`M${MX + 90} 194 L${MX + 90} 170`} stroke="var(--viz-fg)" strokeWidth={1.6} markerEnd="url(#viz-arrow)" />
              </motion.g>

              {/* ===== variables carried to their regions ===== */}
              <Chip text="main, f" line={3} to={[MX + 128, regionMid('text')]} on={s >= 1} delay={0.1} />
              <Chip text={'"hello"'} line={6} to={[MX + 128, regionMid('rodata')]} on={s >= 1} delay={0.55} />
              <Chip text="count = 5" line={0} to={[MX + 120, regionMid('data')]} on={s >= 2} delay={0.1} />
              <Chip text="total = 0" line={1} to={[MX + 120, regionMid('bss')]} on={s >= 3} delay={0.1} />
              <Chip text="64-byte block" line={5} to={[MX + 112, 254]} on={s >= 4} delay={0.1} w={116} />
              <Chip text="main: buf, p" line={4} to={[MX + 114, 50]} on={s >= 5} delay={0.1} w={112} />
              {/* f's frame grows the stack downward, then is popped */}
              <motion.g initial={false} animate={{ opacity: s === 6 ? 1 : 0, scaleY: s === 6 ? 1 : 0 }}
                transition={{ opacity: slowFade(s === 6 ? 0.3 : 0.2), scaleY: { ...heavy, delay: s === 6 ? 0.3 : 0.2 } }}
                style={{ transformOrigin: `${MX + 114}px 64px`, transformBox: 'view-box' }}>
                <rect x={MX + 58} y={64} width={112} height={34} fill="none" stroke="var(--viz-fg)" strokeWidth={1.6} strokeDasharray="4 3" />
                <text x={MX + 114} y={86} textAnchor="middle" fill="var(--viz-fg)" style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>f’s frame</text>
              </motion.g>

              {/* ===== bottom left: fixed vs growing (steps 0–5) ===== */}
              <Fade on={s <= 5}>
                <Label x={20} y={290} size={11} dim>FIXED WHEN THE PROGRAM LOADS</Label>
                <Label x={20} y={312} size={13} weight={600}>.text  .rodata  .data  .bss</Label>
                <Label x={20} y={330} size={11} dim>sizes come from the executable file</Label>
                <Label x={20} y={370} size={11} dim>CHANGES WHILE IT RUNS</Label>
                <Label x={20} y={392} size={13} weight={600}>heap ↑   stack ↓</Label>
                <Label x={20} y={410} size={11} dim>they grow toward each other into the gap</Label>
              </Fade>
              <StackZoom s={s} />
            </g>
          </Scene>
        )
      }}
    </VizStage>
  )
}
