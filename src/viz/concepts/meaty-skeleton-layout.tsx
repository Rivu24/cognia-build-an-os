/* The Meaty Skeleton project layout and build, following the wiki article's own files:
   kernel/ (arch/i386: boot.S, tty.c, linker.ld, crti.S, crtn.S, make.config), libc/ (built as libk.a for the kernel),
   sysroot/ (usr/include, usr/lib, boot), and the scripts headers.sh → build.sh → iso.sh → qemu.sh.
   build.sh runs `DESTDIR="$SYSROOT" make install` in libc, then kernel (PROJECTS="libc kernel"). The kernel links
   with -nostdlib -lk -lgcc and CC carries --sysroot=$SYSROOT. Make rebuilds only targets older than their inputs. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'meaty-skeleton-layout',
  title: 'Meaty Skeleton: layout and build',
  summary: 'How Meaty Skeleton splits the OS into kernel/ and libc/, installs headers and libk.a into a sysroot, links the kernel against libk, wraps it in an ISO, boots it in QEMU, and rebuilds only what changed.',
  lessons: ['t3m2l1', 't3m2l2'],
  articles: ['Meaty Skeleton', 'Makefile'],
  group: 'Toolchain',
  order: 321,
}

const steps: VizStep[] = [
  { caption: 'The OS is split into projects, kernel/ and libc/, plus a few build scripts.', detail: 'config.sh sets PROJECTS="libc kernel", the cross-compiler (i686-elf-gcc) and SYSROOT. Each project has its own Makefile.' },
  { caption: 'Code for one CPU family lives in kernel/arch/i386: boot.S, tty.c, linker.ld.', detail: 'boot.S holds the Multiboot header and _start, tty.c writes the VGA text buffer, linker.ld places the kernel at 1 MiB. A port adds another arch/ folder.' },
  { caption: 'libc/ is built as libk.a for the kernel: the same sources, kernel flags.', detail: 'libk is the freestanding part of libc (string, stdio, abort) compiled with -D__is_libk. A user-space libc.a comes later from the same folder.' },
  { caption: 'headers.sh copies every header into sysroot/usr/include. No compiling yet.', detail: 'sysroot/ is a fake root directory for your OS. It runs make install-headers in libc and kernel with DESTDIR="$SYSROOT".' },
  { caption: 'build.sh runs make install in libc: build libk.a, copy it to sysroot/usr/lib.', detail: 'Each .c file becomes a .libk.o object, and ar rcs bundles them into libk.a. libc goes first because the kernel needs it.' },
  { caption: 'Then make install in kernel: compile, link with -lk, copy to sysroot/boot.', detail: 'CC includes --sysroot=$SYSROOT, so -lk finds sysroot/usr/lib/libk.a. Link list: crti.o crtbegin.o kernel objects -nostdlib -lk -lgcc crtend.o crtn.o.', ms: 4200 },
  { caption: 'iso.sh copies myos.kernel into isodir/, writes grub.cfg and builds myos.iso.', detail: 'grub.cfg holds one entry: multiboot /boot/myos.kernel. grub-mkrescue -o myos.iso isodir makes a bootable CD image.' },
  { caption: 'qemu.sh boots the ISO. Each script runs the one before it first.', detail: 'qemu.sh runs iso.sh, which runs build.sh, which runs headers.sh. One command takes you from source to a running kernel.' },
  { caption: 'Edit tty.c and run it again: make rebuilds only tty.o, then relinks.', detail: 'Make compares timestamps: tty.c is newer than tty.o, so only that object is compiled. The -MD .d files also catch edited headers.', ms: 4000 },
]

// ---- source tree ----
const TX = 20, TW = 262, TY = 56, TH = 19
const TREE: [number, string][] = [
  [0, 'myos/'],
  [1, 'kernel/'], // 1
  [2, 'Makefile'],
  [2, 'include/kernel/tty.h'], // 3
  [2, 'kernel/kernel.c'], // 4
  [2, 'arch/i386/'], // 5
  [3, 'boot.S'], // 6
  [3, 'tty.c'], // 7
  [3, 'linker.ld'], // 8
  [3, 'crti.S crtn.S make.config'], // 9
  [1, 'libc/'], // 10
  [2, 'Makefile'],
  [2, 'include/ string.h stdio.h'], // 12
  [2, 'string/ memcpy.c strlen.c …'], // 13
  [2, 'stdio/ printf.c putchar.c …'], // 14
  [2, 'stdlib/ abort.c'], // 15
  [1, 'sysroot/   (built)'], // 16
  [1, 'build.sh headers.sh iso.sh qemu.sh'], // 17
]
const rowY = (i: number) => TY + i * TH
const rowMid = (i: number) => rowY(i) + TH / 2

const HOT: Record<number, number[]> = {
  0: [1, 10, 17],
  1: [5, 6, 7, 8],
  2: [10, 13, 14, 15],
  3: [3, 12],
  4: [13, 14, 15],
  5: [4, 6, 7, 8],
  6: [16],
  7: [17],
  8: [7],
}

// ---- sysroot / iso column ----
const SX = 300, SW = 230
// ---- script column ----
const CX = 566, CW = 214
const SCRIPTS: [string, string][] = [
  ['headers.sh', 'install-headers'],
  ['build.sh · libc', 'make install → libk.a'],
  ['build.sh · kernel', 'make install → kernel'],
  ['iso.sh', 'grub-mkrescue'],
  ['qemu.sh', 'qemu-system-i386'],
]
const scY = (i: number) => 44 + i * 50
const SCRIPT_STEP = [3, 4, 5, 6, 7]

const CODE = [
  'PROJECTS="libc kernel"    SYSROOT="$(pwd)/sysroot"    # config.sh',
  'KERNEL_ARCH_OBJS = $(ARCHDIR)/boot.o $(ARCHDIR)/tty.o    # make.config',
  'libk.a: $(LIBK_OBJS)    # .c.libk.o: $(CC) ... -D__is_libk',
  '(cd $PROJECT && DESTDIR="$SYSROOT" $MAKE install-headers)',
  '$(AR) rcs libk.a $(LIBK_OBJS)  →  cp libk.a $(DESTDIR)$(LIBDIR)',
  '$(CC) -T arch/i386/linker.ld -o myos.kernel ... -nostdlib -lk -lgcc ...',
  'cp sysroot/boot/myos.kernel isodir/boot/  ;  grub-mkrescue -o myos.iso isodir',
  'qemu-system-$(./target-triplet-to-arch.sh $HOST) -cdrom myos.iso',
  'tty.c newer than tty.o  →  $(CC) -MD -c tty.c  →  relink myos.kernel',
]

/** One line of the source tree. */
function TreeRow({ i, depth, text, hot, dim }: { i: number; depth: number; text: string; hot: boolean; dim: boolean }) {
  const dir = text.split(' ')[0].endsWith('/')
  return (
    <motion.g initial={false} animate={{ opacity: dim ? 0.35 : 1 }} transition={ease}>
      <motion.rect x={TX} y={rowY(i)} width={TW} height={TH} initial={false}
        animate={{ opacity: hot ? 1 : 0 }} transition={ease} fill="var(--viz-bg)" stroke="var(--viz-fg)" strokeWidth={1.4} filter={hot ? 'url(#viz-glow)' : undefined} />
      <text x={TX + 8 + depth * 14} y={rowY(i) + 13.5} fill="var(--viz-fg)" style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: dir ? 600 : 400 }}>
        {text}
      </text>
    </motion.g>
  )
}

