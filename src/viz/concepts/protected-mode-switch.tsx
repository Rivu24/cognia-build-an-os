/* Real mode -> protected mode (Protected Mode, Real Mode, CPU Registers x86, GDT Tutorial, Bare Bones, GRUB).
   Sequence from the Protected Mode article: cli; lgdt [gdtr]; mov eax, cr0; or al, 1; mov cr0, eax; jmp 08h:PModeMain;
   then load DS, ES, FS, GS, SS, ESP. CR0 bit 0 = PE, bit 31 = PG. Selector 0x08 = GDT entry 1, 0x10 = entry 2.
   Real-mode address example: 0x12F3:0x4B27 -> 0x12F30 + 0x4B27 = 0x17A57. After Multiboot: 32-bit PM, paging off,
   interrupts off, EAX = 0x2BADB002; GRUB article: define your own GDT. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'protected-mode-switch',
  title: 'Switching from real mode to protected mode',
  summary: 'Why real mode is limited, and the exact switch: cli, lgdt, set CR0.PE, far jump to load CS, reload the data segments, plus what GRUB has already done for you.',
  lessons: ['t3m2l3', 't4m2l1'],
  articles: ['Protected Mode', 'Real Mode', 'GDT Tutorial', 'Bare Bones'],
  group: 'CPU',
  order: 323,
}

const steps: VizStep[] = [
  { caption: 'When your boot sector runs, the CPU is in real mode: 16-bit, 1 MiB, no protection.', detail: 'Addresses are segment × 16 + offset: 0x12F3:0x4B27 → 0x17A57. Any code can touch any memory or port. Segments shown = 0, as a boot sector usually sets them.' },
  { caption: 'cli turns interrupts off, so nothing runs in the middle of the switch.', detail: 'The article also says to disable NMI and to enable the A20 line before going further.' },
  { caption: 'lgdt [gdtr] tells the CPU where the GDT is: null, code and data descriptors.', detail: 'GDTR holds the table size − 1 (3 × 8 − 1 = 23) and its address. Selector 0x08 = entry 1, 0x10 = entry 2.' },
  { caption: 'Set CR0.PE, bit 0: mov eax, cr0; or al, 1; mov cr0, eax.', detail: 'Read, set one bit, write back: the other CR0 bits keep their values. PE = 1, but CS still holds an old real-mode value.', ms: 3800 },
  { caption: 'jmp 0x08:PModeMain: a far jump loads CS with the code selector.', detail: 'It also throws away instructions already fetched as 16-bit code. From here the CPU decodes 32-bit code.' },
  { caption: 'Reload DS, ES, FS, GS and SS with the data selector 0x10, then set ESP.', detail: 'Each load makes the CPU read that descriptor from the GDT and cache its base, limit and access rights.' },
  { caption: 'Now in 32-bit protected mode: 4 GiB address space, rings and limit checks.', detail: 'BIOS interrupts such as int 0x10 stop working: they are real-mode code.' },
  { caption: 'With GRUB (Multiboot), all of this is already done when your kernel starts.', detail: "You get 32-bit protected mode, paging off, interrupts off and EAX = 0x2BADB002. Load your own GDT soon; do not rely on GRUB's.", ms: 4200 },
]

const CODE: { t: string; label?: boolean; note?: string }[] = [
  { t: 'cli', note: '16-bit' },
  { t: 'lgdt [gdtr]' },
  { t: 'mov eax, cr0' },
  { t: 'or  al, 1' },
  { t: 'mov cr0, eax' },
  { t: 'jmp 0x08:PModeMain' },
  { t: 'PModeMain:', label: true, note: '32-bit' },
  { t: 'mov ax, 0x10' },
  { t: 'mov ds, ax', note: 'es, fs, gs' },
  { t: 'mov ss, ax' },
  { t: 'mov esp, stack_top' },
]
const CY = 64
const LH = 21
const lineY = (i: number) => CY + i * LH
const RUN: number[][] = [[], [0], [1], [2, 3, 4], [5], [7, 8, 9, 10], [], []]

const SEG = ['CS', 'DS', 'ES', 'SS']
const SGX = 300
const SGY = 232
const SGH = 26

function Val({ x, y, v, size = 12, anchor = 'end', weight = 500, dim }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>{v}</text>
    </motion.g>
  )
}

export default function ProtectedModeSwitch() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const pe = s >= 3
        const pm = s >= 4
        const grub = s === 7
        const bits = Array.from({ length: 32 }, (_, i) => (i === 0 ? '0' : i === 31 ? (pe ? '1' : '0') : '·'))
        const segVal = (r: string) => (grub ? 'by GRUB' : r === 'CS' ? (s >= 4 ? '0x0008' : '0x0000') : s >= 5 ? '0x0010' : '0x0000')
        const segHot = (r: string) => (r === 'CS' ? s === 4 : s === 5)
        const banner = pe && !pm ? ['PE = 1, CS not reloaded', 'still running 16-bit code'] : pm ? ['PROTECTED MODE', grub ? '32-bit · set up by GRUB' : '32-bit · 4 GiB · rings + checks'] : ['REAL MODE', '16-bit · 1 MiB · no protection']
        return (
          <Scene label={meta.summary}>
            {/* ---------- code ---------- */}
            <Label x={20} y={44} size={11} dim>{grub ? 'CODE (GRUB ALREADY DID THIS)' : 'CODE'}</Label>
            <motion.g initial={false} animate={{ opacity: grub ? 0.35 : 1 }} transition={ease}>
              {CODE.map((l, i) => {
                const active = RUN[s].includes(i)
                return (
                  <g key={i}>
                    <motion.rect x={20} y={lineY(i) - 14} width={250} height={LH - 2} initial={false} animate={{ opacity: active ? 1 : 0 }} transition={ease} fill="var(--viz-fg)" />
                    <motion.text x={l.label ? 28 : 40} y={lineY(i)} initial={false} animate={{ fill: active ? 'var(--viz-bg)' : 'var(--viz-fg)' }} transition={ease}
                      style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: l.label ? 600 : 400 }}>{l.t}</motion.text>
                    {l.note && (
                      <motion.text x={262} y={lineY(i)} textAnchor="end" initial={false} animate={{ fill: active ? 'var(--viz-bg)' : 'var(--viz-dim)' }} transition={ease}
                        style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>; {l.note}</motion.text>
                    )}
                  </g>
                )
              })}
            </motion.g>

            {/* ---------- info box ---------- */}
            <Block x={20} y={300} w={250} h={134} state={s === 0 || s === 6 || grub ? 'on' : 'off'} />
            <Appear on={s <= 3}>
              <Label x={32} y={320} size={10.5} dim>REAL-MODE ADDRESS</Label>
              <Label x={32} y={344} size={12}>segment × 16 + offset</Label>
              <Label x={32} y={372} size={13} weight={600}>0x12F3:0x4B27</Label>
              <Label x={32} y={392} size={12}>= 0x12F30 + 0x4B27</Label>
              <Label x={32} y={414} size={13} weight={600}>= 0x17A57</Label>
            </Appear>
            <Appear on={s >= 4 && s <= 6}>
              <Label x={32} y={320} size={10.5} dim>PROTECTED-MODE ADDRESS</Label>
              <Label x={32} y={344} size={12}>selector → descriptor</Label>
              <Label x={32} y={362} size={12}>base + offset</Label>
              <Label x={32} y={390} size={13} weight={600}>0x08:0x00100000</Label>
              <Label x={32} y={412} size={12}>= 0 + 0x00100000 (flat)</Label>
            </Appear>
            <Appear on={grub}>
              <Label x={32} y={320} size={10.5} dim>AFTER GRUB (MULTIBOOT)</Label>
              <Label x={32} y={342} size={12}>32-bit protected mode</Label>
              <Label x={32} y={360} size={12}>paging off (PG = 0)</Label>
              <Label x={32} y={378} size={12}>interrupts off (IF = 0)</Label>
              <Label x={32} y={396} size={12} weight={600}>EAX = 0x2BADB002</Label>
              <Label x={32} y={420} size={12}>→ load your own GDT</Label>
            </Appear>

            {/* ---------- mode banner + IF ---------- */}
            <Block x={300} y={40} w={290} h={56} state={s === 0 || s === 6 || grub ? 'on' : s === 3 ? 'on' : 'off'} />
            <Val x={445} y={64} v={banner[0]} size={15} anchor="middle" weight={600} />
            <Val x={445} y={84} v={banner[1]} size={11} anchor="middle" weight={400} dim />
            <Block x={604} y={40} w={176} h={56} state={s === 1 ? 'on' : 'off'} />
            <Val x={692} y={64} v={s >= 1 ? 'IF = 0' : 'IF = 1'} size={15} anchor="middle" weight={600} />
            <Val x={692} y={84} v={s >= 1 ? 'interrupts off' : 'interrupts on'} size={11} anchor="middle" weight={400} dim />

            {/* ---------- CR0 ---------- */}
            <Label x={300} y={118} size={11} dim>CR0 (· = other bits, left as they are)</Label>
            <BitField x={300} y={138} cellW={15} h={26} bits={bits} fields={[[0, 1, ''], [31, 1, '']]} active={pe ? 1 : undefined} showIndex={false} />
            <Label x={300} y={132} size={10.5} dim>31</Label>
            <Label x={780} y={132} size={10.5} dim anchor="end">0</Label>
            <Label x={300} y={186} size={10.5} dim>PG (bit 31): paging, still off</Label>
            <Label x={780} y={186} size={10.5} anchor="end" weight={pe ? 600 : 400} dim={!pe}>{pe ? 'PE (bit 0): protection on' : 'PE (bit 0): off'}</Label>
            <Pulse x={772} y={151} on={s === 3} />

            {/* ---------- segment registers ---------- */}
            <Label x={SGX} y={SGY - 12} size={11} dim>SEGMENT REGS</Label>
            {SEG.map((r, i) => (
              <g key={r}>
                <Block x={SGX} y={SGY + i * SGH} w={100} h={SGH} label={r} mono size={12} align="start" state={segHot(r) ? 'on' : grub ? 'dim' : 'off'} />
                <Val x={SGX + 92} y={SGY + i * SGH + 17} v={segVal(r)} size={11.5} dim={grub} />
              </g>
            ))}
            <Label x={SGX} y={SGY + 4 * SGH + 15} size={10.5} dim>FS, GS like DS</Label>

            {/* ---------- GDTR and GDT ---------- */}
            <Appear on={s >= 2}>
              <Block x={430} y={SGY} w={130} h={44} label="GDTR" sub="limit 23 · &gdt" mono size={13} state={s === 2 ? 'on' : grub ? 'dim' : 'off'} />
              <Label x={600} y={SGY - 12} size={11} dim>GDT</Label>
              {[['0x00', 'null'], ['0x08', 'code · ring 0'], ['0x10', 'data · ring 0']].map(([sel, d], i) => (
                <g key={sel}>
                  <Block x={600} y={SGY + i * 30} w={180} h={30} state={(s === 4 && i === 1) || (s === 5 && i === 2) ? 'on' : grub ? 'dim' : 'off'} />
                  <Label x={610} y={SGY + i * 30 + 20} size={12} weight={600} dim={grub}>{sel}</Label>
                  <Label x={654} y={SGY + i * 30 + 20} size={12} dim={grub}>{d}</Label>
                </g>
              ))}
              <Label x={600} y={SGY + 3 * 30 + 16} size={10.5} dim>base 0 · limit 4 GiB</Label>
            </Appear>
            <Wire from={[560, SGY + 22]} to={[598, SGY + 15]} on={s >= 2 && !grub} />
            <Wire d={`M400 ${SGY + 13} L420 ${SGY + 13} L420 ${SGY + 54} L580 ${SGY + 54} L580 ${SGY + 45} L598 ${SGY + 45}`} on={s >= 4 && !grub} />
            {/* DS, ES, SS each join one bus that leads to entry 0x10 */}
            {[1, 2, 3].map((i) => (
              <line key={i} x1={400} x2={406} y1={SGY + i * SGH + 13} y2={SGY + i * SGH + 13} stroke="var(--viz-fg)" opacity={s >= 5 && !grub ? 1 : 0} />
            ))}
            <line x1={406} x2={406} y1={SGY + SGH + 13} y2={SGY + 3 * SGH + 13} stroke="var(--viz-fg)" opacity={s >= 5 && !grub ? 1 : 0} />
            <Wire d={`M406 ${SGY + 3 * SGH + 13} L590 ${SGY + 3 * SGH + 13} L590 ${SGY + 75} L598 ${SGY + 75}`} on={s >= 5 && !grub} />

            {/* control flowing */}
            <Packet on={s === 2} points={[[270, lineY(1) - 4], [290, lineY(1) - 4], [290, 200], [495, 200], [495, SGY]]} duration={1.6} label="gdtr" />
            <Packet on={s === 4} points={[[270, lineY(5) - 4], [285, lineY(5) - 4], [285, SGY + 14], [SGX, SGY + 14]]} duration={1.2} label="0x08" />
            <Packet on={s === 4} points={[[400, SGY + 13], [420, SGY + 13], [420, SGY + 54], [580, SGY + 54], [580, SGY + 45], [600, SGY + 45]]} duration={1.6} delay={1.2} r={4} />
            <Packet on={s === 5} points={[[406, SGY + 3 * SGH + 13], [590, SGY + 3 * SGH + 13], [590, SGY + 75], [600, SGY + 75]]} duration={1.4} r={4} label="0x10" />
            <Packet on={s === 3} points={[[270, lineY(3) - 4], [285, lineY(3) - 4], [285, 102], [772, 102], [772, 138]]} duration={1.8} label="or al, 1" />

            {/* ---------- addressable memory ---------- */}
            <Label x={300} y={374} size={11} dim>ADDRESSABLE MEMORY (not to scale)</Label>
            <Block x={300} y={382} w={70} h={30} label="1 MiB" size={12} state={pm ? 'off' : 'on'} />
            <Block x={370} y={382} w={410} h={30} label={pm ? 'up to 4 GiB' : 'out of reach'} size={12} state={pm ? (s === 6 || grub ? 'on' : 'off') : 'hatch'} />
            <Label x={300} y={426} size={10.5} dim>0</Label>
            <Label x={370} y={426} size={10.5} dim anchor="middle">0x100000</Label>
            <Label x={780} y={426} size={10.5} dim anchor="end">0xFFFFFFFF</Label>
          </Scene>
        )
      }}
    </VizStage>
  )
}
