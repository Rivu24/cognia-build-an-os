/* Symbol resolution and relocation (Linkers: object files carry a symbol table — what they offer and what is missing —
   and relocations that say how to patch the code once a missing item is found).
   Worked example, i386, encoded by hand (Intel SDM) and checkable with objdump -d / nm / readelf -r:
     main.o .text (17 bytes):  00 55 | 01 89 e5 | 03 6a 03 | 05 6a 02 | 07 e8 fc ff ff ff | 0c 83 c4 08 | 0f c9 | 10 c3
       push ebp; mov ebp,esp; push 3; push 2; call add; add esp,8; leave; ret
       relocation: offset 0x8, R_386_PC32, symbol add. i386 ELF uses REL (implicit addend), so GAS stores the addend -4
       in the field itself: fc ff ff ff.  nm main.o:  00000000 T main,  U add
     add.o .text (11 bytes):   00 55 | 01 89 e5 | 03 8b 45 08 | 06 03 45 0c | 09 5d | 0a c3   (eax = a + b),  nm: 00000000 T add
   ld -m elf_i386 -e main main.o add.o -o prog: .text starts at 0x08049000 (ld's i386 default). main.o's .text ends at
   0x08049010; add.o's .text is assumed to ask for 16-byte alignment (sh_addralign 16, what .p2align 4 or
   gcc -falign-functions=16 produce), so it goes to 0x08049020 after 15 bytes of padding. With alignment 1 it would
   follow main directly at 0x08049011 and rel32 would be 0x05; the method is the same.
   nm sorts by name, so nm main.o prints U add before T main.
   Patch: P = 0x08049008, next instruction = 0x0804900C, S = 0x08049020.
     rel32 = S - next = 0x14  (= S + A - P = 0x08049020 - 4 - 0x08049008), stored little-endian: 14 00 00 00. */
import { motion, type Transition } from 'motion/react'
import type { ReactNode } from 'react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'linker-symbol-resolution',
  title: 'Linking: symbols and relocations',
  summary: 'main.o calls add but leaves a placeholder, a U symbol and a relocation; the linker places both .text sections at 0x08049000 and 0x08049020, resolves add and patches the call to rel32 = 0x14.',
  lessons: ['p5l2'],
  articles: ['Linkers'],
  group: 'Basics',
  order: 70,
}

const steps: VizStep[] = [
  { caption: 'Two object files, compiled separately. main.o calls add, but add lives in add.o.', detail: 'Each .o holds machine code plus two lists: the symbols it offers or needs, and relocations that say how to fix the code later.', ms: 4800 },
  { caption: 'The compiler cannot know where add will be, so the call holds a placeholder.', detail: 'e8 is call with a 4-byte relative offset. Those 4 bytes are left for the linker; for now they hold fc ff ff ff, which is −4.', ms: 4800 },
  { caption: 'main.o’s symbol table: main is T (defined here, in .text), add is U (undefined).', detail: 'This is what nm main.o prints. Addresses in an object file count from 0, because nothing has been placed yet.', ms: 4800 },
  { caption: 'A relocation records where to patch: offset 8, type R_386_PC32, symbol add.', detail: 'readelf -r main.o lists it. PC32 means “store the target as a distance from here”, not as an absolute address.', ms: 4800 },
  { caption: 'The linker merges the .text sections and gives each one a final address.', detail: 'main.o’s 17 bytes go to 0x08049000. add.o’s .text asks for 16-byte alignment, so it starts at 0x08049020 after 15 bytes of padding.', ms: 5400 },
  { caption: 'Resolve: main.o’s U add matches add.o’s T add, which now lives at 0x08049020.', detail: 'The linker checks every undefined symbol against the other files’ symbol tables. Every one must be found exactly once.', ms: 5000 },
  { caption: 'Patch: rel32 = target − next instruction = 0x08049020 − 0x0804900C = 0x14.', detail: 'The CPU adds rel32 to the address just after the 5-byte call. Same sum from the field: 0x08049020 − 4 − 0x08049008. Stored as 14 00 00 00.', ms: 6000 },
  { caption: 'At run time the call lands on add: 0x0804900C + 0x14 = 0x08049020.', detail: 'nm prog now shows final addresses: 08049000 T main and 08049020 T add. No dangling references are left.', ms: 5200 },
  { caption: 'Leave add.o off the command line and nothing defines add: the link fails.', detail: "ld reports “undefined reference to `add'” at main.o (.text+0x8), the relocation it could not fill, and writes no program.", ms: 5600 },
]

