/* cdecl (System V i386) call of  r = add(2, 3)  with  int add(int a, int b) { int sum = a + b; return sum; }
   Code addresses (NASM encodings):
     caller 0x00100020 6A 03 push 3 | 0x00100022 6A 02 push 2 | 0x00100024 E8 rel32 call add | 0x00100029 83 C4 08 add esp, 8
     add    0x00100040 55 push ebp | 0x00100041 89 E5 mov ebp, esp | 0x00100043 83 EC 04 sub esp, 4
            0x00100046 8B 45 08 mov eax, [ebp+8] | 0x00100049 03 45 0C add eax, [ebp+12] | 0x0010004C 89 45 FC mov [ebp-4], eax
            0x0010004F C9 leave | 0x00100050 C3 ret
   Stack starts with ESP = 0x00108000 (the caller's last item) and EBP = 0x00108010 (the caller's frame). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'stack-calling-convention',
  title: 'The stack and the cdecl calling convention',
  summary: 'A call to add(2, 3) on i386: arguments pushed right to left, the return address, the EBP frame, a local at [ebp-4], the result in EAX, then leave, ret and caller cleanup.',
  lessons: ['t1m3l3', 't4m2l6', 'p4l5', 'p2l4'],
  articles: ['Stack', 'Calling Conventions'],
  group: 'CPU',
  order: 133,
}

const steps: VizStep[] = [
  { caption: 'The caller wants r = add(2, 3). ESP points at the top of the stack: 0x00108000.', detail: 'On x86 the stack grows down: each push subtracts 4 from ESP, then stores 4 bytes there.' },
  { caption: 'cdecl: the caller pushes the arguments right to left, 3 first, then 2.', detail: 'Pushing in reverse leaves the first argument (a = 2) at the lowest address, closest to the callee.' },
  { caption: 'call add pushes the return address 0x00100029, then jumps to add.', detail: 'The return address is the instruction right after the call. ESP is now 0x00107FF4.' },
  { caption: 'Prologue: push ebp; mov ebp, esp. EBP now marks this frame.', detail: "The caller's EBP (0x00108010) is saved on the stack so it can be restored later. EBP = ESP = 0x00107FF0." },
  { caption: 'sub esp, 4 makes room for the local variable sum.', detail: 'Locals live below EBP. Nothing is written yet: the slot holds whatever was there before.' },
  { caption: 'Arguments sit above EBP: a at [ebp+8], b at [ebp+12].', detail: '[ebp+0] is the saved EBP and [ebp+4] the return address, so the first argument is always at [ebp+8]. EAX = 2 + 3.', ms: 3800 },
  { caption: 'sum is stored at [ebp-4]. The return value stays in EAX = 5.', detail: 'cdecl returns integers in EAX. EAX, ECX and EDX are scratch; EBX, ESI, EDI, EBP must be preserved.' },
  { caption: 'leave (mov esp, ebp; pop ebp), then ret pops the return address into EIP.', detail: "EBP is the caller's again and execution continues at 0x00100029. The old slots still hold data but are now free." , ms: 3800 },
  { caption: 'The caller cleans up: add esp, 8 drops the two arguments. ESP = 0x00108000.', detail: 'In cdecl the caller removes what it pushed. r = EAX = 5.' },
]

/* ---------- code listing ---------- */
type Line = { addr?: string; text: string; label?: boolean }
const CODE: Line[] = [
  { text: 'caller:', label: true },
  { addr: '00100020', text: 'push 3' },
  { addr: '00100022', text: 'push 2' },
  { addr: '00100024', text: 'call add' },
  { addr: '00100029', text: 'add  esp, 8' },
  { text: 'add:', label: true },
  { addr: '00100040', text: 'push ebp' },
  { addr: '00100041', text: 'mov  ebp, esp' },
  { addr: '00100043', text: 'sub  esp, 4' },
  { addr: '00100046', text: 'mov  eax, [ebp+8]' },
  { addr: '00100049', text: 'add  eax, [ebp+12]' },
  { addr: '0010004C', text: 'mov  [ebp-4], eax' },
  { addr: '0010004F', text: 'leave' },
  { addr: '00100050', text: 'ret' },
]
const CY = 66
const CH = 19
const lineY = (i: number) => CY + i * CH
/** code lines executed in each step */
const RUN: number[][] = [[], [1, 2], [3], [6, 7], [8], [9, 10], [11], [12, 13], [4]]

