/* Git as a chain of snapshots. The Git article is a stub (Git: a version control system made by Linus Torvalds in
   2005), so the mechanics here are standard Git behaviour: working tree → git add → staging area → git commit →
   commit; a branch is a movable label, HEAD names the current branch, git switch rewrites the working tree.
   Commit hashes are made up and shortened (real ones are 40 hex digits; git shows the first 7).
   The breaking change uses Printing To Screen: colour text memory is at 0xB8000, monochrome at 0xB0000, so text
   written to 0xB0000 never shows on QEMU's colour VGA screen. */
import { motion, type Transition } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'git-snapshots',
  title: 'Git: snapshots, branches and the way back',
  summary: 'Files move from the working tree through the staging area into commits, a chain of snapshots with main and HEAD as labels; an experiment branch breaks the boot, git diff shows the one changed line and git switch main brings the working kernel back.',
  lessons: ['p6l4'],
  articles: ['Git'],
  group: 'Basics',
  order: 81,
}

const steps: VizStep[] = [
  { caption: 'Git keeps your project in three places: working tree, staging area, repository.', detail: 'The working tree is the files you edit. git init creates an empty repository in a hidden .git folder. Nothing is saved there until you commit.', ms: 5000 },
  { caption: 'git add copies the current version of your files into the staging area.', detail: 'The staging area is the draft of your next commit, and you choose what goes in. git add . takes every new or changed file.', ms: 4600 },
  { caption: 'git commit turns the staged files into a snapshot: commit a1b2c3d.', detail: 'A commit is the whole project as it was at that moment, plus a message, author and date. Its name is a hash. The short hashes here are made up.', ms: 5000 },
  { caption: 'Commit every state that boots. Each commit points back to its parent.', detail: 'main is a branch: a label that moves forward to each new commit. HEAD marks where you are. git log --oneline lists the history, newest first.', ms: 5200 },
  { caption: 'git switch -c experiment puts a second label on the same commit.', detail: 'A new branch copies nothing: it is one more label on 7c8d9e0. HEAD now follows experiment, so the next commit goes there and main stays put.', ms: 4800 },
  { caption: 'On experiment you change the VGA address and commit. The screen stays blank.', detail: 'Colour text memory is at 0xB8000; 0xB0000 is for monochrome monitors, so the text never shows. main still points at 7c8d9e0, the last kernel that booted.', ms: 5400 },
  { caption: 'git diff main experiment shows exactly what changed: one line in kernel.c.', detail: 'Lines starting with - are what main has, lines starting with + are what experiment has. git log tells you which commit made the change and why.', ms: 5200 },
  { caption: 'git switch main: HEAD moves back and your files return to the working kernel.', detail: 'Git rewrites the working tree to match 7c8d9e0, and the text is back on screen. The broken commit is kept on experiment, ready to fix or delete.', ms: 5400 },
]

/* ---------- weight: slow, settling motion ---------- */
const heavy: Transition = { duration: 1.05, ease: [0.16, 1, 0.3, 1] }
const settle: Transition = { type: 'spring', stiffness: 60, damping: 16, mass: 1.4 }

/* ---------- layout ---------- */
const WT = { x: 20, y: 20, w: 200, h: 156 }
const ST = { x: 280, y: 20, w: 190, h: 156 }
const TM = { x: 510, y: 20, w: 270, h: 156 }
const RP = { x: 20, y: 196, w: 760, h: 236 }
const FILES = ['kernel.c', 'boot.s', 'Makefile']
const rowY = (i: number) => 48 + i * 34

/* commits: square nodes */
const SQ = 72
type C = { hash: string; msg: string; x: number; y: number }
const COMMITS: C[] = [
  { hash: 'a1b2c3d', msg: 'print hello', x: 60, y: 290 },
  { hash: 'e4f5a6b', msg: 'add serial log', x: 210, y: 290 },
  { hash: '7c8d9e0', msg: 'add run target', x: 360, y: 290 },
  { hash: 'f1e2d3c', msg: 'new VGA address', x: 520, y: 350 },
]
const shownAt = [2, 3, 3, 5] // step at which each commit appears

/* ---------- pointer labels (branch + HEAD) per step ---------- */
type P = { x: number; y: number; w: number; tail: [number, number, number, number] } | null
function mainPtr(s: number): P {
  if (s < 2) return null
  const c = s === 2 ? COMMITS[0] : COMMITS[2]
  return { x: c.x, y: 250, w: 56, tail: [c.x + 28, 272, c.x + 28, 290] }
}
function expPtr(s: number): P {
  if (s < 4) return null
  if (s === 4) return { x: 446, y: 315, w: 92, tail: [446, 326, 434, 326] }
  return { x: 510, y: 316, w: 92, tail: [556, 338, 556, 350] }
}
function headPtr(s: number): P {
  if (s < 2) return null
  const onExp = s >= 4 && s <= 6
  const b = onExp ? expPtr(s)! : mainPtr(s)!
  const y = b.y - 28
  return { x: b.x, y, w: 50, tail: [b.x + 25, y + 20, b.x + 25, b.y] }
}

