/* The C preprocessor as text substitution, run before the compiler. Rules from "C preprocessor": #include pastes the
   header's contents in place, #define tokens are replaced by their value, #ifdef keeps a block only if the token is
   defined, header guards (#ifndef X / #define X / ... / #endif) stop a second inclusion, gcc -D defines a token.
   Macro pitfall checked by hand: SQUARE(x) x*x with a = 3 gives a+1*a+1 = 3 + 3 + 1 = 7, not (3+1)^2 = 16;
   ((x)*(x)) gives ((3+1)*(3+1)) = 16. gcc -E stops after preprocessing and prints the result (plus # line markers). */
import type { ReactNode } from 'react'
import { motion, type Transition } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'preprocessor-expansion',
  title: 'The preprocessor rewrites text',
  summary: 'main.c passes through the preprocessor before the compiler: #include pastes util.h in, #define BUF 512 substitutes text, an #ifdef DEBUG block disappears, an include guard blocks the second paste, SQUARE(a+1) expands to a+1*a+1 until parentheses fix it, and gcc -E shows the result.',
  lessons: ['p3l2'],
  articles: ['C preprocessor'],
  group: 'Basics',
  order: 51,
}

const steps: VizStep[] = [
  { caption: 'Before the compiler sees main.c, the preprocessor rewrites it as plain text.', detail: 'It handles every line that starts with #, top to bottom. It knows nothing about C types or functions: it only cuts, pastes and replaces text.', ms: 4400 },
  { caption: '#include "util.h" pastes the text of util.h in its place.', detail: 'The # lines inside util.h are instructions for the preprocessor and are used up. Only the declaration int max(int a, int b); reaches the output.', ms: 4600 },
  { caption: 'The second #include pastes nothing: the include guard stops it.', detail: 'The first paste ran #define UTIL_H. Now #ifndef UTIL_H is false, so everything up to #endif is skipped. Headers often arrive twice through other headers.', ms: 4800 },
  { caption: '#define BUF 512 makes every later BUF become 512.', detail: 'char buf[BUF]; leaves as char buf[512];. Macro names are written in ALL CAPS by custom, to avoid accidental clashes with normal names.', ms: 4400 },
  { caption: 'DEBUG is not defined, so the #ifdef DEBUG block is cut out.', detail: 'The compiler never sees log("start"). Build with gcc -DDEBUG and the same lines would be kept. This is how kernels switch code on and off per build.', ms: 4600 },
  { caption: 'Trap: SQUARE(a+1) becomes a+1*a+1. That is 7 for a = 3, not 16.', detail: 'The text a+1 is pasted for x with no brackets, and * binds tighter than +: a + (1*a) + 1. The preprocessor does not do maths, it only pastes.', ms: 5200 },
  { caption: 'Fix: put brackets around every use of x and around the whole result.', detail: '#define SQUARE(x) ((x)*(x)) expands to ((a+1)*(a+1)) = 4 × 4 = 16. One trap remains: SQUARE(i++) pastes i++ twice, which C leaves undefined.', ms: 5000 },
  { caption: 'gcc -E main.c stops after this pass and prints exactly what the compiler gets.', detail: 'When a macro surprises you, look here. Real output also has # 1 "main.c" line markers so errors can point back to the right file and line.', ms: 5200 },
]

/* weight: heavy, slow springs; text lands instead of popping. */
const heavy: Transition = { type: 'spring', stiffness: 55, damping: 14, mass: 1.3 }
const lazy: Transition = { duration: 1.1, ease: [0.3, 0.05, 0.15, 1] }

// main.c column
const MX = 20, MW = 260, MY = 40, LH = 26
const lineY = (i: number) => MY + 44 + i * LH
// middle column
const CX = 300, CW = 200
// output column
const OX = 520, OW = 260

/** Text that drops in with weight whenever its value changes. */
function Val({ x, y, v, size = 12, anchor = 'start', weight = 400, dim, delay = 0 }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean; delay?: number }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...heavy, delay, opacity: { ...lazy, delay } }}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>
        {v}
      </text>
    </motion.g>
  )
}

