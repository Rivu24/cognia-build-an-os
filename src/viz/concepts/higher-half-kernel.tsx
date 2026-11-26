/* Higher half kernel (32-bit x86, GRUB + boot page table), following "Higher Half x86 Bare Bones":
   kernel loaded at physical 0x00100000, linked at 0xC0100000. One boot page table is installed at PDE[0]
   (identity) and PDE[768] (0xC0000000), paging is enabled, EIP jumps high, then PDE[0] is cleared. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'higher-half-kernel',
  title: 'Higher half kernel: load low, run at 3 GiB',
  summary: 'GRUB loads the kernel at physical 1 MiB; the boot code maps those frames at both 0x00100000 and 0xC0100000, enables paging, jumps high and drops the low mapping.',
  lessons: ['t6m2l3'],
  articles: ['Higher Half x86 Bare Bones', 'Higher Half Kernel'],
  group: 'Memory',
  order: 650,
}

const steps: VizStep[] = [
  { caption: 'GRUB loads the kernel at physical 1 MiB (0x00100000). Paging is off.', detail: 'With paging off, every address the CPU uses is physical. The boot code (_start) starts running down here, at low addresses.' },
  { caption: 'But the kernel was linked to run at 0xC0100000: 3 GiB + 1 MiB.', detail: 'linker.ld adds 0xC0000000 to every virtual address but loads each section at ADDR − 0xC0000000. Nothing is mapped up there yet.' },
  { caption: '_start fills boot_page_table1 with the kernel frames: present + writable.', detail: 'Entry 256 → 0x00100000 | 0x003, entry 257 → 0x00101000 | 0x003, and so on. Entry 1023 maps the VGA buffer 0xB8000, which ends up at 0xC03FF000.' },
  { caption: 'The same table goes into PDE[0] and PDE[768].', detail: 'PDE[0] covers 0x00000000–0x003FFFFF (identity). PDE[768] covers 0xC0000000–0xC03FFFFF (768 = 0xC0000000 >> 22). Both reach the same frames.', ms: 3800 },
  { caption: 'CR3 ← page directory, then CR0 |= 0x80010000: paging is on.', detail: '0x80000000 is PG, 0x00010000 is WP. EIP still points low: without the identity map, the very next instruction fetch would page fault.' },
  { caption: 'An absolute jump moves EIP into the higher half.', detail: 'lea 4f, %ecx; jmp *%ecx. Label 4 is in .text, linked above 0xC0000000, so execution continues at the high address on the same frames.' },
  { caption: 'Unmap the identity copy: PDE[0] = 0, then reload CR3 to flush the TLB.', detail: 'The low mapping was only a bridge for the jump. Writing CR3 again throws away stale TLB entries for 0x00000000–0x003FFFFF.' },
  { caption: 'Kernel above 0xC0000000, user space below.', detail: 'Every process maps the kernel at 0xC0000000–0xFFFFFFFF. Programs get 0x00000000–0xBFFFFFFF and can be linked at 0x00400000 whatever the kernel size.', ms: 3800 },
]

const CODE = [
  'multiboot: GRUB copies each ELF section to its load (AT) address, then jumps to _start',
  'linker.ld:  . = 0x00100000;  …  . += 0xC0000000;  .text : AT(ADDR(.text) - 0xC0000000)',
  'boot.s:  movl %esi,%edx;  orl $0x003,%edx;  movl %edx,(%edi)    # PTE = frame | P | W',
  'movl $(boot_page_table1 - 0xC0000000 + 0x003), boot_page_directory - 0xC0000000 + 768 * 4',
  'movl %ecx,%cr3;  movl %cr0,%ecx;  orl $0x80010000,%ecx;  movl %ecx,%cr0',
  'lea 4f, %ecx;  jmp *%ecx        # 4: is in .text, linked above 0xC0000000',
  'movl $0, boot_page_directory + 0;  movl %cr3,%ecx;  movl %ecx,%cr3    # flush TLB',
  'mov $stack_top, %esp;  call kernel_main',
]

/* layout */
const VX = 110, VW = 140 // virtual column
const PDX = 285, PDW = 100 // page directory
const PTX = 420, PTW = 120 // boot page table
const PX = 560, PW = 130 // physical column
const HI_Y = 145 // centre of the high kernel region
const ID_Y = 350 // centre of the identity region

