/* Stack trace by walking saved frame pointers (x86, cdecl, 32-bit), as in the Stack Trace article:
   struct stackframe { struct stackframe *ebp; uint32_t eip; } and loop stk = stk->ebp until NULL.
   Worked example: _start -> kmain -> page_alloc -> panic. All addresses are a consistent made-up kernel
   (symbols: _start 0x00100000, kmain 0x00101000, page_alloc 0x00101170, panic 0x00101200). */
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'stack-trace-walk',
  title: 'Stack trace: walking the EBP chain',
  summary: 'How each stack frame stores the caller\'s EBP and a return address, and how a kernel walks that chain and maps addresses to function names.',
  lessons: ['t4m2l6', 't4m2l4'],
  articles: ['Stack Trace', 'Stack', 'Kernel Debugging'],
  group: 'CPU',
  order: 426,
}

const steps: VizStep[] = [
  { caption: 'Each call pushes a return address; the callee then pushes the caller\'s EBP.', detail: 'Here _start called kmain, kmain called page_alloc, page_alloc called panic. The stack grows down: newest frame at the bottom.' },
  { caption: 'push ebp; mov ebp, esp: EBP now points at the saved EBP.', detail: 'So [EBP] = the caller\'s EBP and [EBP+4] = the return address. The frames form a linked list.' },
  { caption: 'Read [ebp+4] = 0x001011A7: where execution returns, inside page_alloc.', detail: 'EBP = 0x00107FE0, so the return address sits at 0x00107FE4. That is the first line of the trace.' },
  { caption: 'Follow the link: ebp = [ebp] = 0x00107FEC, the caller\'s frame.', detail: 'One load moves you up one frame. No unwinding tables needed, only the saved EBP values.' },
  { caption: 'Repeat: [ebp+4] = 0x00101024 (in kmain), then ebp = [ebp] = 0x00107FF8.', detail: 'Same two loads at every level: print the return address, step to the saved EBP.' },
  { caption: '[ebp+4] = 0x0010000B; then [ebp] = 0, so the walk stops.', detail: 'Boot code runs xor ebp, ebp before call kmain, so the chain ends in NULL instead of running into garbage.' },
  { caption: 'Symbols turn addresses into names: find the largest symbol ≤ the address.', detail: '0x001011A7 − 0x00101170 = 0x37 → page_alloc+0x37. addr2line -e kernel.elf 0x001011A7 also gives file and line.', ms: 4000 },
  { caption: 'Without -fno-omit-frame-pointer, functions can drop out of the trace.', detail: 'If page_alloc does not save EBP, panic\'s saved EBP points straight at kmain\'s frame, and kmain+0x24 never gets printed.', ms: 4200 },
]

const AX = 120 /* address labels (anchor end) */
const COLX = 128
const COLW = 220
const TOP = 66
const RH = 34
const yc = (i: number) => TOP + i * RH + RH / 2
const ADDR = (i: number) => '0x' + (0x107ffc - 4 * i).toString(16).toUpperCase().padStart(8, '0')

const FRAMES = [
  { name: 'kmain', from: 0, to: 2 },
  { name: 'page_alloc', from: 3, to: 5 },
  { name: 'panic', from: 6, to: 8 },
]

/* row of the frame EBP points to at each step */
function ebpRow(s: number): number | undefined {
  if (s === 1 || s === 2) return 7
  if (s === 3) return 4
  if (s === 4) return 1
  if (s === 7) return 7
  return undefined
}
const EBP_VAL = ['—', '0x00107FE0', '0x00107FE0', '0x00107FEC', '0x00107FF8', '0x00000000', '0x00000000', '0x00107FE0']