/** A source line: bright while being processed, dim once used up, struck through when cut. */
function Line({ x, y, text, state, cut, delay = 0 }: { x: number; y: number; text: string; state: 'live' | 'idle' | 'used'; cut?: boolean; delay?: number }) {
  const w = text.length * 7.2
  return (
    <g>
      <motion.text x={x} y={y} initial={false} animate={{ opacity: state === 'used' ? 0.38 : 1 }} transition={lazy}
        fill={state === 'live' ? 'var(--viz-fg)' : 'var(--viz-dim)'} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: state === 'live' ? 600 : 400 }}>
        {text}
      </motion.text>
      <motion.line x1={x - 2} x2={x + w + 2} y1={y - 4} y2={y - 4} stroke="var(--viz-fg)" strokeWidth={1.5}
        initial={false} animate={{ pathLength: cut ? 1 : 0, opacity: cut ? 1 : 0 }} transition={{ ...lazy, delay }} />
    </g>
  )
}

function Faint({ on, children, low = 0.25 }: { on: boolean; children: ReactNode; low?: number }) {
  return <motion.g initial={false} animate={{ opacity: on ? 1 : low }} transition={lazy}>{children}</motion.g>
}

/** Which main.c lines are under the reading head at each step: [first, count]. */
const CURSOR: ([number, number] | null)[] = [null, [0, 1], [1, 1], [2, 2], [4, 3], [7, 2], [7, 2], null]

