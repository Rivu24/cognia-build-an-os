/* SMP bring-up: MADT lists the local APICs, the BSP copies a trampoline to 0x8000 and wakes each AP with
   INIT, a 10 ms wait and two STARTUP IPIs (vector 0x08 → 0x08 × 4 KiB = 0x8000). Values follow the
   "Symmetric Multiprocessing" example code (ICR at LAPIC base + 0x300 / 0x310, 32 KiB stack per core). */
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'apic-smp-boot',
  title: 'SMP boot: INIT, SIPI and the trampoline',
  summary: 'How the bootstrap processor finds the other cores in the MADT, copies a trampoline to 0x8000 and wakes each one with INIT and STARTUP IPIs through its local APIC.',
  lessons: ['t11m4l2', 't11m4l1', 't11m2l1'],
  articles: ['Symmetric Multiprocessing', 'APIC', 'MADT'],
  group: 'Platform',
  order: 1140,
}

const steps: VizStep[] = [
  { caption: 'The MADT lists one local APIC per core: here APIC IDs 0 to 3.', detail: 'MADT entry type 0 = processor local APIC (with flags bit 0 = enabled). The table also gives the LAPIC address, usually 0xFEE00000.' },
  { caption: 'Only the bootstrap processor (BSP) runs. The other cores (APs) wait.', detail: 'Firmware picks one core to run the boot code. Every AP sits halted until the BSP sends it an inter-processor interrupt (IPI).' },
  { caption: 'The BSP copies the AP trampoline code to physical 0x8000.', detail: 'An AP starts in 16-bit real mode, so its first code must sit below 1 MiB on a 4 KiB boundary: memcpy((void*)0x8000, &ap_trampoline, 4096).' },
  { caption: 'INIT IPI: write the AP ID to ICR 0x310, then 0x00004500 to 0x300.', detail: 'IPIs go out through the BSP\'s own LAPIC. INIT resets the AP into a wait-for-SIPI state. Then wait 10 ms.' },
  { caption: 'STARTUP IPI with vector 0x08: the AP will start at 0x8000.', detail: 'ICR low = 0x00004600 | page number. Page 0x08 × 4096 = 0x8000. The example sends the SIPI twice, 200 µs apart.', ms: 3800 },
  { caption: 'The AP wakes in real mode at 0x8000 and climbs to protected mode.', detail: 'Trampoline: cli, load a GDT, set CR0.PE, far jump to 32-bit code. A 64-bit kernel continues on into long mode.', ms: 4000 },
  { caption: 'Each AP gets its own stack and its own per-CPU data.', detail: 'Two cores must never share a stack. The example uses stack_top − (APIC ID << 15): 32 KiB per core, picked by its APIC ID.' },
  { caption: 'The BSP repeats INIT + SIPI for AP 2 and AP 3, then sets bspdone = 1.', detail: 'Each AP spins until bspdone, then does lock inc aprunning and enters ap_startup(). Never broadcast INIT or SIPI: that can wake disabled cores.', ms: 3800 },
  { caption: 'Every core programs its LAPIC timer and joins the scheduler.', detail: 'LVT timer at 0x320 (vector), initial count at 0x380, current count at 0x390, divide at 0x3E0. Each core now gets its own ticks.', ms: 4000 },
]

const CX = (i: number) => 250 + i * 136 // CPU x
const MADT = ['header · \'APIC\'', 'LAPIC addr 0xFEE00000', 'type 0 · APIC ID 0', 'type 0 · APIC ID 1', 'type 0 · APIC ID 2', 'type 0 · APIC ID 3', 'type 1 · I/O APIC']
const CHAIN = ['16-bit real mode @ 0x8000', 'lgdt, CR0.PE = 1 → 32-bit', 'long mode (64-bit kernels)', 'own stack → wait bspdone']

