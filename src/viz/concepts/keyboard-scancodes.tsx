/* Keyboard input end to end: key press -> scan code -> 8042 translation -> IRQ1 -> handler reads 0x60
   -> make/break test -> shift + keymap -> ring buffer -> EOI -> shell. Values from "PS/2 Keyboard"
   (scan code set 1: A make 0x1E, break 0x9E; set 2: A = 0x1C; left shift 0x2A / 0xAA) and
   "I8042 PS/2 Controller" (ports 0x60 / 0x64, status bit 0, translation on by default, IRQ1). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'keyboard-scancodes',
  title: 'Keyboard: from key press to character',
  summary: 'A key press travels as a scan code through the 8042 controller, raises IRQ1, and your handler turns it into a character in a ring buffer.',
  lessons: ['t5m2l1', 't5m2l2'],
  articles: ['PS/2 Keyboard', 'I8042 PS/2 Controller'],
  group: 'Devices',
  order: 521,
}

const steps: VizStep[] = [
  { caption: 'You press the A key.', detail: 'The keyboard has its own small chip. It notices the key went down and gets ready to report it.' },
  { caption: 'The keyboard sends scan code set 2: 0x1C.', detail: 'Set 2 is the default set most keyboards speak. The byte travels serially over the PS/2 wire to the controller.' },
  { caption: 'The 8042 translates it to set 1: 0x1E.', detail: 'Translation is on by default, for software written for the first IBM PC. The byte waits in the output buffer and status bit 0 (port 0x64) becomes 1.' },
  { caption: 'The controller raises IRQ1, and the CPU runs your handler.', detail: 'IRQ1 always means "byte from the first PS/2 port". If you remapped the master PIC to 0x20, it arrives as vector 0x21.' },
  { caption: 'The handler reads the byte from port 0x60.', detail: 'Inside the IRQ1 handler you can read 0x60 straight away. Polling code must first wait for status bit 0 on port 0x64.' },
  { caption: 'Bit 7 says press or release: 0x1E is make, 0x9E is break.', detail: 'In set 1 a release is the make code with bit 7 set: 0x1E | 0x80 = 0x9E. So the handler only turns presses into characters.' },
  { caption: 'Shift state and a keymap turn 0x1E into a character.', detail: 'Left Shift sends 0x2A when pressed and 0xAA when released, so the driver keeps a shift flag. keymap[0][0x1E] = a, keymap[1][0x1E] = A.' },
  { caption: 'The handler stores it in a ring buffer, then sends EOI.', detail: 'outb(0x20, 0x20) tells the PIC this IRQ is done. Forget it and no more keyboard interrupts arrive.' },
  { caption: 'Later, the shell takes the character out of the buffer.', detail: 'The handler only stores. The shell (or getchar) reads at its own pace, so keys typed while it is busy are not lost.', ms: 3800 },
]

const CODE = [
  'void kbd_irq(void) {',
  '  uint8_t sc = inb(0x60);',
  '  if (sc == 0x2A) shift = 1;',
  '  if (sc == 0xAA) shift = 0;',
  '  if (!(sc & 0x80))',
  '    ring_put(keymap[shift][sc]);',
  '  outb(0x20, 0x20); // EOI',
  '}',
]
const LINE_H = 20
const CODE_X = 30
const CODE_Y = 186

function activeLines(s: number): number[] {
  if (s === 3) return [0]
  if (s === 4) return [1]
  if (s === 5) return [4]
  if (s === 6) return [2, 3, 5]
  if (s === 7) return [5, 6]
  return []
}

/** Code listing with highlighted lines. */
function Code({ s }: { s: number }) {
  const act = activeLines(s)
  return (
    <g>
      <rect x={CODE_X} y={CODE_Y - 16} width={300} height={CODE.length * LINE_H + 22} fill="var(--viz-bg)" stroke="var(--viz-faint)" />
      {CODE.map((line, i) => {
        const on = act.includes(i)
        const y = CODE_Y + i * LINE_H
        return (
          <g key={i}>
            <motion.rect x={CODE_X + 1} y={y - 1} width={298} height={LINE_H} fill="var(--viz-fg)" initial={false}
              animate={{ opacity: on ? 0.12 : 0 }} transition={ease} />
            <motion.rect x={CODE_X + 1} y={y - 1} width={3} height={LINE_H} fill="var(--viz-fg)" initial={false}
              animate={{ opacity: on ? 1 : 0 }} transition={ease} />
            <motion.text x={CODE_X + 12} y={y + 14} initial={false} animate={{ opacity: !on && act.length > 0 ? 0.55 : 1 }} transition={ease}
              fill="var(--viz-fg)" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', whiteSpace: 'pre', fontVariantLigatures: 'none', fontWeight: on ? 600 : 400 }}>{line}</motion.text>
          </g>
        )
      })}
    </g>
  )
}

