/* How make decides what to rebuild. Follows the Makefile article: a rule is "target: dependency" plus tab-indented
   commands; make reads the whole file into a dependency tree and runs a rule's commands when the target is missing or
   any dependency is newer than it. Pattern rule %.o: %.c with $< (first dependency) and $@ (target), as in the article's
   "%.o: %.c Makefile" rule. $^ (all prerequisites) is standard GNU make. The clock times are a worked example of file
   modification times (mtime); only their order matters. */
import { motion, type Transition } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'make-rebuild-graph',
  title: 'make: rebuild only what changed',
  summary: 'A Makefile becomes a dependency graph from sources to object files to kernel.bin; make compares modification times and reruns only the recipes whose target is older than a prerequisite.',
  lessons: ['p6l3'],
  articles: ['Makefile'],
  group: 'Basics',
  order: 80,
}

const steps: VizStep[] = [
  { caption: 'A Makefile is a list of rules: a target, its prerequisites, then a recipe.', detail: 'make runs the recipe when the target file is missing or older than any of its prerequisites. Recipe lines must start with a tab, not spaces.', ms: 5200 },
  { caption: 'make reads every rule first and joins them into a dependency graph.', detail: 'Arrows point from a prerequisite to the file made from it. kernel.bin needs three object files, and each object file needs its sources.', ms: 4600 },
  { caption: 'One pattern rule, %.o: %.c, covers every C file.', detail: '% matches any name, so util.o is made from util.c. In the recipe $@ is the target and $< is the first prerequisite: gcc -c util.c -o util.o.', ms: 5200 },
  { caption: 'First build: no output exists yet, so every recipe runs.', detail: 'make builds prerequisites before the target that needs them: the three object files first, then the link. Each new file is stamped with the current time.', ms: 5200 },
  { caption: 'You touch util.c, as if you had saved an edit. Its time jumps to 10:05.', detail: 'make does not look inside your source files. It only compares modification times, so touch util.c (new time, same contents) counts as a change.', ms: 4400 },
  { caption: 'util.o (10:01) is older than util.c (10:05): it is the only object rebuilt.', detail: 'main.o and boot.o are newer than all of their prerequisites, so make skips them. That is what keeps builds fast once a kernel has dozens of files.', ms: 5200 },
  { caption: 'Now util.o is newer than kernel.bin, so the link runs again.', detail: 'The linker reads all three object files, but main.o and boot.o are reused as they are. $^ in the link recipe means all the prerequisites.', ms: 5000 },
  { caption: 'Edit util.h: main.o and util.o both list it, so both are rebuilt.', detail: 'The line main.o util.o: util.h adds the header as a prerequisite. Leave it out and make misses header edits. gcc -MMD can write such lines for you.', ms: 5600 },
  { caption: 'Run make again with nothing changed: nothing runs.', detail: "Every target is newer than its prerequisites, so make prints that kernel.bin is up to date. make run would start QEMU at once; make clean forces a full rebuild.", ms: 4600 },
]

/* ---------- weight: slow, settling motion ---------- */
const heavy: Transition = { duration: 1.05, ease: [0.16, 1, 0.3, 1] }
const settle: Transition = { type: 'spring', stiffness: 70, damping: 17, mass: 1.3 }

/* ---------- the Makefile ---------- */
const CODE: { t: string; tab?: boolean }[] = [
  { t: 'kernel.bin: main.o util.o boot.o' },
  { t: 'ld -T linker.ld -o $@ $^', tab: true },
  { t: '%.o: %.c' },
  { t: 'gcc -c $< -o $@', tab: true },
  { t: 'boot.o: boot.s' },
  { t: 'as $< -o $@', tab: true },
  { t: 'main.o util.o: util.h' },
  { t: 'run: kernel.bin' },
  { t: 'qemu-system-i386 -kernel $<', tab: true },
  { t: 'clean:' },
  { t: 'rm -f *.o kernel.bin', tab: true },
]
const CX = 20, CY = 20, CW = 270, CH = 272
const LY0 = 68, LH = 21
const lineY = (i: number) => LY0 + i * LH
/** which Makefile lines the step talks about: [first, count] */
const HOT: Record<number, [number, number]> = { 0: [0, 2], 2: [2, 2], 5: [2, 2], 6: [0, 2], 7: [6, 1] }