export default function StackTraceWalk() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const omit = s === 7
        const rows = [
          'ret → 0x0010000B',
          'saved EBP = 0',
          'local',
          'ret → 0x00101024',
          omit ? 'local (EBP not saved)' : 'saved EBP = 0x00107FF8',
          'local',
          'ret → 0x001011A7',
          omit ? 'saved EBP = 0x00107FF8' : 'saved EBP = 0x00107FEC',
          'local',
        ]
        const er = ebpRow(s)
        const reading = s === 2 ? 6 : s === 4 ? 3 : s === 5 ? 0 : undefined
        const rowState = (i: number): 'on' | 'off' | 'dim' | 'fill' | 'hatch' => {
          if (omit && i === 4) return 'hatch'
          if (i === er || i === reading) return 'on'
          if (s >= 2 && s <= 6 && (i === 2 || i === 5 || i === 8)) return 'dim'
          return 'off'
        }
        const trace: [string, string, boolean][] = omit
          ? [['#0 0x001011A7', 'page_alloc+0x37', true], ['#1 0x0010000B', '_start+0x0B', true], ['', 'kmain+0x24 missing', false]]
          : [['#0 0x001011A7', 'page_alloc+0x37', s >= 2], ['#1 0x00101024', 'kmain+0x24', s >= 4], ['#2 0x0010000B', '_start+0x0B', s >= 5]]
        return (
          <Scene label={meta.summary}>
            {/* ── stack ── */}
            <Label x={COLX} y={40} size={11} dim>STACK · HIGH ADDRESSES AT TOP</Label>
            <Label x={COLX} y={56} size={10.5} dim>grows down ↓</Label>
            {rows.map((r, i) => (
              <Appear key={i} on delay={s === 0 ? i * 0.12 : 0}>
                <Block x={COLX} y={TOP + i * RH} w={COLW} h={RH} state={rowState(i)} />
                <Label x={COLX + 10} y={yc(i) + 4} size={12} weight={i % 3 === 2 ? 400 : 500} dim={i % 3 === 2}>{r}</Label>
                <Label x={AX} y={yc(i) + 4} size={10.5} anchor="end" dim={i !== er}>{ADDR(i)}</Label>
              </Appear>
            ))}
            {er !== undefined && <Pulse x={COLX + COLW - 14} y={yc(er)} on r={10} />}

            {/* frame brackets */}
            {FRAMES.map((f, k) => {
              const y1 = TOP + f.from * RH + 4
              const y2 = TOP + (f.to + 1) * RH - 4
              const hot = (s === 2 && k === 2) || (s === 3 && k === 1) || (s === 4 && k === 1) || (s === 5 && k === 0)
              return (
                <g key={k} opacity={omit && k === 1 ? 0.45 : 1}>
                  <path d={`M400 ${y1} L404 ${y1} L404 ${y2} L400 ${y2}`} fill="none" stroke={hot ? 'var(--viz-fg)' : 'var(--viz-dim)'} strokeWidth={hot ? 2 : 1} />
                  <Label x={412} y={(y1 + y2) / 2 + 4} size={11} weight={hot ? 500 : 400} dim={!hot}>{f.name}</Label>
                </g>
              )
            })}

            {/* EBP chain */}
            <Wire d={`M${COLX + COLW} ${yc(7)} C 392 ${yc(7)}, 392 ${yc(4)}, ${COLX + COLW + 4} ${yc(4)}`} on={s >= 1 && !omit} dim={s === 1} />
            <Wire d={`M${COLX + COLW} ${yc(4)} C 392 ${yc(4)}, 392 ${yc(1)}, ${COLX + COLW + 4} ${yc(1)}`} on={s >= 1 && !omit} dim={s === 1} />
            <Wire d={`M${COLX + COLW} ${yc(7)} C 394 ${yc(7)}, 394 ${yc(1)}, ${COLX + COLW + 4} ${yc(1)}`} on={omit} />
            <Packet on={s === 2} points={[[300, yc(7)], [300, yc(6)], [496, 288]]} duration={1.8} />
            <Packet on={s === 3} points={[[COLX + COLW, yc(7)], [384, (yc(7) + yc(4)) / 2], [COLX + COLW, yc(4)]]} duration={1.4} />
            <Packet on={s === 4} points={[[300, yc(4)], [300, yc(3)], [496, 308], [COLX + COLW, yc(4)], [384, (yc(4) + yc(1)) / 2], [COLX + COLW, yc(1)]]} duration={3} />
            <Packet on={s === 5} points={[[300, yc(1)], [300, yc(0)], [496, 328]]} duration={1.8} />
            <Label x={COLX + COLW - 10} y={yc(1) + 4} size={10.5} anchor="end" weight={500} on={s >= 5 && s <= 6}>NULL → stop</Label>

            <Label x={COLX} y={402} size={11} on={s >= 5} dim={s !== 5}>boot: xor ebp, ebp → call kmain</Label>
            <Label x={COLX} y={424} size={12} weight={500} on={omit}>gcc -fno-omit-frame-pointer</Label>

            {/* ── EBP register + code ── */}
            <Block x={490} y={50} w={280} h={46} label="EBP" sub={EBP_VAL[s]} mono size={13} state={s >= 1 && s <= 5 ? 'on' : 'off'} />
            <Appear on={s >= 1}>
              <Label x={490} y={120} size={10.5} dim>EVERY FUNCTION STARTS WITH</Label>
              <Label x={490} y={140} size={12.5} weight={s === 1 ? 500 : 400}>push ebp</Label>
              <Label x={600} y={140} size={12.5} weight={s === 1 ? 500 : 400}>mov ebp, esp</Label>
            </Appear>
            <Appear on={s >= 2}>
              <Label x={490} y={172} size={10.5} dim>THE WALK</Label>
              <Label x={490} y={192} size={11.5}>for (f = ebp; f; f = f-&gt;ebp)</Label>
              <Label x={490} y={210} size={11.5}>{'  print(f->eip);'}</Label>
            </Appear>

            {/* ── trace output ── */}
            <Block x={490} y={236} w={280} h={104} state={s === 6 ? 'on' : 'off'} />
            <Label x={500} y={256} size={10.5} dim>TRACE OUTPUT</Label>
            {trace.map(([a, n, on], i) => (
              <g key={i}>
                <Label x={500} y={288 + i * 20} size={11.5} weight={500} on={on}>{a}</Label>
                <Label x={606} y={288 + i * 20} size={11.5} on={(s >= 6 && on) || (omit && i === 2)} dim={omit && i === 2} weight={on ? 500 : 400}>{n}</Label>
              </g>
            ))}

            {/* ── symbols ── */}
            <Appear on={s >= 6}>
              <Label x={490} y={364} size={10.5} dim>SYMBOLS FROM kernel.elf</Label>
              <Label x={490} y={384} size={10.5}>0x00100000 _start</Label>
              <Label x={636} y={384} size={10.5}>0x00101000 kmain</Label>
              <Label x={490} y={402} size={10.5} weight={s === 6 ? 500 : 400}>0x00101170 page_alloc</Label>
              <Label x={636} y={402} size={10.5}>0x00101200 panic</Label>
              <Label x={490} y={424} size={10.5} dim>$ addr2line -e kernel.elf 0x001011A7</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
