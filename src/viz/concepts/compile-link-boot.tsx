/* The Bare Bones build: assemble, compile, link, check, make an ISO, boot it in QEMU.
   Every command is the one printed in the "Bare Bones" article (it links with the compiler, not ld directly). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'compile-link-boot',
  title: 'From source to a booting kernel',
  summary: 'boot.s and kernel.c become object files, the linker script joins them into myos.bin, grub-mkrescue wraps it in an ISO and QEMU boots it.',
  lessons: ['t2m2l1', 't3m2l2', 't3m1l2', 'p5l1'],
  articles: ['Bare Bones', 'Linker Scripts'],
  group: 'Toolchain',
  order: 250,
}

const steps: VizStep[] = [
  { caption: 'Three inputs: boot.s, kernel.c and the linker script linker.ld.', detail: 'boot.s holds the multiboot header, a 16 KiB stack and _start. kernel.c writes text to VGA memory at 0xB8000. linker.ld says where everything goes.' },
  { caption: 'Assemble: i686-elf-as boot.s -o boot.o', detail: 'An object file holds machine code, symbols and relocations. Its addresses are not final yet: that is the linker\'s job.' },
  { caption: 'Compile: i686-elf-gcc -c kernel.c -o kernel.o -ffreestanding -O2', detail: '-c stops at the object file. -ffreestanding means no standard library, only compiler headers such as stdint.h. Bare Bones also adds -std=gnu99 -Wall -Wextra.' },
  { caption: 'Link with the compiler: -T linker.ld … boot.o kernel.o -lgcc', detail: 'i686-elf-gcc -T linker.ld -o myos.bin -ffreestanding -O2 -nostdlib boot.o kernel.o -lgcc. The result is an ELF file whose entry point is _start.' },
  { caption: 'Check it: grub-file --is-x86-multiboot myos.bin', detail: 'Quiet either way. Exit status 0 means GRUB will find a valid multiboot header; 1 means it will refuse to boot the file.' },
  { caption: 'Lay out a CD folder: the kernel and a grub.cfg menu entry.', detail: 'isodir/boot/myos.bin and isodir/boot/grub/grub.cfg containing menuentry "myos" { multiboot /boot/myos.bin }' },
  { caption: 'grub-mkrescue -o myos.iso isodir builds a bootable CD image.', detail: 'The image holds GRUB itself plus your folder. At boot GRUB reads grub.cfg and loads myos.bin using the multiboot protocol.' },
  { caption: 'qemu-system-i386 -cdrom myos.iso: your kernel prints its first line.', detail: 'QEMU boots GRUB from the CD, GRUB loads the kernel, _start calls kernel_main. qemu-system-i386 -kernel myos.bin also works and skips the ISO.', ms: 4200 },
]

export default function CompileLinkBoot() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        return (
          <Scene label={meta.summary}>
            {/* column headings */}
            <Label x={20} y={30} size={10.5} dim>SOURCE</Label>
            <Label x={290} y={30} size={10.5} dim on={s >= 1}>OBJECT</Label>
            <Label x={440} y={30} size={10.5} dim on={s >= 3}>LINK</Label>
            <Label x={630} y={30} size={10.5} dim on={s >= 3}>KERNEL (ELF)</Label>

            {/* sources */}
            <Block x={20} y={42} w={100} h={40} label="boot.s" mono size={13} state={s === 0 || s === 1 ? 'on' : 'off'} />
            <Block x={20} y={112} w={100} h={40} label="kernel.c" mono size={13} state={s === 0 || s === 2 ? 'on' : 'off'} />
            <Block x={20} y={182} w={100} h={40} label="linker.ld" mono size={13} state={s === 0 || s === 3 ? 'on' : 'off'} />

            {/* assemble */}
            <Wire from={[120, 62]} to={[288, 62]} on={s >= 1} />
            <Label x={204} y={54} size={10.5} anchor="middle" on={s >= 1}>i686-elf-as</Label>
            <Packet on={s === 1} points={[[120, 62], [340, 62]]} duration={1.3} />
            <Appear on={s >= 1} dx={-12} dy={0}>
              <Block x={290} y={42} w={100} h={40} label="boot.o" mono size={13} state={s === 1 ? 'on' : 'off'} />
            </Appear>

            {/* compile */}
            <Wire from={[120, 132]} to={[288, 132]} on={s >= 2} />
            <Label x={204} y={124} size={10.5} anchor="middle" on={s >= 2}>i686-elf-gcc -c</Label>
            <Label x={204} y={148} size={10.5} anchor="middle" dim on={s >= 2}>-ffreestanding</Label>
            <Packet on={s === 2} points={[[120, 132], [340, 132]]} duration={1.3} />
            <Appear on={s >= 2} dx={-12} dy={0}>
              <Block x={290} y={112} w={100} h={40} label="kernel.o" mono size={13} state={s === 2 ? 'on' : 'off'} />
            </Appear>

            {/* link */}
            <Wire d="M390 62 C 415 62, 415 80, 438 80" on={s >= 3} />
            <Wire d="M390 132 C 415 132, 415 114, 438 114" on={s >= 3} />
            <Wire d="M120 202 L515 202 L515 144" on={s >= 3} />
            <Appear on={s >= 3}>
              <Block x={440} y={52} w={150} h={90} label="i686-elf-gcc" sub="-T linker.ld" mono size={13} state={s === 3 ? 'on' : 'off'} />
              <Label x={515} y={128} size={10.5} anchor="middle" dim>-nostdlib … -lgcc</Label>
            </Appear>
            <Packet on={s === 3} points={[[340, 62], [440, 82], [515, 97], [705, 97]]} duration={2} r={4} />
            <Packet on={s === 3} points={[[340, 132], [440, 112], [515, 97], [705, 97]]} duration={2} r={4} delay={0.3} />
            <Packet on={s === 3} points={[[120, 202], [515, 202], [515, 144], [515, 97]]} duration={2} r={4} delay={0.6} />

            <Wire from={[590, 97]} to={[628, 97]} on={s >= 3} />
            <Appear on={s >= 3} dx={-12} dy={0}>
              <Block x={630} y={72} w={150} h={50} label="myos.bin" sub="ELF, entry _start" mono size={14} state={s === 3 ? 'on' : s >= 4 ? 'fill' : 'off'} />
            </Appear>

            {/* check */}
            <Wire from={[705, 122]} to={[705, 246]} on={s >= 4} dim={s > 4} />
            <Packet on={s === 4} points={[[705, 122], [705, 276]]} duration={1.2} r={4} />
            <Appear on={s >= 4}>
              <Block x={610} y={248} w={170} h={56} label="grub-file" sub="--is-x86-multiboot" mono size={13} state={s === 4 ? 'on' : 'off'} />
              <Label x={695} y={324} size={10.5} anchor="middle" weight={500}>exit status 0</Label>
              <Label x={695} y={340} size={10.5} anchor="middle" dim>= multiboot header OK</Label>
            </Appear>

            {/* ISO folder: myos.bin itself is copied in; grub-file was only a pass/fail check */}
            <Wire d="M655 122 C 655 200, 530 180, 530 236" on={s >= 5} />
            <Label x={608} y={203} size={10.5} dim on={s >= 5}>copy</Label>
            <Appear on={s >= 5} dx={12} dy={0}>
              <Block x={345} y={240} w={215} h={110} state={s === 5 ? 'on' : 'off'} />
              <Label x={358} y={262} size={11} weight={500}>isodir/</Label>
              <Label x={358} y={282} size={11}>└ boot/myos.bin</Label>
              <Label x={358} y={302} size={11}>└ boot/grub/grub.cfg</Label>
              <Label x={358} y={330} size={10.5} dim>multiboot /boot/myos.bin</Label>
            </Appear>
            <Packet on={s === 5} points={[[655, 122], [635, 165], [592, 188], [550, 206], [530, 236]]} duration={1.4} r={4} />

            {/* ISO */}
            <Wire from={[345, 295]} to={[302, 295]} on={s >= 6} />
            <Appear on={s >= 6} dx={12} dy={0}>
              <Block x={200} y={270} w={100} h={50} label="myos.iso" sub="GRUB + files" mono size={13} state={s === 6 ? 'on' : s >= 7 ? 'fill' : 'off'} />
              <Label x={250} y={340} size={10.5} anchor="middle">grub-mkrescue</Label>
              <Label x={250} y={356} size={10.5} anchor="middle" dim>-o myos.iso isodir</Label>
            </Appear>
            <Packet on={s === 6} points={[[345, 295], [304, 295]]} duration={0.9} r={4} />

            {/* QEMU screen */}
            <Wire from={[200, 295]} to={[162, 295]} on={s >= 7} />
            <Appear on={s >= 7} dx={12} dy={0}>
              <Block x={20} y={245} w={140} h={100} state="on" />
              <Label x={30} y={263} size={10.5} dim>QEMU</Label>
              <Label x={30} y={290} size={11.5} delay={0.4}>Hello, kernel</Label>
              <Label x={30} y={308} size={11.5} delay={0.7}>World!</Label>
              <motion.rect x={78} y={299} width={7} height={11} fill="var(--viz-fg)"
                initial={false} animate={{ opacity: s >= 7 ? [1, 1, 0, 0] : 0 }}
                transition={{ duration: 1, repeat: s >= 7 ? Infinity : 0, times: [0, 0.5, 0.5, 1] }} />
              <Label x={20} y={368} size={10.5}>qemu-system-i386</Label>
              <Label x={20} y={384} size={10.5} dim>-cdrom myos.iso</Label>
            </Appear>
            <Packet on={s === 7} points={[[250, 295], [166, 295]]} duration={1.1} r={4} label="boot" />
            <Label x={200} y={418} size={11} on={s >= 7}>GRUB → multiboot → _start → kernel_main</Label>

            <Pulse x={705} y={97} on={s === 3} r={18} />
            <Pulse x={695} y={276} on={s === 4} r={18} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