export default function PreprocessorExpansion() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const fixed = s >= 6
        const SRC = [
          '#include "util.h"',
          '#include "util.h"  // again',
          '#define BUF 512',
          'char buf[BUF];',
          '#ifdef DEBUG',
          'log("start");',
          '#endif',
          fixed ? '#define SQUARE(x) ((x)*(x))' : '#define SQUARE(x) x*x',
          'int n = SQUARE(a+1);',
        ]
        const cur = CURSOR[s]
        const lineState = (i: number): 'live' | 'idle' | 'used' => {
          if (cur && i >= cur[0] && i < cur[0] + cur[1]) return 'live'
          if (s === 7) return i === 3 || i === 8 ? 'live' : 'used'
          if (!cur) return 'idle'
          return i < cur[0] ? 'used' : 'idle'
        }
        return (
          <Scene label={meta.summary}>
            {/* ===== main.c ===== */}
            <Block x={MX} y={MY} w={MW} h={LH * 9 + 40} state={s === 0 ? 'on' : 'off'} />
            <Label x={MX + 12} y={MY + 18} size={11} dim>main.c (what you wrote)</Label>
            {cur && (
              <motion.rect x={MX + 4} width={MW - 8} initial={false}
                animate={{ y: lineY(cur[0]) - 17, height: cur[1] * LH }} transition={heavy}
                fill="var(--viz-fg)" opacity={0.1} />
            )}
            {cur && (
              <motion.rect x={MX} width={3} initial={false} animate={{ y: lineY(cur[0]) - 17, height: cur[1] * LH }} transition={heavy} fill="var(--viz-fg)" />
            )}
            {SRC.map((t, i) => (
              <g key={i}>
                {i === 7 ? (
                  <Val x={MX + 14} y={lineY(i)} v={t} size={12} weight={lineState(i) === 'live' ? 600 : 400} dim={lineState(i) !== 'live'} />
                ) : (
                  <Line x={MX + 14} y={lineY(i)} text={t} state={lineState(i)} cut={s >= 4 && i >= 4 && i <= 6} delay={(i - 4) * 0.2} />
                )}
              </g>
            ))}
            {/* at the end: which lines became code */}
            <Appear on={s === 7} dy={10}>
              <Label x={MX} y={MY + LH * 9 + 64} size={11} dim>2 lines of main.c reach the compiler;</Label>
              <Label x={MX} y={MY + LH * 9 + 82} size={11} dim># lines used up, DEBUG block cut</Label>
            </Appear>

            {/* ===== util.h ===== */}
            <Faint on={s === 1 || s === 2}>
              <Block x={CX} y={MY} w={CW} h={126} state={s === 1 || s === 2 ? 'on' : 'off'} />
              <Label x={CX + 12} y={MY + 18} size={11} dim>util.h</Label>
              <Line x={CX + 12} y={MY + 44} text="#ifndef UTIL_H" state={s === 2 ? 'live' : s === 1 ? 'used' : 'idle'} />
              <Line x={CX + 12} y={MY + 66} text="#define UTIL_H" state={s === 1 ? 'used' : 'idle'} cut={s === 2} />
              <Line x={CX + 12} y={MY + 88} text="int max(int a, int b);" state={s === 1 ? 'live' : 'idle'} cut={s === 2} delay={0.2} />
              <Line x={CX + 12} y={MY + 110} text="#endif" state={s === 1 ? 'used' : s === 2 ? 'live' : 'idle'} />
            </Faint>
            <Appear on={s === 2} dy={4}>
              <Label x={CX + CW - 10} y={MY + 44} size={10.5} anchor="end" weight={600}>false</Label>
            </Appear>
            <Wire from={[CX + CW / 2, MY + 128]} to={[CX + CW / 2, 186]} on={s === 1 || s === 2} dim={s === 2} />

            {/* ===== the preprocessor ===== */}
            <Block x={CX} y={190} w={CW} h={56} label="preprocessor" sub="text in → text out" state={s <= 6 ? 'on' : 'off'} />
            <Wire from={[MX + MW, 218]} to={[CX - 2, 218]} on />
            <Wire from={[CX + CW, 218]} to={[OX - 2, 218]} on />

            {/* defined-macro table */}
            <Label x={CX} y={282} size={11} dim>DEFINED MACROS</Label>
            {([
              ['UTIL_H', '(defined)', s >= 1, s === 2],
              ['BUF', '512', s >= 3, s === 3],
              ['DEBUG', 'not defined', s >= 4, s === 4],
              ['SQUARE(x)', fixed ? '((x)*(x))' : 'x*x', s >= 5, s === 5 || s === 6],
            ] as [string, string, boolean, boolean][]).map(([name, val, on, hot], i) => (
              <Appear key={name} on={on} dx={-12} dy={0}>
                <Block x={CX} y={290 + i * 30} w={CW} h={30} state={name === 'DEBUG' ? 'hatch' : hot ? 'on' : 'off'} />
                <Label x={CX + 10} y={310 + i * 30} size={12} weight={500}>{name}</Label>
                <Val x={CX + CW - 10} y={310 + i * 30} v={val} size={12} anchor="end" dim={name === 'DEBUG' || name === 'UTIL_H'} />
              </Appear>
            ))}

            {/* ===== output ===== */}
            <Block x={OX} y={MY} w={OW} h={206} state={s === 7 ? 'on' : 'off'} />
            <Val x={OX + 12} y={MY + 18} v={s === 7 ? '$ gcc -E main.c' : 'output (what the compiler sees)'} size={11} dim={s !== 7} weight={s === 7 ? 600 : 400} />
            <Label x={OX + 12} y={MY + 46} size={12} dim on={s === 0}>(nothing yet)</Label>
            <Appear on={s >= 1}><Label x={OX + 12} y={MY + 46} size={13} weight={500}>int max(int a, int b);</Label></Appear>
            <Label x={OX + 12} y={MY + 74} size={11} dim on={s === 2}>(second paste: nothing)</Label>
            <Appear on={s >= 3}>
              <Label x={OX + 12} y={MY + 74} size={13} weight={500}>char buf[</Label>
              <motion.text x={OX + 12 + 9 * 7.8} y={MY + 74} initial={false} animate={{ opacity: 1 }}
                fill="var(--viz-fg)" style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>512</motion.text>
              <Label x={OX + 12 + 12 * 7.8} y={MY + 74} size={13} weight={500}>];</Label>
              {/* underline the substituted text (a box would crowd the brackets) */}
              <motion.line x1={OX + 12 + 9 * 7.8} x2={OX + 12 + 12 * 7.8} y1={MY + 80} y2={MY + 80} stroke="var(--viz-fg)" strokeWidth={2}
                initial={false} animate={{ opacity: s === 3 ? 1 : 0, pathLength: s === 3 ? 1 : 0 }} transition={lazy} />
            </Appear>
            <Label x={OX + 12} y={MY + 102} size={11} dim on={s === 4}>(DEBUG block: removed)</Label>
            <Appear on={s >= 5}>
              <Val x={OX + 12} y={MY + 102} v={fixed ? 'int n = ((a+1)*(a+1));' : 'int n = a+1*a+1;'} size={13} weight={500} />
            </Appear>
            <Label x={OX + 12} y={MY + 132} size={10.5} dim on={s === 7}>no # lines left, no macros left</Label>

            {/* ===== the compiler, which only ever sees the output ===== */}
            <Wire from={[OX + OW / 2, MY + 208]} to={[OX + OW / 2, 286]} on={s === 7} />
            <Faint on={s === 7} low={0.3}>
              <Block x={OX} y={290} w={OW} h={56} label="compiler" sub="never sees #include, BUF or SQUARE" size={13} state={s === 7 ? 'on' : 'off'} />
            </Faint>

            {/* ===== the macro trap, worked out ===== */}
            <Appear on={s === 5 || s === 6} dy={10}>
              <Label x={MX} y={MY + LH * 9 + 64} size={11} dim>with a = 3</Label>
            </Appear>
            <Appear on={s === 5} dy={10}>
              <Label x={MX} y={MY + LH * 9 + 88} size={13} weight={500}>a+1*a+1</Label>
              <Label x={MX} y={MY + LH * 9 + 110} size={13}>= 3 + (1*3) + 1 = 7</Label>
              <Label x={MX} y={MY + LH * 9 + 132} size={11} dim>you meant (3+1)², which is 16</Label>
            </Appear>
            <Appear on={s === 6} dy={10} delay={0.3}>
              <Label x={MX} y={MY + LH * 9 + 88} size={13} weight={500}>((a+1)*(a+1))</Label>
              <Label x={MX} y={MY + LH * 9 + 110} size={13}>= (4)*(4) = 16</Label>
              <Label x={MX} y={MY + LH * 9 + 132} size={11} dim>brackets keep the pasted text whole</Label>
            </Appear>
            <motion.g initial={false} animate={{ x: s === 5 ? [0, 0, -5, 5, -3, 3, 0] : 0 }} transition={s === 5 ? { duration: 0.8, delay: 1.4 } : lazy}>
              <Appear on={s === 5} delay={0.9}>
                <Block x={190} y={MY + LH * 9 + 70} w={90} h={28} label="7 ≠ 16" size={13} state="on" />
              </Appear>
            </motion.g>

            {/* ===== the text in motion ===== */}
            <Packet on={s === 0} points={[[MX + MW - 30, 218], [CX + CW / 2, 218], [OX + 40, 218]]} duration={2.6} label="text" />
            <Packet on={s === 1} points={[[CX + CW / 2, MY + 84], [CX + CW / 2, 218], [OX - 10, 218], [OX + 6, MY + 42]]} duration={2.6} label="paste" />
            <Packet on={s === 3} points={[[CX + CW - 30, 335], [CX + CW + 12, 335], [CX + CW + 12, MY + 70], [OX + 94, MY + 70]]} duration={2.6} label="512" />
            <Packet on={s === 5 || s === 6} points={[[MX + MW - 30, lineY(8) - 4], [MX + MW + 8, lineY(8) - 4], [MX + MW + 8, 218], [CX + CW / 2, 218], [OX - 10, 218], [OX + 6, MY + 98]]} duration={2.8} />
            <Packet on={s === 7} points={[[OX + OW / 2, MY + 208], [OX + OW / 2, 290]]} duration={2} />
            <Pulse x={MX + 120} y={lineY(5) - 4} on={s === 4} r={18} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
