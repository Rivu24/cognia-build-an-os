/* GCC inline assembly constraints, using the wiki's own wrappers (Inline Assembly/Examples, exact text):
     __asm__ volatile ( "outb %b0, %w1" : : "a"(val), "Nd"(port) : "memory");
     __asm__ volatile ( "inb %w1, %b0" : "=a"(ret) : "Nd"(port) : "memory");
   Inline Assembly: operands are numbered %0, %1 ... from the first output on; 'a' = EAX; '=' = write-only output;
   "N" = a constant 0-255 usable directly by in/out; 'd' = EDX. volatile: "GCC will not delete a volatile asm if it is
   reachable"; "memory" in the clobbers stops the statement being moved.
   Encodings (Intel SDM): out dx, al = EE; out imm8, al = E6 ib; in al, imm8 = E4 ib. GCC prints immediates in decimal
   in the expanded template ($33 = 0x21, $96 = 0x60); objdump prints them in hex.
   Example values: outb(0x3F8, 0x41) -> COM1 data, 0x3F8 = 1016 > 255 so DX; outb(0x21, 0xFF) masks the master PIC
   (8259 PIC, PIC_disable); inb(0x60) -> 0x1E (set-1 scan code, A pressed); port 0x64 bit 0 = output buffer full
   ("8042" PS/2 Controller). */
import { motion, type Transition } from 'motion/react'
import type { ReactNode } from 'react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'inline-asm-constraints',
  title: 'Inline assembly constraints',
  summary: 'How the constraints in the wiki’s outb and inb wrappers make GCC put val in AL and the port in DX or an immediate, what the CPU then runs, and what volatile and the "memory" clobber prevent.',
  lessons: ['p4l5'],
  articles: ['Inline Assembly', 'Inline Assembly/Examples'],
  group: 'Basics',
  order: 61,
}

const steps: VizStep[] = [
  { caption: 'C has no way to say “out”, so outb() wraps one instruction in GCC inline assembly.', detail: 'The asm statement has four parts split by colons: the assembler template, outputs, inputs and clobbers. outb has no outputs, so that part is empty.', ms: 5200 },
  { caption: 'Operands are numbered in order: %0 is the first one, val; %1 is the second, port.', detail: 'Numbering starts at the first output. outb has none, so "a"(val) is %0 and "Nd"(port) is %1.', ms: 4600 },
  { caption: '"a"(val): GCC must load val into the A register. %b0 names its low byte, AL.', detail: 'Called as outb(0x3F8, 0x41), so AL = 0x41, the letter A. The out instruction can only send from AL, AX or EAX.', ms: 4800 },
  { caption: '"Nd"(port): N allows a constant 0–255, d means the DX register.', detail: '0x3F8 is 1016, too big for N, so GCC loads it into DX. %w1 names the 16-bit DX, the only register out accepts as a port.', ms: 4800 },
  { caption: 'GCC fills in the template, and the CPU sends AL to the port in DX: 0x41 to 0x3F8.', detail: 'The template becomes outb %al, %dx, a single byte: EE. GCC does not check the instruction; it only swaps %b0 and %w1 for register names.', ms: 5200 },
  { caption: 'A constant port below 256 takes the N path: outb(0x21, 0xFF) needs no DX.', detail: '%w1 becomes the immediate $33 (0x21) inside the instruction: e6 21. 0xFF to the master PIC data port masks every IRQ.', ms: 5000 },
  { caption: 'inb returns a value: "=a"(ret) means “after the asm, take ret from AL”.', detail: 'The = marks a write-only output. inb(0x60) is in $0x60,%al (e4 60). If A was just pressed, the keyboard returns 0x1E.', ms: 5400 },
  { caption: 'Why volatile: GCC assumes the same asm with the same inputs gives the same result.', detail: 'Polling inb(0x64) in a loop, it may read the port once and spin forever, or delete an inb whose result is unused. volatile forbids both.', ms: 5600 },
  { caption: 'Why "memory": without it, GCC may move memory writes past the asm.', detail: 'A device that reads a buffer must see it filled before outb starts it. The clobber keeps the store in front; volatile keeps the asm itself.', ms: 5800 },
]