/* ---------- the graph ---------- */
type N = { id: string; label: string; x: number; y: number; w: number }
const KERNEL: N = { id: 'kernel', label: 'kernel.bin', x: 482, y: 40, w: 150 }
const OBJS: N[] = [
  { id: 'main.o', label: 'main.o', x: 345, y: 148, w: 110 },
  { id: 'util.o', label: 'util.o', x: 505, y: 148, w: 110 },
  { id: 'boot.o', label: 'boot.o', x: 660, y: 148, w: 110 },
]
const SRCS: N[] = [
  { id: 'main.c', label: 'main.c', x: 320, y: 248, w: 100 },
  { id: 'util.h', label: 'util.h', x: 435, y: 248, w: 100 },
  { id: 'util.c', label: 'util.c', x: 550, y: 248, w: 100 },
  { id: 'boot.s', label: 'boot.s', x: 665, y: 248, w: 100 },
]
const NH = 44
const mid = (n: N) => n.x + n.w / 2

/** source → object edges: [from source, to object, x at the object's bottom] */
const SEDGES: [string, string, number][] = [
  ['main.c', 'main.o', 385],
  ['util.h', 'main.o', 415],
  ['util.h', 'util.o', 545],
  ['util.c', 'util.o', 575],
  ['boot.s', 'boot.o', 715],
]
/** object → kernel edges: [object, x at kernel's bottom] */
const KEDGES: [string, number][] = [['main.o', 522], ['util.o', 557], ['boot.o', 592]]

const srcX = (id: string) => mid(SRCS.find((n) => n.id === id)!)
const objX = (id: string) => mid(OBJS.find((n) => n.id === id)!)
const sPath = (a: string, bx: number) => {
  const ax = srcX(a)
  return `M${ax} ${248} C ${ax} 222, ${bx} 220, ${bx} ${194}`
}
const kPath = (o: string, kx: number) => {
  const ox = objX(o)
  return `M${ox} ${148} C ${ox} 116, ${kx} 118, ${kx} ${86}`
}

/* ---------- file times per step (a worked example: only the order matters) ---------- */
function times(s: number): Record<string, string> {
  const t: Record<string, string> = { 'main.c': '10:00', 'util.h': '10:00', 'util.c': '10:00', 'boot.s': '10:00' }
  if (s >= 3) Object.assign(t, { 'main.o': '10:01', 'util.o': '10:01', 'boot.o': '10:01', kernel: '10:02' })
  if (s >= 4) t['util.c'] = '10:05'
  if (s >= 5) t['util.o'] = '10:06'
  if (s >= 6) t.kernel = '10:07'
  if (s >= 7) Object.assign(t, { 'util.h': '10:10', 'main.o': '10:11', 'util.o': '10:11', kernel: '10:12' })
  return t
}

type St = 'on' | 'off' | 'dim' | 'fill' | 'hatch'
function stateOf(id: string, s: number): St {
  const src = SRCS.some((n) => n.id === id)
  if (src) {
    if ((s === 4 && id === 'util.c') || (s === 7 && id === 'util.h')) return 'fill'
    if (s === 2 && id === 'util.c') return 'on'
    if (s === 0) return 'dim'
    if (s === 5) return id === 'util.c' ? 'on' : 'dim'
    if (s === 6) return 'dim'
    if (s === 7) return 'dim'
    return 'off'
  }
  if (id === 'kernel') return s === 0 || s === 3 || s === 6 || s === 7 ? 'on' : s === 1 || s === 2 || s === 5 ? 'dim' : 'off'
  if (s === 0) return 'off'
  if (s === 1) return 'dim'
  if (s === 2) return id === 'util.o' ? 'on' : 'dim'
  if (s === 3) return 'on'
  if (s === 5) return id === 'util.o' ? 'on' : 'dim'
  if (s === 7) return id === 'boot.o' ? 'dim' : 'on'
  return 'off'
}
/** the verdict make reaches for each target in this step */
function tagOf(id: string, s: number): string | null {
  if (id === 'kernel') return s === 3 ? 'link' : s === 6 || s === 7 ? 'relink' : s === 8 ? 'skip' : null
  if (s === 3) return 'build'
  if (s === 5) return id === 'util.o' ? 'build' : 'skip'
  if (s === 7) return id === 'boot.o' ? 'skip' : 'build'
  if (s === 8) return 'skip'
  return null
}
/** edges that carry this step's story (others dim) */
function edgeLit(from: string, to: string, s: number): boolean {
  if (s === 2) return from === 'util.c'
  if (s === 5) return from === 'util.c'
  if (s === 6) return to === 'kernel'
  if (s === 7) return from === 'util.h' || to === 'kernel'
  if (s === 8) return false
  return true
}