const heavy: Transition = { type: 'spring', stiffness: 62, damping: 16, mass: 1.35 }
const slow: Transition = { duration: 1.1, ease: [0.16, 1, 0.3, 1] }

function Drop({ on, children, delay = 0, dx = 0, dy = -16 }: { on: boolean; children: ReactNode; delay?: number; dx?: number; dy?: number }) {
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0, x: on ? 0 : dx, y: on ? 0 : dy }} transition={{ x: { ...heavy, delay: on ? delay : 0 }, y: { ...heavy, delay: on ? delay : 0 }, opacity: { ...slow, delay: on ? delay : 0, duration: on ? 1.1 : 0.5 } }}>
      {children}
    </motion.g>
  )
}
function Fade({ o, children }: { o: number; children: ReactNode }) {
  return <motion.g initial={false} animate={{ opacity: o }} transition={slow}>{children}</motion.g>
}
/** Mono text that can be pointed at (bold + full ink) or pushed back (dim) and settles in when its value changes. */
function T({ x, y, v, size = 12.5, hot, dim, anchor = 'start', sans }: { x: number; y: number; v: string; size?: number; hot?: boolean; dim?: boolean; anchor?: 'start' | 'middle' | 'end'; sans?: boolean }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={slow}>
      <motion.text x={x} y={y} textAnchor={anchor} initial={false} animate={{ opacity: dim ? 0.5 : 1 }} transition={slow}
        fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: sans ? 'var(--font-sans)' : 'var(--font-mono)', fontWeight: hot ? 700 : 400 }}>
        {v}
      </motion.text>
    </motion.g>
  )
}

/* ---- left column: the two object files ---- */
const LX = 20, LW = 316
const MY = 36, MH = 204 // main.o box
const AY = 258, AH = 138 // add.o box
const C_OFF = 34, C_BYTES = 62, C_NOTE = 208
const MAIN_ROWS: [string, string, string][] = [
  ['00', '55 89 e5', 'set up stack frame'],
  ['03', '6a 03 6a 02', 'push 3, push 2'],
  ['07', 'e8 fc ff ff ff', 'call add'],
  ['0c', '83 c4 08 c9 c3', 'tidy up, return'],
]
const ADD_ROWS: [string, string, string][] = [
  ['00', '55 89 e5', 'set up stack frame'],
  ['03', '8b 45 08 03 45 0c', 'eax = a + b'],
  ['09', '5d c3', 'pop ebp, return'],
]
const mainRowY = (i: number) => 86 + i * 20
const addRowY = (i: number) => AY + 48 + i * 20
const BCW = 7.5 // mono advance at 12.5px

/* ---- right column: the linked program ---- */
const OX = 474, OW = 200
const M_TOP = 80, M_H = 85 // 17 bytes at 5 px each
const P_TOP = M_TOP + M_H, P_H = 75 // 15 bytes of padding
const A_TOP = P_TOP + P_H, A_H = 55 // 11 bytes
const BAND_Y = M_TOP + 7 * 5 // call starts at offset 7
const BAND_H = 25
const PANEL_Y = 316

