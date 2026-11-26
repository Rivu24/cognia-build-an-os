/* Pointers as addresses of byte boxes. Worked example (first principles, checked by hand):
   int is 4 bytes (sizeof(int) = 4 with gcc on x86 and x86-64). x = 42 = 0x2A at 0x1000 is stored little-endian: 2A 00 00 00.
   int arr[4] = {10, 20, 30, 40} at 0x2000 = 0A.. 14.. 1E.. 28.. ; arr + 1 = 0x2000 + 1 * 4 = 0x2004,
   (uint8_t *)arr + 1 = 0x2001, arr + 2 = 0x2008 and *(arr + 2) = arr[2] = 30. Address 0 (NULL) is left unmapped by
   hosted OSes, so dereferencing it raises a page fault. Addresses 0x1000 and 0x2000 are example values. */
import { useEffect, type ReactNode } from 'react'
import { motion, useSpring, useTransform, type Transition } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'c-pointers-memory',
  title: 'C pointers: addresses of byte boxes',
  summary: 'Memory as numbered byte boxes: int x = 42 at 0x1000, a pointer p that holds 0x1000, *p = 7 writing through it, pointer arithmetic that moves by sizeof(int) on an int array, a uint8_t pointer that moves by 1, arr[i] as *(arr + i), and a NULL dereference that faults.',
  lessons: ['p3l1'],
  articles: ['C'],
  group: 'Basics',
  order: 50,
}

const steps: VizStep[] = [
  { caption: 'Memory is one long row of numbered boxes. Each box holds one byte.', detail: 'The number of a box is its address, and a pointer is just one of these numbers. C lets you use them directly, which is why the wiki calls it a "portable Assembly".', ms: 4200 },
  { caption: 'int x = 42; puts x in 4 boxes, starting at 0x1000.', detail: 'An int is 4 bytes (sizeof(int) = 4 with gcc on x86). 42 is 0x2A, and x86 stores the low byte first: 2A 00 00 00.', ms: 4400 },
  { caption: 'int *p = &x; makes p hold the address of x: 0x1000.', detail: '&x means "the address of x". p is a variable too, with its own box; what it holds is a number that names where x lives.', ms: 4400 },
  { caption: '*p = 7; follows the address and writes 7 into x.', detail: 'The * in front of p means "the box p points to". Nothing touched x by name, yet x is now 7: the byte at 0x1000 became 07.', ms: 4400 },
  { caption: 'An array is boxes in a row. p = arr; points p at the first one.', detail: 'int arr[4] = {10, 20, 30, 40} at 0x2000 takes 4 × 4 = 16 bytes. Used as a value, arr turns into &arr[0], which is 0x2000.', ms: 4600 },
  { caption: 'p + 1 is 0x2004, not 0x2001. It moves by one whole int.', detail: 'Pointer arithmetic counts elements, not bytes: p + n adds n × sizeof(*p). For an int pointer that is 0x2000 + 1 × 4 = 0x2004, which is arr[1].', ms: 4800 },
  { caption: 'A uint8_t pointer moves by 1, because a uint8_t is 1 byte.', detail: '(uint8_t *)arr turns arr into a byte pointer; adding 1 gives 0x2001, the second byte of arr[0]. A hex dump walks memory exactly like this, one byte at a time.', ms: 4800 },
  { caption: 'arr[i] is just *(arr + i). arr[2] is the int at 0x2008: 30.', detail: 'arr + 2 = 0x2000 + 2 × 4 = 0x2008, and * reads the int stored there. The [] syntax is pointer arithmetic plus a dereference.', ms: 4600 },
  { caption: 'p = NULL; *p = 7; points at address 0, and the CPU faults.', detail: 'Hosted OSes leave page 0 unmapped on purpose, so the access raises a page fault and the program is stopped. In your own kernel, address 0 is ordinary memory until you unmap page 0 yourself.', ms: 5200 },
]

