/* Stack Smashing Protector and UBSan, following the two wiki articles.
   SSP: the prologue copies __stack_chk_guard (32-bit example value 0xe2dee396 from the article) into the frame between
   the buffer and the saved EBP / return address; the epilogue checks canary ^ __stack_chk_guard and calls
   __stack_chk_fail, which in a kernel panics ("Stack smashing detected"). Overflow example: 27 'A's + NUL = 28 bytes,
   so buffer[16] + canary + saved EBP + return address are overwritten; little-endian return = 0x00414141.
   UBSan: -fsanitize=undefined inserts checks that call __ubsan_handle_* hooks you write (type_mismatch from the article).
   kernel.c:42:9 is an illustrative source location. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'stack-smashing-protector',
  title: 'Stack canaries and UBSan',
  summary: 'How -fstack-protector puts a canary between a buffer and the return address, how an overflow by strcpy hits it first and ends in __stack_chk_fail and a panic, and how UBSan inserts checks that call __ubsan_handle_* hooks.',
  lessons: ['t4m3l1'],
  articles: ['Stack Smashing Protector', 'Undefined Behavior Sanitization'],
  group: 'CPU',
  order: 431,
}

const steps: VizStep[] = [
  { caption: 'foo() has a local char buffer[16] and copies a string into it with strcpy.', detail: 'Built with -fstack-protector, every function with a buffer larger than 8 bytes gets protected. The stack grows down; the return address sits above the locals.' },
  { caption: 'Prologue: copy the secret __stack_chk_guard into the frame, just above the buffer.', detail: 'The guard is a global, 0xe2dee396 in the wiki’s example. Ideally the loader randomises it, so an attacker cannot guess it.' },
  { caption: 'A short string fits: strcpy fills the buffer from buffer[0] upward.', detail: '"hello" plus its NUL is 6 bytes. Writes go toward higher addresses, toward the canary and the return address.' },
  { caption: 'A 28-byte string overflows: it runs past buffer[15], over the canary first.', detail: '27 × "A" + NUL: 16 bytes fill the buffer, then the canary, saved EBP and return address become 0x41414141, 0x41414141, 0x00414141.', ms: 4000 },
  { caption: 'Epilogue, before ret: compare the canary with __stack_chk_guard.', detail: 'canary ^ __stack_chk_guard is not 0, so the copy was changed. The return address has not been used yet.' },
  { caption: 'Mismatch: call __stack_chk_fail. The kernel panics instead of jumping to garbage.', detail: 'Without SSP, ret would load EIP = 0x00414141: a crash far from the bug, or an exploit. Your kernel’s handler calls panic("Stack smashing detected").', ms: 4200 },
  { caption: 'UBSan: -fsanitize=undefined makes the compiler insert checks around risky code.', detail: 'Signed overflow is undefined in C. With INT_MAX + 1 the check fails and calls __ubsan_handle_add_overflow, a hook your kernel provides.', ms: 4000 },
  { caption: 'A misaligned load calls __ubsan_handle_type_mismatch with file, line and column.', detail: 'Reading a uint32_t at 0x1001 is not 4-byte aligned. The handler logs where it happened and panics, so you fix the bug at its source.', ms: 4200 },
]

const CODE: [string, boolean][] = [
  ['void foo(const char *str) {', false],
  ['  uintptr_t canary = __stack_chk_guard;', true],
  ['  char buffer[16];', false],
  ['  strcpy(buffer, str);', false],
  ['  if (canary ^ __stack_chk_guard)', true],
  ['    __stack_chk_fail();', true],
  ['}   /* ret */', false],
]
const CODE_HOT: Record<number, number[]> = { 0: [2, 3], 1: [1], 2: [3], 3: [3], 4: [4], 5: [5] }

// stack column
const SX = 330, SW = 240, SY = 52, SH = 30
const SLOTS = ['arg: str', 'return address', 'saved EBP', 'canary', 'buffer[12..15]', 'buffer[8..11]', 'buffer[4..7]', 'buffer[0..3]']
const slotY = (i: number) => SY + i * SH
const slotMid = (i: number) => slotY(i) + SH / 2

// right column
const RX = 600, RW = 180