export default function ApicSmpBoot() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const cpuSub = (i: number) => {
          if (s === 0) return `APIC ID ${i}`
          if (s === 8) return 'scheduler · ticks'
          if (i === 0) return 'BSP · kernel'
          if (i === 1) return s <= 2 ? 'AP · halted' : s === 3 ? 'INIT: reset' : s === 4 ? 'SIPI → 0x8000' : s <= 6 ? 'trampoline' : 'running'
          return s <= 6 ? 'AP · halted' : 'running'
        }
        const cpuState = (i: number) => {
          if (s === 0) return 'off'
          if (i === 0) return [1, 2, 3, 4, 7].includes(s) ? 'on' : 'off'
          if (i === 1) return s <= 2 ? 'dim' : s <= 4 ? 'off' : s <= 6 ? 'on' : 'off'
          return s <= 6 ? 'dim' : s === 7 ? 'on' : 'off'
        }
        const icrHigh = s === 8 ? '0x310 ICR high' : s === 7 ? '0x310 = ID << 24 (AP 2, 3)' : s >= 3 ? '0x310 = 1 << 24 (AP 1)' : '0x310 ICR high'
        const icrLow = s === 3 ? '0x300 = 0x00004500 INIT' : s >= 4 && s <= 7 ? '0x300 = 0x00004608 SIPI' : '0x300 ICR low'
        const ipi = (to: number, label: string, delay = 0) => (
          <Packet key={`${to}-${delay}-${label}`} on duration={1.4} delay={delay}
            points={[[CX(0) + 60, 136], [CX(0) + 60, 158], [CX(to) + 60, 158], [CX(to) + 60, 138]]} />
        )
        return (
          <Scene label={meta.summary}>
            {/* MADT */}
            <Label x={20} y={32} size={11} dim>MADT (ACPI TABLE 'APIC')</Label>
            {MADT.map((t, i) => (
              <Block key={i} x={20} y={42 + i * 28} w={210} h={28} mono size={11} align="start" label={t}
                state={s === 0 && i >= 2 && i <= 5 ? 'on' : s === 0 || (s === 3 && i === 1) ? 'off' : 'dim'} />
            ))}

            {/* LAPIC registers of the BSP */}
            <Label x={20} y={270} size={11} dim>BSP LAPIC REGISTERS</Label>
            <Block x={20} y={280} w={210} h={30} mono size={11} align="start" label={icrHigh} state={s >= 3 && s <= 4 ? 'on' : s === 7 ? 'on' : 'off'} />
            <Block x={20} y={310} w={210} h={30} mono size={11} align="start" label={icrLow} state={s >= 3 && s <= 4 ? 'on' : s === 7 ? 'on' : 'off'} />
            <Block x={20} y={340} w={210} h={30} mono size={11} align="start" label="0x320 LVT timer: vector" state={s === 8 ? 'on' : 'dim'} />
            <Block x={20} y={370} w={210} h={30} mono size={11} align="start" label="0x380 timer initial count" state={s === 8 ? 'on' : 'dim'} />
            <Label x={20} y={420} size={11} on={s === 3}>then wait 10 ms (mdelay(10))</Label>
            <Label x={20} y={420} size={11} on={s === 4}>twice · page 0x08 → 0x8000</Label>
            <Label x={20} y={420} size={11} on={s === 8}>every core: its own LAPIC timer</Label>

            {/* CPUs and their local APICs */}
            {[0, 1, 2, 3].map((i) => (
              <Appear key={i} on delay={0}>
                <Block x={CX(i)} y={40} w={120} h={62} label={`CPU ${i}`} sub={cpuSub(i)} state={cpuState(i)} />
                <Block x={CX(i) + 10} y={110} w={100} h={26} label={`LAPIC ${i}`} mono size={11} state={s === 8 ? 'on' : cpuState(i) === 'dim' ? 'dim' : 'off'} />
                <line x1={CX(i) + 60} x2={CX(i) + 60} y1={136} y2={158} stroke="var(--viz-faint)" />
                <Pulse x={CX(i) + 60} y={123} on={s === 8} r={18} />
              </Appear>
            ))}
            <line x1={CX(0) + 10} x2={CX(3) + 110} y1={158} y2={158} stroke="var(--viz-dim)" />
            <Label x={260} y={176} size={11} on={s === 3}>INIT IPI → AP 1</Label>
            <Label x={260} y={176} size={11} on={s === 4}>STARTUP IPI × 2, vector 0x08 → AP 1</Label>
            <Label x={260} y={176} size={11} on={s === 7}>INIT + 2 × SIPI → AP 2, then AP 3</Label>
            <Label x={CX(3) + 110} y={176} size={10.5} anchor="end" dim>APIC bus / system interconnect</Label>
            {[0, 1, 2, 3].map((i) => <Pulse key={i} x={CX(i) + 60} y={71} on={s === 0} />)}
            {s === 3 && ipi(1, 'INIT')}
            {s === 4 && [ipi(1, 'SIPI 0x08'), ipi(1, 'SIPI 0x08', 0.75)]}
            {s === 7 && [ipi(2, 'INIT · SIPI'), ipi(3, 'INIT · SIPI', 0.7)]}

            {/* physical memory */}
            <Label x={250} y={200} size={11} dim>PHYSICAL MEMORY</Label>
            <Block x={250} y={210} w={230} h={40} label="kernel (BSP)" size={12} state={s === 2 ? 'on' : 'off'} />
            <Block x={250} y={250} w={230} h={40} label="AP stacks · 32 KiB each" size={12} state={s === 6 ? 'on' : s >= 6 ? 'off' : 'dim'} />
            <Block x={250} y={290} w={230} h={36} label="per-CPU data × 4" size={12} state={s === 6 ? 'on' : s >= 6 ? 'off' : 'dim'} />
            <Block x={250} y={326} w={230} h={30} state="hatch" />
            <Block x={250} y={356} w={230} h={36} label="0x8000 trampoline" mono size={12} state={s === 2 || s === 5 ? 'on' : s > 2 ? 'off' : 'dim'} />
            <Block x={250} y={392} w={230} h={28} state="hatch" />
            <Packet on={s === 2} duration={2} label="memcpy 4 KiB" points={[[365, 230], [240, 230], [240, 374], [300, 374]]} />
            <Packet on={s === 5} duration={2} points={[[400, 374], [496, 374], [496, 172], [CX(1) + 60, 172], [CX(1) + 60, 104]]} />

            {/* the AP's climb */}
            <Label x={520} y={200} size={11} dim on={s >= 5}>AP 1 RUNS THE TRAMPOLINE</Label>
            {CHAIN.map((t, i) => (
              <Appear key={i} on={s >= 5} delay={s === 5 ? i * 0.5 : 0} dy={10}>
                <Block x={520} y={210 + i * 52} w={260} h={40} label={t} mono size={11.5}
                  state={s === 5 ? (i <= 2 ? 'on' : 'dim') : s === 6 ? (i === 3 ? 'on' : 'off') : 'off'} />
              </Appear>
            ))}
            {[0, 1, 2].map((i) => <Wire key={i} from={[650, 250 + i * 52]} to={[650, 260 + i * 52]} on={s >= 5} delay={s === 5 ? i * 0.5 + 0.3 : 0} />)}
            <Wire from={[650, 406]} to={[650, 414]} on={s >= 7} />
            <Label x={650} y={428} size={11} anchor="middle" on={s >= 7}>lock inc aprunning → ap_startup()</Label>
            <Label x={20} y={420} size={11} on={s === 7}>bspdone = 1 · aprunning = 3</Label>
          </Scene>
        )
      }}
    </VizStage>
  )
}