/** A tiny keyboard with a highlighted A key. */
function Keyboard({ pressed }: { pressed: boolean }) {
  const rows = [9, 9, 8]
  return (
    <g>
      <rect x={30} y={50} width={170} height={70} fill="var(--viz-bg)" stroke="var(--viz-fg)" />
      {rows.map((n, r) =>
        Array.from({ length: n }, (_, c) => {
          const kx = 38 + r * 6 + c * 17
          const ky = 58 + r * 19
          const isA = r === 1 && c === 0
          if (isA) return null
          return <rect key={`${r}-${c}`} x={kx} y={ky} width={14} height={14} fill="none" stroke="var(--viz-faint)" />
        }),
      )}
      <motion.g initial={false} animate={{ y: pressed ? 2 : 0 }} transition={ease}>
        <motion.rect x={44} y={77} width={14} height={14} initial={false}
          animate={{ fill: pressed ? 'var(--viz-fg)' : 'var(--viz-bg)' }} stroke="var(--viz-fg)" strokeWidth={1.4}
          filter={pressed ? 'url(#viz-glow)' : undefined} transition={ease} />
        <motion.text x={51} y={88} textAnchor="middle" initial={false} animate={{ fill: pressed ? 'var(--viz-bg)' : 'var(--viz-fg)' }}
          style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>A</motion.text>
      </motion.g>
    </g>
  )
}

const RING = ['l', 's', ' ', '', '', '', '', '']

