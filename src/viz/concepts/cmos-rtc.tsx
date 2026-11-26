/* Reading wall-clock time from the RTC through CMOS ports 0x70 / 0x71. Values follow the "CMOS" article:
   register map (0x00 s, 0x02 min, 0x04 h, 0x07 day, 0x08 month, 0x09 year, 0x0A status A, 0x0B status B),
   update-in-progress = status A bit 7, status B bit 2 = binary mode, bit 1 = 24-hour mode,
   BCD -> binary = (bcd / 16) * 10 + (bcd & 0xF). Worked example: 2026-11-08 14:25:37 in BCD, 24-hour. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse, ease } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'cmos-rtc',
  title: 'CMOS RTC: reading the date and time',
  summary: 'Select an RTC register through port 0x70, read it from port 0x71, wait out updates, and decode BCD into the wall-clock time.',
  lessons: ['t5m1l3'],
  articles: ['CMOS', 'RTC'],
  group: 'Devices',
  order: 513,
}

const steps: VizStep[] = [
  { caption: 'The RTC chip keeps the date and time, even with the power off.', detail: 'A battery keeps it running, and it also holds the CMOS RAM. You reach all of it through two I/O ports: 0x70 and 0x71.' },
  { caption: 'Write a register number to port 0x70 to select it.', detail: 'outb(0x70, 0x00) selects the seconds register. Bit 7 (0x80) of this port also disables NMI, so keep it set the way your OS wants.' },
  { caption: 'Then read the selected register from port 0x71.', detail: 'inb(0x71) returns 0x37. Reading or writing 0x71 may reset the selection, so select again before every access.' },
  { caption: 'Before reading the time, wait while an update is in progress.', detail: 'Once a second the chip updates the time. Status A (0x0A) bit 7 is 1 during an update: reading then can give 8:59 or 8:60 at 9:00.' },
  { caption: 'Read each field: seconds, minutes, hours, day, month, year.', detail: 'Registers 0x00, 0x02, 0x04, 0x07, 0x08, 0x09. Read them all twice; if both reads match, no update slipped in between.' },
  { caption: 'Status B (0x0B) tells you how the bytes are encoded.', detail: 'Bit 2 = 1 means binary, 0 means BCD. Bit 1 = 1 means 24-hour; in 12-hour mode pm sets 0x80 in the hour. Read it, do not change it.' },
  { caption: 'In BCD each hex digit is a decimal digit: 0x37 means 37.', detail: 'binary = (bcd >> 4) * 10 + (bcd & 0x0F) = 3 × 10 + 7 = 37. Read as plain binary, 0x37 would be 55.' },
  { caption: 'Decode every field and you have the wall-clock time.', detail: 'The year register holds only 0–99: add the century (from register 0x32 if ACPI says it exists, otherwise assume one). The RTC may hold UTC or local time.', ms: 4200 },
]

type Row = { idx: string; name: string; raw: string; dec: string }
const ROWS: Row[] = [
  { idx: '0x00', name: 'seconds', raw: '0x37', dec: '37' },
  { idx: '0x02', name: 'minutes', raw: '0x25', dec: '25' },
  { idx: '0x04', name: 'hours', raw: '0x14', dec: '14' },
  { idx: '0x07', name: 'day of month', raw: '0x08', dec: '8' },
  { idx: '0x08', name: 'month', raw: '0x11', dec: '11' },
  { idx: '0x09', name: 'year', raw: '0x26', dec: '26' },
  { idx: '0x0A', name: 'status A', raw: '0x26', dec: '' },
  { idx: '0x0B', name: 'status B', raw: '0x02', dec: '' },
]
const ROW_Y = 62
const ROW_H = 26
const CHIP_X = 440

const CODE = [
  'outb(0x70, reg);           // select',
  'val = inb(0x71);           // read',
  'while (rd(0x0A) & 0x80) ;  // wait',
  's = rd(0x00); m = rd(0x02); h = rd(0x04);',
  'd = rd(0x07); mo = rd(0x08); y = rd(0x09);',
  'b = rd(0x0B);              // format',
  'if (!(b & 0x04)) s = (s >> 4) * 10 + (s & 0xF);',
]
const CODE_ACTIVE: Record<number, number[]> = { 1: [0], 2: [1], 3: [2], 4: [3, 4], 5: [5], 6: [6] }

function Code({ s }: { s: number }) {
  const act = CODE_ACTIVE[s] ?? []
  const x = 30
  const y0 = 316
  const lh = 16
  return (
    <g>
      <Label x={x} y={298} size={11} dim>YOUR DRIVER  (rd(r) = select r, then read)</Label>
      <rect x={x} y={y0 - 12} width={380} height={CODE.length * lh + 12} fill="var(--viz-bg)" stroke="var(--viz-faint)" />
      {CODE.map((line, i) => {
        const on = act.includes(i)
        const y = y0 + i * lh
        return (
          <g key={i}>
            <motion.rect x={x + 1} y={y - 7} width={378} height={lh} fill="var(--viz-fg)" initial={false} animate={{ opacity: on ? 0.12 : 0 }} transition={ease} />
            <motion.rect x={x + 1} y={y - 7} width={3} height={lh} fill="var(--viz-fg)" initial={false} animate={{ opacity: on ? 1 : 0 }} transition={ease} />
            <motion.text x={x + 10} y={y + 5} initial={false} animate={{ opacity: act.length && !on ? 0.5 : 1 }} transition={ease}
              fill="var(--viz-fg)" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', whiteSpace: 'pre', fontVariantLigatures: 'none', fontWeight: on ? 600 : 400 }}>{line}</motion.text>
          </g>
        )
      })}
    </g>
  )
}

/** A row of 8 bits (bit 7 first). `hi` = bit numbers to highlight. `blink` = bit number that toggles 1/0 (polling). */
function Bits({ x, y, bits, hi = [], blink }: { x: number; y: number; bits: string; hi?: number[]; blink?: number }) {
  const w = 34
  return (
    <g>
      {bits.split('').map((b, i) => {
        const bitNo = 7 - i
        const on = hi.includes(bitNo)
        return (
          <g key={i}>
            <Label x={x + i * w + w / 2} y={y - 6} size={10.5} anchor="middle" dim={!on}>{bitNo}</Label>
            <rect x={x + i * w} y={y} width={w} height={28} fill={on ? 'var(--viz-fg)' : 'var(--viz-bg)'} stroke={on ? 'var(--viz-fg)' : 'var(--viz-faint)'}
              filter={on ? 'url(#viz-glow)' : undefined} />
            {blink === bitNo ? (
              <>
                <motion.text x={x + i * w + w / 2} y={y + 19} textAnchor="middle" fill={on ? 'var(--viz-bg)' : 'var(--viz-fg)'}
                  initial={{ opacity: 1 }} animate={{ opacity: [1, 1, 1, 0, 0, 0] }} transition={{ duration: 2.4, repeat: Infinity }}
                  style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>1</motion.text>
                <motion.text x={x + i * w + w / 2} y={y + 19} textAnchor="middle" fill={on ? 'var(--viz-bg)' : 'var(--viz-fg)'}
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 0, 1, 1, 1] }} transition={{ duration: 2.4, repeat: Infinity }}
                  style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>0</motion.text>
              </>
            ) : (
              <text x={x + i * w + w / 2} y={y + 19} textAnchor="middle" fill={on ? 'var(--viz-bg)' : 'var(--viz-fg)'}
                style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: on ? 600 : 400 }}>{b}</text>
            )}
          </g>
        )
      })}
    </g>
  )
}

