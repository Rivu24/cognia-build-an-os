/* NVMe: submission and completion queues in RAM, doorbells in BAR0.
   Register offsets, entry sizes (64-byte command, 16-byte completion), opcodes (0x01/0x05 admin create,
   0x02 read) and the phase bit come from the NVMe article. Doorbell offsets assume CAP.DSTRD = 0:
   SQyTDBL = 0x1000 + (2y)*4, CQyHDBL = 0x1000 + (2y+1)*4, so queue 1 uses 0x1008 and 0x100C. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'nvme-queues',
  title: 'NVMe: queues and doorbells',
  summary: 'The driver writes a 64-byte command into a submission queue in RAM and rings a BAR0 doorbell; the controller DMAs the data, posts a 16-byte completion with a phase bit and interrupts.',
  lessons: ['t10m1l3', 't10m1l2'],
  articles: ['NVMe', 'AHCI'],
  group: 'Devices',
  order: 1013,
}

const steps: VizStep[] = [
  { caption: 'The NVMe controller is a PCI device. Its registers live in BAR0, as MMIO.', detail: 'Find it by PCI class 0x01, subclass 0x08. BAR0 (+ BAR1 for the high half) is a 64-bit physical address; map it, then plain loads and stores reach the registers.' },
  { caption: 'Admin queues first: write their RAM addresses into ASQ (0x28) and ACQ (0x30).', detail: 'At reset only the admin queue pair (id 0) exists. AQA (0x24) holds their sizes; setting CC.EN in CC (0x14) starts the controller.', ms: 3600 },
  { caption: 'Admin commands create I/O queue pair 1: create CQ (0x05), then create SQ (0x01).', detail: 'Each admin command goes into Admin SQ 0 and is announced by writing SQ0TDBL (0x1000). The CQ must exist first: create-SQ names the CQ its completions go to.', ms: 3600 },
  { caption: 'To read, the driver writes a 64-byte command into the SQ slot at the tail.', detail: 'Opcode 0x02 = read. CID 7 tags it. PRP1 points at the buffer. NLB is zero-based: 7 means 8 blocks of 512 bytes = 4 KiB.', ms: 3800 },
  { caption: 'It rings the doorbell: writes the new tail, 1, to SQ1TDBL at BAR0 + 0x1008.', detail: 'Until the doorbell is written the controller does not know the command is there. One MMIO write can hand over many commands at once.' },
  { caption: 'The controller fetches the command and DMAs the data straight into the buffer.', detail: 'No CPU copy: the device reads the 64-byte entry from RAM and writes the 4 KiB of sectors to the PRP1 address itself.', ms: 3600 },
  { caption: 'It posts a 16-byte completion in the CQ: CID 7, status 0, phase bit 1.', detail: 'The CQ memory started zeroed, so a phase bit of 1 marks a new entry. On the next lap round the ring, new entries carry phase 0.', ms: 3800 },
  { caption: 'An interrupt fires. The driver reads entries until the phase bit is stale.', detail: 'It matches the entry to its request by SQ id and CID, checks status (0 = success), and wakes whoever waited for sector 0.', ms: 3600 },
  { caption: 'Finally it writes the new head, 1, to CQ1HDBL at BAR0 + 0x100C.', detail: 'That tells the controller the slot is free again. The CQ entry also reported the SQ head, so the driver knows which SQ slots it may reuse.', ms: 4000 },
]

/** Text that fades in whenever its value changes. */
function Val({ x, y, v, size = 11.5, anchor = 'start', dim }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; dim?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</text>
    </motion.g>
  )
}

/** A small pointer under a ring slot that slides to a new index. */
function Marker({ x0, y, idx, cell, text }: { x0: number; y: number; idx: number; cell: number; text: string }) {
  const cx = x0 + cell / 2
  return (
    <motion.g initial={false} animate={{ x: idx * cell }} transition={ease}>
      <path d={`M${cx} ${y - 8} l5 7 h-10 z`} fill="var(--viz-fg)" />
      <text x={cx + 8} y={y} textAnchor="start" fill="var(--viz-fg)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{text}</text>
    </motion.g>
  )
}