export default function KeyboardScancodes() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const pressed = s <= 4
        const bufByte = s < 2 ? '--' : s === 2 || s === 3 ? '0x1E' : '--'
        const obf = s === 2 || s === 3 ? 1 : 0
        const head = s >= 7 ? 4 : 3
        const tail = s >= 8 ? 4 : 3
        return (
          <Scene label={meta.summary}>
            {/* ---------- top row: keyboard -> 8042 -> PIC -> CPU ---------- */}
            <Label x={30} y={40} size={11} dim>PS/2 KEYBOARD</Label>
            <Keyboard pressed={pressed} />
            <Pulse x={51} y={86} on={s === 0} r={12} />

            <Wire from={[200, 85]} to={[258, 85]} on={s >= 1} />
            <Label x={229} y={76} size={10.5} anchor="middle" on={s === 1} weight={500}>set 2</Label>
            <Packet on={s === 1} points={[[51, 86], [200, 85], [270, 91]]} duration={1.6} label="0x1C" />

            <Label x={260} y={40} size={11} dim>8042 PS/2 CONTROLLER</Label>
            <Block x={260} y={50} w={180} h={70} state={s === 1 || s === 2 ? 'on' : 'off'} />
            <Label x={270} y={68} size={10.5} dim>out buffer</Label>
            <Block x={270} y={76} w={70} h={32} label={bufByte} mono size={14} state={s === 2 || s === 3 ? 'fill' : 'off'} />
            <Label x={352} y={68} size={10.5} dim>0x64 status</Label>
            <Label x={352} y={90} size={12} weight={500}>bit 0 = {obf}</Label>
            <Label x={352} y={106} size={10.5} dim>{obf ? 'byte ready' : 'empty'}</Label>
            <Label x={350} y={138} size={10.5} anchor="middle" on={s === 2} weight={500}>translate: 0x1C → 0x1E</Label>

            <Wire from={[440, 85]} to={[498, 85]} on={s >= 3} />
            <Label x={469} y={76} size={10.5} anchor="middle" on={s >= 3} weight={500}>IRQ1</Label>
            <Block x={500} y={55} w={100} h={60} label="8259 PIC" sub="IRQ1" size={13} state={s === 3 || s === 7 ? 'on' : 'off'} />
            <Wire from={[600, 85]} to={[648, 85]} on={s >= 3} />
            <Block x={650} y={55} w={120} h={60} label="CPU" sub="vector 0x21" size={13} state={s === 3 ? 'on' : 'off'} />
            <Packet on={s === 3} points={[[440, 85], [500, 85], [600, 85], [650, 85]]} duration={1.2} />

            {/* CPU calls the handler */}
            <Wire d="M710 115 L710 152 L180 152 L180 168" on={s >= 3} dim={s !== 3} />
            <Label x={450} y={146} size={10.5} anchor="middle" on={s === 3}>calls kbd_irq()</Label>
            <Packet on={s === 3} points={[[710, 115], [710, 152], [180, 152], [180, 168]]} duration={1.6} delay={0.6} />

            {/* scan code sets for key A (steps 1-2) */}
            <Appear on={s === 1 || s === 2}>
              <Label x={40} y={200} size={11} dim>SCAN CODES FOR KEY A</Label>
              <Label x={170} y={226} size={10.5} dim>press</Label>
              <Label x={270} y={226} size={10.5} dim>release</Label>
              {[['set 2 (keyboard)', '0x1C', '0xF0 0x1C'], ['set 1 (after 8042)', '0x1E', '0x9E']].map((r, i) => {
                const on = (s === 1 && i === 0) || (s === 2 && i === 1)
                return (
                  <g key={i}>
                    <Block x={40} y={234 + i * 34} w={360} h={34} state={on ? 'on' : 'dim'} />
                    <Label x={52} y={256 + i * 34} size={11.5} mono={false} dim={!on}>{r[0]}</Label>
                    <Label x={170} y={256 + i * 34} size={13} weight={600} dim={!on}>{r[1]}</Label>
                    <Label x={270} y={256 + i * 34} size={13} weight={600} dim={!on}>{r[2]}</Label>
                  </g>
                )
              })}
              <Label x={40} y={326} size={10.5} dim>Translation is why your driver sees set 1 codes by default.</Label>
            </Appear>

            {/* ---------- handler code ---------- */}
            <Appear on={s >= 3}>
              <Code s={s} />
            </Appear>

            {/* ---------- middle: scan code bits + keymap ---------- */}
            <Appear on={s >= 4}>
              <Label x={360} y={186} size={11} dim>SC = 0x1E (A pressed)</Label>
              <BitField x={360} y={198} bits="00011110" cellW={20} h={24} showIndex={false}
                fields={s >= 5 ? [[0, 1, ''], [1, 7, '']] : []} active={s === 5 ? 0 : undefined} />
              <Label x={370} y={236} size={10.5} anchor="middle" dim>7</Label>
              <Label x={510} y={236} size={10.5} anchor="middle" dim>0</Label>
            </Appear>
            <Packet on={s === 4} points={[[305, 108], [305, 140], [348, 140], [348, 211], [358, 211]]} duration={1.4} label="0x1E" />

            <Appear on={s >= 5}>
              <Label x={360} y={260} size={11} dim>0x9E (A released)</Label>
              <BitField x={360} y={268} bits="10011110" cellW={20} h={24} showIndex={false}
                fields={[[0, 1, ''], [1, 7, '']]} active={s === 5 ? 0 : undefined} />
              <Label x={530} y={210} size={10.5} on={s === 5}>make</Label>
              <Label x={530} y={284} size={10.5} on={s === 5}>break</Label>
            </Appear>
            <Pulse x={370} y={280} on={s === 5} r={12} />

            <Appear on={s >= 6}>
              <Label x={360} y={322} size={11} dim>keymap[shift][sc]</Label>
              <Block x={480} y={308} w={60} h={20} label={'shift=0'} mono size={10.5} state={s === 6 ? 'on' : 'off'} />
              <Label x={370} y={348} size={10.5} dim>sc</Label>
              <Label x={445} y={348} size={10.5} dim anchor="middle">[0]</Label>
              <Label x={505} y={348} size={10.5} dim anchor="middle">[1]</Label>
              {[['0x1D', '—', '—'], ['0x1E', 'a', 'A'], ['0x1F', 's', 'S']].map((r, i) => {
                const hit = i === 1
                return (
                  <g key={i}>
                    <Block x={360} y={356 + i * 22} w={60} h={22} label={r[0]} mono size={11} state={hit && s >= 6 ? 'on' : 'dim'} />
                    <Block x={420} y={356 + i * 22} w={50} h={22} label={r[1]} mono size={12} state={hit && s >= 6 ? 'fill' : 'dim'} />
                    <Block x={470} y={356 + i * 22} w={70} h={22} label={r[2]} mono size={12} state="dim" />
                  </g>
                )
              })}
            </Appear>

            {/* ---------- right: ring buffer + shell ---------- */}
            <Appear on={s >= 7}>
              <Label x={570} y={182} size={11} dim>RING BUFFER</Label>
              {RING.map((c, i) => {
                const ch = i === 3 && s >= 7 ? 'a' : c
                const consumed = i < tail
                return (
                  <Block key={i} x={570 + i * 25} y={192} w={25} h={28} label={ch || ' '} mono size={13}
                    state={i === 3 && s === 7 ? 'fill' : consumed && ch ? 'dim' : 'off'} />
                )
              })}
              {/* head (write) / tail (read) markers */}
              <motion.g initial={false} animate={{ x: head * 25 }} transition={ease}>
                <line x1={582} x2={582} y1={222} y2={236} stroke="var(--viz-fg)" strokeWidth={1.4} />
                <Label x={582} y={248} size={10.5} anchor="middle">head</Label>
              </motion.g>
              <motion.g initial={false} animate={{ x: tail * 25 }} transition={ease}>
                <line x1={582} x2={582} y1={222} y2={256} stroke="var(--viz-dim)" strokeDasharray="3 3" />
                <Label x={582} y={268} size={10.5} anchor="middle" dim>tail</Label>
              </motion.g>
            </Appear>
            <Packet on={s === 7} points={[[470, 378], [552, 378], [552, 206], [657, 206]]} duration={1.6} label="a" />
            <Packet on={s === 7} points={[[330, 316], [345, 316], [345, 162], [550, 162], [550, 117]]} duration={1.8} delay={0.5} label="EOI" />

            <Appear on={s >= 8}>
              <Block x={570} y={320} w={200} h={90} state={s === 8 ? 'on' : 'off'} />
              <Label x={582} y={340} size={10.5} dim>SHELL</Label>
              <Label x={582} y={372} size={15} weight={500}>{'> ls a'}</Label>
              <motion.rect x={639} y={359} width={9} height={17} fill="var(--viz-fg)"
                initial={{ opacity: 1 }} animate={{ opacity: [1, 1, 0, 0] }} transition={{ duration: 1, repeat: Infinity }} />
              <Label x={582} y={396} size={10.5} dim>getchar() → 'a'</Label>
            </Appear>
            <Packet on={s === 8} points={[[657, 222], [657, 300], [650, 330], [650, 366]]} duration={1.4} label="a" />
          </Scene>
        )
      }}
    </VizStage>
  )
}
