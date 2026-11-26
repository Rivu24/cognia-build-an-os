/* Declarations in headers, definitions in .c files, and the linker that joins separately compiled objects.
   From "Why function implementations shouldn't be put in header files": #include pastes a verbatim copy of the header;
   headers should be declarations and nothing but; code in a header included in more than one place leaves the
   linker with several copies of the same function. From "C Library": freestanding headers are float.h, iso646.h,
   limits.h, stdalign.h, stdarg.h, stdbool.h, stddef.h, stdint.h, stdnoreturn.h (defines and types only); string.h,
   stdio.h and stdlib.h are part of the C library. The nm letters T (defined in text) and U (undefined) are what
   `nm main.o` prints. The function add() is a worked example. */
import type { ReactNode } from 'react'
import { motion, type Transition } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'headers-and-linking-units',
  title: 'Headers, objects and the linker',
  summary: 'util.h holds only the declaration of add(); main.c and util.c both include it and compile separately into main.o and util.o, which the linker joins. A body in the header gives two definitions and a multiple-definition error. Finally, which headers a freestanding compiler still provides and which need a C library.',
  lessons: ['p3l4'],
  articles: ["Why function implementations shouldn't be put in header files", 'C Library'],
  group: 'Basics',
  order: 53,
}

const steps: VizStep[] = [
  { caption: 'util.h holds only a declaration: a promise that add() exists somewhere.', detail: 'int add(int a, int b); gives the name, the argument types and the return type, with no body. That is all a caller needs to compile a call.', ms: 4600 },
  { caption: 'main.c and util.c both #include "util.h". Each gets its own pasted copy.', detail: 'main.c calls add(2, 3); util.c writes the body. Because both see the same declaration, the compiler can check that the call and the body agree.', ms: 4800 },
  { caption: 'Each .c file is compiled on its own into an object file.', detail: 'gcc -c main.c makes main.o. It contains main, plus a note: "I need add, address unknown". nm prints that as U add. util.o has the code: T add.', ms: 5000 },
  { caption: 'The linker joins the objects and fills in every U with a matching T.', detail: 'The call in main.o now jumps to the add code from util.o. One definition, used from anywhere that included the declaration.', ms: 4800 },
  { caption: 'The mistake: put the body of add() in util.h. Both .c files paste it in.', detail: '#include copies text verbatim, so main.c and util.c now each contain a full add(). Each compiles fine on its own, and each object defines add.', ms: 5000 },
  { caption: 'Two definitions of add: the linker stops with a "multiple definition" error.', detail: 'It cannot tell which copy is the real one, even though they are identical. The fix: declaration in util.h, body in exactly one .c file.', ms: 5200 },
  { caption: 'In a kernel there is no C library, but these headers still work.', detail: 'With -ffreestanding the compiler itself provides 9 headers: types, limits and macros only, nothing to link. Use them instead of writing your own uint32_t.', ms: 5200 },
  { caption: 'stdio.h, stdlib.h and string.h belong to a C library. In a kernel, you write it.', detail: 'They hold real code. printf and malloc lean on the OS through system calls, and even memcpy is libc code: your kernel must supply its own memcpy, memset and friends.', ms: 5400 },
]

/* weight: heavy springs, slow fades, things drop into place. */
const heavy: Transition = { type: 'spring', stiffness: 55, damping: 14, mass: 1.3 }
const lazy: Transition = { duration: 1.1, ease: [0.3, 0.05, 0.15, 1] }

const FW = 220, FY = 40, FH = 120
const MAIN_X = 20, HDR_X = 290, UTIL_X = 560
const OY = 214, OH = 70

const FREE = ['stdint.h', 'stddef.h', 'stdarg.h', 'limits.h', 'float.h', 'stdbool.h', 'iso646.h', 'stdalign.h', 'stdnoreturn.h']
const LIBC: [string, string][] = [['stdio.h', 'printf, puts'], ['stdlib.h', 'malloc, free'], ['string.h', 'memcpy, strlen']]

