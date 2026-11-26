/* Why a cross-compiler: the host gcc drags Linux into your kernel; i686-elf-gcc targets the bare machine.
   Values from "Why do I need a Cross Compiler?", "GCC Cross-Compiler" and "Target Triplet". */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'cross-compiler-pipeline',
  title: 'Why a cross-compiler (i686-elf)',
  summary: 'The host gcc assumes Linux and pulls in its headers and libraries; a cross-compiler built for i686-elf targets the bare machine instead.',
  lessons: ['t2m1l1', 't2m1l2', 'p6l2'],
  articles: ['Why do I need a Cross Compiler?', 'GCC Cross-Compiler', 'Target Triplet'],
  group: 'Toolchain',
  order: 210,
}

const steps: VizStep[] = [
  { caption: 'Your system gcc builds programs for the system it runs on.', detail: 'Ask it with gcc -dumpmachine. On 64-bit Linux it answers x86_64-linux-gnu (or x86_64-unknown-linux-gnu): it expects its output to run on Linux.' },
  { caption: 'Compile a kernel with it and Linux comes along uninvited.', detail: 'It uses your system headers, the Linux start files (crt0.o), libc and the Linux libgcc, and makes Linux assumptions throughout.' },
  { caption: 'Your kernel boots on bare hardware. None of that exists there.', detail: 'No Linux, no libc, no system calls. Whatever the host compiler slipped in has nothing to run on, and each flag you add to hide it is another problem.' },
  { caption: 'A target triplet names a platform: machine-vendor-os.', detail: 'x86_64-unknown-linux-gnu = CPU family, vendor (mostly unused, so often left out), operating system. Build tools are prefixed with it.' },
  { caption: 'Your target is i686-elf: 32-bit x86, no operating system.', detail: 'A bare target for freestanding code such as kernels and bootloaders; the vendor is left out. Others: x86_64-elf, arm-none-eabi, aarch64-none-elf, riscv64-none-elf.' },
  { caption: 'Build 1: binutils for the target (assembler, linker, tools).', detail: 'configure --target=i686-elf --prefix="$HOME/opt/cross" --with-sysroot --disable-nls --disable-werror, then make and make install.' },
  { caption: 'Build 2: gcc, which finds the new binutils through your PATH.', detail: 'configure --target=i686-elf --without-headers (assume no C library), then make all-gcc and all-target-libgcc. Not plain make: that builds far too much.' },
  { caption: 'Now i686-elf-gcc compiles your kernel with nothing from the host.', detail: 'i686-elf-gcc -dumpmachine prints i686-elf. It runs on your PC but makes code for the bare machine, with only the headers the compiler itself provides.', ms: 3800 },
]

const CHIPS = ['Linux headers', 'glibc (libc)', 'crt0.o', 'Linux libgcc']
const CHIP_X = [180, 292, 404, 516]
const CHIP_TARGET = [270, 320, 380, 430]