/* ---------- stack ---------- */
const SX = 420
const SW = 170
const SY = 64
const SH = 36
const ADDRS = ['0x00108000', '0x00107FFC', '0x00107FF8', '0x00107FF4', '0x00107FF0', '0x00107FEC', '0x00107FE8']
const slotY = (i: number) => SY + i * SH
const slotC = (i: number) => SY + i * SH + SH / 2

/* per-step register values */
const ESP_SLOT = [0, 2, 3, 4, 5, 5, 5, 2, 0]
const EBP_SLOT = [-1, -1, -1, 4, 4, 4, 4, -1, -1]
const ESP = ['0x00108000', '0x00107FF8', '0x00107FF4', '0x00107FF0', '0x00107FEC', '0x00107FEC', '0x00107FEC', '0x00107FF8', '0x00108000']
const EBP = ['0x00108010', '0x00108010', '0x00108010', '0x00107FF0', '0x00107FF0', '0x00107FF0', '0x00107FF0', '0x00108010', '0x00108010']
const EAX = ['????????', '????????', '????????', '????????', '????????', '0x00000005', '0x00000005', '0x00000005', '0x00000005']
const EIP = ['0x00100020', '0x00100024', '0x00100040', '0x00100043', '0x00100046', '0x0010004C', '0x0010004F', '0x00100029', '0x0010002C']

function Val({ x, y, v, size = 11, anchor = 'middle', dim }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; dim?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={ease}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)' }}>{v}</text>
    </motion.g>
  )
}

/** A pointer tag (ESP / EBP) that slides to a stack slot. */
function Tag({ x, slot, name, on = true }: { x: number; slot: number; name: string; on?: boolean }) {
  return (
    <motion.g initial={false} animate={{ y: slotC(Math.max(0, slot)), opacity: on ? 1 : 0 }} transition={{ type: 'spring', stiffness: 140, damping: 18 }}>
      <path d={`M${x} 0 L${x + 6} -6 L${x + 6} 6 Z`} fill="var(--viz-fg)" />
      <rect x={x + 6} y={-10} width={40} height={20} fill="var(--viz-fg)" />
      <text x={x + 26} y={4} textAnchor="middle" fill="var(--viz-bg)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{name}</text>
    </motion.g>
  )
}

