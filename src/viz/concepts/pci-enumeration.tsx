/* PCI enumeration through configuration mechanism #1 (ports 0xCF8 / 0xCFC).
   Worked example: QEMU's i440FX machine. 00:01.1 is the PIIX3 IDE controller 8086:7010, class 01 subclass 01. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'pci-enumeration',
  title: 'PCI: finding devices through 0xCF8 / 0xCFC',
  summary: 'How the kernel builds a CONFIG_ADDRESS, reads configuration space through port 0xCFC, scans every bus, device and function, and matches IDs, class and BARs to a driver.',
  lessons: ['t9m2l1', 't9m2l2'],
  articles: ['PCI', 'PCI IDE Controller'],
  group: 'Devices',
  order: 920,
}

const steps: VizStep[] = [
  { caption: 'The kernel needs to know which devices sit on the PCI bus.', detail: 'Every PCI function has a 256-byte configuration space. On x86 you reach it through two 32-bit I/O ports.' },
  { caption: 'Build CONFIG_ADDRESS: enable | bus | device | function | offset.', detail: '0x80000000 | (0 << 16) | (1 << 11) | (1 << 8) | 0x00 = 0x80000900. Bits 1:0 stay 0: reads are 32-bit and aligned.' },
  { caption: 'outl(0xCF8, 0x80000900) selects one register of 00:01.1.', detail: 'Bit 31 tells the host bridge to turn the next CONFIG_DATA access into a configuration cycle on the bus.' },
  { caption: 'inl(0xCFC) returns offset 0x00: 0x70108086.', detail: 'Low 16 bits = vendor ID 0x8086, high 16 bits = device ID 0x7010. That pair is the PIIX3 IDE controller.' },
  { caption: 'Vendor 0xFFFF means no device answered.', detail: 'A read of a missing device completes without error and returns all ones. No vendor is assigned 0xFFFF, so skip this slot.' },
  { caption: 'Scan: 256 buses × 32 devices, up to 8 functions each.', detail: 'Brute force calls checkDevice() 8192 times. If header type bit 7 of function 0 is set (like 00:01.0), also try functions 1 to 7.', ms: 4200 },
  { caption: 'Offset 0x08: class 0x01, subclass 0x01 = an IDE controller.', detail: 'The top byte is the class code, then subclass, prog IF and revision. Class/subclass tell you what kind of device it is.' },
  { caption: 'BARs (offsets 0x10 to 0x24) give its I/O port or memory ranges.', detail: 'BAR4 = 0x0000C041: bit 0 = 1 means I/O space, base 0xC040. On IDE, BAR4 is the bus-master DMA block; BAR0–3 = 0 means legacy ports 0x1F0/0x170.' },
  { caption: 'The driver table matches 8086:7010 or class 01:01 → IDE driver.', detail: 'A driver model keeps a list of (vendor, device) or (class, subclass) pairs and calls probe() for each match.', ms: 3800 },
]

/** CONFIG_ADDRESS written before the read shown in step s: every register read needs its own outl. */
const addrFor = (s: number) =>
  s === 4 ? 0x80002000 // 00:04.0 offset 0x00 (empty slot)
    : s === 5 ? 0x8000080c // 00:01.0 offset 0x0C (header type byte)
      : s === 6 ? 0x80000908 // 00:01.1 offset 0x08 (class)
        : s === 7 ? 0x80000920 // 00:01.1 offset 0x20 (BAR4)
          : 0x80000900 // 00:01.1 offset 0x00 (IDs)
const hex = (n: number, w = 2) => '0x' + n.toString(16).toUpperCase().padStart(w, '0')
function decode(addr: number) {
  const bus = (addr >>> 16) & 0xff
  const dev = (addr >>> 11) & 0x1f
  const fn = (addr >>> 8) & 0x7
  const off = addr & 0xfc
  const fields: [number, number, string][] = [
    [0, 1, 'en'],
    [1, 7, 'reserved'],
    [8, 8, `bus ${bus}`],
    [16, 5, `dev ${dev}`],
    [21, 3, `fn ${fn}`],
    [24, 8, `offset ${hex(off)}`],
  ]
  const bdf = `${bus.toString(16).padStart(2, '0')}:${dev.toString(16).padStart(2, '0')}.${fn}`
  return { bits: addr.toString(2).padStart(32, '0'), fields, bdf, off, text: '0x' + addr.toString(16).toUpperCase() }
}