export default function CmosRtc() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const sel = s === 1 || s === 2 || s === 6 ? 0 : s === 3 ? 6 : s === 5 ? 7 : -1
        const index = ['—', '0x00', '0x00', '0x0A', '0x00 … 0x09', '0x0B', '0x00', '0x00 … 0x0B'][s]
        const data = ['—', '—', '0x37', '0xA6 → 0x26', '6 bytes', '0x02', '0x37', 'raw bytes'][s]
        return (
          <Scene label={meta.summary}>
            {/* CPU */}
            <Block x={30} y={52} w={120} h={70} label="CPU" sub="your kernel" state={s === 1 || s === 2 ? 'on' : 'off'} />

            {/* ports */}
            <Label x={210} y={44} size={11} dim>INDEX PORT</Label>
            <Block x={210} y={52} w={160} h={56} label="0x70" sub={`reg = ${index}`} mono size={15} state={s === 1 ? 'on' : s === 0 ? 'dim' : 'off'} />
            <Label x={210} y={144} size={11} dim>DATA PORT</Label>
            <Block x={210} y={152} w={160} h={56} label="0x71" sub={`value = ${data}`} mono size={15} state={s === 2 ? 'on' : s === 0 ? 'dim' : 'off'} />

            <Wire from={[150, 80]} to={[208, 80]} on={s >= 1} />
            <Wire from={[370, 80]} to={[438, 80]} on={s >= 1} />
            <Label x={404} y={72} size={10.5} anchor="middle" on={s >= 1} dim>select</Label>
            <Wire from={[438, 180]} to={[372, 180]} on={s >= 2} />
            <Label x={404} y={172} size={10.5} anchor="middle" on={s >= 2} dim>value</Label>
            <Wire d="M210 196 L90 196 L90 124" on={s >= 2} />

            <Packet on={s === 1} points={[[150, 80], [290, 80], [370, 80], [CHIP_X, 80]]} duration={1.6} label="0x00" />
            <Packet on={s === 2} points={[[CHIP_X + 230, ROW_Y + 13], [CHIP_X, 180], [290, 180], [210, 196], [90, 196], [90, 124]]} duration={2} label="0x37" />
            <Packet on={s === 3} points={[[CHIP_X + 230, ROW_Y + 6 * ROW_H + 13], [CHIP_X, 180], [290, 180], [210, 196], [90, 196], [90, 124]]} duration={1.2} />

            {/* RTC chip with its registers */}
            <Label x={CHIP_X} y={44} size={11} dim>RTC + CMOS RAM  (battery backed)</Label>
            <Block x={CHIP_X} y={52} w={330} h={ROWS.length * ROW_H + 18} state={s === 0 ? 'on' : 'off'} />
            <Pulse x={CHIP_X + 315} y={44} on={s === 0} r={8} />
            {ROWS.map((r, i) => {
              const y = ROW_Y + i * ROW_H
              const isTime = i <= 5
              const on = sel === i
              const decoded = (s >= 7 && isTime) || (s === 6 && i === 0)
              const dimRow = (s === 4 && !isTime) || (s === 3 && i !== 6) || (s === 5 && i !== 7) ? true : false
              return (
                <motion.g key={i} initial={false} animate={{ opacity: dimRow ? 0.4 : 1 }} transition={ease}>
                  <motion.rect x={CHIP_X + 6} y={y} width={318} height={ROW_H - 2} initial={false}
                    animate={{ opacity: on ? 1 : 0 }} fill="none" stroke="var(--viz-fg)" strokeWidth={1.8} filter="url(#viz-glow)" transition={ease} />
                  <Label x={CHIP_X + 16} y={y + 17} size={12} weight={500}>{r.idx}</Label>
                  <Label x={CHIP_X + 66} y={y + 17} size={12} mono={false} dim={!on}>{r.name}</Label>
                  <Block x={CHIP_X + 196} y={y + 2} w={64} h={ROW_H - 6} label={r.raw} mono size={12} state={on ? 'fill' : 'off'} />
                  {isTime && (
                    <>
                      <Label x={CHIP_X + 270} y={y + 17} size={11} on={decoded} dim>→</Label>
                      <Label x={CHIP_X + 316} y={y + 17} size={13} anchor="end" weight={600} on={decoded}>{r.dec}</Label>
                    </>
                  )}
                </motion.g>
              )
            })}
            {/* step 4: scanning highlight over the six time registers */}
            {s === 4 && (
              <motion.rect x={CHIP_X + 6} width={318} height={ROW_H - 2} fill="none" stroke="var(--viz-fg)" strokeWidth={1.8} filter="url(#viz-glow)"
                initial={{ y: ROW_Y }}
                animate={{ y: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5].map((k) => ROW_Y + k * ROW_H) }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
            )}
            <Packet on={s === 4} points={[[CHIP_X, 180], [290, 180], [210, 196], [90, 196], [90, 124]]} duration={0.5} repeat />

            {/* driver code */}
            <Appear on={s >= 1}>
              <Code s={s} />
            </Appear>

            {/* ---------- bottom right: one idea at a time ---------- */}
            <Appear on={s === 3}>
              <Label x={450} y={300} size={11} dim>STATUS A  (register 0x0A)</Label>
              <Bits x={450} y={328} bits="10100110" hi={[7]} blink={7} />
              <Label x={450} y={384} size={12} weight={500}>bit 7 = update in progress</Label>
              <Label x={450} y={402} size={11} dim>1 → wait and poll again; 0 → safe to read</Label>
            </Appear>

            <Appear on={s === 4}>
              <Label x={450} y={300} size={11} dim>READ TWICE, COMPARE</Label>
              {['1st read', '2nd read'].map((t, k) => (
                <g key={k}>
                  <Label x={450} y={330 + k * 30} size={11} dim>{t}</Label>
                  <Label x={530} y={330 + k * 30} size={12} weight={500}>37 25 14 08 11 26</Label>
                </g>
              ))}
              <Label x={450} y={400} size={11}>same both times → consistent</Label>
            </Appear>

            <Appear on={s === 5}>
              <Label x={450} y={300} size={11} dim>STATUS B  (register 0x0B) = 0x02</Label>
              <Bits x={450} y={328} bits="00000010" hi={[2, 1]} />
              <Label x={450} y={384} size={12} weight={500}>bit 2 = 0 → values are BCD</Label>
              <Label x={450} y={404} size={12} weight={500}>bit 1 = 1 → 24-hour clock</Label>
            </Appear>

            <Appear on={s === 6}>
              <Label x={450} y={300} size={11} dim>BCD DECODE  seconds = 0x37</Label>
              <Bits x={450} y={328} bits="00110111" />
              <rect x={446} y={322} width={138} height={40} fill="none" stroke="var(--viz-fg)" strokeWidth={1.6} />
              <rect x={588} y={322} width={138} height={40} fill="none" stroke="var(--viz-fg)" strokeWidth={1.6} />
              <Label x={518} y={384} size={14} anchor="middle" weight={600}>3</Label>
              <Label x={654} y={384} size={14} anchor="middle" weight={600}>7</Label>
              <Label x={586} y={412} size={13} anchor="middle" weight={500}>3 × 10 + 7 = 37</Label>
            </Appear>

            <Appear on={s === 7}>
              <Label x={450} y={300} size={11} dim>WALL-CLOCK TIME</Label>
              <Block x={450} y={314} w={320} h={64} state="on" />
              <Label x={610} y={355} size={24} anchor="middle" weight={600}>2026-11-08 14:25:37</Label>
              <Label x={450} y={402} size={11} dim>year 26 + century 20 → 2026</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
