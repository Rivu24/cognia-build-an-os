/* Kernel architectures compared: one read() in a monolithic kernel and in a microkernel.
   Claims follow the Kernel, Monolithic Kernel, Microkernel and Hybrid Kernel articles: monolithic = drivers and
   services in one kernel address space (fast, a driver bug can bring the system down); microkernel = services as
   user-space servers, kernel keeps scheduling, memory and IPC (more messages and context switches, better isolation);
   hybrid = some components in the kernel, some outside. Examples are the ones the articles list. */
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'kernel-architectures',
  title: 'Monolithic vs microkernel',
  summary: 'The same read() traced through a monolithic kernel (function calls in ring 0) and a microkernel (IPC messages between user-space servers), then the trade-off and where hybrids sit.',
  lessons: ['t16m1l3', 't6m3l2', 't16m1l2'],
  articles: ['Kernel', 'Monolithic Kernel', 'Microkernel', 'Hybrid Kernel'],
  group: 'Design',
  order: 1613,
}

const steps: VizStep[] = [
  { caption: 'Same job, two designs: an app calls read() to get 512 bytes of a file.', detail: 'The work is the same everywhere: find the file (VFS), map it to disk blocks (file system), talk to the disk (driver). What differs is where that code runs.' },
  { caption: 'Monolithic: read() traps into ring 0, and VFS, file system and driver all run there.', detail: 'Linux, most BSDs and xv6 work this way. Drivers loaded as modules still run inside kernel space.', ms: 3600 },
  { caption: 'Each layer is a plain function call in one address space, so the path is short.', detail: 'One trip into the kernel and one back out. No messages, no extra context switches: the main reason monolithic kernels are fast.', ms: 3600 },
  { caption: 'Microkernel: the kernel only schedules, manages memory and passes messages.', detail: 'The file system and the disk driver are ordinary user processes ("servers"). Mach, QNX, L4 and Minix are examples.' },
  { caption: 'read() becomes an IPC message: app → kernel → FS server.', detail: 'The library turns read() into a message. The kernel copies it to the FS server and switches to that process.' },
  { caption: 'The FS server sends its own message to the disk driver server, which talks to the disk.', detail: 'The kernel maps the controller registers into the driver process, so the driver can program the disk from user space.', ms: 3600 },
  { caption: 'Replies travel back the same way: 4 messages, each a trip through the kernel.', detail: 'More messaging and context switching makes a microkernel slower in principle. A well-designed one can still beat a careless monolith.', ms: 3800 },
  { caption: 'Now a driver bug: the monolithic kernel goes down; the microkernel restarts one server.', detail: 'In one address space a bad driver pointer can corrupt anything. As a separate process it only kills itself, though in-flight data may still be lost.', ms: 4200 },
  { caption: 'Hybrid kernels sit in between: mostly in-kernel, some services moved out.', detail: 'For example: keep the VFS in the kernel but run file system and storage drivers as user programs. Windows NT and XNU are hybrids.', ms: 4200 },
]

