/* Hosted vs freestanding C: what survives without an OS, the flags, why libgcc must be linked, and volatile.
   Header list from "C Library" / "Implications of writing a freestanding C project"; flags from
   "Why do I need a Cross Compiler?"; libgcc rules from "Libgcc"; volatile from "Volatile (keyword)". */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'freestanding-c',
  title: 'C without an OS: freestanding',
  summary: 'What a kernel keeps and loses without libc: compiler-provided headers, -ffreestanding and -nostdlib, libgcc helpers like __udivdi3, and volatile for hardware memory.',
  lessons: ['t2m1l3', 'p3l4'],
  articles: ['C Library', 'Libgcc', 'Implications of writing a freestanding C project', 'Volatile (keyword)'],
  group: 'Toolchain',
  order: 230,
}

const steps: VizStep[] = [
  { caption: 'A normal program is hosted: libc and an OS do the work below it.', detail: 'printf formats text in libc, libc makes a write() system call, and the kernel drives the hardware. In hosted C, __STDC_HOSTED__ is 1.' },
  { caption: 'Your kernel is the bottom of that stack. There is nothing to call.', detail: 'No libc to link, no kernel to ask. Anything that needs printf, malloc or files must be written by you, inside the kernel. __STDC_HOSTED__ is 0.' },
  { caption: 'The library headers vanish; the compiler\'s own headers stay.', detail: 'float.h, iso646.h, limits.h, stdalign.h, stdarg.h, stdbool.h, stddef.h, stdint.h, stdnoreturn.h: types and macros only, nothing to link.' },
  { caption: '-ffreestanding to compile, -nostdlib to link.', detail: '-ffreestanding: no libc or builtins assumed. -nostdlib: no crt0.o, no libc. You still supply memset, memcpy, memmove, memcmp.' },
  { caption: 'But gcc still calls helper functions it never shows you.', detail: '32-bit x86 cannot divide one 64-bit number by another in one instruction, so q = a / b on uint64_t compiles to call __udivdi3, a libgcc function.' },
  { caption: '-nostdlib also dropped libgcc: undefined reference to __udivdi3.', detail: 'Or worse: it links today and breaks after a compiler upgrade, because gcc may emit libgcc calls whenever it likes.' },
  { caption: 'Add -lgcc at the very end of the link line. Resolved.', detail: 'A static library only fills references from objects listed before it. Use the libgcc built with your cross-compiler, never the host\'s.' },
  { caption: 'Hardware memory changes on its own. The optimizer does not know that.', detail: 'Without volatile, gcc may read *status once, keep it in a register and spin on the stale value forever, even after the device clears the bit.' },
  { caption: 'volatile forces a real memory access every time.', detail: 'volatile uint32_t *status: every pass reads memory again and sees the change. Use it for memory-mapped I/O such as 0xB8000 and data shared with interrupts.', ms: 3800 },
]

const KEEP = ['stddef.h', 'stdint.h', 'stdbool.h', 'stdarg.h', 'limits.h', 'float.h', 'iso646.h', 'stdalign.h', 'stdnoreturn.h']
const GONE: [string, string][] = [['stdio.h', 'printf, fopen'], ['stdlib.h', 'malloc, free'], ['string.h', 'memcpy, strlen']]