/* ---------- terminal text per step: [command column, reason column] ---------- */
type Line = { t: string; dim?: boolean }
const LINK = 'ld -T linker.ld -o kernel.bin main.o util.o boot.o'
const TERM: Record<number, { title: string; left: Line[]; right: Line[] }> = {
  1: { title: 'TERMINAL', left: [{ t: '$ make' }], right: [{ t: 'make reads the whole Makefile first,' }, { t: 'then starts at the first target, kernel.bin,' }, { t: 'and works down to what it needs.' }] },
  2: {
    title: 'ONE RULE, MANY FILES',
    left: [{ t: '%.o: %.c         →  util.o: util.c' }, { t: 'gcc -c $< -o $@  →  gcc -c util.c -o util.o' }],
    right: [{ t: '$@  the target              util.o' }, { t: '$<  the first prerequisite  util.c' }, { t: 'the same rule makes main.o from main.c', dim: true }],
  },
  3: { title: 'TERMINAL', left: [{ t: '$ make' }, { t: 'gcc -c main.c -o main.o' }, { t: 'gcc -c util.c -o util.o' }, { t: 'as boot.s -o boot.o' }, { t: LINK }], right: [{ t: 'no output file exists yet,' }, { t: 'so every recipe runs: 4 commands' }] },
  4: { title: 'TERMINAL', left: [{ t: '$ touch util.c' }], right: [{ t: 'util.c   10:00  →  10:05' }, { t: 'contents unchanged, time is new', dim: true }] },
  5: { title: 'TERMINAL', left: [{ t: '$ make' }, { t: 'gcc -c util.c -o util.o' }], right: [{ t: 'util.c 10:05 newer than util.o 10:01: build' }, { t: 'main.o, boot.o newer than their sources: skip' }] },
  6: { title: 'TERMINAL', left: [{ t: '$ make', dim: true }, { t: 'gcc -c util.c -o util.o', dim: true }, { t: LINK }], right: [{ t: 'util.o 10:06 newer than kernel.bin 10:02:' }, { t: 'relink. 2 commands instead of 4' }] },
  7: { title: 'TERMINAL', left: [{ t: '$ make' }, { t: 'gcc -c main.c -o main.o' }, { t: 'gcc -c util.c -o util.o' }, { t: LINK }], right: [{ t: 'util.h 10:10 is a prerequisite of' }, { t: 'main.o and util.o: both rebuild.' }, { t: 'boot.o does not list it: skip' }] },
  8: { title: 'TERMINAL', left: [{ t: '$ make' }, { t: "make: 'kernel.bin' is up to date." }], right: [{ t: 'every target is newer than' }, { t: 'its prerequisites: 0 commands' }] },
}
const TX = 20, TY = 322, TW = 760, TH = 108

