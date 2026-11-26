/* Power on to kernel_main: the legacy BIOS boot path on x86.
   Sources: OSDev Wiki "System Initialization (x86)", "Boot Sequence", "Descriptor Cache" (reset at 0xfffffff0),
   "Memory Map (x86)" (0x7C00-0x7DFF, IVT, BDA), "Bare Bones" (kernel linked at 2 MiB). */
import { AnimatePresence, motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'power-on-to-kernel',
  title: 'Power on to kernel_main (BIOS boot)',
  summary: 'From CPU reset at 0xFFFFFFF0 through BIOS POST and the 512-byte boot sector at 0x7C00 to the bootloader and your kernel_main().',
  lessons: ['t1m2l2', 't1m1l1'],
  articles: ['System Initialization (x86)', 'Boot Sequence'],
  group: 'Boot',
  order: 122,
}

const steps: VizStep[] = [
  { caption: 'You press power. The CPU comes out of reset in 16-bit real mode.', detail: 'Every x86 CPU starts in real mode for compatibility. RAM is not set up yet and none of your code is in memory.' },
  { caption: 'Its first instruction is fetched from 0xFFFFFFF0, 16 bytes below 4 GiB.', detail: 'Firmware ROM is mapped at the very top of the 4 GiB space: the reset vector. An OS cannot change or control this stage.' },
  { caption: 'BIOS POST: detect and test RAM, set up hardware, write the IVT and BDA.', detail: 'Power-On Self-Test. The BIOS builds the IVT at 0x0–0x3FF, its data area (BDA) at 0x400, and an EBDA below 0xA0000. Leave all three alone in real mode.' },
  { caption: 'The BIOS walks the boot order stored in CMOS, one device at a time.', detail: 'Floppy, CD, hard disk, USB, network: missing devices are skipped, and each device that exists is tried in turn.' },
  { caption: 'It copies sector 0 of the disk (LBA 0, 512 bytes) to address 0x7C00.', detail: 'Only these 512 bytes are loaded, filling 0x7C00–0x7DFF. Everything else on the disk is still on the disk.', ms: 3600 },
  { caption: 'Bytes 510–511 are 0x55 0xAA, so the BIOS jumps to 0x0000:0x7C00.', detail: 'No signature means: try the next device. On the jump DL holds the boot drive number; other registers are undefined, so set up your own stack.', ms: 3800 },
  { caption: 'The bootloader enters protected mode, then copies the kernel above 1 MiB.', detail: 'It enables A20, loads a GDT, sets CR0.PE, then reads the kernel to 1 MiB+. GRUB does all of this for you (Bare Bones links the kernel at 2 MiB).', ms: 3800 },
  { caption: "It jumps to the kernel's entry point, which calls kernel_main().", detail: 'Your C code runs from here on. Everything before this point belonged to the firmware and the bootloader.', ms: 3800 },
]

