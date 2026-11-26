/* Multiboot 1 handoff: how GRUB recognises the kernel, loads it, and what the CPU looks like at _start.
   Header values from boot.s in "Bare Bones" (FLAGS = ALIGN | MEMINFO = 3, CHECKSUM = -(MAGIC + FLAGS));
   magic numbers from "Multiboot"; machine state from the comments in boot.s ("Bare Bones"). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'multiboot-handoff',
  title: 'Multiboot: GRUB hands over the CPU',
  summary: 'GRUB finds the multiboot header in the first 8 KiB, checks its checksum, loads the kernel at 2 MiB and jumps to _start with EAX = 0x2BADB002 and EBX pointing at the boot info.',
  lessons: ['t3m1l1', 't3m1l2'],
  articles: ['Multiboot', 'Bare Bones', 'GRUB'],
  group: 'Boot',
  order: 310,
}

const steps: VizStep[] = [
  { caption: 'GRUB has myos.bin. Is it a kernel it knows how to start?', detail: 'GRUB does not need to understand your whole file. It looks for one small structure: the multiboot header.' },
  { caption: 'It searches the first 8 KiB, at 4-byte-aligned offsets, for the magic.', detail: 'That is why boot.s puts the header in its own .multiboot section and the linker script places that section first.' },
  { caption: 'Found: magic 0x1BADB002, then flags, then checksum.', detail: 'FLAGS = ALIGN (bit 0: page-align loaded modules) | MEMINFO (bit 1: give me a memory map) = 0x00000003.' },
  { caption: 'The three fields must add up to 0 (in 32 bits).', detail: 'CHECKSUM = -(MAGIC + FLAGS) = 0xE4524FFB. 0x1BADB002 + 0x3 + 0xE4524FFB = 0x100000000, whose low 32 bits are 0. A random match is very unlikely.' },
  { caption: 'GRUB loads the kernel where its ELF headers ask: 0x00200000.', detail: 'Bare Bones\' linker script says . = 2M. The classic choice was 1 MiB (0x00100000). The low 1 MiB holds BIOS data and video memory such as 0xB8000.' },
  { caption: 'It writes a boot info structure, sets EAX and EBX.', detail: 'EAX = 0x2BADB002 proves a multiboot loader started you. EBX = physical address of the info structure (memory map, command line, modules).' },
  { caption: 'Then it jumps to _start: 32-bit protected mode, paging and interrupts off.', detail: 'The kernel now owns the machine. There is no stack you can trust: the multiboot standard leaves ESP undefined. No printf, nothing but your own code.' },
  { caption: '_start points ESP at its own 16 KiB stack, then calls kernel_main.', detail: 'mov $stack_top, %esp. C cannot run without a stack, so this must be assembly. The stack is 16-byte aligned, as the System V ABI expects at the call.', ms: 4000 },
]

const ROW_Y = (i: number) => 268 + i * 32

export default function MultibootHandoff() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const header = s >= 2 && s <= 6
        const regs: { r: string; v: string; note?: string; hot: boolean }[] = [
          { r: 'EAX', v: '0x2BADB002', note: 'set by the loader', hot: s === 5 },
          { r: 'EBX', v: '&info (phys)', hot: s === 5 },
          { r: 'CR0', v: 'PE=1  PG=0', note: 'protected, no paging', hot: s === 6 },
          { r: 'EFLAGS', v: 'IF=0', note: 'interrupts off', hot: s === 6 },
          { r: 'ESP', v: s >= 7 ? 'stack_top' : 'undefined', note: s >= 7 ? '16 KiB stack in .bss' : 'no stack given', hot: s === 6 || s === 7 },
        ]
        return (
          <Scene label={meta.summary}>
            {/* ---------- the kernel file ---------- */}
            <Label x={30} y={36} size={11} dim>myos.bin (file read by GRUB)</Label>
            <Block x={30} y={48} w={340} h={36} state={s === 0 ? 'on' : 'off'} />
            <Block x={30} y={48} w={44} h={36} label="ELF" mono size={10.5} state="dim" />
            <Block x={80} y={48} w={24} h={36} state={s >= 2 ? 'fill' : 'off'} />
            <Label x={240} y={71} size={11} anchor="middle" dim>.text  .rodata  .data …</Label>
            <Appear on={s >= 1}>
              <rect x={30} y={43} width={100} height={46} fill="none" stroke="var(--viz-fg)" strokeDasharray="4 3" />
              <Label x={80} y={104} size={10.5} anchor="middle">first 8 KiB</Label>
            </Appear>
            {s === 1 && (
              <motion.rect y={43} width={3} height={46} fill="var(--viz-fg)" filter="url(#viz-glow)"
                initial={{ x: 30 }} animate={{ x: [30, 127, 30] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
            )}
            <Pulse x={92} y={66} on={s === 2} r={14} />

            {/* ---------- header zoom ---------- */}
            <Appear on={header}>
              <line x1={80} y1={84} x2={30} y2={130} stroke="var(--viz-faint)" strokeDasharray="3 3" />
              <line x1={104} y1={84} x2={370} y2={130} stroke="var(--viz-faint)" strokeDasharray="3 3" />
              <Block x={30} y={136} w={110} h={50} label="magic  +0" sub="0x1BADB002" size={12} state={s === 2 || s === 3 ? 'on' : 'off'} />
              <Block x={145} y={136} w={110} h={50} label="flags  +4" sub="0x00000003" size={12} state={s === 3 ? 'on' : 'off'} />
              <Block x={260} y={136} w={110} h={50} label="checksum  +8" sub="0xE4524FFB" size={12} state={s === 3 ? 'on' : 'off'} />
            </Appear>
            <Label x={30} y={210} size={10.5} on={s === 2} dim>flags: bit 0 ALIGN · bit 1 MEMINFO</Label>
            <Label x={30} y={210} size={10.5} on={s === 3}>0x1BADB002 + 0x00000003 + 0xE4524FFB</Label>
            <Label x={30} y={228} size={10.5} on={s === 3} weight={500}>= 0x1_00000000 → low 32 bits = 0 ✓</Label>
            <Label x={30} y={210} size={10.5} on={s >= 4 && s <= 6} dim>header valid: sum = 0</Label>

            {/* ---------- _start code (replaces the header view) ---------- */}
            <Appear on={s >= 7}>
              <Block x={30} y={124} w={340} h={108} state="on" />
              <Label x={44} y={146} size={11} dim>boot.s</Label>
              <Label x={44} y={168} size={12}>_start:</Label>
              <Label x={64} y={188} size={12} weight={500}>mov $stack_top, %esp</Label>
              <Label x={64} y={208} size={12} weight={500}>call kernel_main</Label>
              <Label x={64} y={226} size={10.5} dim>cli; 1: hlt; jmp 1b   (if it returns)</Label>
            </Appear>

            {/* ---------- physical memory (high addresses on top) ---------- */}
            <Label x={560} y={36} size={11} dim>PHYSICAL MEMORY</Label>
            <Block x={560} y={46} w={200} h={54} label="free" size={12} state="dim" />
            <Block x={560} y={100} w={200} h={70} mono={s >= 4} size={s >= 4 ? 13 : 12}
              label={s >= 4 ? 'myos.bin' : 'free'}
              sub={s >= 4 ? (s >= 7 ? 'stack_top in .bss' : '.text .rodata .data .bss') : undefined}
              state={s === 4 || s === 6 || s === 7 ? 'on' : s >= 4 ? 'off' : 'dim'} />
            <Label x={552} y={174} size={10.5} anchor="end" weight={s === 4 ? 500 : 400} dim={s !== 4}>0x00200000</Label>
            <Block x={560} y={170} w={200} h={60} label="free" size={12} state="dim" />
            <Block x={560} y={230} w={200} h={46} mono={s >= 5} size={12}
              label={s >= 5 ? 'multiboot info' : 'free'} sub={s >= 5 ? 'mem, mmap, cmdline…' : undefined}
              state={s === 5 ? 'on' : s >= 5 ? 'off' : 'dim'} />
            <Block x={560} y={276} w={200} h={54} label="free" size={12} state="dim" />
            <Label x={552} y={334} size={10.5} anchor="end" dim>0x00100000</Label>
            <Block x={560} y={330} w={200} h={70} label="low memory" sub="BIOS data, VGA 0xB8000" size={12} state="dim" />
            <Label x={552} y={404} size={10.5} anchor="end" dim>0x00000000</Label>
            <Label x={760} y={420} size={10.5} anchor="end" dim on={s >= 5}>(GRUB picks where the info goes)</Label>

            {/* load */}
            <Wire d="M370 66 C 470 66, 470 135, 558 135" on={s >= 4} dashed dim={s > 4} />
            <Packet on={s === 4} points={[[370, 66], [470, 100], [556, 135]]} duration={1.6} label="load" />
            <Packet on={s === 6} points={[[236, ROW_Y(0)], [440, 155], [556, 148]]} duration={1.3} />
            <Pulse x={560} y={148} on={s === 6} r={10} />

            {/* ---------- CPU state ---------- */}
            <Appear on={s >= 5}>
              <Label x={30} y={258} size={11} dim>CPU STATE AT _start</Label>
              {regs.map((g, i) => (
                <g key={g.r}>
                  <Block x={30} y={ROW_Y(i)} w={76} h={28} label={g.r} mono size={12} state={g.hot ? 'on' : 'off'} />
                  <Block x={106} y={ROW_Y(i)} w={130} h={28} label={g.v} mono size={12} state={g.hot ? 'fill' : 'off'} />
                  {g.note && <Label x={246} y={ROW_Y(i) + 18} size={10.5} dim={!g.hot}>{g.note}</Label>}
                </g>
              ))}
            </Appear>
            <Wire d={`M236 ${ROW_Y(1) + 14} C 400 ${ROW_Y(1) + 14}, 420 253, 558 253`} on={s >= 5} dim={s > 5} />
            <Packet on={s === 5} points={[[236, ROW_Y(1) + 14], [400, 300], [558, 253]]} duration={1.4} r={4} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
