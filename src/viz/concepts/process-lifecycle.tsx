/* Process lifecycle: spawn, exit, wait. The wiki has no article on process creation (lesson t8m2l4 says the design is
   yours), so this follows the lesson's own design: spawn(path, argv) makes a child with its own address space, the
   parent's wait() blocks it (Blocking Process: removed from the scheduling queue until the event happens), exit(code)
   leaves a zombie that holds the status until the parent collects it, then the child is freed. Orphans go to PID 1, the
   Unix convention. CR3 values match the processes-vs-threads worked example. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'process-lifecycle',
  title: 'Process lifecycle: spawn, exit, wait',
  summary: 'A parent spawns a child with its own address space, blocks in wait(), the child exits and becomes a zombie holding its exit status, the parent wakes, collects the status and the child is freed; orphans are handed to PID 1.',
  lessons: ['t8m2l4'],
  articles: ['Processes and Threads', 'Blocking Process'],
  group: 'User space',
  order: 824,
}

const steps: VizStep[] = [
  { caption: 'The parent, PID 1, is running. It calls spawn() to start another program.', detail: 'spawn(path, argv) creates a new process in one call. Unix splits the same job into fork() and exec(). Either way the kernel builds a new process.' },
  { caption: 'The kernel builds the child: PID 2 with its own address space. It starts Ready.', detail: 'A new page directory (CR3 = 0x00340000), a kernel stack and the program loaded into it. The child joins the ready queue; spawn returns 2 to the parent.', ms: 3800 },
  { caption: 'The parent calls wait(2). The child has not exited yet, so the parent blocks.', detail: 'Blocked means off the scheduling queue until an event, here “PID 2 exited”. No busy-waiting: the parent uses no CPU time while it waits.' },
  { caption: 'The scheduler picks the child. It runs in its own address space.', detail: 'Loading CR3 = 0x00340000 switches to the child’s memory. The parent’s memory is untouched and invisible to it.' },
  { caption: 'The child calls exit(3). Its memory is freed, but a zombie entry keeps the code 3.', detail: 'A zombie has no address space and never runs again. It keeps just its PID, its parent and the exit status until the parent collects them.', ms: 3800 },
  { caption: 'The exit is the event the parent waited for: it moves Blocked → Ready.', detail: 'The kernel finds the parent waiting on PID 2 and puts it back on the ready queue. The next time it is scheduled, wait() can return.' },
  { caption: 'wait() returns 3 to the parent. The zombie is reaped and PID 2 is gone.', detail: 'The kernel copies the status out, then frees the kernel stack and the table entry. The free-frame count is back where it started.', ms: 3800 },
  { caption: 'If a parent exits first, its children are orphans. PID 1 adopts them and reaps them.', detail: 'Unix-like systems use this rule so every zombie has someone to wait() for it. Without it, an orphan’s zombie would stay forever.', ms: 4200 },
]

// states (box top-left); tokens sit on the bottom row of each box
type St = 'ready' | 'running' | 'blocked' | 'zombie' | 'freed' | 'none'
const BW = 110, BH = 56
const BOX: Record<Exclude<St, 'none'>, [number, number, string]> = {
  ready: [50, 62, 'Ready'],
  running: [210, 62, 'Running'],
  zombie: [370, 62, 'Zombie'],
  blocked: [210, 186, 'Blocked'],
  freed: [370, 186, 'Freed'],
}
const PARENT: St[] = ['running', 'running', 'blocked', 'blocked', 'blocked', 'ready', 'running', 'running']
const CHILD: St[] = ['none', 'ready', 'ready', 'running', 'zombie', 'zombie', 'freed', 'freed']

const tokenPos = (st: St, who: 0 | 1): [number, number] => {
  if (st === 'none') return [105, 30]
  const [x, y] = BOX[st]
  return [x + BW / 2 + (who === 0 ? -22 : 22), y + 39]
}

/** A process token moving between states. */
function Token({ st, who, label }: { st: St; who: 0 | 1; label: string }) {
  const [x, y] = tokenPos(st, who)
  const gone = st === 'none' || st === 'freed'
  return (
    <motion.g initial={false} animate={{ x, y, opacity: st === 'none' ? 0 : gone ? 0.35 : 1 }} transition={{ type: 'spring', stiffness: 90, damping: 16 }}>
      <circle r={11} fill={gone ? 'var(--viz-bg)' : 'var(--viz-fg)'} stroke="var(--viz-fg)" filter={gone ? undefined : 'url(#viz-glow)'} />
      <text y={4} textAnchor="middle" fill={gone ? 'var(--viz-fg)' : 'var(--viz-bg)'} style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{label}</text>
    </motion.g>
  )
}

