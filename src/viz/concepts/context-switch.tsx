/* Software context switch (32-bit x86, cdecl), step by step through switch_to_task() from
   Brendan's Multi-tasking Tutorial, Step 1. Stack addresses are a worked example: A's kernel stack top
   (esp0) is 0xC0108000, B's is 0xC010A000, and each push moves ESP down by 4. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'context-switch',
  title: 'Context switch: switch_to_task(A → B)',
  summary: 'How a software task switch saves A on its own kernel stack, stores ESP in its TCB, loads B’s ESP, esp0 and CR3, pops B’s registers and returns into B.',
  lessons: ['t7m1l2', 't7m1l3'],
  articles: ['Context Switching', "Brendan's Multi-tasking Tutorial"],
  group: 'Tasks',
  order: 720,
}

const steps: VizStep[] = [
  { caption: 'Task A is running. Task B is paused: its registers wait on its own kernel stack.', detail: 'Each task has a TCB holding esp (saved stack pointer), esp0 (top of its kernel stack) and cr3 (its address space).' },
  { caption: 'A calls switch_to_task(B). CALL pushes the return address on A’s stack.', detail: 'cdecl: the argument (B’s TCB) is pushed first, then CALL pushes EIP. EAX, ECX and EDX are caller-saved, so they need no saving here.' },
  { caption: 'Push the callee-saved registers: EBX, ESI, EDI, EBP.', detail: 'The C code that called switch_to_task expects these four to survive the call, so they go onto A’s stack. ESP drops by 16.' },
  { caption: 'Save ESP into A’s TCB. All of A’s state is now on its stack.', detail: 'mov [edi+TCB.ESP], esp stores 0xC0107F68. That one number finds everything A pushed. EDI (A’s TCB address) is scratch: A’s EDI is saved.' },
  { caption: 'Load ESP from B’s TCB. From here on, the CPU uses B’s stack.', detail: 'ESI = B’s TCB address, read from the argument. current_task_TCB = B. Pushes and pops now touch B’s stack; A stays frozen.' },
  { caption: 'Write B’s esp0 into the TSS.', detail: 'If an interrupt arrives while B runs in ring 3, the CPU loads ESP from TSS.esp0. It must be B’s own kernel stack. EBX is scratch here: A’s value is already on A’s stack.' },
  { caption: 'B is in another process, so load B’s CR3. This flushes the TLB.', detail: 'The code compares CR3 first. Two threads of one process share CR3: the load is skipped and the TLB keeps its entries.' },
  { caption: 'Pop EBP, EDI, ESI, EBX: the values B pushed when it was switched out.', detail: 'B paused inside its own call to switch_to_task, so its stack has exactly the same layout as A’s does now.' },
  { caption: 'ret pops B’s saved EIP. B continues right after its own switch_to_task call.', detail: 'To B, switch_to_task simply returned. A later switch back to A pops A’s registers in the same way.', ms: 3800 },
]

const CODE = [
  '; task A runs kernel code',
  'push next_thread ;  call switch_to_task',
  'push ebx ;  push esi ;  push edi ;  push ebp',
  'mov edi,[current_task_TCB] ;  mov [edi+TCB.ESP],esp',
  'mov esi,[esp+(4+1)*4] ;  mov [current_task_TCB],esi ;  mov esp,[esi+TCB.ESP]',
  'mov ebx,[esi+TCB.ESP0] ;  mov [TSS.ESP0],ebx',
  'mov eax,[esi+TCB.CR3] ;  mov ecx,cr3 ;  cmp eax,ecx ;  je .doneVAS ;  mov cr3,eax',
  'pop ebp ;  pop edi ;  pop esi ;  pop ebx',
  'ret      ; EIP ← B’s saved return address',
]

const AX = 30, BX = 570, CW = 200 // task columns
const CX = 300, CPUW = 200 // CPU column
const SY = 150, SH = 30 // stack slots
const slotY = (i: number) => SY + i * SH + SH / 2
const REG_Y = { EIP: 46, ESP: 72, EBX: 108, ESI: 134, EDI: 160, EBP: 186, CR3: 222 }
const regMid = (r: keyof typeof REG_Y) => REG_Y[r] + 13

/** A register / field row: name on the left, value on the right. */
function Row({ x, y, w, h = 26, name, value, state = 'off' }: { x: number; y: number; w: number; h?: number; name: string; value: string; state?: 'on' | 'off' | 'dim' }) {
  return (
    <g>
      <Block x={x} y={y} w={w} h={h} label={name} mono size={11} align="start" state={state} />
      <motion.text key={value} x={x + w - 8} y={y + h / 2 + 4} textAnchor="end" initial={{ opacity: 0 }} animate={{ opacity: state === 'dim' ? 0.5 : 1 }} transition={{ duration: 0.5 }}
        fill="var(--viz-fg)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        {value}
      </motion.text>
    </g>
  )
}

