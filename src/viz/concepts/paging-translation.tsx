/* EXEMPLAR concept. Conventions every concept follows:
   1. export `meta` (VizMeta) and a default component with no props.
   2. Steps are short captions (+ optional detail) that tell the story in plain words.
   3. The scene is a pure function of `step`: keep elements mounted and animate their state, so moving
      backwards and forwards is smooth. Use the primitives in ../core/primitives and only CSS colour tokens.
   4. Real, correct numbers: the values here are a worked example a learner can check by hand. */
import { VizStage } from '../core/VizStage'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'paging-translation',
  title: 'Paging: virtual to physical (32-bit)',
  summary: 'How the MMU splits a virtual address 10 | 10 | 12 and walks CR3, the page directory and a page table to find the physical byte.',
  lessons: ['t6m2l1', 't6m2l2', 't6m2l4'],
  articles: ['Paging', 'Setting Up Paging'],
  group: 'Memory',
  order: 640,
}

const steps: VizStep[] = [
  { caption: 'Your code reads address 0x00403A7C.', detail: 'With paging on, every address the CPU uses is virtual. The MMU must translate it before memory sees it.' },
  { caption: 'The MMU splits the 32 bits: 10 | 10 | 12.', detail: 'Top 10 bits pick a page-directory entry, the next 10 pick a page-table entry, the low 12 are the offset inside a 4 KiB page.' },
  { caption: 'CR3 holds the physical address of the page directory.', detail: 'Each process can have its own directory; switching CR3 switches the whole address space.' },
  { caption: 'Directory index 1 selects PDE[1] → a page table.', detail: 'The entry is present (P=1), so the walk continues. If P=0, the CPU raises a page fault (#PF).' },
  { caption: 'Table index 3 selects PTE[3] → frame 0x0012F000.', detail: 'A page table entry holds the physical frame address plus flags: present, writable, user.' },
  { caption: 'Frame + offset = physical address 0x0012FA7C.', detail: '0x0012F000 + 0xA7C. Only the low 12 bits pass through unchanged.' },
  { caption: 'The TLB remembers the answer.', detail: 'Next time this page is touched, no walk is needed. Change a mapping and you must invlpg it (or reload CR3).', ms: 3800 },
]

const BITS = '00000000010000000011101001111100'
const FIELDS: [number, number, string][] = [
  [0, 10, 'directory index = 1'],
  [10, 10, 'table index = 3'],
  [20, 12, 'offset = 0xA7C'],
]

/** Parts of the machine stay visible but faint until the walk reaches them, so step 1 already shows the whole picture. */
function Faint({ on, children }: { on: boolean; children: ReactNode }) {
  return <motion.g initial={false} animate={{ opacity: on ? 1 : 0.22 }} transition={ease}>{children}</motion.g>
}

export default function PagingTranslation() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => (
        <Scene label={meta.summary}>
          {/* virtual address */}
          <Label x={112} y={18} size={11} dim>VIRTUAL ADDRESS</Label>
          <Label x={688} y={18} size={13} anchor="end" weight={500}>0x00403A7C</Label>
          <BitField x={112} y={44} bits={BITS} fields={s >= 1 ? FIELDS : []} active={s === 3 ? 0 : s === 4 ? 1 : s === 5 ? 2 : undefined} cellW={18} h={26} />

          {/* CR3 */}
          <Faint on={s >= 2}>
            <Block x={30} y={230} w={110} h={46} label="CR3" sub="0x00100000" mono state={s === 2 ? 'on' : 'off'} />
          </Faint>
          <Wire from={[140, 253]} to={[196, 253]} on={s >= 2} />

          {/* page directory */}
          <Faint on={s >= 2}>
            <Label x={200} y={150} size={11} dim>PAGE DIRECTORY</Label>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Block key={i} x={200} y={160 + i * 32} w={150} h={32} mono size={11}
                label={i === 5 ? '…1023' : `PDE[${i}]`} state={s >= 3 && i === 1 ? 'on' : i === 1 && s > 3 ? 'off' : s >= 3 ? 'dim' : 'off'} />
            ))}
          </Faint>
          <Wire d="M350 208 C 385 208, 385 176, 418 176" on={s >= 3} />
          <Pulse x={275} y={208} on={s === 3} />

          {/* page table */}
          <Faint on={s >= 3}>
            <Label x={420} y={150} size={11} dim>PAGE TABLE</Label>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Block key={i} x={420} y={160 + i * 32} w={150} h={32} mono size={11}
                label={i === 5 ? '…1023' : `PTE[${i}]`} sub={i === 3 && s >= 4 ? undefined : undefined} state={s >= 4 && i === 3 ? 'on' : s >= 4 ? 'dim' : 'off'} />
            ))}
          </Faint>
          <Label x={578} y={258} size={10.5} on={s >= 4}>0x0012F000 | P W</Label>
          <Wire d="M570 272 C 605 272, 610 300, 638 300" on={s >= 4} />
          <Pulse x={495} y={272} on={s === 4} />

          {/* physical memory */}
          <Faint on={s >= 4}>
            <Label x={640} y={150} size={11} dim>PHYSICAL RAM</Label>
            <Block x={640} y={160} w={130} h={110} state="hatch" />
            <Block x={640} y={270} w={130} h={70} label="frame" sub="0x0012F000" mono state={s >= 5 ? 'on' : 'off'} />
            <Block x={640} y={340} w={130} h={44} state="hatch" />
          </Faint>
          <Appear on={s >= 5}>
            <line x1={646} x2={764} y1={333} y2={333} stroke="var(--viz-fg)" strokeDasharray="3 3" />
            <Label x={705} y={410} size={12} anchor="middle" weight={500}>0x0012FA7C</Label>
            <Label x={705} y={428} size={10} anchor="middle" dim>frame + 0xA7C</Label>
          </Appear>
          <Packet on={s === 5} points={[[50, 253], [275, 208], [495, 272], [705, 333]]} duration={2.2} label="walk" />

          {/* TLB */}
          <Appear on={s >= 6}>
            <Block x={30} y={330} w={300} h={70} state="on" />
            <Label x={44} y={352} size={11} dim>TLB (translation cache)</Label>
            <Label x={44} y={380} size={13} weight={500}>0x00403 → 0x0012F</Label>
          </Appear>
          <Wire d="M330 365 C 480 365, 520 420, 638 400" on={s >= 6} dashed />
        </Scene>
      )}
    </VizStage>
  )
}