export default function KernelArchitectures() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const mono = s >= 1 && s <= 2
        const micro = s >= 3 && s <= 6
        const crash = s === 7
        const monoBox = (on: boolean) => (crash ? 'dim' : on ? 'on' : s >= 3 && !crash ? 'dim' : 'off')
        const microBox = (on: boolean) => (on ? 'on' : (s >= 1 && s <= 2) ? 'dim' : 'off')
        return (
          <Scene label={meta.summary}>
            {/* ---- headers and ring boundary ---- */}
            <Label x={30} y={40} size={14} mono={false} weight={600}>Monolithic</Label>
            <Label x={420} y={40} size={14} mono={false} weight={600}>Microkernel</Label>
            <line x1={400} x2={400} y1={26} y2={372} stroke="var(--viz-faint)" />
            <line x1={20} x2={390} y1={160} y2={160} stroke="var(--viz-dim)" strokeDasharray="4 4" />
            <line x1={410} x2={780} y1={160} y2={160} stroke="var(--viz-dim)" strokeDasharray="4 4" />
            <Label x={380} y={60} size={10.5} anchor="end" dim>user space · ring 3</Label>
            <Label x={380} y={180} size={10.5} anchor="end" dim>kernel space · ring 0</Label>
            <Label x={780} y={40} size={10.5} anchor="end" dim>user space · ring 3</Label>
            <Label x={420} y={262} size={10.5} dim>kernel space · ring 0</Label>

            {/* ---- monolithic ---- */}
            <Block x={30} y={70} w={170} h={50} label="App" sub="read(fd, buf, 512)" state={s === 0 || s === 1 ? 'on' : s >= 3 ? 'dim' : 'off'} />
            <Block x={30} y={188} w={350} h={130} state={crash ? 'on' : s >= 3 ? 'dim' : 'off'} />
            <Block x={42} y={208} w={70} h={44} label="syscall" size={12} state={monoBox(s === 1)} />
            <Block x={128} y={208} w={70} h={44} label="VFS" size={12} state={monoBox(s === 2 || s === 8)} />
            <Block x={214} y={208} w={70} h={44} label="ext2" sub="FS" size={12} state={monoBox(s === 2)} />
            <Block x={300} y={208} w={70} h={44} label="driver" sub="AHCI" size={12} state={crash ? 'hatch' : monoBox(s === 2)} />
            <Wire from={[77, 120]} to={[77, 205]} on={s >= 1} />
            <Label x={84} y={146} size={10.5} on={s >= 1}>syscall</Label>
            <Wire from={[112, 230]} to={[126, 230]} on={s >= 2} delay={0.1} />
            <Wire from={[198, 230]} to={[212, 230]} on={s >= 2} delay={0.3} />
            <Wire from={[284, 230]} to={[298, 230]} on={s >= 2} delay={0.5} />
            <Label x={42} y={284} size={10.5} on={!crash && s !== 8} dim={s !== 2}>one address space,</Label>
            <Label x={42} y={302} size={10.5} on={!crash && s !== 8} dim={s !== 2}>layers call each other directly</Label>
            <Label x={42} y={284} size={12} on={crash} weight={600}>kernel panic</Label>
            <Label x={42} y={284} size={11} on={s === 8} weight={600}>hybrid: VFS stays in the kernel</Label>
            <Label x={42} y={302} size={10.5} on={s === 8}>file system and driver move out →</Label>
            <Label x={42} y={302} size={10.5} on={crash}>the bug can corrupt any kernel data</Label>
            <Block x={300} y={332} w={70} h={34} label="disk" size={12} state={s === 1 || s === 2 ? 'on' : s >= 3 ? 'dim' : 'off'} />
            <Wire from={[335, 252]} to={[335, 330]} on arrow={false} dim />
            <Packet on={s === 1} points={[[77, 120], [77, 230], [163, 230], [249, 230], [335, 230], [335, 349]]} duration={2.6} label="read" />
            <Packet on={s === 2} points={[[335, 349], [335, 230], [249, 230], [163, 230], [77, 230], [77, 120]]} duration={2.6} label="512 B" />
            <Appear on={s >= 2 && s <= 7}>
              <Label x={214} y={92} size={11}>2 ring switches</Label>
              <Label x={214} y={110} size={11}>0 messages</Label>
            </Appear>

            {/* ---- microkernel ---- */}
            <Block x={420} y={70} w={110} h={50} label="App" sub="read()" state={microBox(s === 0 || s === 4)} />
            <Block x={545} y={70} w={110} h={50} label="FS server" sub="ext2" state={microBox(s === 3 || s === 4 || s === 5 || s === 8)} />
            <Block x={670} y={70} w={110} h={50} label="disk driver" sub={crash ? 'crashed' : 'AHCI'} state={crash ? 'hatch' : microBox(s === 3 || s === 5 || s === 8)} />
            <Block x={420} y={196} w={225} h={48} label="microkernel" sub="IPC · scheduling · memory" size={13} state={microBox(s === 3 || s === 4 || s === 5 || s === 6 || crash)} />
            <Pulse x={645} y={196} on={s === 3} r={12} />
            <Wire from={[725, 120]} to={[725, 330]} on arrow={false} dim />
            <Label x={732} y={252} size={10.5} dim>MMIO</Label>
            <Block x={680} y={332} w={90} h={34} label="disk" size={12} state={s === 5 || s === 6 ? 'on' : (s >= 1 && s <= 2) ? 'dim' : 'off'} />
            {/* message hops through the kernel */}
            <Wire d="M470 120 L490 194" on={s >= 4 && s <= 6} />
            <Wire d="M560 194 L590 122" on={s >= 4 && s <= 6} delay={0.3} />
            <Wire d="M615 122 L630 194" on={s >= 5 && s <= 6} />
            <Wire d="M645 210 L700 122" on={s >= 5 && s <= 6} delay={0.3} />
            <Packet on={s === 4} points={[[475, 120], [500, 220], [570, 220], [595, 120]]} duration={2.2} label="msg 1" />
            <Packet on={s === 5} points={[[600, 120], [620, 220], [645, 220], [705, 120], [725, 120], [725, 349]]} duration={2.6} label="msg 2" />
            <Packet on={s === 6} points={[[725, 349], [725, 120], [705, 120], [645, 220], [600, 120], [570, 220], [500, 220], [475, 120]]} duration={3.2} label="replies 3, 4" />
            <Appear on={s === 6}>
              <Label x={420} y={290} size={11}>4 messages</Label>
              <Label x={420} y={308} size={11}>each: into the kernel, copy, switch</Label>
            </Appear>
            <Label x={670} y={142} size={10.5} on={crash} weight={600}>restart it</Label>
            <Label x={420} y={290} size={11} on={crash}>kernel, app and FS server keep running</Label>
            <Label x={420} y={290} size={11} on={s === 8} weight={600}>hybrid: FS and driver as servers</Label>
            <Label x={420} y={308} size={10.5} on={s === 8}>user programs, reached by IPC</Label>

            {/* ---- the trade-off ---- */}
            <Appear on={s >= 6 && s <= 7}>
              <Label x={30} y={396} size={11} weight={500}>+ fast: function calls</Label>
              <Label x={30} y={414} size={11} dim={!crash} weight={crash ? 500 : 400}>− one bad driver can take down everything</Label>
              <Label x={420} y={396} size={11} weight={500}>− slower: messages and switches</Label>
              <Label x={420} y={414} size={11} dim={!crash} weight={crash ? 500 : 400}>+ a crashed server can be restarted</Label>
            </Appear>

            {/* ---- the spectrum ---- */}
            <Appear on={s >= 8}>
              <Wire from={[110, 386]} to={[690, 386]} on={s >= 8} arrow={false} />
              {([[110, 'monolithic', 'Linux · BSDs', 'start'], [400, 'hybrid', 'Windows NT · XNU', 'middle'], [690, 'microkernel', 'Mach · QNX · L4 · Minix', 'end']] as const).map(([x, name, ex, anchor]) => (
                <g key={name}>
                  <circle cx={x} cy={386} r={5} fill={name === 'hybrid' ? 'var(--viz-fg)' : 'var(--viz-bg)'} stroke="var(--viz-fg)" />
                  <Label x={x} y={408} size={12} anchor={anchor === 'start' ? 'start' : anchor === 'end' ? 'end' : 'middle'} weight={600} mono={false}>{name}</Label>
                  <Label x={x} y={426} size={10.5} anchor={anchor === 'start' ? 'start' : anchor === 'end' ? 'end' : 'middle'} dim>{ex}</Label>
                </g>
              ))}
              <Label x={30} y={390} size={10.5} dim>more in</Label>
              <Label x={30} y={404} size={10.5} dim>kernel</Label>
              <Label x={780} y={390} size={10.5} anchor="end" dim>more in</Label>
              <Label x={780} y={404} size={10.5} anchor="end" dim>user space</Label>
              <Pulse x={400} y={386} on={s === 8} r={12} />
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