const A_SLOTS = ['… A’s caller frames', 'arg: TCB* B', 'return EIP → A', 'EBX (A)', 'ESI (A)', 'EDI (A)', 'EBP (A)']
const B_SLOTS = ['… B’s caller frames', 'arg (B’s last call)', 'return EIP → B', 'EBX (B)', 'ESI (B)', 'EDI (B)', 'EBP (B)']

const ESP_VAL = ['0xC0107F80', '0xC0107F78', '0xC0107F68', '0xC0107F68', '0xC0109F68', '0xC0109F68', '0xC0109F68', '0xC0109F78', '0xC0109F7C']
const A_ESP_SLOT = [0, 2, 6, 6, 6, 6, 6, 6, 6]
const B_ESP_SLOT = [6, 6, 6, 6, 6, 6, 6, 2, 1]

export default function ContextSwitch() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const onB = s >= 4
        const aSlot = (i: number): 'on' | 'off' | 'dim' => {
          if (s >= 4) return 'dim'
          if (s === 1 && (i === 1 || i === 2)) return 'on'
          if (s === 2 && i >= 3) return 'on'
          return 'off'
        }
        const bSlot = (i: number): 'on' | 'off' | 'dim' => {
          if (s < 4) return 'dim'
          if (s === 7 && i >= 3) return 'on'
          if (s === 8 && i === 2) return 'on'
          if ((s === 7 && i >= 3) || (s >= 8 && i >= 2)) return 'dim'
          return 'off'
        }
        const regOwner = s >= 7 ? 'B’s value' : 'A’s value'
        return (
          <Scene label={meta.summary}>
            {/* column titles */}
            <Label x={AX} y={24} size={12} mono={false} weight={600}>Task A</Label>
            <Label x={AX + CW} y={24} size={11} anchor="end" weight={s < 4 ? 600 : 400} dim={s >= 4}>{s < 4 ? 'running' : 'paused'}</Label>
            <Label x={BX} y={24} size={12} mono={false} weight={600}>Task B</Label>
            <Label x={BX + CW} y={24} size={11} anchor="end" weight={s >= 8 ? 600 : 400} dim={s < 8}>{s >= 8 ? 'running' : s >= 4 ? 'resuming' : 'paused'}</Label>
            <Label x={CX} y={24} size={12} mono={false} weight={600}>CPU</Label>

            {/* TCBs */}
            <Row x={AX} y={34} w={CW} h={24} name="TCB A.esp" value={s >= 3 ? '0xC0107F68' : 'stale'} state={s === 3 ? 'on' : 'off'} />
            <Row x={AX} y={58} w={CW} h={24} name="TCB A.esp0" value="0xC0108000" />
            <Row x={AX} y={82} w={CW} h={24} name="TCB A.cr3" value="0x00210000" />
            <Row x={BX} y={34} w={CW} h={24} name="TCB B.esp" value="0xC0109F68" state={s === 4 ? 'on' : 'off'} />
            <Row x={BX} y={58} w={CW} h={24} name="TCB B.esp0" value="0xC010A000" state={s === 5 ? 'on' : 'off'} />
            <Row x={BX} y={82} w={CW} h={24} name="TCB B.cr3" value="0x00340000" state={s === 6 ? 'on' : 'off'} />

            {/* kernel stacks */}
            <Label x={AX} y={140} size={10.5} dim>A&apos;s KERNEL STACK (high addresses on top)</Label>
            <Label x={BX} y={140} size={10.5} dim>B&apos;s KERNEL STACK</Label>
            {A_SLOTS.map((t, i) => (
              <Appear key={i} on={i === 0 || (i <= 2 ? s >= 1 : s >= 2)} dy={-6} delay={i >= 3 ? (i - 3) * 0.12 : 0}>
                <Block x={AX} y={SY + i * SH} w={CW} h={SH} label={t} mono size={11} state={aSlot(i)} />
              </Appear>
            ))}
            {B_SLOTS.map((t, i) => (
              <Block key={i} x={BX} y={SY + i * SH} w={CW} h={SH} label={t} mono size={11} state={bSlot(i)} />
            ))}
            <Label x={AX} y={376} size={10.5} dim>grows down ↓</Label>

            {/* ESP markers */}
            <motion.g initial={false} animate={{ y: slotY(A_ESP_SLOT[s]) }} transition={{ type: 'spring', stiffness: 90, damping: 16 }}>
              <path d={`M${AX + CW + 2} 0 l8 -5 v10 z`} fill={onB ? 'var(--viz-dim)' : 'var(--viz-fg)'} />
              <Label x={AX + CW + 13} y={4} size={10.5} dim={onB} weight={onB ? 400 : 600}>{onB ? 'saved' : 'ESP'}</Label>
            </motion.g>
            <motion.g initial={false} animate={{ y: slotY(B_ESP_SLOT[s]) }} transition={{ type: 'spring', stiffness: 90, damping: 16 }}>
              <path d={`M${BX - 2} 0 l-8 -5 v10 z`} fill={onB ? 'var(--viz-fg)' : 'var(--viz-dim)'} />
              <Label x={BX - 13} y={4} size={10.5} anchor="end" dim={!onB} weight={onB ? 600 : 400}>{onB ? 'ESP' : 'saved'}</Label>
            </motion.g>

            {/* CPU registers */}
            <Row x={CX} y={REG_Y.EIP} w={CPUW} name="EIP" value={s === 0 ? 'in task A' : s < 8 ? 'switch_to_task' : 'in task B'} state={s === 1 || s === 8 ? 'on' : 'off'} />
            <Row x={CX} y={REG_Y.ESP} w={CPUW} name="ESP" value={ESP_VAL[s]} state={s === 3 || s === 4 ? 'on' : 'off'} />
            <Row x={CX} y={REG_Y.EBX} w={CPUW} name="EBX" value={s === 5 || s === 6 ? '0xC010A000 (scratch)' : regOwner} state={s === 2 || s === 5 || s === 7 ? 'on' : 'off'} />
            <Row x={CX} y={REG_Y.ESI} w={CPUW} name="ESI" value={s >= 4 && s <= 6 ? '→ TCB B (scratch)' : regOwner} state={s === 2 || s === 4 || s === 7 ? 'on' : 'off'} />
            <Row x={CX} y={REG_Y.EDI} w={CPUW} name="EDI" value={s >= 3 && s <= 6 ? '→ TCB A (scratch)' : regOwner} state={s === 2 || s === 3 || s === 7 ? 'on' : 'off'} />
            <Row x={CX} y={REG_Y.EBP} w={CPUW} name="EBP" value={regOwner} state={s === 2 || s === 7 ? 'on' : 'off'} />
            <Row x={CX} y={REG_Y.CR3} w={CPUW} name="CR3" value={s >= 6 ? '0x00340000' : '0x00210000'} state={s === 6 ? 'on' : 'off'} />
            <Label x={CX + CPUW / 2} y={264} size={11} anchor="middle" weight={600} on={s === 6}>TLB flushed</Label>
            <Row x={CX} y={276} w={CPUW} h={30} name="TSS.esp0" value={s >= 5 ? '0xC010A000' : '0xC0108000'} state={s === 5 ? 'on' : 'off'} />
            <Row x={CX} y={318} w={CPUW} h={30} name="current_task" value={s >= 4 ? 'TCB B' : 'TCB A'} state={s === 4 ? 'on' : 'off'} />
            <Pulse x={CX + CPUW / 2} y={REG_Y.CR3 + 13} on={s === 6} />

            {/* data moving */}
            <Packet on={s === 1} points={[[CX, regMid('EIP')], [AX + CW, slotY(2)]]} duration={1.4} label="EIP" />
            {(['EBX', 'ESI', 'EDI', 'EBP'] as const).map((r, k) => (
              <Packet key={r} on={s === 2} points={[[CX, regMid(r)], [AX + CW, slotY(3 + k)]]} duration={1.4} delay={k * 0.3} />
            ))}
            <Packet on={s === 3} points={[[CX, regMid('ESP')], [AX + CW, 46]]} duration={1.2} label="esp" />
            <Packet on={s === 4} points={[[BX, 46], [CX + CPUW, regMid('ESP')]]} duration={1.2} label="esp" />
            <Packet on={s === 5} points={[[BX, 70], [CX + CPUW + 30, 70], [CX + CPUW + 30, 291], [CX + CPUW, 291]]} duration={1.8} label="esp0" />
            <Packet on={s === 6} points={[[BX, 94], [CX + CPUW + 18, 94], [CX + CPUW + 18, regMid('CR3')], [CX + CPUW, regMid('CR3')]]} duration={1.6} label="cr3" />
            {(['EBP', 'EDI', 'ESI', 'EBX'] as const).map((r, k) => (
              <Packet key={r} on={s === 7} points={[[BX, slotY(6 - k)], [CX + CPUW, regMid(r)]]} duration={1.4} delay={k * 0.3} />
            ))}
            <Packet on={s === 8} points={[[BX, slotY(2)], [CX + CPUW, regMid('EIP')]]} duration={1.4} label="EIP" />

            {/* the instructions doing the work */}
            {CODE.map((c, i) => (
              <Label key={i} x={AX} y={418} size={12} on={s === i}>{c}</Label>
            ))}
          </Scene>
        )
      }}
    </VizStage>
  )
}