/* weight: slow, heavy springs. Things settle like they have mass instead of snapping. */
const heavy: Transition = { type: 'spring', stiffness: 55, damping: 14, mass: 1.3 }
const lazy: Transition = { duration: 1.1, ease: [0.3, 0.05, 0.15, 1] }

// row A: x lives here
const AX = 140, AW = 52, AY = 66, AH = 44
const aMid = (i: number) => AX + i * AW + AW / 2
// row B: the array
const BX = 40, BW = 44, BY = 300, BH = 44
const bMid = (i: number) => BX + i * BW + BW / 2
// pointer boxes
const PX = 250, PY = 176, PW = 180, PH = 60
const QX = 24

const ARR = ['0A', '00', '00', '00', '14', '00', '00', '00', '1E', '00', '00', '00', '28', '00', '00', '00']
const ARR_LABEL = ['arr[0] = 10', 'arr[1] = 20', 'arr[2] = 30', 'arr[3] = 40']

const CODE: [string, string][] = [
  ['0x1000  0x1001  0x1002 …', '// every address names one byte'],
  ['int x = 42;', '// sizeof(int) = 4 → 4 boxes, 42 = 0x2A'],
  ['int *p = &x;', '// &x = the address of x = 0x1000'],
  ['*p = 7;', '// go to 0x1000, write 7 there'],
  ['p = arr;', '// arr becomes &arr[0] = 0x2000'],
  ['p = p + 1;', '// 0x2000 + 1 × sizeof(int) = 0x2004'],
  ['uint8_t *b = (uint8_t *)arr + 1;', '// 0x2000 + 1 × sizeof(uint8_t) = 0x2001'],
  ['p = arr + 2;   // *p == arr[2]', '// 0x2000 + 2 × 4 = 0x2008 → reads 30'],
  ['p = NULL;   *p = 7;', '// address 0 is not mapped → fault'],
]

/** Text that drops in with weight whenever its value changes. */
function Val({ x, y, v, size = 13, anchor = 'middle', weight = 500, dim, delay = 0 }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean; delay?: number }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...heavy, delay, opacity: { ...lazy, delay } }}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: weight }}>
        {v}
      </text>
    </motion.g>
  )
}

/** Fades a whole part of the machine between present-but-quiet and live. */
function Faint({ on, children, low = 0.22 }: { on: boolean; children: ReactNode; low?: number }) {
  return <motion.g initial={false} animate={{ opacity: on ? 1 : low }} transition={lazy}>{children}</motion.g>
}

/** A pointer arrow whose ends swing on a heavy spring when the pointer changes. */
function Arrow({ from, to, on }: { from: [number, number]; to: [number, number]; on: boolean }) {
  const fx = useSpring(from[0], heavy), fy = useSpring(from[1], heavy)
  const tx = useSpring(to[0], heavy), ty = useSpring(to[1], heavy)
  useEffect(() => { fx.set(from[0]); fy.set(from[1]); tx.set(to[0]); ty.set(to[1]) }, [from, to, fx, fy, tx, ty])
  const d = useTransform([fx, fy, tx, ty], ([a, b, c, e]: number[]) => {
    const m = (b + e) / 2
    return `M${a} ${b} C ${a} ${m}, ${c} ${m}, ${c} ${e}`
  })
  return (
    <motion.path d={d} fill="none" stroke="var(--viz-fg)" strokeWidth={1.8} markerEnd="url(#viz-arrow)"
      initial={false} animate={{ opacity: on ? 1 : 0 }} transition={lazy} />
  )
}

/** Where p points at each step: [from, to] in scene coordinates. */
function pTarget(s: number): { from: [number, number]; to: [number, number] } {
  const up = (x: number): { from: [number, number]; to: [number, number] } => ({ from: [PX + 50, PY], to: [x, AY + AH + 5] })
  const down = (i: number): { from: [number, number]; to: [number, number] } => ({ from: [PX + 90, PY + PH], to: [bMid(i), BY - 5] })
  if (s <= 3) return up(aMid(0))
  if (s === 4) return down(0)
  if (s <= 6) return down(4)
  if (s === 7) return down(8)
  return up(66)
}