export default function CrossCompilerPipeline() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const cross = s >= 7
        const back = s >= 3 && s <= 6 // top band is context while we look at triplet / build
        const leakOn = s >= 1 && !cross
        return (
          <Scene label={meta.summary}>
            {/* ---------- top band: compile pipeline ---------- */}
            <Label x={30} y={36} size={11} dim>COMPILE YOUR KERNEL</Label>
            <Block x={30} y={60} w={110} h={50} label="kernel.c" mono size={13} state={back ? 'dim' : 'off'} />
            <Wire from={[140, 85]} to={[238, 85]} on dim={back} />

            <Block
              x={240} y={50} w={220} h={70} mono size={15}
              label={cross ? 'i686-elf-gcc' : 'gcc (host)'}
              sub={cross ? '-dumpmachine: i686-elf' : '-dumpmachine: x86_64-linux-gnu'}
              state={s === 0 || cross ? 'on' : back ? 'dim' : 'off'}
            />
            <Pulse x={350} y={99} on={s === 0} r={12} />

            <Wire from={[460, 85]} to={[528, 85]} on={s >= 1} dim={back} />
            <Appear on={s >= 1}>
              <Block x={530} y={60} w={110} h={50} label="myos.bin" mono size={13}
                sub={cross ? 'bare i686 code' : 'expects Linux'}
                state={s === 1 ? 'on' : cross ? 'fill' : back ? 'dim' : 'off'} />
            </Appear>

            <Wire from={[640, 85]} to={[678, 85]} on={s >= 2} dashed={!cross} dim={back} />
            <Appear on={s >= 2 && !cross}>
              <line x1={652} y1={77} x2={666} y2={93} stroke="var(--viz-fg)" strokeWidth={2} opacity={back ? 0.45 : 1} />
              <line x1={666} y1={77} x2={652} y2={93} stroke="var(--viz-fg)" strokeWidth={2} opacity={back ? 0.45 : 1} />
            </Appear>
            <Appear on={s >= 2} dx={10} dy={0}>
              <Block x={680} y={45} w={100} h={80} label="bare x86" sub="no OS/libc" state={s === 2 || cross ? 'on' : back ? 'dim' : 'off'} />
            </Appear>

            {/* host leftovers that the host compiler pulls in */}
            {CHIPS.map((c, i) => (
              <g key={c}>
                <Appear on={s >= 1} delay={i * 0.08}>
                  <Block x={CHIP_X[i]} y={150} w={104} h={32} label={c} mono size={11}
                    state={cross || back ? 'dim' : s >= 2 ? 'hatch' : 'off'} />
                </Appear>
                <Wire d={`M${CHIP_X[i] + 52} 150 C ${CHIP_X[i] + 52} 136, ${CHIP_TARGET[i]} 140, ${CHIP_TARGET[i]} 124`} on={leakOn} dim={back || s >= 2} delay={i * 0.08} />
                <Packet on={s === 1} points={[[CHIP_X[i] + 52, 150], [CHIP_TARGET[i], 124]]} duration={1.1} delay={i * 0.25} r={4} />
              </g>
            ))}
            <Label x={630} y={171} size={10.5} dim on={s === 1}>← from your host</Label>
            <Label x={630} y={164} size={10.5} on={s === 2}>none of these</Label>
            <Label x={630} y={180} size={10.5} on={s === 2}>exist on bare x86</Label>
            {/* packets stop at the compiler's edges so they never cover its title */}
            <Packet on={s === 1} points={[[140, 85], [238, 85]]} duration={1.1} />
            <Packet on={s === 1} points={[[460, 85], [526, 85]]} duration={1.1} delay={1.1} />
            <Packet on={cross} points={[[140, 85], [238, 85]]} duration={1.4} />
            <Packet on={cross} points={[[460, 85], [585, 85], [660, 85]]} duration={1.4} delay={1.4} label="kernel" />

            {/* divider */}
            <line x1={20} x2={780} y1={212} y2={212} stroke="var(--viz-faint)" />

            {/* ---------- bottom left: triplet anatomy ---------- */}
            <Appear on={s >= 3}>
              <Label x={30} y={238} size={11} dim>TARGET TRIPLET</Label>
              <Block x={30} y={250} w={110} h={46} mono size={15} label={s >= 4 ? 'i686' : 'x86_64'} state={s === 3 || s === 4 ? 'on' : 'off'} />
              <Label x={145} y={279} size={15} anchor="middle" dim>-</Label>
              <Block x={150} y={250} w={110} h={46} mono size={s >= 4 ? 12 : 15} label={s >= 4 ? '(left out)' : 'unknown'} state={s >= 4 ? 'dim' : s === 3 ? 'on' : 'off'} />
              <Label x={265} y={279} size={15} anchor="middle" dim>-</Label>
              <Block x={270} y={250} w={120} h={46} mono size={15} label={s >= 4 ? 'elf' : 'linux-gnu'} state={s === 3 || s === 4 ? 'on' : 'off'} />
              <Label x={85} y={314} size={10.5} anchor="middle" dim>machine (CPU)</Label>
              <Label x={205} y={314} size={10.5} anchor="middle" dim>vendor</Label>
              <Label x={330} y={314} size={10.5} anchor="middle" dim>operating system</Label>
            </Appear>
            <Label x={30} y={346} size={11} on={s === 3}>x86_64-linux-gnu with the vendor spelled out:</Label>
            <Label x={30} y={366} size={11} on={s === 3} weight={500}>x86_64-unknown-linux-gnu</Label>
            <Label x={30} y={346} size={11} on={s >= 4}>i686-elf: 32-bit x86, ELF objects,</Label>
            <Label x={30} y={364} size={11} on={s >= 4}>no OS, no user space</Label>
            <Label x={30} y={392} size={10.5} dim on={s >= 4}>also bare: x86_64-elf · arm-none-eabi</Label>
            <Label x={30} y={410} size={10.5} dim on={s >= 4}>aarch64-none-elf · riscv64-none-elf</Label>

            {/* ---------- bottom right: build order ---------- */}
            <Appear on={s >= 5}>
              <Label x={430} y={238} size={11} dim>BUILD ORDER</Label>
              <Block x={430} y={250} w={170} h={50} label="1 · binutils" sub="--target=i686-elf" state={s === 5 ? 'on' : 'off'} />
              <Block x={630} y={250} w={150} h={50} mono size={13} label="i686-elf-as" sub="-ld  -objdump  …" state={s === 5 ? 'on' : 'off'} />
              <Label x={430} y={418} size={10.5} dim>installed in $HOME/opt/cross/bin</Label>
            </Appear>
            <Wire from={[600, 275]} to={[628, 275]} on={s >= 5} />
            <Packet on={s === 5} points={[[515, 275], [705, 275]]} duration={1.4} r={4} />

            <Wire from={[515, 300]} to={[515, 336]} on={s >= 6} />
            <Label x={525} y={323} size={10.5} dim on={s >= 6}>uses them</Label>
            <Appear on={s >= 6}>
              <Block x={430} y={338} w={170} h={50} label="2 · gcc + libgcc" sub="--without-headers" state={s === 6 ? 'on' : 'off'} />
              <Block x={630} y={338} w={150} h={50} mono size={13} label="i686-elf-gcc" sub="+ libgcc.a" state={s === 6 ? 'on' : cross ? 'fill' : 'off'} />
            </Appear>
            <Wire from={[600, 363]} to={[628, 363]} on={s >= 6} />
            <Packet on={s === 6} points={[[705, 300], [705, 318], [515, 318], [515, 363], [705, 363]]} duration={2} r={4} />
            <Pulse x={705} y={363} on={cross} r={16} />

            {/* small "PATH" reminder that gcc's build must find i686-elf-as */}
            <motion.text x={705} y={326} textAnchor="middle" initial={false} animate={{ opacity: s === 6 ? 1 : 0 }} transition={ease}
              fill="var(--viz-dim)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>via PATH</motion.text>
          </Scene>
        )
      }}
    </VizStage>
  )
}