/** One graph node. When its file is (re)written the node drops in and lands with a thud ring. */
function FileNode({ n, time, state, tag, out }: { n: N; time?: string; state: St; tag: string | null; out: boolean }) {
  const missing = out && !time
  const k = `${n.id}-${time ?? 'none'}`
  const lands = (out && !!time) || state === 'fill'
  return (
    <g>
      <motion.g key={k} initial={lands ? { y: -16, opacity: 0.2 } : { opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={lands ? settle : heavy}>
        <Block x={n.x} y={n.y} w={n.w} h={NH} label={n.label} sub={missing ? 'missing' : time} mono size={14} state={state} />
      </motion.g>
      {(lands || !out) && (state === 'on' || state === 'fill') && (
        <motion.rect key={`ring-${k}`} x={n.x} y={n.y} width={n.w} height={NH} fill="none" stroke="var(--viz-fg)" strokeWidth={1.2}
          initial={{ opacity: 0.7, scale: 1 }} animate={{ opacity: 0, scale: 1.14 }} transition={{ duration: 1.3, ease: 'easeOut', delay: 0.35 }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      )}
      <motion.text x={n.x + 1} y={n.y - 7} textAnchor="start" initial={false}
        animate={{ opacity: tag ? 1 : 0, y: tag ? 0 : 5 }} transition={heavy}
        fill={tag === 'skip' ? 'var(--viz-dim)' : 'var(--viz-fg)'}
        style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: tag === 'skip' ? 400 : 600 }}>
        {tag ?? ''}
      </motion.text>
    </g>
  )
}

/** A line of terminal text that slides in under its own weight, one after another. */
function TLine({ x, y, line, i, step, size = 11.5 }: { x: number; y: number; line: Line; i: number; step: number; size?: number }) {
  return (
    <motion.text key={`${step}-${i}-${line.t}`} x={x} y={y} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ ...heavy, delay: 0.12 + i * 0.16 }} fill={line.dim ? 'var(--viz-dim)' : 'var(--viz-fg)'}
      style={{ fontSize: size, fontFamily: 'var(--font-mono)', whiteSpace: 'pre' }}>
      {line.t}
    </motion.text>
  )
}