const heavy: Transition = { type: 'spring', stiffness: 62, damping: 16, mass: 1.35 }
const slow: Transition = { duration: 1.1, ease: [0.16, 1, 0.3, 1] }

/** A group that drops into place on the heavy spring. */
function Drop({ on, children, delay = 0, dy = -14 }: { on: boolean; children: ReactNode; delay?: number; dy?: number }) {
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : dy }} transition={{ y: { ...heavy, delay: on ? delay : 0 }, opacity: { ...slow, delay: on ? delay : 0, duration: on ? 1.1 : 0.5 } }}>
      {children}
    </motion.g>
  )
}

/** Text that settles in whenever its value changes. */
function Val({ x, y, v, size = 15, anchor = 'start', weight = 500, dim, mono = true }: { x: number; y: number; v: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; dim?: boolean; mono?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={slow}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontWeight: weight }}>
        {v}
      </text>
    </motion.g>
  )
}

/* ---------- the asm statement, piece by piece ---------- */
type Role = 'kw' | 'vol' | 'p' | 'tpl' | 'op0' | 'op1' | 'out' | 'out0' | 'in0' | 'in1' | 'clob'
const OUTB: [string, Role][] = [
  ['__asm__ ', 'kw'], ['volatile', 'vol'], [' ( ', 'p'], ['"outb ', 'tpl'], ['%b0', 'op0'], [', ', 'tpl'], ['%w1', 'op1'], ['"', 'tpl'],
  [' :', 'p'], [' ', 'out'], [': ', 'p'], ['"a"(val)', 'in0'], [', ', 'p'], ['"Nd"(port)', 'in1'], [' : ', 'p'], ['"memory"', 'clob'], [');', 'p'],
]
const INB: [string, Role][] = [
  ['__asm__ ', 'kw'], ['volatile', 'vol'], [' ( ', 'p'], ['"inb ', 'tpl'], ['%w1', 'op1'], [', ', 'tpl'], ['%b0', 'op0'], ['"', 'tpl'],
  [' : ', 'p'], ['"=a"(ret)', 'out0'], [' : ', 'p'], ['"Nd"(port)', 'in1'], [' : ', 'p'], ['"memory"', 'clob'], [');', 'p'],
]
type Piece = { text: string; col: number; len: number; role: Role }
function layout(src: [string, Role][]): Piece[] {
  let c = 0
  return src.map(([t, role]) => {
    const lead = t.length - t.trimStart().length
    const p = { text: t.trim(), col: c + lead, len: t.length, role }
    c += t.length
    return p
  })
}
const P_OUTB = layout(OUTB)
const P_INB = layout(INB)
const CW = 9 // mono advance at 15px
const AX0 = 24
const AY = 96
const px = (c: number) => AX0 + c * CW
const span = (ps: Piece[], roles: Role[]): [number, number] => {
  const sel = ps.filter((p) => roles.includes(p.role))
  const a = Math.min(...sel.map((p) => p.col))
  const b = Math.max(...sel.map((p) => (p.text ? p.col + p.text.length : p.col + 1)))
  return [px(a), px(b)]
}
const mid = (ps: Piece[], role: Role) => { const [a, b] = span(ps, [role]); return (a + b) / 2 }

// which pieces each step points at
const FOCUS: Role[][] = [[], ['op0', 'op1', 'in0', 'in1'], ['op0', 'in0'], ['op1', 'in1'], ['tpl', 'op0', 'op1'], ['op1', 'in1'], ['out0', 'op0'], ['vol'], ['clob']]
// which part of the statement each step is about (bracket highlight)
const SEG_ON = ['all', 'in', 'in', 'in', 'tpl', 'in', 'out', 'none', 'clob']

/* ---------- middle diagram ---------- */
const RX = 250
const PX = 600, PW = 176
const PORTS: [string, string][] = [['0x21', 'PIC data'], ['0x60', 'keyboard data'], ['0x3F8', 'COM1 data']]
const portY = (i: number) => 172 + i * 46
const portC = (i: number) => portY(i) + 20

