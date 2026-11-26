/* How the Bare Bones linker script turns two object files into one laid-out kernel image.
   Script text from "Bare Bones"; keywords and symbols from "Linker Scripts"; object-file idea from "Object Files".
   Section starts follow from . = 2M and BLOCK(4K) : ALIGN(4K), given that each section is smaller than 4 KiB
   (true for the Bare Bones kernel). kernel_end is a symbol the learner adds; the original script has none. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease, spring } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'linker-script-layout',
  title: 'Linker script: laying out the kernel',
  summary: 'The linker reads linker.ld line by line, merges the sections of boot.o and kernel.o, and places them at 2 MiB on 4 KiB boundaries.',
  lessons: ['t2m2l1'],
  articles: ['Linker Scripts', 'Object Files', 'Bare Bones'],
  group: 'Toolchain',
  order: 240,
}

const steps: VizStep[] = [
  { caption: 'Two object files arrive, each with its own sections.', detail: 'boot.o and kernel.o each have .text, .data, .bss and so on, all counted from offset 0. Nothing has a final address yet: the linker script decides.' },
  { caption: 'ENTRY(_start) names the first instruction to run.', detail: 'It becomes the entry point in the ELF header. After loading the kernel, GRUB jumps there.' },
  { caption: '. = 2M: the location counter starts at 0x00200000.', detail: '"." is the current output address. 1M was the classic choice; Bare Bones uses 2M because it is more often free on UEFI machines.' },
  { caption: '.text: the multiboot header first, then every input .text.', detail: '*(.multiboot) comes before *(.text) so the header lands in the first 8 KiB. *(.text) means: the .text of all input files, in command-line order.' },
  { caption: 'ALIGN(4K) rounds up: .rodata starts at 0x00201000.', detail: 'Each output section starts on a fresh 4 KiB page, so later you can map code read-only and data non-executable. The gap is padding.' },
  { caption: '.data follows at 0x00202000: variables with initial values.', detail: 'A global like int x = 5 is stored in the file and loaded into memory as-is.' },
  { caption: '.bss at 0x00203000: zero-filled data, including the 16 KiB stack.', detail: '*(COMMON) *(.bss). It takes memory but no bytes in the file (nobits), which is why boot.s puts its stack here.' },
  { caption: 'kernel_end = . marks the first free byte after the kernel.', detail: 'A symbol you add yourself. In C write extern char kernel_end[]; and use its address, for example as the start of free memory.', ms: 3800 },
]

/* script lines: [indent, text] */
const CODE: [number, string][] = [
  [0, 'ENTRY(_start)'],
  [0, 'SECTIONS {'],
  [1, '. = 2M;'],
  [1, '.text BLOCK(4K) : ALIGN(4K)'],
  [2, '{ *(.multiboot) *(.text) }'],
  [1, '.rodata BLOCK(4K) : ALIGN(4K)'],
  [2, '{ *(.rodata) }'],
  [1, '.data BLOCK(4K) : ALIGN(4K)'],
  [2, '{ *(.data) }'],
  [1, '.bss BLOCK(4K) : ALIGN(4K)'],
  [2, '{ *(COMMON) *(.bss) }'],
  [1, 'kernel_end = .;  /* added */'],
  [0, '}'],
]
const PX = 212
const LY = 70
const LH = 23
const lineY = (i: number) => LY + i * LH
/* which script lines each step points at */
const ACTIVE: ([number, number] | null)[] = [null, [0, 0], [2, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 11]]
/* location counter "." after each step (y in the output column) */
const DOT: (number | null)[] = [null, null, 400, 338, 284, 236, 110, 110]

const OX = 560
const OW = 140

function Note({ on, a, b }: { on: boolean; a: string; b: string }) {
  return (
    <>
      <Label x={20} y={300} size={11} on={on} weight={500}>{a}</Label>
      <Label x={20} y={318} size={10.5} on={on} dim>{b}</Label>
    </>
  )
}