const DEVS: [string, string, string][] = [
  ['00:00.0', '8086:1237', 'host bridge'],
  ['00:01.0', '8086:7000', 'ISA bridge'],
  ['00:01.1', '8086:7010', 'IDE'],
  ['00:02.0', '1234:1111', 'VGA'],
  ['00:03.0', '8086:100E', 'network'],
  ['00:04.0', 'FFFF', '(no device)'],
]

const CFG = [
  '0x00  device 7010 | vendor 8086',
  '0x04  status | command',
  '0x08  class 01  sub 01  if 80',
  '0x0C  BIST | hdr 00 | lat | cls',
  '0x10  BAR0 = 0',
  '0x14–0x1C  BAR1–3 = 0',
  '0x20  BAR4 = 0xC041 (bus master)',
  '0x24  BAR5 = 0',
]

const LX = 210 // device list x
const LY = 150 // device list top
const RH = 32 // device row height
const TX = 510 // config table x
const TY = 150
const TH = 26

/** A highlight box that walks down the device rows while the scan runs. */
function ScanSweep({ on }: { on: boolean }) {
  if (!on) return null
  const ys = DEVS.map((_, i) => LY + i * RH)
  return (
    <motion.rect x={LX - 3} width={276} height={RH} fill="none" stroke="var(--viz-fg)" strokeWidth={2} filter="url(#viz-glow)"
      initial={{ y: ys[0], opacity: 0 }} animate={{ y: ys, opacity: [0, 1, 1, 1, 1, 1] }}
      transition={{ duration: 2.4, ease: 'linear', repeat: Infinity, repeatDelay: 0.4 }} />
  )
}