/* ---------- terminal per step ---------- */
type Line = { t: string; dim?: boolean; bold?: boolean }
const TERM: Line[][] = [
  [{ t: '$ git init', bold: true }, { t: 'Initialized empty Git' }, { t: 'repository in .git/' }],
  [{ t: '$ git add .', bold: true }, { t: '# no output: 3 files staged', dim: true }],
  [{ t: '$ git commit -m "print hello"', bold: true }, { t: '[main (root-commit) a1b2c3d]' }],
  [{ t: '$ git log --oneline', bold: true }, { t: '7c8d9e0 (HEAD -> main) add run…' }, { t: 'e4f5a6b add serial log' }, { t: 'a1b2c3d print hello' }],
  [{ t: '$ git switch -c experiment', bold: true }, { t: "Switched to a new branch" }, { t: "'experiment'" }],
  [{ t: '$ git commit -am "new VGA address"', bold: true }, { t: '[experiment f1e2d3c] new VGA…' }, { t: '$ make run', bold: true }, { t: '# QEMU: blank screen', dim: true }],
  [{ t: '$ git diff main experiment', bold: true }, { t: '--- a/kernel.c', dim: true }, { t: '+++ b/kernel.c', dim: true }, { t: '-#define VGA 0xB8000' }, { t: '+#define VGA 0xB0000', bold: true }],
  [{ t: '$ git switch main', bold: true }, { t: "Switched to branch 'main'" }, { t: '$ make run', bold: true }, { t: '# QEMU: hello is back', dim: true }],
]

/** Text that rolls in when its value changes. */
function Val({ x, y, v, size = 11, anchor = 'start', dim, weight = 400, delay = 0 }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; dim?: boolean; weight?: number; delay?: number }) {
  return (
    <motion.text key={v} x={x} y={y} textAnchor={anchor} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...heavy, delay }}
      fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight, whiteSpace: 'pre' }}>
      {v}
    </motion.text>
  )
}

/** A branch or HEAD label that glides between commits with weight. */
function Pointer({ p, home, text, strong }: { p: P; home: NonNullable<P>; text: string; strong?: boolean }) {
  const last = p ?? home
  return (
    <g>
      <motion.line initial={false} animate={{ x1: last.tail[0], y1: last.tail[1], x2: last.tail[2], y2: last.tail[3], opacity: p ? 1 : 0 }}
        transition={settle} stroke="var(--viz-fg)" strokeWidth={1.4} />
      <motion.g initial={false} animate={{ x: last.x, y: last.y, opacity: p ? 1 : 0 }} transition={settle}>
        <motion.rect x={0} y={0} height={strong ? 20 : 22} initial={false} animate={{ width: last.w }} transition={settle}
          fill={strong ? 'var(--viz-fg)' : 'var(--viz-bg)'} stroke="var(--viz-fg)" strokeWidth={1.2} />
        <text x={8} y={strong ? 14 : 15} fill={strong ? 'var(--viz-bg)' : 'var(--viz-fg)'} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{text}</text>
      </motion.g>
    </g>
  )
}

/** One commit: a square snapshot that drops into the chain and lands with a ring. */
function Commit({ c, on, state, broken, s }: { c: C; on: boolean; state: 'on' | 'off' | 'dim'; broken?: boolean; s: number }) {
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : -26 }} transition={settle}>
      <Block x={c.x} y={c.y} w={SQ} h={SQ} state={state} />
      {broken && <rect x={c.x + 5} y={c.y + 5} width={SQ - 10} height={SQ - 10} fill="url(#viz-hatch)" opacity={state === 'dim' ? 0.5 : 1} />}
      <text x={c.x + SQ / 2} y={c.y + 32} textAnchor="middle" fill={state === 'dim' ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.hash}</text>
      <text x={c.x + SQ / 2} y={c.y + 50} textAnchor="middle" fill="var(--viz-dim)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>3 files</text>
      {on && state === 'on' && (
        <motion.rect key={`ring-${s}`} x={c.x} y={c.y} width={SQ} height={SQ} fill="none" stroke="var(--viz-fg)" strokeWidth={1.2}
          initial={{ opacity: 0.7, scale: 1 }} animate={{ opacity: 0, scale: 1.25 }} transition={{ duration: 1.3, ease: 'easeOut', delay: 0.45 }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      )}
    </motion.g>
  )
}