/** Text that fades in whenever its value changes. */
function Val({ x, y, v, size = 11.5, weight = 400, dim }: { x: number; y: number; v: string; size?: number; weight?: number; dim?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>{v}</text>
    </motion.g>
  )
}

const PCODE = ['pid = spawn("/bin/child");', 'wait(pid, &status);', 'printf("%d", status); // 3']
const CCODE = ['do_work();', 'exit(3);']
const P_HOT = [0, 0, 1, 1, 1, 1, 2, -1]
const C_HOT = [-1, -1, -1, 0, 1, -1, -1, -1]

const RX = 520, RW = 260
const READYQ = ['', 'PID 2', 'PID 2', '', '', 'PID 1', '', '']
const BLOCKQ = ['', '', 'PID 1 · waiting for PID 2 to exit', 'PID 1 · waiting for PID 2 to exit', 'PID 1 · waiting for PID 2 to exit', '', '', '']

export default function ProcessLifecycle() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const p = PARENT[s], c = CHILD[s]
        const boxState = (k: St): 'on' | 'off' | 'dim' => (k === p || k === c ? (s === 7 ? 'off' : 'on') : 'off')
        const childStateText = c === 'none' ? '' : c === 'freed' ? 'gone' : c
        return (
          <Scene label={meta.summary}>
            {/* ===== state machine ===== */}
            <Label x={20} y={24} size={11} dim>STATES</Label>
            {(Object.keys(BOX) as Exclude<St, 'none'>[]).map((k) => {
              const [x, y, name] = BOX[k]
              return (
                <g key={k}>
                  <Block x={x} y={y} w={BW} h={BH} state={k === 'freed' && c === 'freed' ? 'hatch' : boxState(k)} />
                  <Label x={x + BW / 2} y={y + 19} size={12} anchor="middle" mono={false} weight={600}>{name}</Label>
                </g>
              )
            })}
            {/* transitions */}
            <Wire from={[105, 34]} to={[105, 60]} on width={1.2} />
            <Label x={112} y={46} size={10.5} dim>spawn()</Label>
            <Wire from={[160, 80]} to={[208, 80]} width={1.2} />
            <Label x={185} y={74} size={10.5} anchor="middle" dim>run</Label>
            <Wire from={[210, 104]} to={[162, 104]} width={1.2} dim />
            <Label x={185} y={118} size={10.5} anchor="middle" dim>preempt</Label>
            <Wire from={[320, 90]} to={[368, 90]} width={1.2} />
            <Label x={345} y={84} size={10.5} anchor="middle" dim>exit()</Label>
            <Wire from={[265, 118]} to={[265, 184]} width={1.2} />
            <Label x={272} y={156} size={10.5} dim>wait()</Label>
            <Wire d="M210 214 C 140 214, 105 180, 105 120" width={1.2} />
            <Label x={128} y={196} size={10.5} anchor="end" dim>woken</Label>
            <Wire from={[425, 118]} to={[425, 184]} width={1.2} />
            <Label x={432} y={156} size={10.5} dim>reaped</Label>

            {/* highlight the transition taken this step */}
            <Pulse x={265} y={150} on={s === 2} r={12} />
            <Pulse x={345} y={90} on={s === 4} r={12} />
            <Pulse x={140} y={196} on={s === 5} r={12} />
            <Pulse x={425} y={150} on={s === 6} r={12} />

            <Token st={p} who={0} label="P1" />
            <Token st={c} who={1} label="C2" />

            {/* ===== code ===== */}
            <Label x={20} y={272} size={11} dim>PARENT · PID 1</Label>
            {PCODE.map((t, i) => (
              <Block key={t} x={20} y={280 + i * 26} w={230} h={26} label={t} mono size={11} align="start"
                state={P_HOT[s] === i ? 'on' : s === 7 ? 'dim' : 'off'} />
            ))}
            <Label x={262} y={272} size={11} dim>CHILD · PID 2</Label>
            {CCODE.map((t, i) => (
              <Block key={t} x={262} y={280 + i * 26} w={218} h={26} label={t} mono size={11} align="start"
                state={C_HOT[s] === i ? 'on' : s < 1 || s >= 6 ? 'dim' : 'off'} />
            ))}
            <Label x={262} y={352} size={10.5} dim>own address space · CR3 0x00340000</Label>

            {/* ===== scheduler queues ===== */}
            <line x1={20} x2={480} y1={366} y2={366} stroke="var(--viz-faint)" />
            <Label x={20} y={392} size={11} dim>ready queue</Label>
            <Block x={130} y={376} w={350} h={24} state={READYQ[s] ? 'off' : 'dim'} />
            <Val x={140} y={392} v={READYQ[s] || 'empty'} weight={READYQ[s] ? 600 : 400} dim={!READYQ[s]} />
            <Label x={20} y={424} size={11} dim>blocked</Label>
            <Block x={130} y={408} w={350} h={24} state={BLOCKQ[s] ? 'on' : 'dim'} />
            <Val x={140} y={424} v={BLOCKQ[s] || 'empty'} weight={BLOCKQ[s] ? 600 : 400} dim={!BLOCKQ[s]} />

            {/* ===== process table ===== */}
            <Label x={RX} y={24} size={11} dim>PROCESS TABLE</Label>
            <Block x={RX} y={34} w={RW} h={92} state={s === 0 || s === 2 || s === 5 || s === 6 ? 'on' : 'off'} />
            <Label x={RX + 12} y={54} size={12} mono={false} weight={600}>PID 1 · parent</Label>
            <Label x={RX + 12} y={76} size={11} dim>state</Label>
            <Val x={RX + 110} y={76} v={p} weight={600} />
            <Label x={RX + 12} y={96} size={11} dim>CR3</Label>
            <Val x={RX + 110} y={96} v="0x00210000" />
            <Label x={RX + 12} y={116} size={11} dim>waits for</Label>
            <Val x={RX + 110} y={116} v={s >= 2 && s <= 5 ? 'PID 2 to exit' : s === 6 ? 'got status 3' : '—'} />

            <Appear on={s >= 1}>
              <Block x={RX} y={142} w={RW} h={112} state={c === 'freed' ? 'dim' : s === 1 || s === 4 ? 'on' : 'off'} />
              <Label x={RX + 12} y={162} size={12} mono={false} weight={600}>PID 2 · child of 1</Label>
              <Label x={RX + 12} y={184} size={11} dim>state</Label>
              <Val x={RX + 110} y={184} v={childStateText} weight={600} />
              <Label x={RX + 12} y={204} size={11} dim>address space</Label>
              <Val x={RX + 130} y={204} v={s >= 4 ? 'freed' : 'CR3 0x00340000'} />
              <Label x={RX + 12} y={224} size={11} dim>exit status</Label>
              <Val x={RX + 130} y={224} v={s >= 4 && s <= 5 ? '3 (kept)' : s >= 6 ? 'collected' : '—'} weight={s >= 4 && s <= 5 ? 600 : 400} />
              <Label x={RX + 12} y={244} size={11} dim>table entry</Label>
              <Val x={RX + 130} y={244} v={s >= 6 ? 'freed' : 'in use'} />
            </Appear>

            {/* ===== orphans ===== */}
            <Appear on={s === 7}>
              <Label x={RX} y={286} size={11} dim>ORPHANS</Label>
              <rect x={RX} y={294} width={RW} height={136} fill="none" stroke="var(--viz-fg)" />
              <Block x={RX + 85} y={304} w={90} h={30} label="PID 1" mono size={12} state="on" />
              <Block x={RX + 16} y={360} w={90} h={30} label="PID 5" sub={undefined} mono size={12} state="hatch" />
              <Label x={RX + 61} y={406} size={10.5} anchor="middle" dim>exited first</Label>
              <Block x={RX + 154} y={360} w={90} h={30} label="PID 6" mono size={12} state="off" />
              <Wire from={[RX + 104, 334]} to={[RX + 74, 358]} dashed dim arrow={false} />
              <Wire from={[RX + 106, 375]} to={[RX + 154, 375]} dashed dim arrow={false} />
              <Wire from={[RX + 155, 334]} to={[RX + 190, 358]} delay={0.6} />
              <Label x={RX + 199} y={406} size={10.5} anchor="middle" weight={600}>parent → 1</Label>
            </Appear>

            {/* ===== motion ===== */}
            <Packet on={s === 1} points={[[tokenPos('running', 0)[0], 70], [105, 40], [105, 62]]} duration={1.2} label="spawn" />
            <Packet on={s === 4} points={[[tokenPos('zombie', 1)[0], 118], [tokenPos('zombie', 1)[0], 130], [RX - 12, 130], [RX - 12, 220], [RX, 220]]} duration={1.6} label="3" />
            <Packet on={s === 5} points={[[425, 118], [425, 150], [320, 214]]} duration={1.2} label="wake" />
            <Packet on={s === 6} points={[[RX + RW - 20, 224], [RX + RW - 20, 116], [RX + 230, 116]]} duration={1.4} label="3" />
          </Scene>
        )
      }}
    </VizStage>
  )
}