export default function InlineAsmConstraints() {
  return (
    <VizStage meta={meta} steps={steps} interval={5000}>
      {(s) => {
        const isInb = s === 6 || s === 7
        const ps = isInb ? P_INB : P_OUTB
        const focus = FOCUS[s]
        const seg = SEG_ON[s]
        const segs: { key: string; label: string; roles: Role[] }[] = [
          { key: 'tpl', label: 'TEMPLATE', roles: ['tpl', 'op0', 'op1'] },
          { key: 'out', label: isInb ? 'OUTPUTS' : 'OUTPUTS (none)', roles: [isInb ? 'out0' : 'out'] },
          { key: 'in', label: 'INPUTS', roles: isInb ? ['in1'] : ['in0', 'in1'] },
          { key: 'clob', label: 'CLOBBERS', roles: ['clob'] },
        ]
        // register and port contents per step
        const al = s === 2 || s === 3 || s === 4 ? '0x41' : s === 5 ? '0xFF' : s === 6 ? '0x1E' : '--'
        const dx = s === 3 || s === 4 ? '0x03F8' : '--'
        const portOn = s === 4 ? 2 : s === 5 ? 0 : s === 6 ? 1 : -1
        const tplText = s <= 1 ? 'outb %b0, %w1' : s === 2 ? 'outb %al, %w1' : s <= 4 ? 'outb %al, %dx' : s === 5 ? 'outb %al, $33' : 'inb $96, %al'
        const objd = s === 4 ? ['ee', 'out %al,(%dx)'] : s === 5 ? ['e6 21', 'out %al,$0x21'] : s === 6 ? ['e4 60', 'in $0x60,%al'] : null
        const note = s <= 1 ? 'registers not chosen yet' : s === 2 ? '%b0 → %al' : s === 3 ? '%w1 → %dx' : s === 4 ? 'AL = the data, DX = the port number' : s === 5 ? '33 = 0x21, fits N (0–255)' : '96 = 0x60; then ret = AL'
        const call = s >= 2 && s <= 4 ? 'outb(0x3F8, 0x41)' : s === 5 ? 'outb(0x21, 0xFF)' : s === 6 ? 'inb(0x60)' : ''
        return (
          <Scene label={meta.summary}>
            {/* ===== the C function and its asm statement ===== */}
            <Val x={24} y={30} size={13} weight={400} dim v={isInb ? 'static inline uint8_t inb(uint16_t port)' : 'static inline void outb(uint16_t port, uint8_t val)'} />
            {call && <Label x={776} y={30} size={11} dim anchor="end">called as</Label>}
            <Val x={776} y={48} size={13} anchor="end" v={call} />

            {segs.map((g) => {
              const [a, b] = span(ps, g.roles)
              const lit = seg === 'all' || seg === g.key
              return (
                <motion.g key={g.key} initial={false} animate={{ opacity: lit ? 1 : 0.3 }} transition={slow}>
                  <motion.path initial={false} animate={{ d: `M${a} 76 V70 H${Math.max(b, a + 8)} V76` }} transition={heavy} fill="none" stroke="var(--viz-dim)" strokeWidth={1} />
                  <motion.text initial={false} animate={{ x: (a + Math.max(b, a + 8)) / 2 }} transition={heavy} y={62} textAnchor="middle" fill="var(--viz-dim)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
                    {g.label}
                  </motion.text>
                </motion.g>
              )
            })}
            <motion.g key={isInb ? 'inb' : 'outb'} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={slow}>
              {ps.map((p, i) => {
                const hot = focus.includes(p.role)
                return p.text ? (
                  <g key={i}>
                    <motion.text x={px(p.col)} y={AY} initial={false} animate={{ opacity: focus.length && !hot ? 0.42 : 1 }} transition={slow}
                      fill="var(--viz-fg)" style={{ fontSize: 15, fontFamily: 'var(--font-mono)', fontWeight: hot ? 600 : 400 }}>
                      {p.text}
                    </motion.text>
                    <motion.rect x={px(p.col)} y={AY + 7} height={2} fill="var(--viz-fg)" initial={false}
                      animate={{ width: hot ? p.text.length * CW : 0 }} transition={{ ...slow, delay: 0.2 }} />
                  </g>
                ) : null
              })}
            </motion.g>
            {/* %0 / %1 ↔ the inputs they name */}
            <Wire d={`M${mid(P_OUTB, 'op0')} ${AY + 12} C ${mid(P_OUTB, 'op0')} ${AY + 44}, ${mid(P_OUTB, 'in0')} ${AY + 44}, ${mid(P_OUTB, 'in0')} ${AY + 14}`} on={s === 1 || s === 2} dashed width={1.2} />
            <Wire d={`M${mid(P_OUTB, 'op1')} ${AY + 12} C ${mid(P_OUTB, 'op1')} ${AY + 56}, ${mid(P_OUTB, 'in1')} ${AY + 56}, ${mid(P_OUTB, 'in1')} ${AY + 14}`} on={s === 1 || s === 3} dashed width={1.2} delay={0.25} />
            {/* labels sit beside each arrowhead, clear of the other arc */}
            <Label x={mid(P_OUTB, 'in0') + 9} y={AY + 30} size={11} weight={600} on={s === 1 || s === 2}>%0</Label>
            <Label x={mid(P_OUTB, 'in1') + 9} y={AY + 30} size={11} weight={600} on={s === 1 || s === 3}>%1</Label>
            {/* inb: the output is %0 */}
            <Wire d={`M${mid(P_INB, 'op0')} ${AY + 12} C ${mid(P_INB, 'op0')} ${AY + 44}, ${mid(P_INB, 'out0')} ${AY + 44}, ${mid(P_INB, 'out0')} ${AY + 14}`} on={s === 6} dashed width={1.2} />
            <Label x={mid(P_INB, 'out0')} y={AY + 50} size={11} anchor="middle" on={s === 6}>%0, write-only</Label>

            {/* ===== registers and ports (steps 0–6) ===== */}
            <Appear on={s <= 6} dy={10}>
              <motion.g initial={false} animate={{ opacity: s === 0 || s === 1 ? 0.35 : 1 }} transition={slow}>
                <Label x={24} y={160} size={11} dim>C VARIABLES</Label>
                <Block x={24} y={174} w={150} h={44} mono size={13} label={isInb ? 'ret' : 'val'}
                  sub={isInb ? '0x1E' : s === 5 ? '0xFF' : s >= 2 ? '0x41' : 'uint8_t'} state={s === 2 || s === 6 ? 'on' : s === 3 ? 'dim' : 'off'} />
                <Block x={24} y={230} w={150} h={44} mono size={13} label="port"
                  sub={isInb ? '0x60' : s === 5 ? '0x21' : s >= 2 ? '0x3F8' : 'uint16_t'} state={s === 3 || s === 5 ? 'on' : s === 2 ? 'dim' : 'off'} />

                <Label x={RX} y={160} size={11} dim>CPU REGISTERS</Label>
                <Block x={RX} y={174} w={130} h={44} mono size={13} label="EAX" state={s === 3 ? 'dim' : 'off'} />
                <Block x={RX + 130} y={174} w={60} h={44} mono size={12} label="AH" state={s === 3 ? 'dim' : 'off'} />
                <Block x={RX + 190} y={174} w={90} h={44} mono size={13} label="AL" sub={al} state={s === 2 || s === 4 || s === 5 || s === 6 ? 'on' : s === 3 ? 'dim' : 'off'} />
                <Block x={RX} y={230} w={130} h={44} mono size={13} label="EDX" state={s === 2 || s >= 5 ? 'dim' : 'off'} />
                <Block x={RX + 130} y={230} w={150} h={44} mono size={13} label="DX" sub={dx} state={s === 3 || s === 4 ? 'on' : s === 2 || s >= 5 ? 'dim' : 'off'} />
                <Label x={RX + 205} y={292} size={11} anchor="middle" dim on={s === 5 || s === 6}>DX not needed</Label>

                <Label x={PX} y={160} size={11} dim>I/O PORTS</Label>
                {PORTS.map(([p, d], i) => (
                  <Block key={p} x={PX} y={portY(i)} w={PW} h={40} mono size={13} label={p} sub={d} state={portOn === i ? 'on' : portOn >= 0 ? 'dim' : 'off'} />
                ))}
              </motion.g>

              {/* C variable → register */}
              <Wire from={[178, 196]} to={[RX - 4, 196]} on={s === 2} />
              <Wire from={[178, 252]} to={[RX - 4, 252]} on={s === 3} />
              <Packet on={s === 2} points={[[178, 196], [RX - 4, 196]]} duration={1.8} label="0x41" />
              <Packet on={s === 3} points={[[178, 252], [RX - 4, 252]]} duration={1.8} label="0x3F8" />
              <Label x={212} y={290} size={10.5} anchor="middle" dim on={s === 3}>1016 &gt; 255</Label>

              {/* out %al,(%dx): AL's byte to the port DX selects */}
              <Wire d={`M${RX + 284} 196 H565 V${portC(2)} H${PX - 4}`} on={s === 4} />
              <Wire d={`M${RX + 284} 252 H562`} on={s === 4} arrow={false} dashed delay={0.2} />
              <Packet on={s === 4} points={[[RX + 284, 196], [565, 196], [565, portC(2)], [PX - 4, portC(2)]]} duration={2.2} delay={0.4} label="0x41" />

              {/* out %al,$0x21: the port number rides inside the instruction */}
              <Wire d={`M${RX + 284} 196 H${PX - 4}`} on={s === 5} />
              <Packet on={s === 5} points={[[RX + 284, 196], [PX - 4, portC(0)]]} duration={1.8} delay={0.3} label="0xFF" />

              {/* in $0x60,%al then ret = AL */}
              <Wire d={`M${PX - 4} ${portC(1)} H565 V196 H${RX + 284}`} on={s === 6} />
              <Wire d={`M${RX + 235} 220 V224 H206 V196 H178`} on={s === 6} delay={0.5} />
              <Packet on={s === 6} points={[[PX - 4, portC(1)], [565, portC(1)], [565, 196], [RX + 284, 196], [RX + 235, 200], [RX + 235, 224], [206, 224], [206, 196], [178, 196]]} duration={3.2} delay={0.3} label="0x1E" />

              {/* what GCC emits */}
              <Block x={24} y={316} w={752} h={112} state="off" />
              <Label x={40} y={338} size={11} dim>WHAT GCC EMITS</Label>
              <Label x={40} y={368} size={12} dim>template</Label>
              <Val x={150} y={368} v={tplText} size={16} dim={s <= 1} />
              <Val x={430} y={368} v={note} size={12} dim mono={false} weight={400} />
              <Label x={40} y={404} size={12} dim>objdump -d</Label>
              <Drop on={!!objd} delay={0.3}>
                <Val x={150} y={404} v={objd ? objd[0] : ''} size={16} />
                <Val x={260} y={404} v={objd ? objd[1] : ''} size={16} />
              </Drop>
              <Label x={150} y={404} size={16} dim on={!objd}>…</Label>
            </Appear>

            {/* ===== step 7: volatile ===== */}
            <Drop on={s === 7} delay={0.2} dy={14}>
              <Label x={24} y={164} size={11} dim>POLLING A STATUS PORT</Label>
              <Label x={24} y={192} size={15} weight={500}>{'while ((inb(0x64) & 1) == 0) { }'}</Label>
              <Label x={24} y={214} size={12} dim mono={false}>wait until bit 0 of the PS/2 status port says a byte is ready</Label>
              {[0, 1].map((k) => {
                const cx = k === 0 ? 24 : 412
                const L = cx + 204, R = cx + 340, T = 270, B = 344
                return (
                  <g key={k}>
                    <Label x={cx} y={252} size={13} weight={600} mono={false}>{k === 0 ? 'asm without volatile' : 'asm volatile'}</Label>
                    <Block x={cx + 10} y={268} w={120} h={40} mono size={13} label="port 0x64" sub="status" state={k === 1 ? 'on' : 'off'} />
                    {k === 0 ? (
                      <>
                        <Wire from={[cx + 130, 288]} to={[L - 4, 288]} dashed />
                        <Label x={(cx + 130 + L) / 2} y={280} size={10.5} anchor="middle" dim>read once</Label>
                        <Wire d={`M${L} ${T} H${R} V${B} H${L} Z`} arrow={false} width={1.2} />
                        <Label x={(L + R) / 2} y={(T + B) / 2 + 4} size={11} anchor="middle" dim>old value</Label>
                        <Packet on={s === 7} points={[[L, T], [R, T], [R, B], [L, B], [L, T]]} duration={2.4} />
                      </>
                    ) : (
                      <>
                        <Wire d={`M${cx + 70} 308 V${B} H${R} V288 H${cx + 134}`} width={1.2} />
                        <Label x={(cx + 70 + R) / 2 + 20} y={B - 10} size={11} anchor="middle" dim>reads again every pass</Label>
                        <Packet on={s === 7} points={[[cx + 70, 308], [cx + 70, B], [R, B], [R, 288], [cx + 134, 288]]} duration={2.4} />
                      </>
                    )}
                    <Label x={cx} y={384} size={12} mono={false} dim={k === 0}>{k === 0 ? 'Same asm, same input → GCC may reuse the result:' : 'volatile = the asm has side effects:'}</Label>
                    <Label x={cx} y={404} size={12} mono={false} dim={k === 0}>{k === 0 ? 'the loop never sees the byte arrive.' : 'GCC runs it every time it is reached.'}</Label>
                  </g>
                )
              })}
            </Drop>

            {/* ===== step 8: the "memory" clobber ===== */}
            <Drop on={s === 8} delay={0.2} dy={14}>
              <Label x={24} y={164} size={11} dim>A DEVICE THAT READS A BUFFER IN RAM</Label>
              <Label x={24} y={192} size={14} weight={500}>{'buffer[0] = 0x41;  outb(port, START);'}</Label>
              <Label x={24} y={214} size={12} dim mono={false}>source order: fill the buffer, then tell the device to start</Label>
              <Label x={24} y={252} size={13} weight={600} mono={false}>without "memory"</Label>
              <Label x={412} y={252} size={13} weight={600} mono={false}>with "memory"</Label>
            </Drop>
            {/* left: GCC may sink the store below the asm. The two rows trade places after they land. */}
            <motion.g initial={false} animate={{ opacity: s === 8 ? 1 : 0, y: s === 8 ? 56 : 0 }} transition={{ opacity: slow, y: { ...heavy, delay: s === 8 ? 0.7 : 0 } }}>
              <Block x={24} y={266} w={300} h={40} mono size={13} label="buffer[0] = 0x41" state="dim" />
            </motion.g>
            <motion.g initial={false} animate={{ opacity: s === 8 ? 1 : 0, y: s === 8 ? -54 : 0 }} transition={{ opacity: slow, y: { ...heavy, delay: s === 8 ? 0.7 : 0 } }}>
              <Block x={24} y={320} w={300} h={40} mono size={13} label="outb(port, START)" state="on" />
            </motion.g>
            <Wire d="M330 286 C 360 296, 360 330, 330 340" on={s === 8} dashed delay={1.1} />
            <Label x={364} y={318} size={10.5} dim on={s === 8} delay={1.1}>moved</Label>
            <Appear on={s === 8} delay={0.4}>
              <Block x={412} y={266} w={300} h={40} mono size={13} label="buffer[0] = 0x41" state="off" />
              <line x1={404} x2={720} y1={313} y2={313} stroke="var(--viz-fg)" strokeWidth={2.2} />
              <Label x={730} y={317} size={10.5} dim>fence</Label>
              <Block x={412} y={320} w={300} h={40} mono size={13} label="outb(port, START)" state="on" />
              <Label x={24} y={392} size={12} mono={false} dim>The device may start before the buffer is written.</Label>
              <Label x={412} y={392} size={12} mono={false}>No memory access is moved across the asm.</Label>
              <Label x={24} y={414} size={12} mono={false} dim>GCC only knows registers; it cannot see the device.</Label>
              <Label x={412} y={414} size={12} mono={false}>volatile keeps the asm; "memory" keeps its place.</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