export default function FreestandingC() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const phaseA = s >= 2 && s <= 3
        const phaseB = s >= 4 && s <= 6
        const phaseC = s >= 7
        const hostDim = s >= 2
        return (
          <Scene label={meta.summary}>
            {/* ---------- hosted stack ---------- */}
            <Label x={20} y={34} size={11} dim>HOSTED · a normal program</Label>
            <Block x={20} y={44} w={300} h={40} label="your program" sub={'printf("hi")'} size={13} state={s === 0 ? 'on' : hostDim ? 'dim' : 'off'} />
            <Block x={20} y={90} w={300} h={40} label="libc" sub="printf · malloc · fopen" size={13} state={hostDim ? 'dim' : 'off'} />
            <Block x={20} y={136} w={300} h={40} label="OS kernel" sub="write() system call" size={13} state={hostDim ? 'dim' : 'off'} />
            <Block x={20} y={182} w={300} h={40} label="hardware" size={13} state={hostDim ? 'dim' : 'off'} />
            <Wire from={[345, 64]} to={[345, 200]} on dim={hostDim} />
            <Packet on={s === 0} points={[[345, 64], [345, 110], [345, 156], [345, 202]]} duration={2.2} />

            {/* ---------- freestanding stack ---------- */}
            <Label x={420} y={34} size={11} dim on={s >= 1}>FREESTANDING · your kernel</Label>
            <Appear on={s >= 1} dx={14} dy={0}>
              <Block x={420} y={44} w={300} h={40} label="your kernel" sub="-ffreestanding" size={13} state={s === 1 ? 'on' : 'off'} />
              <Block x={420} y={90} w={300} h={40} label="no libc" size={13} state="hatch" />
              <Block x={420} y={136} w={300} h={40} label="no OS underneath: you are it" size={13} state="hatch" />
              <Block x={420} y={182} w={300} h={40} label="hardware" sub="ports, 0xB8000, …" size={13} state={s === 1 ? 'on' : 'off'} />
            </Appear>
            <Wire from={[745, 64]} to={[745, 200]} on={s >= 1} />
            <Packet on={s === 1} points={[[745, 64], [745, 202]]} duration={1.4} />

            <line x1={20} x2={780} y1={240} y2={240} stroke="var(--viz-faint)" />

            {/* ---------- phase A: headers + flags ---------- */}
            <Appear on={phaseA}>
              <Label x={20} y={262} size={10.5} dim>GONE (part of libc)</Label>
              {GONE.map(([h, f], i) => (
                <g key={h}>
                  <Block x={20} y={272 + i * 34} w={260} h={28} state="hatch" />
                  <Label x={32} y={291 + i * 34} size={11.5} weight={500}>{h}</Label>
                  <Label x={112} y={291 + i * 34} size={11} dim>{f}</Label>
                  <motion.line x1={26} x2={274} y1={286 + i * 34} y2={286 + i * 34} stroke="var(--viz-fg)" strokeWidth={1.6}
                    initial={false} animate={{ pathLength: s >= 2 ? 1 : 0 }} transition={{ ...ease, delay: 0.3 + i * 0.15 }} />
                </g>
              ))}
              <Label x={320} y={262} size={10.5} dim>STILL THERE (the compiler ships them)</Label>
              {KEEP.map((h, i) => (
                <Appear key={h} on={phaseA} delay={i * 0.05}>
                  <Block x={320 + (i % 3) * 152} y={272 + Math.floor(i / 3) * 34} w={145} h={28} label={h} mono size={11.5} state={s === 2 ? 'on' : 'off'} />
                </Appear>
              ))}
            </Appear>
            <Appear on={s === 3}>
              <Block x={20} y={384} w={170} h={32} label="-ffreestanding" mono size={13} state="fill" />
              <Block x={200} y={384} w={130} h={32} label="-nostdlib" mono size={13} state="fill" />
              <Label x={345} y={397} size={10.5}>+ write memset, memcpy,</Label>
              <Label x={345} y={413} size={10.5}>memmove, memcmp yourself</Label>
            </Appear>

            {/* ---------- phase B: libgcc ---------- */}
            <Appear on={phaseB}>
              <Label x={20} y={262} size={10.5} dim>WHY THE KERNEL LINKS -lgcc</Label>
              <Block x={20} y={272} w={220} h={56} state={s === 4 ? 'on' : 'off'} />
              <Label x={32} y={292} size={10.5} dim>kernel.c (uint64_t a, b)</Label>
              <Label x={32} y={314} size={12.5} weight={500}>q = a / b;</Label>
              <Block x={280} y={272} w={220} h={56} state={s === 4 ? 'on' : 'off'} />
              <Label x={292} y={292} size={10.5} dim>kernel.o (32-bit x86)</Label>
              <Label x={292} y={314} size={12.5} weight={500}>call __udivdi3</Label>
            </Appear>
            <Wire from={[240, 300]} to={[278, 300]} on={phaseB} />
            <Wire from={[500, 300]} to={[538, 300]} on={phaseB && s >= 5} />
            <Packet on={s === 4} points={[[130, 302], [276, 300]]} duration={1.2} r={4} />
            <motion.g initial={false} animate={{ opacity: phaseB && s >= 5 ? 1 : 0, x: s === 5 ? [0, -5, 5, -4, 4, -2, 0] : 0 }}
              transition={s === 5 ? { duration: 0.6, delay: 0.4 } : ease}>
              <Block x={540} y={272} w={240} h={56} state={s === 5 ? 'on' : 'off'} />
              <Label x={552} y={292} size={10.5} dim>link: -nostdlib{s >= 6 ? ' … -lgcc' : ''}</Label>
              <Label x={552} y={314} size={11.5} weight={500} on={s === 5}>undefined reference</Label>
              <Label x={552} y={314} size={11.5} weight={500} on={s >= 6}>resolved → myos.bin</Label>
            </motion.g>
            <Label x={552} y={346} size={11} on={s === 5 && phaseB}>to `__udivdi3'</Label>
            <Appear on={s === 6}>
              <Block x={280} y={356} w={220} h={56} label="libgcc.a" sub="__udivdi3 · __umoddi3 · …" mono size={13} state="on" />
              <Label x={20} y={372} size={11} weight={500}>… boot.o kernel.o -lgcc</Label>
              <Label x={20} y={390} size={10.5} dim>-lgcc last: after its users</Label>
            </Appear>
            <Wire d="M500 384 C 600 384, 660 370, 660 330" on={s === 6} />
            <Packet on={s === 6} points={[[390, 384], [500, 384], [640, 370], [660, 332]]} duration={1.6} r={4} />

            {/* ---------- phase C: volatile ---------- */}
            <Appear on={phaseC}>
              <Block x={20} y={268} w={140} h={110} state={s === 7 ? 'on' : 'off'} />
              <Label x={32} y={288} size={10.5} dim>CPU register</Label>
              <Label x={90} y={330} size={15} anchor="middle" weight={500}>{s >= 8 ? 'EAX = 0' : 'EAX = 1'}</Label>
              <Label x={90} y={350} size={10.5} anchor="middle" dim>{s >= 8 ? 'fresh' : 'stale copy'}</Label>
              <Block x={185} y={262} w={345} h={86} state="off" />
              <Label x={197} y={284} size={12} weight={s >= 8 ? 500 : 400}>{s >= 8 ? 'volatile uint32_t *status = …;' : 'uint32_t *status = …;'}</Label>
              <Label x={197} y={306} size={12}>while (*status &amp; 1) ;</Label>
              <Label x={197} y={332} size={10.5} dim>{s >= 8 ? '// reads memory on every pass' : '// may become: read once, then spin'}</Label>
              <Block x={560} y={268} w={220} h={80} label="device status register" sub="bit 0 = 0 (ready)" size={12} state={s === 8 ? 'on' : 'off'} />
              <Label x={20} y={398} size={11} weight={500}>{s >= 8 ? 'sees 0, leaves the loop' : 'spins forever'}</Label>
            </Appear>
            <Wire d="M670 348 L670 372 L162 372" on={phaseC} dim={s === 7} />
            <Packet on={s === 7} points={[[148, 360], [32, 360], [32, 300], [148, 300], [148, 360]]} duration={1.6} r={4} />
            <Packet on={s === 8} points={[[670, 348], [670, 372], [164, 372]]} duration={1.2} r={4} label="read" />
            <Label x={185} y={420} size={10.5} dim on={s === 8}>use it for memory-mapped I/O and data shared with interrupts</Label>

            <Pulse x={745} y={202} on={s === 1} r={14} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