export default function LinkerSymbolResolution() {
  return (
    <VizStage meta={meta} steps={steps} interval={5000}>
      {(s) => {
        const fail = s === 8
        const placed = s >= 4 && !fail
        const patched = s >= 6 && !fail
        const callBytes = patched ? '14 00 00 00' : fail ? '?? ?? ?? ??' : 'fc ff ff ff'
        return (
          <Scene label={meta.summary}>
            {/* ===================== main.o ===================== */}
            <Block x={LX} y={MY} w={LW} h={MH} state={s === 0 || fail ? 'on' : 'off'} />
            <Label x={LX + 12} y={MY + 22} size={13} weight={600} mono={false}>main.o</Label>
            <Label x={LX + LW - 12} y={MY + 22} size={11} dim anchor="end">.text · 17 bytes</Label>
            {/* the call row: the one instruction the linker has to finish */}
            <motion.rect x={LX + 6} y={mainRowY(2) - 15} width={LW - 12} height={21} fill="none" initial={false}
              animate={{ stroke: s === 1 || s === 3 || fail ? 'var(--viz-fg)' : 'var(--viz-faint)', strokeWidth: s === 1 || s === 3 || fail ? 1.8 : 1, opacity: s >= 1 ? 1 : 0 }} transition={slow}
              filter={s === 1 || fail ? 'url(#viz-glow)' : undefined} />
            {MAIN_ROWS.map(([o, b, n], i) => {
              const call = i === 2
              const back = s >= 1 && s <= 3 && !call
              return (
                <g key={o}>
                  <T x={C_OFF} y={mainRowY(i)} v={o} dim />
                  <T x={C_BYTES} y={mainRowY(i)} v={b} dim={back} hot={call && s === 1} />
                  <T x={C_NOTE} y={mainRowY(i)} v={n} size={11} dim={!call || back} />
                </g>
              )
            })}
            {/* the 4 placeholder bytes = offset 8..11 */}
            <motion.line x1={C_BYTES + 3 * BCW} x2={C_BYTES + 14 * BCW} y1={mainRowY(2) + 4} y2={mainRowY(2) + 4} stroke="var(--viz-fg)" strokeWidth={2}
              initial={false} animate={{ pathLength: s === 1 || s === 3 || fail ? 1 : 0, opacity: s === 1 || s === 3 || fail ? 1 : 0 }} transition={slow} />
            <line x1={LX + 10} x2={LX + LW - 10} y1={164} y2={164} stroke="var(--viz-faint)" />
            <Label x={LX + LW - 12} y={206} size={10.5} dim anchor="end">symbols (nm)</Label>
            <T x={C_OFF} y={206} v="00000000 T main" size={13} hot={s === 2} dim={s === 1 || s === 3 || s === 5 || fail} />
            <T x={C_OFF + 9 * 7.8} y={186} v="U add" size={13} hot={s === 2 || s === 5 || fail} dim={s === 1 || s === 3} />
            <Label x={LX + LW - 12} y={MY + MH - 12} size={10.5} dim anchor="end">relocation</Label>
            <T x={C_OFF} y={MY + MH - 12} v="@8  R_386_PC32  add" size={12} hot={s === 3 || fail} dim={s >= 1 && s <= 2} />

            {/* ===================== add.o ===================== */}
            <Drop on={!fail} dx={-30} dy={0}>
              <Block x={LX} y={AY} w={LW} h={AH} state={s === 0 ? 'on' : 'off'} />
              <Label x={LX + 12} y={AY + 22} size={13} weight={600} mono={false}>add.o</Label>
              <Label x={LX + LW - 12} y={AY + 22} size={11} dim anchor="end">.text · 11 bytes</Label>
              {ADD_ROWS.map(([o, b, n], i) => (
                <g key={o}>
                  <T x={C_OFF} y={addRowY(i)} v={o} dim />
                  <T x={C_BYTES} y={addRowY(i)} v={b} dim={s >= 1 && s <= 3} />
                  <T x={C_NOTE} y={addRowY(i)} v={n} size={11} dim />
                </g>
              ))}
              <line x1={LX + 10} x2={LX + LW - 10} y1={AY + 104} y2={AY + 104} stroke="var(--viz-faint)" />
              <Label x={LX + LW - 12} y={AY + 124} size={10.5} dim anchor="end">symbols (nm)</Label>
              <T x={C_OFF} y={AY + 124} v="00000000 T add" size={13} hot={s === 5} dim={s >= 1 && s <= 3} />
            </Drop>
            <Drop on={fail} delay={0.5} dy={8}>
              <Block x={LX} y={AY} w={LW} h={AH} state="hatch" />
              <Label x={LX + LW / 2} y={AY + AH / 2 - 4} size={13} anchor="middle" mono={false} weight={600}>add.o not given</Label>
              <Label x={LX + LW / 2} y={AY + AH / 2 + 16} size={11} anchor="middle" dim>nothing defines add</Label>
            </Drop>

            {/* resolution: U add → T add */}
            <Wire d={`M${C_OFF + 9 * 7.8 + 46} 182 H352 V${AY + 120} H${LX + LW + 6}`} on={s === 5} />
            <Label x={358} y={(182 + AY + 120) / 2 + 4} size={10.5} dim on={s === 5}>match</Label>
            <Wire d={`M${C_OFF + 9 * 7.8 + 46} 182 H352 V${AY + 40}`} on={fail} dashed arrow={false} />
            <Label x={358} y={AY + 56} size={12} on={fail} weight={600}>✕ not found</Label>

            {/* ===================== the linked program ===================== */}
            <T x={OX} y={30} size={11} dim v={fail ? '$ ld -m elf_i386 -e main main.o -o prog' : '$ ld -m elf_i386 -e main main.o add.o -o prog'} />
            <Label x={OX} y={58} size={13} weight={600} mono={false}>prog</Label>
            <Label x={OX + 44} y={58} size={11} dim>linked .text</Label>
            <Fade o={s < 4 ? 0.5 : 1}>
              {/* empty map until the linker runs */}
              <Block x={OX} y={M_TOP} w={OW} h={M_H + P_H + A_H} state={placed ? 'off' : 'hatch'} />
              <Label x={OX + OW / 2} y={M_TOP + 110} size={11} anchor="middle" dim on={!placed}>{fail ? 'no output written' : 'no addresses yet'}</Label>
            </Fade>
            {/* main.o's .text lands first */}
            <Drop on={placed} delay={0.25} dx={-60} dy={0}>
              <Block x={OX} y={M_TOP} w={OW} h={M_H} state={s === 4 ? 'on' : 'off'} />
              <Label x={OX + 10} y={M_TOP + 22} size={13} weight={600}>main</Label>
              <Label x={OX + 10} y={M_TOP + M_H - 9} size={10.5} dim>17 bytes from main.o</Label>
              <Label x={OX + OW + 10} y={M_TOP + 5} size={11}>0x08049000</Label>
            </Drop>
            {/* padding, then add.o's .text */}
            <Drop on={placed} delay={0.5} dy={0}>
              <Block x={OX} y={P_TOP} w={OW} h={P_H} state="hatch" />
              <Label x={OX + OW / 2} y={P_TOP + P_H / 2 + 4} size={10.5} anchor="middle" dim>padding, 15 bytes</Label>
              <Label x={OX + OW + 10} y={P_TOP + 5} size={10.5} dim>0x08049011</Label>
            </Drop>
            <Drop on={placed} delay={0.6} dx={-60} dy={0}>
              <Block x={OX} y={A_TOP} w={OW} h={A_H} state={s === 4 || s === 5 || s === 7 ? 'on' : 'off'} />
              <Label x={OX + 10} y={A_TOP + 22} size={13} weight={600}>add</Label>
              <Label x={OX + 10} y={A_TOP + A_H - 9} size={10.5} dim>11 bytes from add.o</Label>
              <Label x={OX + OW + 10} y={A_TOP + 5} size={11} weight={s === 5 ? 600 : 400}>0x08049020</Label>
            </Drop>
            {/* the call inside main, before and after the patch */}
            <Drop on={placed} delay={0.4} dx={-60} dy={0}>
              <motion.rect x={OX + 6} y={BAND_Y} width={OW - 12} height={BAND_H} initial={false}
                animate={{ fill: patched ? 'var(--viz-fg)' : 'var(--viz-bg)', stroke: 'var(--viz-fg)', strokeWidth: s === 6 ? 2 : 1 }} transition={slow}
                filter={s === 6 ? 'url(#viz-glow)' : undefined} />
              <motion.text x={OX + 14} y={BAND_Y + 17} initial={false} animate={{ fill: patched ? 'var(--viz-bg)' : 'var(--viz-fg)' }} transition={slow}
                style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                e8
              </motion.text>
              <motion.g key={callBytes} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...slow, delay: s === 6 ? 1.0 : 0 }}>
                <motion.text x={OX + 14 + 3 * BCW} y={BAND_Y + 17} initial={false} animate={{ fill: patched ? 'var(--viz-bg)' : 'var(--viz-fg)' }} transition={slow}
                  style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {callBytes}
                </motion.text>
              </motion.g>
              <motion.text x={OX + OW - 12} y={BAND_Y + 17} textAnchor="end" initial={false} animate={{ fill: patched ? 'var(--viz-bg)' : 'var(--viz-dim)' }} transition={slow}
                style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                call
              </motion.text>
              <Label x={OX + OW + 10} y={BAND_Y + 17} size={10.5} dim>0x08049007</Label>
            </Drop>

            {/* sections travelling into place */}
            <Packet on={s === 4} points={[[LX + LW + 4, mainRowY(1)], [OX - 6, M_TOP + 40]]} duration={1.6} label=".text" />
            <Packet on={s === 4} points={[[LX + LW + 4, addRowY(1)], [420, addRowY(1)], [420, A_TOP + 28], [OX - 6, A_TOP + 28]]} duration={1.9} delay={0.4} label=".text" />

            {/* the patch value travels from the arithmetic up into the call */}
            <Packet on={s === 6} points={[[OX + 150, PANEL_Y + 74], [440, PANEL_Y + 74], [440, BAND_Y + 12], [OX + 4, BAND_Y + 12]]} duration={2.2} repeat={false} label="0x14" />
            {/* run time: the call jumps to add */}
            <Wire d={`M${OX} ${BAND_Y + 12} C ${OX - 56} ${BAND_Y + 12}, ${OX - 56} ${A_TOP + 28}, ${OX - 4} ${A_TOP + 28}`} on={s === 7} />
            <Label x={OX - 60} y={(BAND_Y + A_TOP) / 2 + 22} size={11} anchor="end" on={s === 7}>+0x14</Label>
            <Packet on={s === 7} points={[[OX, BAND_Y + 12], [OX - 42, BAND_Y + 30], [OX - 42, A_TOP + 10], [OX - 4, A_TOP + 28]]} duration={1.8} delay={0.3} />

            {/* ===================== what the linker knows ===================== */}
            <Block x={OX} y={PANEL_Y} w={302} h={114} state={fail ? 'on' : 'off'} />
            <Fade o={s < 4 ? 1 : 0}>
              <Label x={OX + 14} y={PANEL_Y + 26} size={11} dim>LINKER</Label>
              <Label x={OX + 14} y={PANEL_Y + 56} size={12} dim mono={false}>Object files only count from 0.</Label>
              <Label x={OX + 14} y={PANEL_Y + 78} size={12} dim mono={false}>Final addresses are decided here,</Label>
              <Label x={OX + 14} y={PANEL_Y + 98} size={12} dim mono={false}>when everything is put together.</Label>
            </Fade>
            <Fade o={s === 4 ? 1 : 0}>
              <Label x={OX + 14} y={PANEL_Y + 26} size={11} dim>LAYOUT</Label>
              <Label x={OX + 14} y={PANEL_Y + 54} size={12.5}>main.o .text → 0x08049000</Label>
              <Label x={OX + 14} y={PANEL_Y + 76} size={12.5}>add.o  .text → 0x08049020</Label>
              <Label x={OX + 14} y={PANEL_Y + 98} size={11} dim>0x08049011 rounded up to 16</Label>
            </Fade>
            <Fade o={s === 5 ? 1 : 0}>
              <Label x={OX + 14} y={PANEL_Y + 26} size={11} dim>GLOBAL SYMBOLS</Label>
              <Label x={OX + 14} y={PANEL_Y + 54} size={13}>main = 0x08049000</Label>
              <Label x={OX + 14} y={PANEL_Y + 78} size={13} weight={700}>add  = 0x08049020</Label>
              <Label x={OX + 14} y={PANEL_Y + 100} size={11} dim>U add in main.o: resolved</Label>
            </Fade>
            <Fade o={s === 6 ? 1 : 0}>
              <Label x={OX + 14} y={PANEL_Y + 26} size={11} dim>PATCH AT 0x08049008</Label>
              <Label x={OX + 30} y={PANEL_Y + 52} size={12.5}>0x08049020  target (add)</Label>
              <Label x={OX + 14} y={PANEL_Y + 72} size={12.5}>−</Label>
              <Label x={OX + 30} y={PANEL_Y + 72} size={12.5}>0x0804900C  next instruction</Label>
              <line x1={OX + 14} x2={OX + 130} y1={PANEL_Y + 80} y2={PANEL_Y + 80} stroke="var(--viz-dim)" />
              <Label x={OX + 14} y={PANEL_Y + 98} size={14} weight={700}>= 0x14 → 14 00 00 00</Label>
            </Fade>
            <Fade o={s === 7 ? 1 : 0}>
              <Label x={OX + 14} y={PANEL_Y + 26} size={11} dim>nm prog</Label>
              <Label x={OX + 14} y={PANEL_Y + 56} size={13}>08049000 T main</Label>
              <Label x={OX + 14} y={PANEL_Y + 80} size={13}>08049020 T add</Label>
              <Label x={OX + 14} y={PANEL_Y + 102} size={11} dim>plus a few ld adds itself, like _end</Label>
            </Fade>
            <Fade o={fail ? 1 : 0}>
              <Label x={OX + 14} y={PANEL_Y + 26} size={11} dim>ld</Label>
              <Label x={OX + 14} y={PANEL_Y + 52} size={12}>main.o: in function `main':</Label>
              <Label x={OX + 14} y={PANEL_Y + 74} size={12}>(.text+0x8): undefined</Label>
              <Label x={OX + 14} y={PANEL_Y + 96} size={13} weight={700}>reference to `add'</Label>
            </Fade>
          </Scene>
        )
      }}
    </VizStage>
  )
}