function slotValue(i: number, s: number): string {
  const over = s >= 3 && s <= 5
  if (i === 0) return '→ string'
  if (i === 1) return over ? '0x00414141' : 'into caller'
  if (i === 2) return over ? '0x41414141' : 'caller’s EBP'
  if (i === 3) return s < 1 ? '' : over ? '0x41414141' : '0xe2dee396'
  if (over) return 'A A A A'
  if (s === 2 || s >= 6) {
    if (s >= 6) return ''
    if (i === 7) return "'h' 'e' 'l' 'l'"
    if (i === 6) return "'o' '\\0'"
  }
  return ''
}

/** Text that fades in whenever its value changes. */
function Val({ x, y, v, size = 12, anchor = 'end', weight = 500, dim }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -5 }} animate={{ opacity: dim ? 0.55 : 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>{v}</text>
    </motion.g>
  )
}

export default function StackSmashingProtector() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const ubsan = s >= 6
        const over = s >= 3 && s <= 5
        const slotState = (i: number): 'on' | 'off' | 'dim' => {
          if (ubsan) return 'dim'
          if (s === 0) return i >= 4 ? 'on' : 'off'
          if (s === 1) return i === 3 ? 'on' : 'off'
          if (s === 2) return i === 6 || i === 7 ? 'on' : 'off'
          if (s === 3) return i >= 1 ? 'on' : 'off'
          if (s === 4 || s === 5) return i === 3 ? 'on' : i === 1 ? 'off' : 'dim'
          return 'off'
        }
        return (
          <Scene label={meta.summary}>
            {/* ===== code ===== */}
            <Label x={20} y={30} size={11} dim>WHAT THE COMPILER EMITS</Label>
            {CODE.map(([c, added], i) => (
              <g key={i}>
                <Block x={20} y={40 + i * 26} w={290} h={26} state={(CODE_HOT[s] ?? []).includes(i) ? 'on' : ubsan ? 'dim' : 'off'} />
                <Label x={30 + (c.length - c.trimStart().length) * 6.6} y={57 + i * 26} size={11} dim={ubsan}>{c.trimStart()}</Label>
                {added && <Label x={319} y={57 + i * 26} size={12} anchor="middle" weight={600}>+</Label>}
              </g>
            ))}
            <Label x={20} y={238} size={10.5} dim>+ added by -fstack-protector</Label>

            {/* ===== stack frame ===== */}
            <Label x={SX} y={30} size={11} dim>FOO’S STACK FRAME</Label>
            <Label x={SX + SW} y={30} size={10.5} anchor="end" dim>high addresses ↑</Label>
            {SLOTS.map((t, i) => (
              <g key={i}>
                <Block x={SX} y={slotY(i)} w={SW} h={SH} label={t} mono size={11} align="start" state={slotState(i)} />
                <Val x={SX + SW - 10} y={slotY(i) + 19} v={slotValue(i, s)} size={11.5} weight={i === 3 || (over && i <= 2) ? 600 : 400} dim={slotState(i) === 'dim'} />
              </g>
            ))}
            {/* strcpy direction */}
            <Wire from={[SX + SW + 12, slotY(7) + SH]} to={[SX + SW + 12, over ? slotY(1) + 4 : slotY(6) + 4]} on={s === 2 || s === 3} />
            <Label x={SX + SW + 12} y={slotY(7) + SH + 16} size={10.5} anchor="middle" on={s === 2 || s === 3}>strcpy writes</Label>
            <Label x={SX + SW + 12} y={slotY(7) + SH + 30} size={10.5} anchor="middle" on={s === 2 || s === 3}>upward</Label>

            {/* ===== guard, check, panic ===== */}
            <Label x={RX} y={30} size={11} dim>GLOBAL</Label>
            <Block x={RX} y={40} w={RW} h={44} label="__stack_chk_guard" sub="0xe2dee396" mono size={12} state={s === 1 || s === 4 ? 'on' : ubsan ? 'dim' : 'off'} />

            <Appear on={s >= 4 && !ubsan}>
              <Block x={RX} y={120} w={RW} h={66} state={s === 4 ? 'on' : 'off'} />
              <Label x={RX + 10} y={140} size={11}>0x41414141</Label>
              <Label x={RX + 10} y={158} size={11}>^ 0xe2dee396</Label>
              <Label x={RX + 10} y={177} size={11} weight={600}>≠ 0  → smashed</Label>
            </Appear>
            <Appear on={s === 5}>
              <Block x={RX} y={210} w={RW} h={44} label="__stack_chk_fail()" sub="noreturn" mono size={12} state="on" />
              <Wire from={[RX + RW / 2, 186]} to={[RX + RW / 2, 208]} />
              <Wire from={[RX + RW / 2, 254]} to={[RX + RW / 2, 270]} />
              <Block x={RX} y={272} w={RW} h={36} label="KERNEL PANIC" mono size={12} state="fill" />
              <Label x={RX + RW} y={324} size={10.5} anchor="end" dim>"Stack smashing detected"</Label>
              {/* the jump that never happens */}
              <Wire d={`M${SX + SW} ${slotMid(1)} C ${SX + SW + 20} ${slotMid(1)}, ${SX + SW + 14} 330, ${SX + SW - 40} 316`} dashed dim />
              <Label x={SX + SW - 46} y={320} size={10.5} anchor="end" dim>ret → 0x00414141 never runs</Label>
            </Appear>

            {/* ===== UBSan band ===== */}
            <line x1={20} x2={780} y1={338} y2={338} stroke="var(--viz-faint)" />
            <Label x={20} y={356} size={11} dim>UBSAN · -fsanitize=undefined</Label>
            <Block x={20} y={366} w={220} h={56} state={ubsan ? 'on' : 'dim'} />
            <Appear on={ubsan}>
            <Val x={30} y={388} anchor="start" size={12} v={s === 7 ? 'x = *(uint32_t *)p;' : 'r = a + b;'} />
            <Val x={30} y={408} anchor="start" size={11} dim v={s === 7 ? 'p = 0x1001' : 'a = INT_MAX, b = 1'} />
            </Appear>
            <Wire from={[240, 394]} to={[268, 394]} on={ubsan} />
            <Block x={270} y={366} w={230} h={56} state={ubsan ? 'on' : 'dim'} />
            <Appear on={ubsan}>
            <Label x={280} y={388} size={11} dim>inserted check</Label>
            <Val x={280} y={408} anchor="start" size={12} v={s === 7 ? 'p % 4 == 0 ?  no' : 'overflows?  yes'} />
            </Appear>
            <Wire from={[500, 394]} to={[528, 394]} on={ubsan} />
            <Block x={530} y={366} w={250} h={56} state={ubsan ? 'fill' : 'dim'} />
            <motion.g initial={false} animate={{ opacity: ubsan ? 1 : 0 }} transition={ease}>
              <motion.text key={s === 7 ? 'tm' : 'ao'} x={540} y={388} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={ease}
                fill="var(--viz-bg)" style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {s === 7 ? '__ubsan_handle_type_mismatch' : '__ubsan_handle_add_overflow'}
              </motion.text>
              <motion.text key={s === 7 ? 'tm2' : 'ao2'} x={540} y={408} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={ease}
                fill="var(--viz-bg)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                {s === 7 ? 'Unaligned · kernel.c:42:9 → panic' : 'log file:line:col → panic'}
              </motion.text>
            </motion.g>

            {/* ===== motion ===== */}
            <Packet on={s === 1} points={[[RX, 62], [RX - 14, 62], [RX - 14, slotMid(3)], [SX + SW, slotMid(3)]]} duration={1.4} label="guard" />
            <Packet on={s === 2} points={[[310, 40 + 3 * 26 + 13], [SX - 30, 40 + 3 * 26 + 13], [SX - 30, slotMid(7)], [SX, slotMid(7)]]} duration={1.4} label="hello" />
            <Packet on={s === 3} points={[[SX + 132, slotMid(7)], [SX + 132, slotMid(1)]]} duration={2.2} label="A…" />
            <Packet on={s === 4} points={[[SX + SW, slotMid(3)], [RX - 14, slotMid(3)], [RX - 14, 150], [RX, 150]]} duration={1.3} label="canary" />
            <Packet on={s === 4} points={[[RX + RW / 2, 84], [RX + RW / 2, 120]]} duration={1} delay={0.4} />
            <Packet on={s === 5} points={[[RX + RW / 2, 186], [RX + RW / 2, 232], [RX + RW / 2, 290]]} duration={1.6} />
            <Packet on={ubsan} points={[[130, 366], [130, 358], [385, 358], [385, 366]]} duration={1.2} />
            <Packet on={ubsan} points={[[500, 394], [530, 394]]} duration={0.8} delay={1.1} />
            <Pulse x={SX + SW / 2} y={slotMid(3)} on={s === 3 || s === 4} r={16} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
