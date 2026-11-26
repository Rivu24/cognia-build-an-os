/* IPC: three ways for two processes to talk, with the copies and the waiting made visible.
   Follows the Message Passing article (asynchronous send copies into a kernel post box, receiver may block),
   Unix Pipes (byte stream through a circular kernel buffer, reader waits when empty, writer when full),
   Shared Memory (the kernel maps the same physical range into both address spaces; you must coordinate access)
   and IPC Data Copying methods (kernel-buffered = two copies, shared mapping = zero copies). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'ipc-message-passing',
  title: 'IPC: messages, pipes, shared memory',
  summary: 'Two processes exchange data three ways: a message copied through a kernel queue, a byte stream through a pipe buffer, and one physical frame mapped into both address spaces.',
  lessons: ['t8m2l6', 't16m1l2'],
  articles: ['Message Passing', 'Unix Pipes', 'Shared Memory', 'IPC Data Copying methods'],
  group: 'User space',
  order: 826,
}

const steps: VizStep[] = [
  { caption: 'Process A and process B each have their own address space. Neither can see the other.', detail: 'The MMU gives each process private page tables, so a pointer in A means nothing in B. To talk, they need help from the kernel.' },
  { caption: 'Message passing: B calls receive() and blocks until a message arrives.', detail: 'The scheduler takes B off the CPU. It uses no time while it waits.' },
  { caption: 'A calls send(): the kernel copies "hello" into B\'s queue. Copy 1.', detail: 'Asynchronous send: the message is copied into kernel memory and attached to B\'s post box, so A can carry on at once.', ms: 3600 },
  { caption: 'The kernel wakes B and copies the message into B\'s buffer. Copy 2.', detail: 'Two copies and two trips into the kernel. Cheap for small messages, costly for big ones.', ms: 3600 },
  { caption: 'A pipe is a byte stream: write() puts bytes into a ring buffer in the kernel.', detail: 'pipe() returns two file descriptors: fd[1] to write, fd[0] to read. The buffer has a fixed size; a full buffer puts the writer to sleep.', ms: 3800 },
  { caption: 'read() takes the oldest 3 bytes, "abc". "de" stays for the next read().', detail: 'A pipe has no message boundaries: you get the bytes you ask for, in order. If the buffer were empty, read() would put B to sleep until A writes more.', ms: 3800 },
  { caption: 'Shared memory: the kernel maps one physical frame into both address spaces.', detail: 'A sees frame 0x00321000 at 0x40000000, B sees it at 0x70000000. Different addresses, so store offsets in it, not pointers.', ms: 4000 },
  { caption: 'A writes x = 42 and B sees it at once: zero copies. But now they need a lock.', detail: 'No kernel in the path means nobody else orders the accesses. Without a lock B could read a half-written value.', ms: 4000 },
  { caption: 'Compare: copies and who does the waiting.', detail: 'Kernel-buffered methods cost copies but the kernel handles the waiting. Shared memory costs nothing to transfer, but you write the synchronisation.', ms: 4400 },
]

/** Text that fades in whenever its value changes. */
function Val({ x, y, v, size = 11.5, dim, weight = 500 }: { x: number; y: number; v: string; size?: number; dim?: boolean; weight?: number }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
      <text x={x} y={y} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>{v}</text>
    </motion.g>
  )
}

const BYTES = ['a', 'b', 'c', 'd', 'e']