export default function MakeRebuildGraph() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const t = times(s)
        const hot = HOT[s]
        const term = TERM[s]
        return (
          <Scene label={meta.summary}>
            {/* ===== the Makefile ===== */}
            <Block x={CX} y={CY} w={CW} h={CH} state={s === 0 || s === 2 || s === 7 ? 'on' : 'off'} />
            <Label x={CX + 12} y={CY + 20} size={10.5} dim>Makefile</Label>
            <line x1={CX} x2={CX + CW} y1={CY + 30} y2={CY + 30} stroke="var(--viz-faint)" />
            {/* the highlight bar glides between rules */}
            <motion.rect x={CX + 1} width={CW - 2} initial={false} fill="var(--viz-faint)"
              animate={{ y: hot ? lineY(hot[0]) - 15 : lineY(0) - 15, height: hot ? hot[1] * LH : LH, opacity: hot ? 1 : 0 }} transition={settle} />
            <motion.rect x={CX + 1} width={3} initial={false} fill="var(--viz-fg)"
              animate={{ y: hot ? lineY(hot[0]) - 15 : lineY(0) - 15, height: hot ? hot[1] * LH : LH, opacity: hot ? 1 : 0 }} transition={settle} />
            {CODE.map((c, i) => {
              const lit = !hot || (i >= hot[0] && i < hot[0] + hot[1])
              return (
                <motion.g key={i} initial={false} animate={{ opacity: lit ? 1 : 0.42 }} transition={heavy}>
                  {c.tab && <text x={CX + 14} y={lineY(i)} fill="var(--viz-dim)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>⇥</text>}
                  <text x={CX + (c.tab ? 34 : 12)} y={lineY(i)} fill="var(--viz-fg)" style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: c.tab ? 400 : 500 }}>{c.t}</text>
                </motion.g>
              )
            })}

            {/* ===== the dependency graph ===== */}
            {SEDGES.map(([a, b, bx], i) => (
              <Wire key={`s${i}`} d={sPath(a, bx)} on={s >= 1} dim={!edgeLit(a, b, s)} width={edgeLit(a, b, s) && s !== 1 && s !== 3 ? 2 : 1.3} delay={s === 1 ? 0.15 + i * 0.12 : 0} />
            ))}
            {KEDGES.map(([o, kx], i) => (
              <Wire key={`k${i}`} d={kPath(o, kx)} on={s >= 1} dim={!edgeLit(o, 'kernel', s)} width={edgeLit(o, 'kernel', s) && s !== 1 && s !== 3 ? 2 : 1.3} delay={s === 1 ? 0.75 + i * 0.12 : 0} />
            ))}

            {/* the walk: slow packets climb the graph, passing behind each node as it is processed */}
            {s === 3 && [['main.c', 'main.o'], ['util.c', 'util.o'], ['boot.s', 'boot.o']].map(([a, o], i) => (
              <Packet key={`b${i}`} points={[[srcX(a), 248], [objX(o), 194], [objX(o), 148], [557, 86]]} duration={2.8} delay={i * 0.35} r={4.5} />
            ))}
            <Packet on={s === 5} points={[[600, 248], [575, 194], [560, 170]]} duration={2.2} r={5} />
            {s === 6 && OBJS.map((n, i) => (
              <Packet key={`l${i}`} points={[[mid(n), 148], [KEDGES[i][1], 86], [557, 64]]} duration={2.2} delay={i * 0.25} r={4.5} />
            ))}
            {s === 7 && [['main.o', 415], ['util.o', 545]].map(([o, bx], i) => (
              <Packet key={`h${i}`} points={[[485, 248], [bx as number, 194], [objX(o as string), 148], [557, 86]]} duration={2.8} delay={i * 0.3} r={4.5} />
            ))}

            <FileNode n={KERNEL} time={t.kernel} state={stateOf('kernel', s)} tag={tagOf('kernel', s)} out />
            {OBJS.map((n) => <FileNode key={n.id} n={n} time={t[n.id]} state={stateOf(n.id, s)} tag={tagOf(n.id, s)} out />)}
            {SRCS.map((n) => <FileNode key={n.id} n={n} time={t[n.id]} state={stateOf(n.id, s)} tag={null} out={false} />)}

            <Label x={310} y={312} size={10.5} dim on={s >= 1}>arrow = “is needed to make” · times = when each file was last written</Label>


            {/* ===== terminal / rule anatomy ===== */}
            <Block x={TX} y={TY} w={TW} h={TH} state="off" />
            <motion.text key={`title-${term?.title ?? 'rule'}`} x={TX + 12} y={TY + 16} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={heavy}
              fill="var(--viz-dim)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
              {term?.title ?? 'ANATOMY OF A RULE'}
            </motion.text>
            <line x1={430} x2={430} y1={TY + 26} y2={TY + TH - 10} stroke="var(--viz-faint)" opacity={s === 0 ? 0 : 1} />

            {s === 0 && (
              <motion.g key="anatomy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={heavy}>
                <text x={44} y={TY + 46} fill="var(--viz-fg)" style={{ fontSize: 15, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>kernel.bin:</text>
                <text x={164} y={TY + 46} fill="var(--viz-fg)" style={{ fontSize: 15, fontFamily: 'var(--font-mono)' }}>main.o util.o boot.o</text>
                <line x1={44} x2={134} y1={TY + 54} y2={TY + 54} stroke="var(--viz-fg)" strokeWidth={1.5} />
                <line x1={164} x2={344} y1={TY + 54} y2={TY + 54} stroke="var(--viz-fg)" strokeWidth={1.5} />
                <Label x={89} y={TY + 68} size={10.5} anchor="middle" dim>target</Label>
                <Label x={254} y={TY + 68} size={10.5} anchor="middle" dim>prerequisites</Label>
                <rect x={44} y={TY + 78} width={26} height={16} fill="none" stroke="var(--viz-dim)" strokeDasharray="2 2" />
                <text x={57} y={TY + 90} textAnchor="middle" fill="var(--viz-dim)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>tab</text>
                <text x={80} y={TY + 91} fill="var(--viz-fg)" style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>ld -T linker.ld -o $@ $^</text>
                <Label x={300} y={TY + 91} size={10.5} dim>recipe</Label>
                <Label x={430} y={TY + 46} size={12} mono={false} weight={500}>The recipe runs only when the target</Label>
                <Label x={430} y={TY + 64} size={12} mono={false} weight={500}>is missing, or older than a prerequisite.</Label>
                <Label x={430} y={TY + 88} size={11} mono={false} dim>Otherwise make leaves it alone.</Label>
              </motion.g>
            )}
            {term && term.left.map((l, i) => <TLine key={`L${s}-${i}`} x={34} y={TY + 38 + i * 16} line={l} i={i} step={s} size={11.5} />)}
            {term && term.right.map((l, i) => <TLine key={`R${s}-${i}`} x={444} y={TY + 38 + i * 16} line={l} i={i + term.left.length * 0.5} step={s} size={11} />)}
          </Scene>
        )
      }}
    </VizStage>
  )
}