export default function PciEnumeration() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const known = (i: number) => s >= 5 || (i === 2 && s >= 3) || (i === 5 && s >= 4)
        const rowState = (i: number) => {
          if (i === 5 && s >= 4) return s === 4 ? 'on' : s === 5 ? 'hatch' : 'dim'
          if (s === 3 && i === 2) return 'on'
          if (s === 5 && i === 1) return 'on'
          if (s >= 6) return i === 2 ? 'on' : 'dim'
          return 'off'
        }
        const A = decode(addrFor(s))
        const io = s === 4 || s === 6 || s === 7 // an outl → inl pair shown on the short port wires
        const cfgOn = (i: number) => (s === 3 && i === 0) || (s === 6 && i === 2) || (s === 7 && i === 6) || (s === 8 && (i === 0 || i === 2))
        return (
          <Scene label={meta.summary}>
            {/* CONFIG_ADDRESS */}
            <Label x={80} y={18} size={11} dim>CONFIG_ADDRESS (written to port 0xCF8)</Label>
            <Label x={720} y={18} size={13} anchor="end" weight={500} on={s >= 1}>{A.text}</Label>
            <Appear on={s >= 1}>
              <BitField x={80} y={40} bits={A.bits} fields={A.fields} cellW={20} h={24} active={s === 2 ? 0 : undefined} />
              <Label x={80} y={118} size={11.5}>0x80000000 | bus{'<<'}16 | dev{'<<'}11 | fn{'<<'}8 | offset   →   {A.bdf}, offset {hex(A.off)}</Label>
            </Appear>
            <Label x={400} y={70} size={13} anchor="middle" dim on={s === 0}>which devices are out there?</Label>

            {/* CPU and the two ports */}
            <Block x={30} y={150} w={140} h={46} label="0xCF8" sub="CONFIG_ADDRESS" mono state={s === 2 || io ? 'on' : s >= 6 ? 'dim' : 'off'} />
            <Block x={30} y={236} w={140} h={50} label="CPU" sub="kernel code" state={s === 0 || s === 2 || s === 3 ? 'on' : io ? 'off' : s >= 6 ? 'dim' : 'off'} />
            <Block x={30} y={326} w={140} h={46} label="0xCFC" sub="CONFIG_DATA" mono state={s === 3 || io ? 'on' : s >= 6 ? 'dim' : 'off'} />
            <Label x={118} y={222} size={10.5} on={s === 2 || io}>outl</Label>
            <Label x={118} y={311} size={10.5} on={s === 3 || io}>inl</Label>
            <Label x={30} y={398} size={10.5} on={s === 6 || s === 7}>each read: a new outl first</Label>
            <Wire from={[80, 236]} to={[80, 199]} on={(s >= 2 && s <= 4) || io} />
            <Wire d={`M170 173 C 192 173, 186 ${LY + 2 * RH + 16}, ${LX - 4} ${LY + 2 * RH + 16}`} on={s >= 2 && s <= 3} />
            <Wire d={`M${LX - 4} ${LY + 5 * RH + 16} C 186 ${LY + 5 * RH + 16}, 192 349, 173 349`} on={s === 4} dim />
            <Wire d={`M${LX - 4} ${LY + 2 * RH + 24} C 186 ${LY + 2 * RH + 40}, 194 349, 173 349`} on={s === 3} />
            <Wire from={[80, 326]} to={[80, 289]} on={(s >= 3 && s <= 4) || io} />
            <Pulse x={100} y={261} on={s === 0} />

            {/* devices on bus 0 */}
            <Label x={LX} y={140} size={11} dim>PCI BUS 0 (BUS:DEV.FN  VENDOR:DEVICE)</Label>
            {DEVS.map(([bdf, ids, name], i) => (
              <Block key={i} x={LX} y={LY + i * RH} w={270} h={RH} mono size={11} align="start"
                label={known(i) ? `${bdf}  ${ids}  ${name}` : `${bdf}  ????:????`} state={rowState(i)} />
            ))}
            <ScanSweep on={s === 5} />
            <Label x={LX} y={372} size={11} on={s === 5}>for bus 0..255, dev 0..31: read vendor</Label>
            <Label x={LX} y={390} size={11} dim on={s === 5}>00:01.0 header type (0x0E) = 0x80 → bit 7 = 1:</Label>
            <Label x={LX} y={406} size={11} dim on={s === 5}>multi-function, so try 00:01.1 … 00:01.7</Label>
            <Label x={LX} y={380} size={11} dim on={s === 4}>vendor == 0xFFFF → empty, move on</Label>

            {/* configuration space of 00:01.1 */}
            <Appear on={s >= 3} dx={-10} dy={0}>
              <Label x={TX} y={140} size={11} dim>CONFIG SPACE OF 00:01.1</Label>
              {CFG.map((t, i) => (
                <Block key={i} x={TX} y={TY + i * TH} w={270} h={TH} mono size={11} align="start" label={t}
                  state={cfgOn(i) ? 'on' : s === 4 || (s >= 6 && !(s === 8 && (i === 0 || i === 2))) ? 'dim' : 'off'} />
              ))}
            </Appear>
            <Label x={TX} y={380} size={11} on={s === 3}>vendor 0x8086 · device 0x7010</Label>
            <Label x={TX} y={398} size={11} dim on={s === 3}>= Intel PIIX3 IDE controller</Label>
            <Label x={TX} y={380} size={11} on={s === 6}>class 0x01 = mass storage</Label>
            <Label x={TX} y={398} size={11} dim on={s === 6}>subclass 0x01 = IDE controller</Label>
            <Label x={TX} y={380} size={11} on={s === 7}>bit 0 = 1 → I/O space BAR</Label>
            <Label x={TX} y={398} size={11} dim on={s === 7}>0xC041 {'&'} ~0x3 = 0xC040 (bus master DMA)</Label>
            <Label x={TX} y={416} size={11} dim on={s === 7}>BAR0–3 = 0 → ATA ports 0x1F0 / 0x170</Label>
            <Pulse x={TX + 135} y={TY + 6 * TH + 13} on={s === 7} />
            <Pulse x={TX + 135} y={TY + 2 * TH + 13} on={s === 6} />

            {/* driver match */}
            <Wire from={[TX + 135, TY + 8 * TH + 2]} to={[TX + 135, 378]} on={s >= 8} />
            <Appear on={s >= 8}>
              <Block x={TX} y={382} w={270} h={46} label="IDE driver" sub="probe: 0x1F0 / 0x170, DMA at 0xC040" state="on" />
            </Appear>
            {/* moving data on top of everything */}
            <Packet on={s === 2} points={[[80, 236], [80, 173], [180, 173], [LX + 20, LY + 2 * RH + 16]]} duration={2} label="0x80000900" />
            <Packet on={s === 3} points={[[LX + 20, LY + 2 * RH + 16], [176, 349], [96, 349], [80, 314]]} duration={2} label="0x70108086" />
            <Packet on={s === 4} points={[[LX + 20, LY + 5 * RH + 16], [176, 349], [96, 349], [80, 314]]} duration={2} label="0xFFFFFFFF" />
            {/* each read: outl CONFIG_ADDRESS, then inl CONFIG_DATA */}
            <Packet on={io} points={[[80, 236], [80, 199]]} duration={1} />
            <Packet on={s === 6 || s === 7} points={[[80, 326], [80, 289]]} duration={1} delay={0.6} />
            <Packet on={s === 8} points={[[LX + 135, LY + 2 * RH + 16], [TX - 10, LY + 2 * RH + 16], [TX - 10, 405], [TX + 20, 405]]} duration={2.2} label="8086:7010" />
          </Scene>
        )
      }}
    </VizStage>
  )
}