export default function StackCallingConvention() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const run = RUN[s]
        // which slots are live (above or at ESP) and which are written
        const written = [true, s >= 1, s >= 1, s >= 2, s >= 3, s >= 4, false]
        const live = (i: number) => written[i] && i <= ESP_SLOT[s]
        const slotState = (i: number): 'on' | 'off' | 'dim' | 'fill' | 'hatch' => {
          if (i === 0) return 'hatch'
          if (!written[i]) return 'dim'
          if (!live(i)) return 'dim'
          const fresh = (s === 1 && (i === 1 || i === 2)) || (s === 2 && i === 3) || (s === 3 && i === 4) || (s === 4 && i === 5) || (s === 5 && (i === 1 || i === 2)) || (s === 6 && i === 5)
          return fresh ? 'on' : 'off'
        }
        const SLOT: [string, string | undefined][] = [
          ["caller's data", undefined],
          ['b = 3', 'arg 2'],
          ['a = 2', 'arg 1'],
          ['return address', '0x00100029'],
          ['saved EBP', '0x00108010'],
          [s >= 6 ? 'sum = 5' : 'sum = ?', 'local'],
          ['', undefined],
        ]
        // the frame grows by one slot when sub esp, 4 reserves the local (step index 4)
        const frameEnd = s >= 4 ? slotY(6) - 2 : slotY(5) - 2
        const offsets: [number, string, boolean][] = [[1, '[ebp+12]', s === 5], [2, '[ebp+8]', s === 5], [3, '[ebp+4]', false], [4, '[ebp+0]', false], [5, '[ebp-4]', s === 6]]
        return (
          <Scene label={meta.summary}>
            {/* ---------- code ---------- */}
            <Label x={20} y={44} size={11} dim>CODE</Label>
            {CODE.map((l, i) => {
              const active = run.includes(i)
              return (
                <g key={i}>
                  <motion.rect x={20} y={lineY(i) - 13} width={250} height={CH - 1} initial={false}
                    animate={{ opacity: active ? 1 : 0 }} transition={ease} fill="var(--viz-fg)" />
                  {l.addr && (
                    <motion.text x={28} y={lineY(i)} initial={false} animate={{ fill: active ? 'var(--viz-bg)' : 'var(--viz-dim)' }} transition={ease}
                      style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{l.addr}</motion.text>
                  )}
                  <motion.text x={l.label ? 28 : 100} y={lineY(i)} initial={false} animate={{ fill: active ? 'var(--viz-bg)' : 'var(--viz-fg)' }} transition={ease}
                    style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: l.label ? 600 : 400 }}>{l.text}</motion.text>
                </g>
              )
            })}

            {/* C source */}
            <Label x={20} y={350} size={11} dim>C SOURCE</Label>
            {['int add(int a, int b) {', 'int sum = a + b;', 'return sum;', '}', 'r = add(2, 3);'].map((t, i) => (
              <Label key={i} x={i === 1 || i === 2 ? 44 : 20} y={370 + i * 15} size={11.5} dim={i < 4 ? s < 3 || s > 7 : s >= 3 && s <= 6}>{t}</Label>
            ))}

            {/* ---------- stack ---------- */}
            <Label x={SX} y={44} size={11} dim>STACK (higher addresses at the top)</Label>
            {ADDRS.map((a, i) => (
              <Label key={a} x={SX - 8} y={slotC(i) + 4} size={10.5} anchor="end" dim={!(written[i] && live(i))}>{a}</Label>
            ))}
            {ADDRS.map((a, i) => (
              <rect key={a} x={SX} y={slotY(i)} width={SW} height={SH} fill="none" stroke="var(--viz-faint)" />
            ))}
            {SLOT.map(([lab, sub], i) => (
              <g key={i}>
                {i === 0 || i === 6 ? (
                  <Block x={SX} y={slotY(i)} w={SW} h={SH} label={lab || undefined} size={12} state={slotState(i)} />
                ) : (
                  <Appear on={written[i]} dx={30} dy={0}>
                    <Block x={SX} y={slotY(i)} w={SW} h={SH} label={lab} sub={sub} size={12} mono state={slotState(i)} />
                  </Appear>
                )}
              </g>
            ))}
            <Wire from={[SX + SW / 2, slotY(7) + 4]} to={[SX + SW / 2, slotY(7) + 22]} dim />
            <Label x={SX + SW / 2 + 12} y={slotY(7) + 18} size={10.5} dim>grows down</Label>

            {/* frame brace for add */}
            <Appear on={s >= 3 && s <= 6} dx={-6} dy={0}>
              <motion.line x1={SX - 96} x2={SX - 96} y1={slotY(3) + 2} initial={false} animate={{ y2: frameEnd }} transition={ease} stroke="var(--viz-fg)" />
              <line x1={SX - 96} x2={SX - 90} y1={slotY(3) + 2} y2={slotY(3) + 2} stroke="var(--viz-fg)" />
              <motion.line x1={SX - 96} x2={SX - 90} initial={false} animate={{ y1: frameEnd, y2: frameEnd }} transition={ease} stroke="var(--viz-fg)" />
            </Appear>
            <motion.g initial={false} animate={{ y: (slotY(3) + 2 + frameEnd) / 2 + 4 }} transition={ease}>
              <Label x={SX - 100} y={0} size={10.5} anchor="end" on={s >= 3 && s <= 6}>frame</Label>
            </motion.g>

            {/* pointer tags + offsets */}
            <Tag x={SX + SW + 4} slot={ESP_SLOT[s]} name="ESP" />
            <Tag x={SX + SW + 54} slot={EBP_SLOT[s]} name="EBP" on={EBP_SLOT[s] >= 0} />
            {offsets.map(([slot, txt, hot]) => (
              <Label key={txt} x={SX + SW + 110} y={slotC(slot) + 4} size={11} on={s >= 5 && s <= 6 && (slot !== 4)} dim={!hot} weight={hot ? 600 : 400}>{txt}</Label>
            ))}
            <Pulse x={SX + 14} y={slotC(2)} r={10} on={s === 5} />
            <Pulse x={SX + 14} y={slotC(5)} r={10} on={s === 6} />

            {/* ---------- registers ---------- */}
            {(['ESP', 'EBP', 'EAX', 'EIP'] as const).map((r, i) => {
              const v = r === 'ESP' ? ESP[s] : r === 'EBP' ? EBP[s] : r === 'EAX' ? EAX[s] : EIP[s]
              const prev = s === 0 ? v : r === 'ESP' ? ESP[s - 1] : r === 'EBP' ? EBP[s - 1] : r === 'EAX' ? EAX[s - 1] : EIP[s - 1]
              const hot = v !== prev && !(r === 'EIP')
              const x = 370 + i * 103
              return (
                <g key={r}>
                  <Block x={x} y={360} w={95} h={50} state={hot || (r === 'EIP' && (s === 2 || s === 7)) ? 'on' : 'off'} />
                  <Label x={x + 47.5} y={380} size={12} anchor="middle" weight={600}>{r}</Label>
                  <Val x={x + 47.5} y={399} v={v} size={11} dim={v.startsWith('?')} />
                </g>
              )
            })}
            <Label x={370} y={432} size={10.5} dim>registers after this step</Label>

            {/* motion: pushes, call, return */}
            <Packet on={s === 1} points={[[270, lineY(1) - 4], [340, lineY(1) - 4], [340, slotC(1)], [SX, slotC(1)]]} duration={1.2} label="3" />
            <Packet on={s === 1} points={[[270, lineY(2) - 4], [330, lineY(2) - 4], [330, slotC(2)], [SX, slotC(2)]]} duration={1.2} delay={0.9} label="2" />
            <Packet on={s === 2} points={[[270, lineY(3) - 4], [340, lineY(3) - 4], [340, slotC(3)], [SX, slotC(3)]]} duration={1.4} label="ret" />
            <Packet on={s === 3} points={[[520, 360], [520, 345], [610, 345], [610, slotC(4)], [SX + SW, slotC(4)]]} duration={1.4} label="EBP" />
            <Packet on={s === 5} points={[[SX + SW / 2, slotC(2)], [SX + SW / 2 + 40, slotC(2)], [SX + SW / 2 + 40, 352], [623, 352], [623, 360]]} duration={1.4} r={4} />
            <Packet on={s === 6} points={[[623, 360], [623, 340], [SX + SW / 2, 340], [SX + SW / 2, slotY(6)]]} duration={1.2} r={4} />
            <Packet on={s === 7} points={[[SX + SW, slotC(3)], [700, slotC(3)], [700, 345], [726, 345], [726, 360]]} duration={1.4} label="pop → EIP" />
            <Pulse x={255} y={lineY(4) - 4} r={10} on={s === 7} />
            <Label x={262} y={lineY(4)} size={10.5} on={s === 7}>← next</Label>
          </Scene>
        )
      }}
    </VizStage>
  )
}