const P_VAL = ['', '', '0x1000', '0x1000', '0x2000', '0x2004', '0x2004', '0x2008', '0x0 (NULL)']

export default function CPointersMemory() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const xv = s >= 3 ? ['07', '00', '00', '00'] : s >= 1 ? ['2A', '00', '00', '00'] : ['··', '··', '··', '··']
        const rowA = [...xv, '··', '··', '··', '··']
        const aState = (i: number) =>
          s === 0 ? (i === 0 ? 'on' : 'off')
            : s === 1 || s === 3 ? (i < 4 ? 'on' : 'off')
              : s === 2 ? (i === 0 ? 'on' : 'off')
                : 'dim'
        const bState = (i: number) =>
          s === 4 ? (i === 0 ? 'on' : 'off')
            : s === 5 ? (i >= 4 && i < 8 ? 'on' : i < 4 ? 'dim' : 'off')
              : s === 6 ? (i === 1 || i === 4 ? 'on' : 'off')
                : s === 7 ? (i >= 8 && i < 12 ? 'on' : 'dim')
                  : s === 8 ? 'dim' : 'off'
        const pt = pTarget(s)
        const [code, comment] = CODE[s]
        return (
          <Scene label={meta.summary}>
            <Label x={20} y={20} size={11} dim>MEMORY · one box = one byte, named by its address</Label>

            {/* ===== address 0 (only matters at the end) ===== */}
            <Faint on={s === 8} low={0.18}>
              <Label x={66} y={58} size={10.5} anchor="middle" dim>0x0</Label>
              <Block x={24} y={AY} w={84} h={AH} state="hatch" />
              <Label x={66} y={40} size={10.5} anchor="middle" dim>not mapped</Label>
            </Faint>
            <Label x={124} y={AY + 27} size={13} anchor="middle" dim>…</Label>

            {/* ===== row A: x ===== */}
            <Appear on={s >= 1} dy={-6}>
              <Val x={AX + 2 * AW} y={38} v={s >= 3 ? 'int x = 7' : 'int x = 42'} size={12} />
              <line x1={AX + 2} x2={AX + 4 * AW - 2} y1={44} y2={44} stroke="var(--viz-dim)" />
            </Appear>
            {rowA.map((v, i) => (
              <g key={i}>
                <Label x={aMid(i)} y={58} size={10.5} anchor="middle" dim={!(s === 0 || (s <= 3 && i === 0))}>{`0x${(0x1000 + i).toString(16).toUpperCase()}`}</Label>
                <Block x={AX + i * AW} y={AY} w={AW} h={AH} state={aState(i)} />
                <Val x={aMid(i)} y={AY + 27} v={v} size={15} dim={v === '··'} delay={i < 4 ? i * 0.09 : 0} />
              </g>
            ))}
            <Pulse x={aMid(0)} y={AY + AH / 2} on={s === 0 || s === 3} r={20} />

            {/* ===== the CPU fault (last step) ===== */}
            <motion.g initial={false} animate={{ opacity: s === 8 ? 1 : 0, x: s === 8 ? [0, 0, -6, 6, -4, 4, -2, 0] : 0 }}
              transition={s === 8 ? { opacity: lazy, x: { duration: 0.9, delay: 1.6 } } : lazy}>
              <Block x={590} y={AY - 6} w={186} h={56} label="page fault (#PF)" sub="Segmentation fault" size={13} state="on" />
            </motion.g>
            <Pulse x={66} y={AY + AH / 2} on={s === 8} r={22} />

            {/* ===== pointers ===== */}
            <Appear on={s >= 2} dy={10}>
              <Block x={PX} y={PY} w={PW} h={PH} state={s === 2 || s === 5 || s === 7 || s === 8 ? 'on' : 'off'} />
              <Label x={PX + 12} y={PY + 20} size={11} dim>int *p  (holds an address)</Label>
              <Val x={PX + PW - 12} y={PY + 46} v={P_VAL[s] || '0x1000'} size={18} anchor="end" />
            </Appear>
            <Arrow from={pt.from} to={pt.to} on={s >= 2} />

            <Faint on={s === 6} low={s > 6 ? 0.3 : 0}>
              <Block x={QX} y={PY} w={180} h={PH} state={s === 6 ? 'on' : 'off'} />
              <Label x={QX + 12} y={PY + 20} size={11} dim>uint8_t *b</Label>
              <Label x={QX + 168} y={PY + 46} size={18} anchor="end" weight={500}>0x2001</Label>
            </Faint>
            <Arrow from={[QX + 82, PY + PH]} to={[bMid(1), BY - 5]} on={s === 6} />

            {/* ===== code panel ===== */}
            <Block x={460} y={164} w={316} h={76} state="off" />
            <Label x={472} y={180} size={10.5} dim>C</Label>
            <Val x={472} y={204} v={code} size={s === 6 ? 13.5 : 15} anchor="start" />
            <Val x={472} y={228} v={comment} size={11} anchor="start" dim delay={0.25} />

            {/* ===== row B: the array ===== */}
            <Faint on={s >= 4}>
              <Label x={BX + 16 * BW} y={288} size={11} anchor="end" dim>int arr[4] = {'{10, 20, 30, 40}'}</Label>
              {ARR.map((v, i) => (
                <g key={i}>
                  <Block x={BX + i * BW} y={BY} w={BW} h={BH} state={bState(i)} />
                  <Val x={bMid(i)} y={BY + 27} v={s >= 4 ? v : '··'} size={14} dim={s < 4} delay={s === 4 ? i * 0.05 : 0} />
                </g>
              ))}
              {[0, 1, 2, 3].map((k) => (
                <g key={k}>
                  <line x1={BX + k * 176 + 2} x2={BX + k * 176 + 174} y1={BY + BH + 6} y2={BY + BH + 6} stroke="var(--viz-faint)" />
                  <Label x={BX + k * 176 + 88} y={BY + BH + 20} size={11} anchor="middle" dim={!(s === 7 && k === 2) && !(s === 5 && k === 1)} weight={(s === 7 && k === 2) || (s === 5 && k === 1) ? 600 : 400}>{ARR_LABEL[k]}</Label>
                  <Label x={BX + k * 176 + 2} y={BY + BH + 37} size={10.5} dim>{`0x${(0x2000 + k * 4).toString(16).toUpperCase()}`}</Label>
                </g>
              ))}
            </Faint>

            {/* how far +1 moves */}
            <Appear on={s === 5 || s === 6} dy={6}>
              <path d={`M${BX + 1} 392 L${BX + 1} 398 L${BX + 4 * BW - 1} 398 L${BX + 4 * BW - 1} 392`} fill="none" stroke="var(--viz-fg)" strokeWidth={1.4} />
              <Label x={BX + 2 * BW} y={414} size={11} anchor="middle" weight={500}>int *: +1 = 4 bytes</Label>
            </Appear>
            <Appear on={s === 6} dy={6} delay={0.5}>
              <path d={`M${BX + 1} 420 L${BX + 1} 426 L${BX + BW - 1} 426 L${BX + BW - 1} 420`} fill="none" stroke="var(--viz-fg)" strokeWidth={1.4} />
              <Label x={BX + BW + 10} y={430} size={11} weight={500}>uint8_t *: +1 = 1 byte</Label>
            </Appear>

            {/* ===== motion with meaning ===== */}
            <Packet on={s === 3} points={[[PX + 50, PY], [PX + 50, 150], [aMid(0), 150], [aMid(0), AY + AH + 4]]} duration={2.4} label="7" />
            <Packet on={s === 7} points={[[bMid(10), BY - 4], [bMid(10), 262], [600, 262], [600, 242]]} duration={2.4} label="30" />
            <Packet on={s === 8} points={[[PX + 50, PY], [PX + 50, 150], [66, 150], [66, AY + AH + 4]]} duration={2.4} label="*p" />
          </Scene>
        )
      }}
    </VizStage>
  )
}
