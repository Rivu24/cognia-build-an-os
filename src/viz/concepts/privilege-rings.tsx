/* Privilege rings on x86: CPL comes from CS, DPL guards segments, gates and (via U/S) pages.
   Values follow the GDT Tutorial / Getting to Ring 3 layout: user code 0x1B (RPL 3), kernel code 0x08.
   Exception numbers from the Exceptions article: #GP = 13, #PF = 14. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'privilege-rings',
  title: 'Privilege rings: ring 0 vs ring 3',
  summary: 'How the CPU knows the current privilege level from CS, checks it against DPL and the page U/S bit, faults on violations, and lets ring 3 in only through gates.',
  lessons: ['t8m1l1', 't4m2l1'],
  articles: ['Security', 'Getting to Ring 3', 'System Calls', 'Paging'],
  group: 'User space',
  order: 811,
}

const steps: VizStep[] = [
  { caption: 'x86 has four privilege rings: 0 is the most trusted, 3 the least.', detail: 'Rings decide which instructions may run and, together with segmentation and paging, which memory may be touched.' },
  { caption: 'Most kernels use two: the kernel in ring 0, programs in ring 3.', detail: 'Rings 1 and 2 are rarely needed, and many architectures only have two levels. Ring 3 is also called userland or user space.' },
  { caption: 'The current level (CPL) is the low two bits of CS.', detail: 'A program running with CS = 0x1B (user code, entry 3, RPL 3) has CPL 3. The kernel runs with CS = 0x08: CPL 0.' },
  { caption: 'Segments, gates and pages each carry the level they require.', detail: 'Descriptors have a DPL (0 to 3). IDT gates have a DPL too. Page entries have a U/S bit: 0 means supervisor only.' },
  { caption: 'Ring 3 executes cli → General Protection Fault (#GP, 13).', detail: 'cli, hlt, lgdt, mov cr3 need ring 0 (cli/sti also depend on IOPL). The CPU refuses and jumps to the kernel\'s #GP handler.' },
  { caption: 'Ring 3 touches a page with U/S = 0 → Page Fault (#PF, 14).', detail: 'The page is supervisor-only. The CPU raises #PF before the access happens; the kernel decides whether to kill the program.' },
  { caption: 'The only way in: a gate the kernel opened, e.g. int 0x80 (DPL 3).', detail: 'Because the gate\'s DPL is 3, ring 3 may use it. The CPU takes CS = 0x08 from the gate and the kernel stack from TSS.ESP0: now CPL 0.' },
  { caption: 'The kernel does the work, then iret drops back to ring 3.', detail: 'iret pops the saved EIP, CS (0x1B), EFLAGS, ESP and SS. The program continues at CPL 3, exactly where it left off.', ms: 3800 },
]

const CS_USER = '0000000000011011'
const CS_KERN = '0000000000001000'

/* rings drawn as nested rectangles with a wide top band for user programs */
const R3 = { x: 30, y: 46, w: 360, h: 384 }
const R2 = { x: 70, y: 140, w: 280, h: 270 }
const R1 = { x: 95, y: 170, w: 230, h: 220 }
const R0 = { x: 120, y: 200, w: 180, h: 170 }

const GX = 262 /* x of the syscall gate */

const CHECKS = [
  { what: 'kernel data segment', need: 'DPL 0' },
  { what: 'IDT gate 0x80 (syscall)', need: 'DPL 3' },
  { what: 'kernel page (PTE)', need: 'U/S 0' },
  { what: 'cli · hlt · lgdt · mov cr3', need: 'CPL 0' },
]

const STATUS: [string, string][] = [
  ['4 levels', '0 = most privileged'],
  ['ring 0 kernel · ring 3 apps', 'rings 1 and 2 unused'],
  ['CPL = CS & 3 = 3', 'this program runs in ring 3'],
  ['ring 3 may use only level-3 things', 'DPL 3 / U/S 1'],
  ['#GP · exception 13', 'cli at CPL 3'],
  ['#PF · exception 14', 'user access to a U/S = 0 page'],
  ['int 0x80 → CPL 0', 'CS = 0x08 from gate · stack = TSS.ESP0'],
  ['iret → CPL 3', 'CS = 0x1B again'],
]

function checkState(s: number, i: number): 'on' | 'off' | 'dim' {
  if (s < 3) return 'off'
  if (s === 3) return 'on'
  if (s === 4) return i === 3 ? 'on' : 'dim'
  if (s === 5) return i === 2 ? 'on' : 'dim'
  if (s === 6) return i === 1 ? 'on' : 'dim'
  return 'dim'
}

