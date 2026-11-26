/* The shell loop on a Unix-like API: read a line (echo, backspace), split it into words,
   decide builtin or program, then run "echo hello | upper" as two children joined by a pipe.
   fd numbers follow the usual rule: pipe() returns the two lowest free descriptors, 3 and 4. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'shell-loop',
  title: 'The shell loop and a pipe',
  summary: 'A shell reads a line with echo and backspace, splits "echo hello | upper", makes a pipe, starts two children whose stdout and stdin are redirected with dup2, waits for both and prints the prompt again.',
  lessons: ['t8m3l2'],
  articles: ['Creating A Shell', 'Unix Pipes'],
  group: 'User space',
  order: 832,
}

const steps: VizStep[] = [
  { caption: 'The shell prints "$ " and reads keys. It echoes each one and adds it to its line buffer.', detail: 'The shell is an ordinary user program. Keys arrive on its stdin (fd 0); it writes them back to stdout (fd 1) so you can see what you type.' },
  { caption: 'Backspace removes the typo from the buffer and the screen. Enter ends the line.', detail: 'Backspace drops the last character from the buffer and prints "\\b \\b" to erase it on screen. Nothing runs until Enter.' },
  { caption: 'Split the line on spaces: echo, hello, |, upper. The | separates two commands.', detail: 'Left of | is "echo hello", right of it is "upper". Real shells also handle quotes, > and <, but the idea is the same.' },
  { caption: 'Builtin or program? Neither command is a builtin, so both run as programs.', detail: 'cd and exit must be builtins: a child cannot change the shell’s own working directory or end the shell. Everything else is found on disk and started.', ms: 3800 },
  { caption: 'pipe() makes a buffer in the kernel with two ends: fd 3 reads, fd 4 writes.', detail: 'pipe() returns the two lowest free descriptors. 0, 1 and 2 are taken by the terminal, so the shell gets 3 (read end) and 4 (write end).' },
  { caption: 'Child 1 is forked for echo. dup2(4, 1) turns its stdout into the pipe’s write end.', detail: 'fork copies the fd table. dup2(4, 1) makes fd 1 point where fd 4 points; then the child closes 3 and 4 and execs echo, which just writes to fd 1.', ms: 4000 },
  { caption: 'Child 2 is forked for upper. dup2(3, 0) turns its stdin into the pipe’s read end.', detail: 'Same pattern on the other side: close 3 and 4, then exec upper. Neither program knows a pipe is involved. They only use fd 0 and fd 1.', ms: 4000 },
  { caption: 'The shell closes 3 and 4 and waits. "hello\\n" flows echo → pipe → upper → screen.', detail: 'The parent must close its write end too: upper sees end-of-file only when every write end is closed. If the pipe fills, echo blocks until upper reads.', ms: 4400 },
  { caption: 'Both children exit. waitpid returns for each, and the shell prints "$ " again.', detail: 'That is the whole loop: prompt, read, split, start, wait. Then it begins again with the next line.', ms: 3800 },
]

const LINE = 'echo hello | upper'
const TYPED = 'echo hellp'
const TOKENS = [
  { t: 'echo', x: 370, w: 58 },
  { t: 'hello', x: 436, w: 66 },
  { t: '|', x: 510, w: 30 },
  { t: 'upper', x: 548, w: 66 },
]

// fd tables: [fd, target] per step
const SHELL_FD = (s: number) => [
  'tty', 'tty', 'tty',
  s < 4 ? '—' : s >= 7 ? 'closed' : 'pipe read',
  s < 4 ? '—' : s >= 7 ? 'closed' : 'pipe write',
]
const ECHO_FD = ['tty', 'pipe write', 'tty', 'closed', 'closed']
const UPPER_FD = ['pipe read', 'tty', 'tty', 'closed', 'closed']

const TY = 166, RH = 24 // fd table rows
const rowMid = (i: number) => TY + i * RH + RH / 2
const ECHO_X = 20, SHELL_X = 315, UPPER_X = 610, TW = 170
const PIPE = { x: 290, y: 340, w: 220, h: 38 }

function FdTable({ x, rows, hot, s, dimAll }: { x: number; rows: string[]; hot: number[]; s: number; dimAll?: boolean }) {
  return (
    <g>
      {rows.map((r, i) => (
        <g key={i}>
          <Block x={x} y={TY + i * RH} w={TW} h={RH} state={dimAll ? 'dim' : hot.includes(i) ? 'on' : r === 'closed' || r === '—' ? 'dim' : 'off'} />
          <Label x={x + 10} y={TY + i * RH + 16} size={12} weight={600}>{i}</Label>
          <motion.text key={`${r}-${s >= 7}`} x={x + TW - 10} y={TY + i * RH + 16} textAnchor="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={ease}
            fill={r.startsWith('pipe') ? 'var(--viz-fg)' : 'var(--viz-dim)'} style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: r.startsWith('pipe') ? 600 : 400 }}>
            {r}
          </motion.text>
        </g>
      ))}
    </g>
  )
}

export default function ShellLoop() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const text = s === 0 ? TYPED : LINE
        const forked1 = s >= 5, forked2 = s >= 6, done = s === 8
        return (
          <Scene label={meta.summary}>
            {/* ---------- terminal ---------- */}
            <Label x={20} y={20} size={11} dim>TERMINAL</Label>
            <Block x={20} y={28} w={330} h={94} state={s <= 1 || s >= 7 ? 'on' : 'off'} />
            <motion.text key={text} x={32} y={54} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={ease}
              fill="var(--viz-fg)" style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>$ {text}</motion.text>
            <Label x={32} y={78} size={13} weight={600} on={s >= 7} delay={s === 7 ? 1.6 : 0}>HELLO</Label>
            <Label x={32} y={102} size={13} on={s === 8}>$</Label>
            <motion.rect y={42} width={8} height={15} fill="var(--viz-fg)" initial={false}
              animate={{ x: 32 + (text.length + 2) * 7.8, opacity: s <= 1 ? [1, 0, 1] : 0 }} transition={{ x: ease, opacity: { duration: 1, repeat: s <= 1 ? Infinity : 0 } }} />
            <motion.rect x={50} y={90} width={8} height={15} fill="var(--viz-fg)" initial={false}
              animate={{ opacity: s === 8 ? [1, 0, 1] : 0 }} transition={{ duration: 1, repeat: s === 8 ? Infinity : 0 }} />

            {/* ---------- line buffer ---------- */}
            <Label x={370} y={20} size={11} dim>LINE BUFFER</Label>
            {Array.from({ length: 18 }, (_, i) => (
              <g key={i}>
                <Block x={370 + i * 22} y={28} w={22} h={26} state={(s === 1 && i === 9) ? 'on' : i < text.length ? 'off' : 'dim'} />
                <motion.text key={`${i}-${text[i] ?? ''}`} x={370 + i * 22 + 11} y={46} textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ ...ease, delay: s === 1 && i >= 9 ? 0.4 + (i - 9) * 0.08 : 0 }}
                  fill="var(--viz-fg)" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{text[i] === ' ' ? '' : text[i] ?? ''}</motion.text>
              </g>
            ))}
            <Label x={370 + 9 * 22 + 11} y={70} size={10.5} anchor="middle" on={s === 1}>⌫ p → o</Label>
            <Label x={780} y={70} size={10.5} anchor="end" on={s === 1} weight={600}>Enter ⏎</Label>

            {/* tokens */}
            {TOKENS.map((k, i) => (
              <Appear key={k.t} on={s >= 2} delay={s === 2 ? i * 0.15 : 0}>
                <Block x={k.x} y={78} w={k.w} h={24} label={k.t} mono size={12}
                  state={(s === 2 && i === 2) || (s === 3 && i !== 2 && i !== 1) ? 'on' : s === 4 && i === 2 ? 'on' : 'off'} />
              </Appear>
            ))}
            <Label x={624} y={95} size={10.5} dim on={s >= 2}>4 words, 1 pipe</Label>
            <Label x={370} y={120} size={11} on={s === 3}>cd, exit → builtin · echo, upper → fork + exec</Label>

            {/* ---------- shell (parent) ---------- */}
            <Label x={SHELL_X} y={TY - 10} size={11} weight={600}>SHELL (parent)</Label>
            <FdTable x={SHELL_X} rows={SHELL_FD(s)} hot={s === 4 ? [3, 4] : s === 7 ? [3, 4] : []} s={s} />
            <Label x={SHELL_X} y={312} size={11} on={s >= 7} weight={s === 8 ? 600 : 400}>{s === 8 ? 'waitpid × 2: both done' : 'waitpid(echo), waitpid(upper)'}</Label>

            {/* ---------- pipe ---------- */}
            <Appear on={s >= 4}>
              <Label x={PIPE.x} y={PIPE.y - 8} size={10.5} dim>PIPE · buffer in the kernel</Label>
              {Array.from({ length: 8 }, (_, i) => (
                <Block key={i} x={PIPE.x + i * (PIPE.w / 8)} y={PIPE.y} w={PIPE.w / 8} h={PIPE.h} state={s === 7 && i < 6 ? 'on' : s === 4 ? 'on' : 'off'} />
              ))}
              {['h', 'e', 'l', 'l', 'o', '\\n'].map((c, i) => (
                <Label key={i} x={PIPE.x + i * (PIPE.w / 8) + PIPE.w / 16} y={PIPE.y + 24} size={12} anchor="middle" on={s === 7} delay={s === 7 ? 0.8 + i * 0.1 : 0}>{c}</Label>
              ))}
              <Label x={PIPE.x} y={PIPE.y + PIPE.h + 16} size={10.5} dim>write end</Label>
              <Label x={PIPE.x + PIPE.w} y={PIPE.y + PIPE.h + 16} size={10.5} dim anchor="end">read end</Label>
            </Appear>
            {/* shell's own pipe fds: 3 (read) and 4 (write) */}
            <Wire d={`M${SHELL_X} ${rowMid(4)} H300 V${PIPE.y - 22}`} on={s >= 4 && s < 7} arrow={false} dashed />
            <Wire d={`M${SHELL_X + TW} ${rowMid(3)} H500 V${PIPE.y - 22}`} on={s >= 4 && s < 7} arrow={false} dashed />

            {/* ---------- child 1: echo ---------- */}
            <Appear on={forked1} dx={120} dy={0}>
              <Label x={ECHO_X} y={TY - 10} size={11} weight={600}>CHILD 1 · echo hello</Label>
              <FdTable x={ECHO_X} rows={ECHO_FD} hot={s === 5 ? [1] : s === 7 ? [1] : []} s={s} dimAll={done} />
              <Label x={ECHO_X} y={312} size={11} on={s >= 5} dim={done}>{done ? 'exited' : 'dup2(4, 1) · exec echo'}</Label>
            </Appear>
            <Wire d={`M${ECHO_X + TW} ${rowMid(1)} H240 V${PIPE.y + PIPE.h / 2} H${PIPE.x - 2}`} on={forked1} dim={done} />

            {/* ---------- child 2: upper ---------- */}
            <Appear on={forked2} dx={-120} dy={0}>
              <Label x={UPPER_X} y={TY - 10} size={11} weight={600}>CHILD 2 · upper</Label>
              <FdTable x={UPPER_X} rows={UPPER_FD} hot={s === 6 ? [0] : s === 7 ? [0, 1] : []} s={s} dimAll={done} />
              <Label x={UPPER_X} y={312} size={11} on={s >= 6} dim={done}>{done ? 'exited' : 'dup2(3, 0) · exec upper'}</Label>
            </Appear>
            <Wire d={`M${PIPE.x + PIPE.w} ${PIPE.y + PIPE.h / 2} H560 V${rowMid(0)} H${UPPER_X - 2}`} on={forked2} dim={done} />

            {/* ---------- motion ---------- */}
            <Packet on={s === 0} points={[[370 + 9 * 22 + 11, 62], [370 + 9 * 22 + 11, 136], [300, 136], [300, 54]]} duration={1.6} label="echo" />
            <Packet on={s === 5} points={[[SHELL_X, rowMid(2)], [ECHO_X + TW, rowMid(2)]]} duration={1.2} label="fork" />
            <Packet on={s === 6} points={[[SHELL_X + TW, rowMid(2)], [UPPER_X, rowMid(2)]]} duration={1.2} label="fork" />
            <Packet on={s === 7} points={[[ECHO_X + TW, rowMid(1)], [240, rowMid(1)], [240, PIPE.y + PIPE.h / 2], [PIPE.x + PIPE.w, PIPE.y + PIPE.h / 2], [560, PIPE.y + PIPE.h / 2], [560, rowMid(0)], [UPPER_X, rowMid(0)]]} duration={2.4} label="hello\n" />
            <Packet on={s === 7} points={[[760, TY], [760, 140], [340, 140], [340, 78]]} duration={1.4} delay={1.2} label="HELLO" />
            <Pulse x={PIPE.x + PIPE.w / 2} y={PIPE.y + PIPE.h / 2} on={s === 4} r={20} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