function Val({ x, y, v, size = 12, anchor = 'start', weight = 400, dim, delay = 0 }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean; delay?: number }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...heavy, delay, opacity: { ...lazy, delay } }}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight, whiteSpace: 'pre' }}>
        {v}
      </text>
    </motion.g>
  )
}

/** Parts that drop in from above with weight and stay. */
function Drop({ on, children, delay = 0, low = 0 }: { on: boolean; children: ReactNode; delay?: number; low?: number }) {
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : low, y: on || low > 0 ? 0 : -18 }} transition={{ ...heavy, delay, opacity: { ...lazy, delay } }}>
      {children}
    </motion.g>
  )
}

function Faint({ on, children, low = 0.25 }: { on: boolean; children: ReactNode; low?: number }) {
  return <motion.g initial={false} animate={{ opacity: on ? 1 : low }} transition={lazy}>{children}</motion.g>
}

/** A file box with a title and code lines. */
function File({ x, title, lines, state, hot }: { x: number; title: string; lines: string[]; state: 'on' | 'off' | 'dim'; hot?: number[] }) {
  return (
    <g>
      <Block x={x} y={FY} w={FW} h={FH} state={state} />
      <Label x={x + 12} y={FY + 18} size={11} dim>{title}</Label>
      {lines.map((t, i) => (
        <Val key={i} x={x + 12} y={FY + 44 + i * 21} v={t} size={12} weight={hot?.includes(i) ? 600 : 400} dim={!hot?.includes(i) && t.startsWith('//')} delay={i * 0.08} />
      ))}
    </g>
  )
}