/** Text that cross-fades (slides up) when its content changes. */
function Swap({ x, y, text, size = 13, anchor = 'middle', weight = 500, fill = 'var(--viz-fg)' }: {
  x: number; y: number; text: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; fill?: string
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.g key={text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
        <motion.text x={x} y={y} textAnchor={anchor} initial={false} animate={{ fill }} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>
          {text}
        </motion.text>
      </motion.g>
    </AnimatePresence>
  )
}

type St = 'on' | 'off' | 'dim' | 'fill' | 'hatch'
const MX = 640
const MW = 130

const RUN = ['reset', '0xFFFFFFF0', 'BIOS POST', 'BIOS boot scan', 'BIOS disk read', '0000:7C00', 'bootloader', 'kernel_main()']
const POST = ['detect + test RAM', 'set up buses and devices', 'IVT at 0x0, BDA at 0x400', 'read boot order (CMOS)']
const LOADER = ['enable A20, load a GDT', 'set CR0.PE = 1', 'copy kernel above 1 MiB', 'jump to kernel entry']

export default function PowerOnToKernel() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const rom: St = s === 1 || s === 2 ? 'on' : s === 0 ? 'dim' : 'off'
        const ivt: St = s === 2 ? 'on' : s < 2 ? 'dim' : 'off'
        const boot: St = s === 4 || s === 5 ? 'on' : s < 4 ? 'dim' : 'off'
        const kern: St = s >= 6 ? 'on' : 'dim'
        const free: St = s < 2 ? 'dim' : 'off'
        return (
          <Scene label={meta.summary}>
            {/* CPU */}
            <Block x={30} y={70} w={160} h={80} state={s === 0 || s === 6 ? 'on' : 'off'} />
            <Label x={110} y={104} anchor="middle" size={15} weight={500} mono={false}>CPU</Label>
            <Swap x={110} y={128} size={11} weight={400} fill="var(--viz-dim)" text={s >= 6 ? '32-bit protected' : '16-bit real mode'} />
            <Pulse x={110} y={110} on={s === 0} r={22} />

            {/* what the CPU is executing */}
            <Block x={30} y={162} w={160} h={46} state={s === 7 ? 'fill' : s === 5 ? 'on' : 'off'} />
            <motion.text x={40} y={176} initial={false} animate={{ fill: s === 7 ? 'var(--viz-bg)' : 'var(--viz-dim)' }} style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>EXECUTING</motion.text>
            <Swap x={110} y={198} size={12.5} text={RUN[s]} fill={s === 7 ? 'var(--viz-bg)' : 'var(--viz-fg)'} />
            <Label x={40} y={228} size={11} on={s === 5}>DL = 0x80 (boot disk)</Label>

            {/* firmware ROM */}
            <Wire from={[190, 105]} to={[238, 105]} on={s >= 1} />
            <Block x={240} y={70} w={230} h={80} label="FIRMWARE ROM (BIOS)" sub="reset vector 0xFFFFFFF0" mono size={13} state={rom} />
            <Pulse x={355} y={110} on={s === 1} r={18} />
            <Packet on={s === 1} points={[[190, 105], [238, 105]]} duration={1.1} label="fetch" />
            <Wire d="M470 86 L638 78" on={s >= 1} dashed dim={s !== 1} />

            {/* POST checklist, later replaced by the bootloader's checklist */}
            <Appear on={s >= 2 && s <= 5}>
              <Label x={240} y={180} size={10.5} dim>BIOS POST</Label>
              {POST.map((t, i) => (
                <Label key={t} x={252} y={200 + i * 18} size={11} on={s >= 2} delay={s === 2 ? 0.35 * i : 0} dim={s !== 2}>{`+ ${t}`}</Label>
              ))}
            </Appear>
            <Appear on={s >= 6}>
              <Label x={240} y={180} size={10.5} dim>BOOTLOADER (e.g. GRUB)</Label>
              {LOADER.map((t, i) => (
                <Label key={t} x={252} y={200 + i * 18} size={11} on={s >= 6 && (i < 3 || s === 7)} delay={s === 6 ? 0.4 * i : 0} dim={s === 7 && i < 3}>{`+ ${t}`}</Label>
              ))}
            </Appear>

            {/* boot devices */}
            <Label x={30} y={292} size={10.5} dim>BOOT ORDER (CMOS)</Label>
            <Block x={30} y={300} w={110} h={50} label="1 floppy" sub={s >= 3 ? 'no disk' : undefined} size={12} state="dim" />
            <Block x={155} y={300} w={110} h={50} label="2 CD-ROM" sub={s >= 3 ? 'no disk' : undefined} size={12} state="dim" />
            <Block x={280} y={300} w={130} h={50} label="3 hard disk" sub={s >= 3 ? 'bootable' : undefined} size={12}
              state={s === 3 || s === 4 || s === 6 ? 'on' : s < 3 ? 'dim' : 'off'} />
            <Packet on={s === 3} points={[[85, 362], [210, 362], [345, 362]]} duration={2.2} r={4} />

            {/* sector 0 */}
            <Appear on={s >= 4}>
              <Label x={30} y={378} size={10.5} dim>SECTOR 0 · 512 BYTES</Label>
              <Block x={30} y={386} w={300} h={26} label="boot code" size={11} state={s === 4 ? 'on' : 'off'} />
              <Block x={330} y={386} w={80} h={26} label="table" size={11} state="dim" />
              <Block x={410} y={386} w={30} h={26} label="55" mono size={11} state={s === 5 ? 'fill' : 'off'} />
              <Block x={440} y={386} w={30} h={26} label="AA" mono size={11} state={s === 5 ? 'fill' : 'off'} />
              <Label x={30} y={426} size={10.5} dim>0</Label>
              <Label x={330} y={426} size={10.5} dim anchor="middle">446</Label>
              <Label x={410} y={426} size={10.5} dim anchor="middle">510</Label>
              <Label x={470} y={426} size={10.5} dim anchor="end">512</Label>
            </Appear>
            <Pulse x={440} y={399} on={s === 5} r={16} />

            {/* address space */}
            <Label x={MX + MW} y={46} size={10.5} anchor="end" dim>ADDRESS SPACE (not to scale)</Label>
            <Block x={MX} y={60} w={MW} h={36} label="firmware ROM" sub="0xFFFFFFF0" size={12} state={rom} />
            <motion.g initial={false} animate={{ opacity: s < 2 ? 0.35 : 0.8 }}>
              <Block x={MX} y={96} w={MW} h={34} state="hatch" />
              <Label x={MX + MW / 2} y={117} anchor="middle" size={11} dim>…</Label>
              <Block x={MX} y={190} w={MW} h={32} label="video + ROMs" size={11} state="hatch" />
            </motion.g>
            <Block x={MX} y={130} w={MW} h={60} label="kernel" sub="above 1 MiB" size={13} state={kern} />
            <Block x={MX} y={222} w={MW} h={16} label="EBDA" size={10.5} state={free === 'dim' ? 'dim' : 'hatch'} />
            <Block x={MX} y={238} w={MW} h={24} label="free" size={11} state={free} />
            <Block x={MX} y={262} w={MW} h={38} label="boot sector" size={12} state={boot} />
            <Block x={MX} y={300} w={MW} h={30} label="free" size={11} state={free} />
            <Block x={MX} y={330} w={MW} h={36} label="IVT + BDA" size={12} state={ivt} />
            {([[190, '0x100000'], [222, '0xA0000'], [238, '0x80000'], [262, '0x7E00'], [300, '0x7C00'], [330, '0x0500'], [366, '0x0000']] as const).map(([y, t]) => (
              <Label key={t} x={MX - 8} y={y + 4} size={10} anchor="end" dim>{t}</Label>
            ))}

            {/* data and control flow */}
            <Packet on={s === 2} points={[[470, 130], [520, 130], [520, 348], [638, 348]]} duration={2} label="IVT" />
            <Wire d="M410 338 L565 338 L565 281 L638 281" on={s >= 4} dim={s > 5} />
            <Packet on={s === 4} points={[[410, 338], [565, 338], [565, 281], [632, 281]]} duration={1.8} />
            <Label x={487} y={331} size={10.5} anchor="middle" on={s === 4}>512 B</Label>
            <Packet on={s === 5} points={[[640, 281], [520, 272], [200, 272], [110, 272], [110, 210]]} duration={2.2} label="jmp 0x7C00" />
            <Wire d="M410 320 L545 320 L545 160 L638 160" on={s >= 6} dim={s > 6} />
            <Packet on={s === 6} points={[[410, 320], [545, 320], [545, 160], [638, 160]]} duration={2} label="kernel" />
            <Packet on={s === 7} points={[[640, 160], [215, 160], [215, 185], [192, 185]]} duration={1.8} label="call" />
            <Pulse x={110} y={185} on={s === 7} r={20} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