export default function MeatySkeletonLayout() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const hot = HOT[s] ?? []
        const focusTree = s <= 5 || s === 8
        return (
          <Scene label={meta.summary}>
            {/* ===== source tree ===== */}
            <Label x={TX} y={36} size={11} dim>SOURCE TREE</Label>
            {/* tree guides */}
            <line x1={TX + 12} x2={TX + 12} y1={rowY(1)} y2={rowMid(17)} stroke="var(--viz-faint)" />
            {TREE.map(([d, t], i) => (
              <TreeRow key={i} i={i} depth={d} text={t} hot={hot.includes(i)} dim={!focusTree ? i !== 16 && i !== 17 : hot.length > 0 && !hot.includes(i) && s !== 0} />
            ))}
            <Label x={TX + 154} y={rowY(7) + 13.5} size={10.5} weight={600} on={s === 8}>edited</Label>

            {/* ===== sysroot (faint until headers.sh fills it) ===== */}
            <motion.g initial={false} animate={{ opacity: s >= 3 ? 1 : 0.22 }} transition={ease}>
              <Label x={SX} y={36} size={11} dim>SYSROOT/ (FAKE ROOT)</Label>
              <rect x={SX} y={48} width={SW} height={214} fill="none" stroke="var(--viz-fg)" />
              <Label x={SX + 12} y={70} size={11} dim>usr/include/</Label>
              <Block x={SX + 12} y={78} w={SW - 24} h={48} state={s === 3 ? 'on' : 'off'} />
              <Label x={SX + 22} y={97} size={11} on={s >= 3}>string.h stdio.h sys/</Label>
              <Label x={SX + 22} y={115} size={11} on={s >= 3}>kernel/tty.h</Label>
              <Label x={SX + 12} y={148} size={11} dim>usr/lib/</Label>
              <Label x={SX + 12} y={206} size={11} dim>boot/</Label>
            </motion.g>
            <Appear on={s >= 4}>
              <Block x={SX + 12} y={156} w={SW - 24} h={32} label="libk.a" mono size={12} state={s === 4 || s === 5 ? 'on' : 'off'} />
            </Appear>
            <Appear on={s >= 5}>
              <Block x={SX + 12} y={214} w={SW - 24} h={34} label="myos.kernel" mono size={12} state={s === 5 || s === 8 ? 'on' : s === 6 ? 'on' : 'off'} />
            </Appear>
            <Label x={SX + SW - 10} y={209} size={10.5} anchor="end" weight={600} on={s === 8}>relinked</Label>

            {/* ===== iso ===== */}
            <Appear on={s >= 6}>
              <Label x={SX} y={288} size={11} dim>ISODIR/</Label>
              <Block x={SX} y={296} w={SW} h={44} label="boot/myos.kernel" sub="boot/grub/grub.cfg" mono size={11.5} state={s === 6 ? 'on' : 'off'} />
              <Wire from={[SX + SW / 2, 340]} to={[SX + SW / 2, 356]} />
              <Block x={SX} y={358} w={SW} h={30} label="myos.iso" mono size={12} state={s === 6 || s === 7 ? 'on' : 'off'} />
            </Appear>

            {/* ===== scripts ===== */}
            <Label x={CX} y={36} size={11} dim>./qemu.sh RUNS, IN ORDER</Label>
            {SCRIPTS.map(([a, b], i) => {
              const at = SCRIPT_STEP[i]
              const st = s === at || (s === 8 && i === 2) ? 'on' : s > at && s !== 8 ? 'off' : s === 8 ? 'dim' : 'dim'
              return (
                <g key={i}>
                  <Block x={CX} y={scY(i)} w={CW} h={40} label={a} sub={s === 8 ? (i < 2 ? 'up to date' : i === 2 ? 'tty.o + relink' : b) : b} mono size={12} state={st} />
                  <Label x={CX - 8} y={scY(i) + 24} size={11} anchor="end" dim>{i + 1}</Label>
                </g>
              )
            })}
            {[0, 1, 2, 3].map((i) => (
              <Wire key={i} from={[CX + CW / 2, scY(i) + 40]} to={[CX + CW / 2, scY(i + 1) - 1]} on={s > SCRIPT_STEP[i] && s !== 8} width={1.2} />
            ))}

            {/* QEMU window */}
            <Appear on={s >= 7}>
              <Block x={CX} y={300} w={CW} h={88} state={s === 7 ? 'on' : 'off'} />
              <Label x={CX + 10} y={318} size={10.5} dim>QEMU · VGA text</Label>
              <Label x={CX + 10} y={346} size={12} weight={500}>Hello, kernel World!</Label>
              <motion.rect x={CX + 10} y={354} width={8} height={3} fill="var(--viz-fg)" initial={false}
                animate={{ opacity: s >= 7 ? [1, 0, 1] : 0 }} transition={{ duration: 1, repeat: Infinity }} />
            </Appear>

            {/* ===== motion: files flowing ===== */}
            <Packet on={s === 3} points={[[TX + TW, rowMid(3)], [SX - 14, rowMid(3)], [SX - 14, 102], [SX + 12, 102]]} duration={1.6} label="tty.h" />
            <Packet on={s === 3} points={[[TX + TW, rowMid(12)], [SX - 14, rowMid(12)], [SX - 14, 102], [SX + 12, 102]]} duration={1.8} delay={0.4} label="string.h" />
            {[13, 14, 15].map((r, k) => (
              <Packet key={r} on={s === 4} points={[[TX + TW, rowMid(r)], [SX - 14, rowMid(r)], [SX - 14, 172], [SX + 12, 172]]} duration={1.6} delay={k * 0.3} />
            ))}
            <Packet on={s === 4} points={[[CX, scY(1) + 20], [SX + SW + 14, scY(1) + 20], [SX + SW + 14, 172], [SX + SW - 12, 172]]} duration={1.4} delay={0.9} label="libk.a" />
            {[6, 7, 8].map((r, k) => (
              <Packet key={r} on={s === 5} points={[[TX + TW, rowMid(r)], [SX - 14, rowMid(r)], [SX - 14, 231], [SX + 12, 231]]} duration={1.6} delay={k * 0.3} />
            ))}
            <Packet on={s === 5} points={[[SX + SW / 2, 188], [SX + SW / 2, 214]]} duration={1} delay={0.6} label="-lk" />
            <Packet on={s === 6} points={[[SX + SW / 2, 248], [SX + SW / 2, 296], [SX + SW / 2, 373]]} duration={1.8} />
            <Packet on={s === 7} points={[[SX + SW, 373], [CX - 14, 373], [CX - 14, 344], [CX, 344]]} duration={1.4} label="boot" />
            <Packet on={s === 8} points={[[TX + TW, rowMid(7)], [SX - 14, rowMid(7)], [SX - 14, 231], [SX + 12, 231]]} duration={1.8} />
            <Pulse x={TX + 60} y={rowMid(7)} on={s === 8} r={12} />

            {/* the command doing the work */}
            <line x1={20} x2={780} y1={404} y2={404} stroke="var(--viz-faint)" />
            {CODE.map((c, i) => (
              <Label key={i} x={20} y={428} size={12} on={s === i}>{c}</Label>
            ))}
          </Scene>
        )
      }}
    </VizStage>
  )
}