export default function HeadersAndLinkingUnits() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const bad = s === 4 || s === 5
        const libPart = s >= 6
        const hdrLines = bad ? ['int add(int a, int b)', '{', '    return a + b;', '}'] : ['int add(int a, int b);', '// declaration only']
        const utilLines = bad ? ['#include "util.h"', '// (body moved to util.h)'] : ['#include "util.h"', 'int add(int a, int b) {', '    return a + b;', '}']
        const mainLines = ['#include "util.h"', 'int main(void) {', '    return add(2, 3);', '}']
        const top = libPart ? 'dim' : 'off'
        return (
          <Scene label={meta.summary}>
            {/* ===== source files ===== */}
            <Faint on={s >= 1 && !libPart} low={libPart ? 0.4 : 0.25}>
              <File x={MAIN_X} title="main.c" lines={mainLines} state={s === 1 ? 'on' : top} hot={s === 1 ? [0, 2] : []} />
            </Faint>
            <Faint on={!libPart} low={0.4}>
              <File x={HDR_X} title="util.h" lines={hdrLines} state={s === 0 || s === 4 ? 'on' : top} hot={s === 0 ? [0] : bad ? [0, 1, 2, 3] : []} />
            </Faint>
            <Appear on={s === 0} dy={8} delay={0.8}>
              <Label x={HDR_X + FW / 2} y={FY + FH + 34} size={11} anchor="middle">declaration = name + types, no body</Label>
              <Label x={HDR_X + FW / 2} y={FY + FH + 52} size={11} anchor="middle" dim>the body (definition) lives in util.c</Label>
            </Appear>
            <Faint on={s >= 1 && !libPart} low={libPart ? 0.4 : 0.25}>
              <File x={UTIL_X} title="util.c" lines={utilLines} state={s === 1 ? 'on' : top} hot={s === 1 ? [0, 1] : []} />
            </Faint>
            <Pulse x={HDR_X + 30} y={FY + 40} on={s === 0} r={16} />

            {/* #include: the header is pasted into each .c file (wires fade with the files in the library part) */}
            <Faint on={!libPart} low={0.35}>
            <Wire from={[HDR_X - 2, FY + 60]} to={[MAIN_X + FW + 4, FY + 60]} on={s >= 1} dim={libPart} />
            <Wire from={[HDR_X + FW + 2, FY + 60]} to={[UTIL_X - 4, FY + 60]} on={s >= 1} dim={libPart} />
            <Label x={(MAIN_X + FW + HDR_X) / 2} y={FY + 84} size={10.5} anchor="middle" dim on={s >= 1}>paste</Label>
            <Label x={(HDR_X + FW + UTIL_X) / 2} y={FY + 84} size={10.5} anchor="middle" dim on={s >= 1}>paste</Label>
            <Packet on={s === 1 || s === 4} points={[[HDR_X + 10, FY + 60], [MAIN_X + FW + 6, FY + 60]]} duration={2} label={bad ? 'body' : 'decl'} />
            <Packet on={s === 1 || s === 4} points={[[HDR_X + FW - 10, FY + 60], [UTIL_X - 6, FY + 60]]} duration={2} label={bad ? 'body' : 'decl'} />

            {/* ===== compile each file alone ===== */}
            <Wire from={[MAIN_X + 110, FY + FH + 2]} to={[MAIN_X + 110, OY - 4]} on={s >= 2} dim={libPart} />
            <Wire from={[UTIL_X + 110, FY + FH + 2]} to={[UTIL_X + 110, OY - 4]} on={s >= 2} dim={libPart} />
            <Label x={MAIN_X + 120} y={FY + FH + 32} size={10.5} dim on={s >= 2}>gcc -c main.c</Label>
            <Label x={UTIL_X + 120} y={FY + FH + 32} size={10.5} dim on={s >= 2}>gcc -c util.c</Label>
            </Faint>
            <Packet on={s === 2} points={[[MAIN_X + 110, FY + FH], [MAIN_X + 110, OY]]} duration={1.8} />
            <Packet on={s === 2} points={[[UTIL_X + 110, FY + FH], [UTIL_X + 110, OY]]} duration={1.8} delay={0.3} />

            <Drop on={s >= 2} delay={0.6}>
              <Faint on={!libPart} low={0.3}>
                <Block x={MAIN_X} y={OY} w={FW} h={OH} state={s === 2 || bad ? 'on' : 'off'} />
                <Label x={MAIN_X + 12} y={OY + 18} size={11} dim>main.o (machine code)</Label>
                <Label x={MAIN_X + 12} y={OY + 40} size={12.5}>T main</Label>
                <Val x={MAIN_X + 12} y={OY + 60} v={bad ? 'T add   ← pasted copy' : 'U add   ← needed'} size={12.5} weight={600} />
              </Faint>
            </Drop>
            <Drop on={s >= 2} delay={0.85}>
              <Faint on={!libPart} low={0.3}>
                <Block x={UTIL_X} y={OY} w={FW} h={OH} state={s === 2 || bad ? 'on' : 'off'} />
                <Label x={UTIL_X + 12} y={OY + 18} size={11} dim>util.o (machine code)</Label>
                <Val x={UTIL_X + 12} y={OY + 40} v={bad ? 'T add   ← pasted copy' : 'T add   ← defined'} size={12.5} weight={600} />
              </Faint>
            </Drop>
            <Appear on={s === 2} dy={6} delay={1}>
              <Label x={400} y={OY + 30} size={11} anchor="middle" dim>compiled separately:</Label>
              <Label x={400} y={OY + 48} size={11} anchor="middle" dim>main.c never sees util.c</Label>
            </Appear>
            <Appear on={bad} dy={6} delay={0.6}>
              <Label x={400} y={OY + 30} size={11} anchor="middle" weight={600}>two objects,</Label>
              <Label x={400} y={OY + 48} size={11} anchor="middle" weight={600}>two copies of add</Label>
            </Appear>

            {/* ===== the linker ===== */}
            <Faint on={!libPart} low={0}>
              <Wire d={`M${MAIN_X + 110} ${OY + OH + 2} L${MAIN_X + 110} 328 L${HDR_X - 4} 328`} on={s >= 3 && !libPart} />
              <Wire d={`M${UTIL_X + 110} ${OY + OH + 2} L${UTIL_X + 110} 328 L${HDR_X + FW + 4} 328`} on={s >= 3 && !libPart} />
              <Drop on={s >= 3} low={0}>
                <Block x={HDR_X} y={302} w={FW} h={54} label="linker (ld)" sub="fills each U with a T" size={13} state={s === 3 || s === 5 ? 'on' : 'off'} />
              </Drop>
              <Wire from={[400, 358]} to={[400, 378]} on={s >= 3 && !libPart} />
              <motion.g initial={false} animate={{ opacity: s >= 3 ? (s === 4 ? 0.35 : 1) : 0, x: s === 5 ? [0, 0, -7, 7, -5, 5, -2, 0] : 0 }}
                transition={s === 5 ? { opacity: lazy, x: { duration: 0.9, delay: 1.5 } } : lazy}>
                <Block x={HDR_X - 40} y={382} w={FW + 80} h={50} state={s === 5 ? 'on' : 'off'} />
                <Val x={400} y={403} v={s === 5 ? 'error: multiple definition' : 'program'} size={13} anchor="middle" weight={600} />
                <Val x={400} y={422} v={s === 5 ? "of `add' (main.o and util.o)" : s === 4 ? 'link not run yet' : 'call add → add’s code'} size={11} anchor="middle" dim />
              </motion.g>
            </Faint>
            {/* symbols travel to the linker's edges (not across its label), then the joined program drops out below */}
            <Packet on={s === 3} points={[[MAIN_X + 110, OY + OH], [MAIN_X + 110, 328], [HDR_X - 6, 328]]} duration={2.2} label="U add" />
            <Packet on={s === 3} points={[[UTIL_X + 110, OY + OH], [UTIL_X + 110, 328], [HDR_X + FW + 6, 328]]} duration={2.2} delay={0.3} label="T add" />
            <Packet on={s === 3} points={[[400, 358], [400, 380]]} duration={1.2} delay={1.4} r={4} />
            <Packet on={s === 5} points={[[MAIN_X + 110, OY + OH], [MAIN_X + 110, 328], [HDR_X - 2, 328]]} duration={2} repeat={false} label="T add" />
            <Packet on={s === 5} points={[[UTIL_X + 110, OY + OH], [UTIL_X + 110, 328], [HDR_X + FW + 2, 328]]} duration={2} repeat={false} label="T add" />

            {/* ===== freestanding vs libc headers ===== */}
            <Appear on={libPart} dy={10}>
              <Label x={20} y={318} size={11} dim>FREESTANDING · the compiler ships these</Label>
            </Appear>
            {FREE.map((h, i) => (
              <Drop key={h} on={libPart} delay={0.2 + i * 0.07}>
                <Block x={20 + (i % 3) * 164} y={328 + Math.floor(i / 3) * 34} w={156} h={28} label={h} mono size={12} state={s === 6 ? 'on' : 'off'} />
              </Drop>
            ))}
            <Appear on={libPart} dy={10} delay={0.4}>
              <Label x={20} y={438} size={10.5} dim>types, limits and macros: nothing to link</Label>
            </Appear>

            <Appear on={s === 7} dy={10}>
              <Label x={530} y={318} size={11} dim>NEED A C LIBRARY</Label>
            </Appear>
            {LIBC.map(([h, f], i) => (
              <Drop key={h} on={s === 7} delay={0.3 + i * 0.12}>
                <Block x={530} y={328 + i * 34} w={250} h={28} state="hatch" />
                <Label x={542} y={347 + i * 34} size={12} weight={600}>{h}</Label>
                <Label x={632} y={347 + i * 34} size={11} dim>{f}</Label>
              </Drop>
            ))}
            <Appear on={s === 7} dy={10} delay={0.7}>
              <Label x={530} y={438} size={10.5} weight={600}>in your kernel: you write these</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
