/* Handling a page fault. From "Exceptions" (Page Fault = vector 14, a fault: saved EIP points at the faulting
   instruction; error code bits P W U R I; CR2 = faulting virtual address) and "Paging" (Page Faults / Handling:
   P=0 not present, R/W, U/S, I/D; map memory, set present, iret; INVLPG invalidates one TLB entry).
   Worked example: user write to 0x00804123 = directory 2, table 4, offset 0x123; error code 0b00110 = 0x6. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'page-fault-handling',
  title: 'Page faults: catch, decide, fix, retry',
  summary: 'An access to an unmapped page raises #PF (vector 14) with CR2 and an error code; the handler either reports a bug or maps a frame, flushes the TLB entry and retries.',
  lessons: ['t6m2l4', 't6m2l2'],
  articles: ['Paging', 'Exceptions'],
  group: 'Memory',
  order: 645,
}

const steps: VizStep[] = [
  { caption: 'A user program writes to 0x00804123, but that page is not mapped.', detail: 'Directory index 2, table index 4, offset 0x123. PTE[4] has P = 0 (not present), so the MMU cannot translate the address.' },
  { caption: 'The CPU stops the instruction and raises #PF: exception vector 14.', detail: 'A page fault is a fault, not a trap: the saved EIP points at the faulting instruction itself, so it can run again later.' },
  { caption: 'CR2 now holds the faulting address: 0x00804123.', detail: 'The CPU loads CR2 with the virtual address it could not use. Read it early in your handler (mov eax, cr2), before another fault can overwrite it.' },
  { caption: 'The CPU also pushes an error code that says why.', detail: 'P = 0: page not present. W = 1: a write. U = 1: the CPU was in user mode (CPL 3). I = 1 only for instruction fetches, with NX on. Here: 0b00110 = 0x6.' },
  { caption: 'The handler decides: is this address allowed?', detail: 'Check CR2 against what the process owns: its heap, its stack, files it mapped. The error code tells you whether the access type is allowed there too.' },
  { caption: 'Not allowed: report CR2 and the error code, then stop the culprit.', detail: 'A user process gets killed (on Unix, SIGSEGV). A fault in kernel code on an unmapped address is a kernel bug: print everything and panic.' },
  { caption: 'Allowed: take a free frame and map the page (demand paging).', detail: 'frame = alloc_frame() from the physical allocator, then PTE[4] = frame | P | W | U for the page 0x00804000.' },
  { caption: 'invlpg the page, then iret: the write runs again and succeeds.', detail: 'x86 never caches P=0 entries, so invlpg is just a safe habit here; it is required when you change a mapping that was present. iret goes back to the saved EIP: the write retries, now with P = 1.', ms: 4200 },
]

const BITS: { name: string; v: number; mean: string }[] = [
  { name: 'I', v: 0, mean: 'data access' },
  { name: 'R', v: 0, mean: '' },
  { name: 'U', v: 1, mean: 'user mode' },
  { name: 'W', v: 1, mean: 'write' },
  { name: 'P', v: 0, mean: 'not present' },
]
const YES = ['frame = alloc_frame();', 'PTE[4] = frame | P|W|U;', 'invlpg [0x00804000]  (habit)', 'iret  → retry the write']

export default function PageFaultHandling() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const mapped = s >= 6
        return (
          <Scene label={meta.summary}>
            {/* ---------- user program ---------- */}
            <Label x={30} y={36} size={11} dim>USER PROGRAM</Label>
            <Block x={30} y={44} w={260} h={64} label="mov [0x00804123], eax" mono size={13}
              sub={s === 7 ? 'retried: the write succeeds' : s >= 1 ? 'stopped: EIP stays here' : 'CPL 3'} state={s === 0 || s === 7 ? 'on' : 'off'} />
            <Packet on={s === 0} points={[[160, 76], [290, 76], [330, 86]]} duration={1.4} label="walk" />

            {/* ---------- page table ---------- */}
            <Label x={330} y={36} size={11} dim>PAGE TABLE (via PDE[2])</Label>
            {[
              ['PTE[3]', 'present  P=1'],
              ['PTE[4]', mapped ? '0x00345000 P W U' : 'not present  P=0'],
              ['PTE[5]', 'present  P=1'],
            ].map(([k, v], i) => (
              <g key={i}>
                <Block x={330} y={44 + i * 28} w={210} h={28} state={i === 1 ? (s === 0 || s === 6 ? 'on' : 'off') : 'dim'} />
                <Label x={340} y={63 + i * 28} size={11.5} weight={600} dim={i !== 1}>{k}</Label>
                <Label x={400} y={63 + i * 28} size={11.5} dim={i !== 1}>{v}</Label>
              </g>
            ))}
            <Pulse x={524} y={86} on={s === 0 || s === 6} r={10} />
            <Label x={330} y={146} size={10.5} dim>dir 2 · table 4 · offset 0x123</Label>

            {/* ---------- CPU state: CR2 + error code ---------- */}
            <Label x={570} y={36} size={11} dim>CPU STATE AT THE FAULT</Label>
            <Block x={570} y={44} w={200} h={46} label="CR2" sub={s >= 2 ? '0x00804123' : '—'} mono size={13} state={s === 2 ? 'on' : s < 2 ? 'dim' : 'off'} />
            <Packet on={s === 2} points={[[160, 44], [160, 22], [760, 22], [760, 44]]} duration={1.6} />

            <Appear on={s >= 3}>
              <Label x={570} y={110} size={11} dim>ERROR CODE = 0x6</Label>
              {BITS.map((b, i) => {
                const key = b.name === 'U' || b.name === 'W' || b.name === 'P'
                const hot = s === 3 && key
                return (
                  <g key={b.name}>
                    <Label x={590 + i * 40} y={126} size={11} anchor="middle" weight={600} dim={!key}>{b.name}</Label>
                    <rect x={570 + i * 40} y={132} width={40} height={24} fill={hot ? 'var(--viz-fg)' : 'var(--viz-bg)'}
                      stroke={hot ? 'var(--viz-fg)' : 'var(--viz-faint)'} filter={hot ? 'url(#viz-glow)' : undefined} />
                    <text x={590 + i * 40} y={149} textAnchor="middle" fill={hot ? 'var(--viz-bg)' : 'var(--viz-fg)'}
                      style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{b.v}</text>
                  </g>
                )
              })}
              <Label x={570} y={174} size={10.5} dim={s !== 3}>user · write · not present</Label>
            </Appear>

            {/* ---------- #PF -> handler ---------- */}
            <Wire d="M120 108 L120 221 L288 221" on={s >= 1} dim={s > 1} />
            <Label x={128} y={150} size={11} weight={600} on={s >= 1}>#PF · vector 14</Label>
            <Packet on={s === 1} points={[[120, 108], [120, 221], [290, 221]]} duration={1.4} />

            <Appear on={s >= 1}>
              <Block x={290} y={196} w={220} h={50} label="page_fault_handler()" sub="IDT[14]" mono size={12.5} state={s === 1 ? 'on' : 'off'} />
            </Appear>
            <Wire from={[400, 246]} to={[400, 272]} on={s >= 4} />
            <Appear on={s >= 4}>
              <Block x={290} y={274} w={220} h={44} label="is CR2 a valid address?" size={13} state={s === 4 ? 'on' : 'off'} />
            </Appear>
            <Pulse x={400} y={296} on={s === 4} r={18} />

            {/* no: a bug */}
            <Wire d="M290 296 L150 296 L150 338" on={s >= 5} dim={s !== 5} />
            <Label x={220} y={288} size={11} anchor="middle" on={s >= 5} weight={600}>no</Label>
            <Appear on={s >= 5}>
              <motion.g initial={false} animate={{ opacity: s === 5 ? 1 : 0.45 }} transition={ease}>
                <Block x={30} y={340} w={240} h={70} label="print CR2 + error code" sub="then kill the task or panic()" size={13} state={s === 5 ? 'on' : 'off'} />
              </motion.g>
            </Appear>

            {/* yes: demand paging */}
            <Wire d="M510 296 L524 296 L524 248 L538 248" on={s >= 6} />
            <Label x={524} y={240} size={11} anchor="middle" on={s >= 6} weight={600}>yes</Label>
            {YES.map((t, i) => {
              const live = (s === 6 && i <= 1) || (s === 7 && i >= 2)
              return (
                <Appear key={i} on={s >= (i <= 1 ? 6 : 7)} delay={(i % 2) * 0.25}>
                  <Block x={540} y={230 + i * 44} w={230} h={36} label={t} mono size={12} state={live ? 'on' : 'off'} />
                </Appear>
              )
            })}
            <Packet on={s === 6} points={[[540, 292], [552, 292], [552, 86], [540, 86]]} duration={1.6} label="frame" />

            {/* retry */}
            <Packet on={s === 7} points={[[540, 380], [520, 380], [520, 184], [200, 184], [200, 108]]} duration={2} label="retry" />
          </Scene>
        )
      }}
    </VizStage>
  )
}