const REGS: [string, string, string?][] = [
  ['CAP', '0x00'], ['CC', '0x14'], ['CSTS', '0x1C'], ['AQA', '0x24'], ['ASQ', '0x28'], ['ACQ', '0x30'], ['SQ0TDBL', '0x1000'], ['SQ1TDBL', '0x1008'], ['CQ1HDBL', '0x100C'],
]
const X0 = 237
const CELL = 37

export default function NvmeQueues() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const regOn = (name: string) =>
          (s === 1 && (name === 'ASQ' || name === 'ACQ')) || (s === 2 && name === 'SQ0TDBL') || (s === 4 && name === 'SQ1TDBL') || (s === 8 && name === 'CQ1HDBL')
        const regVal: Record<string, string | undefined> = {
          ASQ: s >= 1 ? '0x200000' : undefined,
          ACQ: s >= 1 ? '0x201000' : undefined,
          CC: s >= 1 ? 'EN=1' : undefined,
          SQ0TDBL: s >= 2 ? '← 2' : undefined,
          SQ1TDBL: s >= 4 ? '← 1' : undefined,
          CQ1HDBL: s >= 8 ? '← 1' : undefined,
        }
        const sqTail = s >= 3 ? 1 : 0
        const cqHead = s >= 8 ? 1 : 0
        return (
          <Scene label={meta.summary}>
            {/* ---- driver ---- */}
            <Block x={20} y={30} w={185} h={120} state={s === 3 || s === 7 ? 'on' : 'off'} />
            <Label x={32} y={52} size={13} mono={false} weight={500}>Driver (CPU)</Label>
            <Label x={32} y={80} size={11.5} dim>sq_tail =</Label>
            <Val x={110} y={80} v={String(sqTail)} />
            <Label x={32} y={102} size={11.5} dim>cq_head =</Label>
            <Val x={110} y={102} v={String(cqHead)} />
            <Label x={32} y={124} size={11.5} dim>phase   =</Label>
            <Val x={110} y={124} v="1" />

            {/* ---- top lanes: MMIO writes → / ← interrupt ---- */}
            <Wire from={[205, 60]} to={[568, 60]} on dim={!(s === 0 || s === 1 || s === 2 || s === 4 || s === 8)} />
            <Label x={387} y={75} size={10.5} anchor="middle" dim>MMIO store to BAR0</Label>
            <Wire from={[570, 98]} to={[207, 98]} on={s >= 6} dim={s !== 7} dashed />
            <Label x={387} y={92} size={10.5} anchor="middle" on={s >= 6} dim={s !== 7}>interrupt (MSI-X)</Label>
            <Packet on={s === 1} points={[[215, 60], [530, 60]]} duration={1.2} label="ASQ, ACQ" />
            <Packet on={s === 2} points={[[215, 60], [530, 60]]} duration={1.2} label="SQ0 tail = 2" />
            <Packet on={s === 4} points={[[215, 60], [530, 60]]} duration={1.2} label="tail = 1" />
            <Packet on={s === 8} points={[[215, 60], [530, 60]]} duration={1.2} label="head = 1" />
            <Packet on={s === 7} points={[[570, 98], [220, 98]]} duration={1.2} />

            {/* ---- RAM ---- */}
            <Block x={225} y={115} w={320} h={315} state="dim" />
            <Label x={237} y={133} size={11} dim>RAM</Label>
            <Appear on={s >= 1}>
              <Block x={X0} y={141} w={142} h={40} label="Admin SQ 0" sub="0x200000" size={12} state={s === 1 || s === 2 ? 'on' : 'off'} />
              <Block x={X0 + 154} y={141} w={142} h={40} label="Admin CQ 0" sub="0x201000" size={12} state={s === 1 ? 'on' : 'off'} />
            </Appear>

            <Appear on={s >= 2} delay={0.5}>
              <Label x={X0} y={200} size={10.5} dim>I/O SQ 1 · 64-byte commands</Label>
              {Array.from({ length: 8 }, (_, i) => (
                <Block key={`sq${i}`} x={X0 + i * CELL} y={207} w={CELL} h={32} mono size={10.5}
                  label={i === 0 && s >= 3 ? 'cid7' : undefined}
                  state={i === 0 && (s === 3 || s === 5) ? 'on' : i === 0 && s >= 3 ? 'fill' : 'off'} />
              ))}
              <Marker x0={X0} y={251} idx={sqTail} cell={CELL} text="tail" />

              <Label x={X0} y={272} size={10.5} dim>I/O CQ 1 · 16-byte completions</Label>
              {Array.from({ length: 8 }, (_, i) => (
                <Block key={`cq${i}`} x={X0 + i * CELL} y={279} w={CELL} h={32} mono size={10.5}
                  label={i === 0 && s >= 6 ? 'P1' : 'P0'}
                  state={i === 0 && (s === 6 || s === 7) ? 'on' : i === 0 && s >= 6 ? 'fill' : 'off'} />
              ))}
              <Marker x0={X0} y={323} idx={cqHead} cell={CELL} text="head" />
            </Appear>

            {/* entry inspector */}
            <Appear on={s >= 3}>
              <Block x={X0} y={334} w={296} h={48} state={s === 3 || s === 6 ? 'on' : 'off'} />
              {s >= 3 && s < 6 && (
                <>
                  <Val x={X0 + 10} y={353} v="opcode 0x02 (read) · CID 7 · NSID 1" size={10.5} />
                  <Val x={X0 + 10} y={371} v="PRP1 = buffer · LBA 0 · NLB 7" size={10.5} />
                </>
              )}
              {s >= 6 && (
                <>
                  <Val x={X0 + 10} y={353} v="CID 7 · SQ id 1 · SQ head 1" size={10.5} />
                  <Val x={X0 + 10} y={371} v="status 0 = success · phase 1" size={10.5} />
                </>
              )}
            </Appear>
            <Block x={X0} y={390} w={296} h={32} label={s >= 5 ? 'buffer (PRP1) · 4 KiB · sectors 0–7' : 'buffer (PRP1) · 4 KiB · empty'} size={11.5} mono
              state={s === 5 ? 'on' : s >= 5 ? 'fill' : 'off'} />

            {/* ---- NVMe controller ---- */}
            <Block x={570} y={30} w={210} h={400} state={s === 0 ? 'on' : 'off'} />
            <Label x={582} y={52} size={13} mono={false} weight={500}>NVMe controller</Label>
            <Label x={582} y={70} size={10.5} dim>PCI class 01h · subclass 08h</Label>
            <Label x={582} y={92} size={10.5} dim>BAR0 REGISTERS (MMIO)</Label>
            <Pulse x={740} y={88} on={s === 0} r={10} />
            {REGS.map(([name, off], i) => (
              <g key={name}>
                <Block x={582} y={100 + i * 24} w={186} h={24} state={regOn(name) ? 'on' : 'off'} />
                <Label x={592} y={116 + i * 24} size={11}>{name}</Label>
                {regVal[name] && <Val x={652} y={116 + i * 24} v={regVal[name]!} size={11} />}
                <Label x={760} y={116 + i * 24} size={10.5} anchor="end" dim>{off}</Label>
              </g>
            ))}
            <Block x={582} y={330} w={186} h={36} label="command engine" sub={s === 2 ? 'create CQ 1, SQ 1' : s === 5 ? 'fetch + execute' : s === 6 ? 'post completion' : undefined} size={12}
              state={s === 2 || s === 5 || s === 6 ? 'on' : 'off'} />
            <Block x={582} y={374} w={186} h={50} label="flash · namespace 1" sub="LBA 0–7 → 4 KiB" size={12} state={s === 5 ? 'on' : 'off'} />

            {/* ---- motion for the queue steps ---- */}
            <Packet on={s === 2} points={[[308, 161], [560, 161], [600, 348]]} duration={1.6} delay={1.2} />
            <Packet on={s === 3} points={[[205, 130], [255, 223]]} duration={1.2} />
            <Packet on={s === 5} points={[[255, 223], [600, 348], [675, 399], [520, 406]]} duration={2.6} />
            <Packet on={s === 6} points={[[600, 348], [255, 295]]} duration={1.4} />
            <Packet on={s === 7} points={[[255, 295], [140, 140]]} duration={1.4} delay={0.6} />
          </Scene>
        )
      }}
    </VizStage>
  )
}