export default function LinkerScriptLayout() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const act = ACTIVE[s]
        const dot = DOT[s]
        const inState = (placedAt: number) => (s === placedAt ? 'on' : s > placedAt ? 'dim' : 'off') as 'on' | 'dim' | 'off'
        return (
          <Scene label={meta.summary}>
            {/* ---------- inputs ---------- */}
            <Label x={20} y={38} size={11} dim>boot.o</Label>
            <Block x={20} y={46} w={170} h={24} label=".multiboot" mono size={11} align="start" state={inState(3)} />
            <Block x={20} y={70} w={170} h={24} label=".text  (_start)" mono size={11} align="start" state={inState(3)} />
            <Block x={20} y={94} w={170} h={24} label=".bss   (stack)" mono size={11} align="start" state={inState(6)} />
            <Label x={20} y={146} size={11} dim>kernel.o</Label>
            <Block x={20} y={154} w={170} h={24} label=".text" mono size={11} align="start" state={inState(3)} />
            <Block x={20} y={178} w={170} h={24} label=".rodata" mono size={11} align="start" state={inState(4)} />
            <Block x={20} y={202} w={170} h={24} label=".data" mono size={11} align="start" state={inState(5)} />
            <Block x={20} y={226} w={170} h={24} label=".bss" mono size={11} align="start" state={inState(6)} />
            <Pulse x={176} y={82} on={s === 1} r={10} />

            {/* notes */}
            <Note on={s === 0} a="each .o counts from 0" b="no final addresses yet" />
            <Note on={s === 1} a="ELF entry point = _start" b="GRUB jumps here" />
            <Note on={s === 2} a='"." = location counter' b="now 0x00200000 (2 MiB)" />
            <Note on={s === 3} a="*(.text) = every .text" b="link order: boot.o, kernel.o" />
            <Note on={s === 4} a="ALIGN(4K): round up to" b="the next 0x1000 boundary" />
            <Note on={s === 5} a=".data: initial values" b="stored in the file" />
            <Note on={s === 6} a=".bss: nobits" b="memory, but no file bytes" />
            <Note on={s === 7} a="extern char kernel_end[];" b="free memory starts here" />

            {/* ---------- the script ---------- */}
            <Label x={PX} y={38} size={11} dim>linker.ld</Label>
            <rect x={PX} y={46} width={300} height={312} fill="var(--viz-bg)" stroke="var(--viz-faint)" />
            <motion.rect
              x={PX + 1} width={298} initial={false}
              animate={{ y: act ? lineY(act[0]) - 16 : lineY(0) - 16, height: act ? (act[1] - act[0] + 1) * LH : LH, opacity: act ? 1 : 0 }}
              transition={spring} fill="var(--viz-faint)" fillOpacity={0.55}
            />
            <motion.rect
              x={PX} width={3} initial={false}
              animate={{ y: act ? lineY(act[0]) - 16 : lineY(0) - 16, height: act ? (act[1] - act[0] + 1) * LH : LH, opacity: act ? 1 : 0 }}
              transition={spring} fill="var(--viz-fg)"
            />
            {CODE.map(([ind, t], i) => {
              const hot = !!act && i >= act[0] && i <= act[1]
              return (
                <motion.text key={i} x={PX + 14 + ind * 14} y={lineY(i)} initial={false}
                  animate={{ opacity: !act || hot ? 1 : 0.72 }} transition={ease}
                  fill={hot ? 'var(--viz-fg)' : 'var(--viz-dim)'}
                  style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: hot ? 600 : 400 }}>
                  {t}
                </motion.text>
              )
            })}

            {/* script line -> output slot */}
            <Wire d={`M512 ${lineY(3) - 4} C 538 ${lineY(3)}, 532 355, 558 355`} on={s === 3} />
            <Wire d={`M512 ${lineY(5) - 4} C 538 ${lineY(5)}, 532 297, 558 297`} on={s === 4} />
            <Wire d={`M512 ${lineY(7) - 4} C 538 ${lineY(7)}, 532 248, 558 248`} on={s === 5} />
            <Wire d={`M512 ${lineY(9) - 4} C 538 ${lineY(9)}, 532 160, 558 160`} on={s === 6} />
            <Wire d={`M512 ${lineY(11) - 4} C 538 ${lineY(11)}, 532 110, 558 110`} on={s === 7} />
            <Packet on={s === 3} points={[[512, lineY(3) - 4], [535, 300], [600, 355]]} duration={1.4} r={4} />
            <Packet on={s === 6} points={[[512, lineY(9) - 4], [535, 180], [600, 160]]} duration={1.4} r={4} />

            {/* ---------- output: the loaded image, high addresses on top ---------- */}
            <Label x={OX} y={38} size={11} dim on={s >= 2}>MEMORY (myos.bin loaded)</Label>
            <Label x={OX} y={56} size={10.5} dim on={s >= 2}>↑ higher addresses</Label>
            {/* base line at 2 MiB */}
            <Appear on={s >= 2}>
              <line x1={OX - 6} x2={OX + OW + 6} y1={400} y2={400} stroke="var(--viz-fg)" strokeWidth={1.5} />
              <Label x={OX + OW + 8} y={404} size={10.5} weight={500}>0x00200000</Label>
            </Appear>

            <Appear on={s >= 3} dx={-16} dy={0}>
              <Block x={OX} y={382} w={OW} h={18} label=".multiboot" mono size={10.5} state={s === 3 ? 'on' : 'off'} />
              <Block x={OX} y={360} w={OW} h={22} label="boot.o .text" mono size={10.5} state={s === 3 ? 'on' : 'off'} />
              <Block x={OX} y={338} w={OW} h={22} label="kernel.o .text" mono size={10.5} state={s === 3 ? 'on' : 'off'} />
            </Appear>
            <Appear on={s >= 4} dx={-16} dy={0}>
              <Block x={OX} y={310} w={OW} h={28} state="hatch" />
              <Block x={OX} y={284} w={OW} h={26} label=".rodata" mono size={10.5} state={s === 4 ? 'on' : 'off'} />
              <Label x={OX + OW + 8} y={314} size={10.5} weight={s === 4 ? 500 : 400} dim={s !== 4}>0x00201000</Label>
            </Appear>
            <Appear on={s >= 5} dx={-16} dy={0}>
              <Block x={OX} y={260} w={OW} h={24} state="hatch" />
              <Block x={OX} y={236} w={OW} h={24} label=".data" mono size={10.5} state={s === 5 ? 'on' : 'off'} />
              <Label x={OX + OW + 8} y={264} size={10.5} weight={s === 5 ? 500 : 400} dim={s !== 5}>0x00202000</Label>
            </Appear>
            <Appear on={s >= 6} dx={-16} dy={0}>
              <Block x={OX} y={210} w={OW} h={26} state="hatch" />
              <Block x={OX} y={130} w={OW} h={80} label="stack 16 KiB" sub="boot.o .bss" mono size={11} state={s === 6 ? 'on' : 'off'} />
              <Block x={OX} y={110} w={OW} h={20} label="kernel.o .bss" mono size={10.5} state={s === 6 ? 'on' : 'off'} />
              <Label x={OX + OW + 8} y={214} size={10.5} weight={s === 6 ? 500 : 400} dim={s !== 6}>0x00203000</Label>
            </Appear>
            <Label x={OX + OW + 8} y={330} size={10.5} dim on={s === 4}>padding</Label>
            <Appear on={s >= 7}>
              <line x1={OX - 6} x2={OX + OW + 6} y1={110} y2={110} stroke="var(--viz-fg)" strokeWidth={2} filter="url(#viz-glow)" />
              <Label x={OX + OW + 8} y={114} size={10.5} weight={600}>kernel_end</Label>
            </Appear>

            {/* location counter "." */}
            <motion.g initial={false} animate={{ y: dot ?? 400, opacity: dot !== null && s < 7 ? 1 : 0 }} transition={spring}>
              <circle cx={OX - 12} cy={0} r={4.5} fill="var(--viz-fg)" filter="url(#viz-glow)" />
              <line x1={OX} x2={OX + OW} y1={0} y2={0} stroke="var(--viz-fg)" strokeDasharray="3 3" />
            </motion.g>
            <Pulse x={OX - 12} y={400} on={s === 2} r={10} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