export default function PrivilegeRings() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const inKernel = s === 6
        const [st, sub] = STATUS[s]
        return (
          <Scene label={meta.summary}>
            <Label x={30} y={30} size={11} dim>PRIVILEGE RINGS (x86)</Label>

            {/* ── rings ── */}
            <Block {...R3} state={s === 0 || s === 2 ? 'on' : 'off'} />
            <Block {...R2} state={s >= 1 ? 'hatch' : 'off'} />
            <Block {...R1} state={s >= 1 ? 'hatch' : 'off'} />
            <Block {...R0} state={s === 0 || s === 1 || inKernel ? 'on' : 'off'} />
            <Label x={38} y={64} size={11} weight={500}>RING 3 · user space</Label>
            <Label x={78} y={159} size={10.5} dim>{s >= 1 ? 'RING 2 · unused' : 'RING 2'}</Label>
            <Label x={103} y={189} size={10.5} dim>{s >= 1 ? 'RING 1 · unused' : 'RING 1'}</Label>
            <Label x={128} y={219} size={11} weight={500}>RING 0 · kernel</Label>

            {/* gate opening through the ring walls (step 6+) */}
            {[R2.y, R1.y, R0.y].map((y, i) => (
              <motion.g key={i} initial={false} animate={{ opacity: s >= 6 ? 1 : 0 }} transition={{ ...ease, delay: i * 0.15 }}>
                <rect x={GX - 14} y={y - 3} width={28} height={6} fill="var(--viz-bg)" />
                <line x1={GX - 14} x2={GX - 14} y1={y - 6} y2={y + 6} stroke="var(--viz-fg)" strokeWidth={2} />
                <line x1={GX + 14} x2={GX + 14} y1={y - 6} y2={y + 6} stroke="var(--viz-fg)" strokeWidth={2} />
              </motion.g>
            ))}

            {/* programs */}
            <Appear on={s >= 1}>
              <Block x={70} y={76} w={110} h={32} label="app A" size={12} state={s === 2 || s === 4 ? 'on' : s >= 5 ? 'dim' : 'off'} />
              <Block x={240} y={76} w={110} h={32} label="app B" size={12} state={s >= 5 ? 'on' : s >= 2 ? 'dim' : 'off'} />
            </Appear>

            {/* kernel */}
            <Appear on={s >= 1}>
              <Block x={140} y={236} w={140} h={54} label="kernel" sub={inKernel ? 'running syscall' : 'CPL 0'} size={13} state={inKernel ? 'fill' : 'off'} />
              <Block x={140} y={306} w={140} h={44} label="kernel page" sub="U/S = 0" size={12} state={s === 5 ? 'on' : s >= 3 ? 'off' : 'dim'} />
            </Appear>

            {/* #GP: cli bounces at the ring wall */}
            <Label x={110} y={128} size={11} weight={500} on={s === 4}>cli</Label>
            <Packet on={s === 4} points={[[125, 108], [125, 138], [125, 108]]} duration={1.1} />
            <Cross x={125} y={140} on={s === 4} />
            {/* #PF: user access to supervisor page */}
            <Label x={296} y={128} size={11} weight={500} on={s === 5}>mov [kpage]</Label>
            <Packet on={s === 5} points={[[290, 108], [290, 138], [290, 108]]} duration={1.1} />
            <Cross x={290} y={140} on={s === 5} />

            {/* syscall through the gate */}
            <Wire from={s === 7 ? [GX, 234] : [GX, 110]} to={s === 7 ? [GX, 112] : [GX, 234]} on={s >= 6} dashed />
            <Label x={GX + 8} y={128} size={10.5} on={s >= 6}>{s === 7 ? 'iret' : 'int 0x80'}</Label>
            <Packet on={s === 6} points={[[GX, 108], [GX, 236]]} duration={1.4} />
            <Packet on={s === 7} points={[[GX, 236], [GX, 108]]} duration={1.4} />

            {/* ── CS / CPL ── */}
            <Appear on={s >= 2}>
            <Label x={430} y={40} size={13} weight={500}>{inKernel ? 'CS = 0x0008 → CPL 0' : 'CS = 0x001B → CPL 3'}</Label>
            <BitField x={430} y={62} bits={inKernel ? CS_KERN : CS_USER} cellW={21} h={24}
              fields={[[0, 13, 'index'], [13, 1, 'TI'], [14, 2, inKernel ? 'CPL=0' : 'CPL=3']]} active={s === 2 || s >= 6 ? 2 : undefined} />
            </Appear>
            <Pulse x={745} y={74} on={s === 2} r={16} />

            {/* ── what the CPU checks ── */}
            <Appear on={s >= 3}>
              <Label x={430} y={140} size={11} dim>WHAT EACH THING REQUIRES</Label>
              {CHECKS.map((c, i) => (
                <g key={i}>
                  <Block x={430} y={150 + i * 40} w={340} h={36} state={checkState(s, i)} />
                  <Label x={442} y={173 + i * 40} size={12} mono={i === 3} weight={500}>{c.what}</Label>
                  <Label x={758} y={173 + i * 40} size={12} anchor="end" weight={500}>{c.need}</Label>
                </g>
              ))}
            </Appear>

            {/* ── status ── */}
            <Block x={430} y={334} w={340} h={76} label={st} sub={sub} size={14} state={s >= 4 ? 'on' : 'off'} />
          </Scene>
        )
      }}
    </VizStage>
  )
}

/** An X that marks a blocked access. */
function Cross({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.4 }} transition={ease} style={{ transformOrigin: `${x}px ${y}px` }}>
      <line x1={x - 7} y1={y - 7} x2={x + 7} y2={y + 7} stroke="var(--viz-fg)" strokeWidth={2.4} />
      <line x1={x - 7} y1={y + 7} x2={x + 7} y2={y - 7} stroke="var(--viz-fg)" strokeWidth={2.4} />
    </motion.g>
  )
}