export default function HigherHalfKernel() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const mapped = s >= 3
        const identity = s >= 3 && s < 6
        return (
          <Scene label={meta.summary}>
            {/* register row */}
            <Block x={VX} y={30} w={VW} h={36} label="EIP" mono size={12} sub={s < 5 ? '0x001… (low)' : '0xC01… (high)'} state={s === 5 ? 'on' : 'off'} />
            <Block x={PDX} y={30} w={PDW} h={36} label="CR3" mono size={12} sub={s < 4 ? 'unused' : 'PD (phys)'} state={s === 4 || s === 6 ? 'on' : s < 4 ? 'dim' : 'off'} />
            <Block x={PTX} y={30} w={PTW} h={36} label="CR0" mono size={12} sub={s < 4 ? 'PG = 0' : 'PG = 1  WP = 1'} state={s === 4 ? 'on' : 'off'} />
            <Block x={PX} y={30} w={PW} h={36} label="GRUB" size={13} state={s === 0 ? 'on' : 'dim'} />
            <Wire from={[PDX + PDW - 5, 66]} to={[PDX + PDW - 5, 90]} on={s >= 4} />
            <Pulse x={PDX + PDW / 2} y={48} on={s === 6} />

            {/* column titles */}
            <Label x={VX} y={84} size={10.5} dim>VIRTUAL ADDRESSES</Label>
            <Label x={PDX} y={84} size={10.5} dim on={s >= 3}>PAGE DIRECTORY</Label>
            <Label x={PX} y={84} size={10.5} dim>PHYSICAL RAM</Label>

            {/* virtual address space (dimmed while paging is off) */}
            <motion.g initial={false} animate={{ opacity: s === 0 ? 0.3 : 1 }} transition={{ duration: 0.6 }}>
              <Block x={VX} y={92} w={VW} h={28} label="unmapped" size={11} state="dim" />
              <Block x={VX} y={120} w={VW} h={50} label="kernel" size={13} mono
                sub={s < 3 ? 'not mapped yet' : '→ 0x00100000'}
                state={s === 1 || s === 3 || s === 5 || s === 7 ? 'on' : s >= 3 ? 'fill' : 'off'} />
              <Block x={VX} y={170} w={VW} h={16} state="hatch" />
              <Block x={VX} y={186} w={VW} h={140} state={s === 7 ? 'on' : 'off'} />
              <Label x={VX + VW / 2} y={212} anchor="middle" size={12} mono={false} weight={500}>user space</Label>
              <Label x={VX + VW / 2} y={228} anchor="middle" size={10.5} dim>below 3 GiB</Label>
              <Appear on={s >= 7}>
                <Block x={VX + 14} y={252} w={VW - 28} h={40} label="program" size={12} sub="0x00400000" state="off" />
              </Appear>
              <Pulse x={VX + VW / 2} y={272} on={s === 7} />
              <Block x={VX} y={326} w={VW} h={48} label={s >= 6 ? 'unmapped' : 'kernel'} mono size={13}
                sub={s < 3 ? '(physical)' : s < 6 ? 'identity copy' : 'PDE[0] = 0'}
                state={s >= 6 ? 'dim' : s === 3 || s === 4 ? 'on' : 'off'} />
              <Block x={VX} y={374} w={VW} h={26} label="first 1 MiB" size={11} state="dim" />
              {/* boundary addresses */}
              <Label x={VX - 8} y={96} anchor="end" size={10.5} dim>0xFFFFFFFF</Label>
              <Label x={VX - 8} y={174} anchor="end" size={10.5} dim={s !== 1}>0xC0100000</Label>
              <Label x={VX - 8} y={190} anchor="end" size={10.5} dim>0xC0000000</Label>
              <Label x={VX - 8} y={378} anchor="end" size={10.5} dim>0x00100000</Label>
              <Label x={VX - 8} y={404} anchor="end" size={10.5} dim>0x00000000</Label>
            </motion.g>
            <Pulse x={VX + VW / 2} y={HI_Y} on={s === 1} />

            {/* EIP marker on the left edge of the virtual column */}
            <motion.g initial={false} animate={{ y: s >= 5 ? HI_Y : ID_Y }} transition={{ type: 'spring', stiffness: 60, damping: 14 }}>
              <circle cx={VX} cy={0} r={5} fill="var(--viz-fg)" filter="url(#viz-glow)" />
              <Label x={VX - 10} y={4} anchor="end" size={11} weight={600}>EIP</Label>
            </motion.g>
            <Pulse x={VX} y={ID_Y} on={s === 4} r={10} />
            <Pulse x={VX} y={HI_Y} on={s === 5} r={10} />

            {/* page directory */}
            <Appear on={s >= 3} dx={-10} dy={0}>
              <rect x={PDX} y={92} width={PDW} height={276} fill="none" stroke="var(--viz-faint)" />
              <Block x={PDX} y={92} w={PDW} h={26} label="PDE[1023]" mono size={11} state="dim" />
              <Block x={PDX} y={HI_Y - 18} w={PDW} h={36} label="PDE[768]" mono size={11} sub="→ table1" state={s === 3 ? 'on' : 'off'} />
              <Label x={PDX + PDW / 2} y={250} anchor="middle" size={14} dim>⋮</Label>
              <Block x={PDX} y={ID_Y - 18} w={PDW} h={36} label="PDE[0]" mono size={11} sub={s >= 6 ? '0' : '→ table1'} state={s >= 6 ? 'dim' : s === 3 ? 'on' : 'off'} />
            </Appear>
            <Wire from={[VX + VW, HI_Y]} to={[PDX - 2, HI_Y]} on={mapped} />
            <Wire from={[VX + VW, ID_Y]} to={[PDX - 2, ID_Y]} on={identity} />
            <Wire d={`M${PDX + PDW} ${HI_Y} C ${PDX + PDW + 22} ${HI_Y}, ${PTX - 24} 240, ${PTX - 2} 240`} on={mapped} />
            <Wire d={`M${PDX + PDW} ${ID_Y} C ${PDX + PDW + 22} ${ID_Y}, ${PTX - 24} 300, ${PTX - 2} 300`} on={identity} />
            <Pulse x={PDX + PDW / 2} y={ID_Y} on={s === 6} />

            {/* boot page table */}
            <Appear on={s >= 2} dx={-10} dy={0}>
              <Label x={PTX} y={172} size={10.5} dim>boot_page_table1</Label>
              <Block x={PTX} y={180} w={PTW} h={36} label="PTE[1023]" mono size={11} sub="0x000B8003" state="off" />
              <Block x={PTX} y={216} w={PTW} h={36} label="PTE[257]" mono size={11} sub="0x00101003" state={s === 2 ? 'on' : 'off'} />
              <Block x={PTX} y={252} w={PTW} h={36} label="PTE[256]" mono size={11} sub="0x00100003" state={s === 2 ? 'on' : 'off'} />
              <Block x={PTX} y={288} w={PTW} h={36} label="PTE[0–255]" mono size={11} sub="0 (not present)" state="dim" />
            </Appear>
            <Wire from={[PTX + PTW, 270]} to={[PX - 2, 270]} on={s >= 2} />

            {/* physical memory */}
            <Block x={PX} y={92} w={PW} h={144} label="free RAM" size={12} state="off" />
            <Block x={PX} y={236} w={PW} h={74} label="kernel image" size={13} sub="1 MiB and up" state={s === 0 || s === 3 ? 'on' : 'fill'} />
            <Block x={PX} y={310} w={PW} h={90} label="first 1 MiB" size={12} sub="VGA at 0xB8000" state="dim" />
            <Label x={PX + PW + 8} y={314} size={10.5} dim>0x00100000</Label>
            <Label x={PX + PW + 8} y={404} size={10.5} dim>0x00000000</Label>
            <Packet on={s === 0} points={[[PX + PW / 2, 66], [PX + PW / 2, 270]]} duration={1.4} label="load" />

            {/* both virtual copies land on the same frames */}
            <Packet on={s === 3} points={[[VX + VW / 2, HI_Y], [PDX + PDW / 2, HI_Y], [PTX + PTW / 2, 270], [PX + PW / 2, 273]]} duration={2.2} />
            <Packet on={s === 3} points={[[VX + VW / 2, ID_Y], [PDX + PDW / 2, ID_Y], [PTX + PTW / 2, 270], [PX + PW / 2, 273]]} duration={2.2} delay={0.9} />
            <Packet on={s === 5} points={[[VX + 18, ID_Y], [VX + 18, HI_Y]]} duration={1.3} label="jmp" />

            {/* the instruction(s) doing the work */}
            {CODE.map((c, i) => (
              <Label key={i} x={40} y={428} size={11} on={s === i}>{c}</Label>
            ))}
          </Scene>
        )
      }}
    </VizStage>
  )
}