export default function GitSnapshots() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const vga = s >= 5 && s <= 6 ? '0xB0000' : '0xB8000'
        const staged = s >= 1
        const commitState = (i: number): 'on' | 'off' | 'dim' => {
          if (s === 2) return i === 0 ? 'on' : 'off'
          if (s === 3) return i >= 1 ? 'on' : 'off'
          if (s === 4) return i === 2 ? 'on' : 'off'
          if (s === 5) return i === 3 ? 'on' : 'off'
          if (s === 6) return i >= 2 ? 'on' : 'dim'
          if (s === 7) return i === 2 ? 'on' : i === 3 ? 'dim' : 'off'
          return 'off'
        }
        return (
          <Scene label={meta.summary}>
            {/* ===== working tree ===== */}
            <Block x={WT.x} y={WT.y} w={WT.w} h={WT.h} state={s === 0 || s === 5 || s === 7 ? 'on' : 'off'} />
            <Label x={WT.x + 12} y={WT.y + 18} size={10.5} dim>WORKING TREE</Label>
            {FILES.map((f, i) => (
              <g key={f}>
                <Block x={WT.x + 12} y={rowY(i)} w={WT.w - 24} h={28} label={f} mono size={12.5} align="start"
                  state={(s === 5 || s === 7) && i === 0 ? 'on' : s === 0 || s === 1 ? 'off' : 'off'} />
                {i === 0 && <Val x={WT.x + WT.w - 20} y={rowY(i) + 18} v={vga} anchor="end" size={11} weight={vga === '0xB0000' ? 700 : 400} dim={vga === '0xB8000' && s !== 7} />}
              </g>
            ))}
            <Val x={WT.x + 12} y={WT.y + WT.h - 12} size={10.5} dim
              v={s === 0 ? '3 new files, not tracked' : s === 1 ? 'copied, still editable' : s === 2 ? 'same as a1b2c3d' : s === 3 ? 'same as 7c8d9e0' : s === 5 ? 'kernel.c edited' : s === 7 ? 'files restored from 7c8d9e0' : 'on branch experiment'} />

            {/* git add */}
            <Wire from={[WT.x + WT.w, 96]} to={[ST.x - 2, 96]} on={s >= 1} width={s === 1 ? 2 : 1.3} dim={s !== 1} />
            <Label x={250} y={88} size={10.5} anchor="middle" on={s >= 1} dim={s !== 1} weight={s === 1 ? 600 : 400}>git add</Label>
            {s === 1 && FILES.map((_, i) => (
              <Packet key={`add${i}`} points={[[WT.x + WT.w - 14, rowY(i) + 14], [ST.x + 14, rowY(i) + 14]]} duration={2.2} delay={i * 0.35} r={4.5} />
            ))}

            {/* ===== staging area ===== */}
            <Block x={ST.x} y={ST.y} w={ST.w} h={ST.h} state={s === 1 ? 'on' : 'off'} />
            <Label x={ST.x + 12} y={ST.y + 18} size={10.5} dim>STAGING AREA</Label>
            {FILES.map((f, i) => (
              <motion.g key={f} initial={false} animate={{ opacity: staged ? 1 : 0, x: staged ? 0 : -24 }} transition={{ ...settle, delay: staged ? 0.5 + i * 0.12 : 0 }}>
                <Block x={ST.x + 12} y={rowY(i)} w={ST.w - 24} h={28} label={f} mono size={12.5} align="start" state={s === 1 ? 'on' : 'dim'} />
              </motion.g>
            ))}
            <Val x={ST.x + 12} y={ST.y + ST.h - 12} size={10.5} dim
              v={s === 0 ? 'empty' : s === 1 ? '3 files ready to commit' : s === 2 ? 'matches a1b2c3d' : 'draft of the next commit'} />

            {/* git commit: staging → repository */}
            <Label x={383} y={190} size={10.5} on={s >= 2} dim={s !== 2 && s !== 3} weight={s === 2 || s === 3 ? 600 : 400}>git commit</Label>

            {/* ===== terminal ===== */}
            <Block x={TM.x} y={TM.y} w={TM.w} h={TM.h} state="off" />
            <Label x={TM.x + 12} y={TM.y + 18} size={10.5} dim>TERMINAL</Label>
            {TERM[s].map((l, i) => {
              return (
                <motion.text key={`${s}-${i}`} x={TM.x + 12} y={TM.y + 44 + i * 17} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ ...heavy, delay: 0.1 + i * 0.16 }} fill={l.dim ? 'var(--viz-dim)' : 'var(--viz-fg)'}
                  style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: l.bold ? 600 : 400, whiteSpace: 'pre', fontVariantLigatures: 'none' }}>
                  {l.t}
                </motion.text>
              )
            })}

            {/* ===== repository ===== */}
            <Block x={RP.x} y={RP.y} w={RP.w} h={RP.h} state="off" />
            <Label x={RP.x + 12} y={RP.y + 18} size={10.5} dim>REPOSITORY (.git)</Label>
            <Wire from={[375, ST.y + ST.h]} to={[375, RP.y + 8]} on={s >= 2} width={s === 2 || s === 3 ? 2 : 1.3} dim={s !== 2 && s !== 3} />
            <Label x={RP.x + RP.w - 12} y={RP.y + 18} size={10.5} anchor="end" dim on={s >= 2 && s !== 6}>hashes shortened and made up</Label>
            <Appear on={s === 0} dy={0}>
              <rect x={60} y={290} width={SQ} height={SQ} fill="none" stroke="var(--viz-faint)" strokeDasharray="4 4" />
              <Label x={150} y={331} size={11} dim>no commits yet</Label>
            </Appear>

            {/* commit packets: from staging down into the chain */}
            <Packet on={s === 2} points={[[375, 120], [375, RP.y + 8], [96, 270], [96, 300]]} duration={2.6} r={5} />
            {s === 3 && [1, 2].map((k, j) => (
              <Packet key={`c${k}`} points={[[375, 120], [375, RP.y + 8], [COMMITS[k].x + 36, 270], [COMMITS[k].x + 36, 300]]} duration={2.6} delay={j * 0.5} r={4.5} />
            ))}
            <Packet on={s === 5} points={[[WT.x + WT.w - 20, rowY(0) + 14], [250, 98], [375, 120], [375, RP.y + 8], [556, 330], [556, 360]]} duration={3} r={5} />
            {/* git switch main: the snapshot flows back into the working tree */}
            <Packet on={s === 7} points={[[372, 292], [250, 214], [250, 168], [WT.x + WT.w - 6, 150]]} duration={2.8} r={5} />

            {/* parent links: each commit points back to the one before */}
            <Wire from={[COMMITS[1].x, 326]} to={[COMMITS[0].x + SQ + 2, 326]} on={s >= 3} delay={s === 3 ? 0.4 : 0} />
            <Wire from={[COMMITS[2].x, 326]} to={[COMMITS[1].x + SQ + 2, 326]} on={s >= 3} delay={s === 3 ? 0.7 : 0} />
            <Wire d={`M${COMMITS[3].x} ${COMMITS[3].y + 36} C ${COMMITS[3].x - 40} ${COMMITS[3].y + 36}, ${COMMITS[2].x + SQ + 40} 326, ${COMMITS[2].x + SQ + 2} 326`} on={s >= 5} delay={s === 5 ? 0.6 : 0} />
            <Label x={171} y={318} size={10.5} anchor="middle" dim on={s === 3}>parent</Label>

            {COMMITS.map((c, i) => (
              <g key={c.hash}>
                <Commit c={c} on={s >= shownAt[i]} state={commitState(i)} broken={i === 3} s={s} />
                {i < 3 && <Label x={c.x + SQ / 2} y={c.y + SQ + 20} size={10.5} anchor="middle" dim={commitState(i) !== 'on'} on={s >= shownAt[i]}>{c.msg}</Label>}
              </g>
            ))}
            {/* the broken commit's note */}
            <Label x={COMMITS[3].x + SQ + 12} y={COMMITS[3].y + 30} size={10.5} on={s >= 5} dim={s === 7}>{COMMITS[3].msg}</Label>
            <Label x={COMMITS[3].x + SQ + 12} y={COMMITS[3].y + 48} size={11} weight={600} on={s >= 5} dim={s === 7}>✕ screen stays blank</Label>
            <Label x={COMMITS[2].x + SQ / 2} y={COMMITS[2].y + SQ + 36} size={10.5} anchor="middle" weight={600} on={s >= 5}>✓ boots</Label>

            {/* pointers */}
            <Pointer p={mainPtr(s)} home={mainPtr(2)!} text="main" />
            <Pointer p={expPtr(s)} home={expPtr(4)!} text="experiment" />
            <Pointer p={headPtr(s)} home={headPtr(2)!} text="HEAD" strong />

            {/* ===== the diff card ===== */}
            <motion.g initial={false} animate={{ opacity: s === 6 ? 1 : 0, y: s === 6 ? 0 : 10 }} transition={heavy}>
              <Block x={604} y={206} w={168} h={88} state="on" />
              <Label x={614} y={224} size={10.5} dim>main → experiment</Label>
              <Label x={614} y={249} size={12} dim>- #define VGA 0xB8000</Label>
              <Label x={614} y={270} size={12} weight={700}>+ #define VGA 0xB0000</Label>
              <Label x={614} y={286} size={10.5} dim>kernel.c · 1 line</Label>
            </motion.g>
          </Scene>
        )
      }}
    </VizStage>
  )
}