export default function IpcMessagePassing() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const mode = s <= 3 ? 'msg' : s <= 5 ? 'pipe' : 'shm'
        const aCall = s === 0 ? '' : mode === 'msg' ? (s >= 2 ? 'send(B, "hello")' : '…') : mode === 'pipe' ? 'write(fd[1], "abcde", 5)' : s >= 7 ? 'lock(); x = 42; unlock();' : 'p = map_shared(…)'
        const bCall = s === 0 ? '' : mode === 'msg' ? 'receive(&buf)' : mode === 'pipe' ? (s >= 5 ? 'read(fd[0], buf, 3)' : '…') : s >= 7 ? 'lock(); v = x; unlock();' : 'p = map_shared(…)'
        const bState = s === 1 || s === 2 ? 'blocked' : 'running'
        const aBuf = mode === 'msg' ? { label: 'buf: hello', sub: 'private memory' } : mode === 'pipe' ? { label: 'buf: abcde', sub: 'private memory' } : { label: 'page @ 0x40000000', sub: s >= 7 ? 'x = 42' : 'x = 0' }
        const bBuf = mode === 'msg' ? { label: s >= 3 ? 'buf: hello' : 'buf: (empty)', sub: 'private memory' } : mode === 'pipe' ? { label: s >= 5 ? 'buf: abc' : 'buf: (empty)', sub: 'private memory' } : { label: 'page @ 0x70000000', sub: s >= 7 ? 'x = 42' : 'x = 0' }
        const pipeHas = (i: number) => (s === 4 ? i < 5 : s === 5 ? i >= 3 && i < 5 : false)
        return (
          <Scene label={meta.summary}>
            {/* ---- process A ---- */}
            <Block x={20} y={30} w={220} h={205} state={s === 2 || s === 4 || s === 7 ? 'on' : 'off'} />
            <Label x={32} y={54} size={13} mono={false} weight={600}>Process A</Label>
            <Val x={32} y={76} v="running" size={10.5} dim weight={400} />
            <Val x={32} y={110} v={aCall} size={11} />
            <Block x={32} y={150} w={196} h={50} label={aBuf.label} sub={aBuf.sub} size={12} mono state={mode === 'shm' && s >= 6 ? 'on' : 'off'} />

            {/* ---- process B ---- */}
            <Block x={560} y={30} w={220} h={205} state={s === 3 || s === 5 ? 'on' : s === 1 || s === 2 ? 'dim' : 'off'} />
            <Label x={572} y={54} size={13} mono={false} weight={600}>Process B</Label>
            <Val x={572} y={76} v={bState} size={10.5} dim={bState === 'running'} weight={bState === 'running' ? 400 : 600} />
            <Val x={572} y={110} v={bCall} size={11} />
            <Block x={572} y={150} w={196} h={50} label={bBuf.label} sub={bBuf.sub} size={12} mono state={mode === 'shm' && s >= 6 ? 'on' : 'off'} />
            <Pulse x={740} y={72} on={s === 1} r={12} />

            {/* ---- the wall between address spaces ---- */}
            <Appear on={s <= 5}>
              <line x1={400} x2={400} y1={40} y2={225} stroke="var(--viz-dim)" strokeDasharray="4 5" />
              <rect x={318} y={118} width={164} height={36} fill="var(--viz-bg)" />
              <Label x={400} y={133} size={11} anchor="middle" dim={s !== 0} weight={s === 0 ? 600 : 400}>no shared addresses</Label>
              <Label x={400} y={149} size={10.5} anchor="middle" dim>A ✕ B</Label>
            </Appear>

            {/* ---- physical frame for shared memory ---- */}
            <Appear on={s >= 6}>
              <Label x={400} y={88} size={10.5} anchor="middle" dim>PHYSICAL RAM</Label>
              <Block x={320} y={96} w={160} h={56} label="frame 0x00321000" sub={s >= 7 ? 'x = 42' : 'x = 0'} size={12} mono state={s >= 6 && s <= 7 ? 'on' : 'off'} />
              <Label x={400} y={176} size={11} anchor="middle" on={s === 7} weight={600}>both lock() before touching x</Label>
            </Appear>
            <Wire d="M228 175 C 280 175, 280 124, 318 124" on={s >= 6} dashed />
            <Wire d="M572 175 C 520 175, 520 124, 482 124" on={s >= 6} dashed />

            {/* ---- user / kernel boundary ---- */}
            <line x1={20} x2={780} y1={248} y2={248} stroke="var(--viz-dim)" strokeDasharray="4 4" />
            <Block x={20} y={256} w={760} h={94} state="off" />
            <Label x={32} y={276} size={11} dim>KERNEL</Label>

            {/* message queue */}
            <Appear on={mode === 'msg'}>
              <Label x={300} y={276} size={10.5} dim>B's message queue (post box)</Label>
              {[0, 1, 2].map((i) => (
                <Block key={i} x={300 + i * 70} y={286} w={70} h={42} mono size={12}
                  label={i === 0 && s === 2 ? 'hello' : undefined} state={i === 0 && s === 2 ? 'on' : 'off'} />
              ))}
            </Appear>

            {/* pipe ring buffer */}
            <Appear on={mode === 'pipe'}>
              <Label x={232} y={276} size={10.5} dim>pipe buffer (circular)</Label>
              {Array.from({ length: 8 }, (_, i) => (
                <Block key={i} x={232 + i * 42} y={286} w={42} h={42} mono size={14}
                  label={pipeHas(i) ? BYTES[i] : undefined} state={pipeHas(i) ? (s === 4 ? 'on' : 'off') : 'off'} />
              ))}
              <Label x={232 + (s >= 5 ? 3 : 0) * 42 + 21} y={343} size={10.5} anchor="middle">▲ read</Label>
              <Label x={232 + 5 * 42 + 21} y={343} size={10.5} anchor="middle">▲ write</Label>
              <Label x={600} y={300} size={10.5} dim>fd[1] → write end</Label>
              <Label x={600} y={318} size={10.5} dim>fd[0] → read end</Label>
            </Appear>

            {/* page tables for shared memory */}
            <Appear on={mode === 'shm'}>
              <Label x={232} y={276} size={10.5} dim>page tables</Label>
              <Label x={232} y={302} size={12}>A: 0x40000000 → frame 0x00321000</Label>
              <Label x={232} y={326} size={12}>B: 0x70000000 → frame 0x00321000</Label>
            </Appear>

            {/* ---- motion ---- */}
            <Packet on={s === 2} points={[[130, 200], [130, 248], [335, 307]]} duration={1.8} />
            <Label x={200} y={312} size={11} weight={600} on={s === 2}>copy 1 →</Label>
            <Packet on={s === 3} points={[[335, 307], [670, 248], [670, 200]]} duration={1.8} />
            <Label x={520} y={312} size={11} weight={600} on={s === 3}>→ copy 2</Label>
            {BYTES.map((b, i) => (
              <Packet key={b} on={s === 4} points={[[130, 200], [130, 248], [253 + i * 42, 307]]} duration={1.6} delay={i * 0.22} r={4} />
            ))}
            {[0, 1, 2].map((i) => (
              <Packet key={i} on={s === 5} points={[[253 + i * 42, 307], [670, 248], [670, 200]]} duration={1.6} delay={i * 0.25} r={4} />
            ))}
            <Packet on={s === 7} points={[[228, 175], [275, 150], [320, 124]]} duration={1.2} />
            <Packet on={s === 7} points={[[482, 124], [525, 150], [572, 175]]} duration={1.2} delay={1.4} />

            {/* ---- comparison ---- */}
            <Block x={20} y={358} w={760} h={72} state={s === 8 ? 'on' : 'dim'} />
            <Label x={30} y={374} size={10.5} dim>METHOD</Label>
            <Label x={220} y={374} size={10.5} dim>COPIES</Label>
            <Label x={330} y={374} size={10.5} dim>WHO HANDLES THE WAITING</Label>
            <Appear on={s >= 3}>
              <Label x={30} y={392} size={11}>message passing</Label>
              <Label x={220} y={392} size={11} weight={600}>2</Label>
              <Label x={330} y={392} size={11}>kernel: receiver blocks until a message arrives</Label>
            </Appear>
            <Appear on={s >= 5}>
              <Label x={30} y={408} size={11}>pipe</Label>
              <Label x={220} y={408} size={11} weight={600}>2</Label>
              <Label x={330} y={408} size={11}>kernel: reader waits if empty, writer if full</Label>
            </Appear>
            <Appear on={s >= 7}>
              <Label x={30} y={424} size={11}>shared memory</Label>
              <Label x={220} y={424} size={11} weight={600}>0</Label>
              <Label x={330} y={424} size={11}>you: a lock or semaphore in the shared page</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
