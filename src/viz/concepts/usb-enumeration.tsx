/* USB enumeration of a boot-protocol keyboard on a root-hub port: reset, address 0, first 8 bytes of the device
   descriptor (bMaxPacketSize0), SET_ADDRESS, full descriptor, configuration/interface/endpoint, SET_CONFIGURATION.
   SETUP bytes are the real 8-byte packets (bmRequestType, bRequest, wValue, wIndex, wLength, little-endian). */
import { motion, useTime, useTransform } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Label, BitField, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'usb-enumeration',
  title: 'USB enumeration: from plug-in to driver',
  summary: 'How a host controller resets a new device, talks to it at address 0, reads its descriptors with control transfers (SETUP, DATA, STATUS), gives it an address, configures it and hands it to a class driver.',
  lessons: ['t10m2l1', 't10m2l2', 't10m2l3'],
  articles: ['Universal Serial Bus', 'USB Human Interface Devices'],
  group: 'Devices',
  order: 1020,
}

const steps: VizStep[] = [
  { caption: 'A host controller (UHCI, OHCI, EHCI or xHCI) drives a root hub.', detail: 'The controller is a PCI device your driver programs. The root hub gives it ports; every USB device hangs off a hub port.' },
  { caption: 'A device plugs in. The hub reports it; the host resets the port.', detail: 'Wait at least 100 ms for power to settle, then reset the port for at least 50 ms. Afterwards the port is enabled.' },
  { caption: 'After reset the device is in the default state, at address 0.', detail: 'It listens on endpoint 0, the default control pipe. Only one device may be at address 0, so enumerate one device at a time.' },
  { caption: 'Every request is a control transfer: SETUP, DATA, STATUS.', detail: 'SETUP carries 8 bytes describing the request. Zero or more DATA packets follow, then a zero-length STATUS in the opposite direction confirms it.', ms: 3800 },
  { caption: 'GET_DESCRIPTOR(device) for 8 bytes reveals bMaxPacketSize0.', detail: 'Byte 7 is the largest packet EP0 accepts (8, 16, 32 or 64). Until you know it, ask for a small amount.', ms: 3800 },
  { caption: 'SET_ADDRESS(5): from now on the device answers at address 5.', detail: 'No DATA stage, only SETUP and STATUS. The new address takes effect once the STATUS stage has completed.', ms: 3600 },
  { caption: 'Read the full 18-byte device descriptor: vendor, product, configs.', detail: 'idVendor 0x046D and idProduct 0xC31C are stored little-endian: 6D 04, 1C C3. Device class 0 means "see each interface".', ms: 3800 },
  { caption: 'GET_DESCRIPTOR(configuration) returns interface and endpoints too.', detail: 'Interface descriptors cannot be requested alone. Class 3 = HID, subclass 1 = boot protocol, protocol 1 = keyboard.', ms: 3800 },
  { caption: 'SET_CONFIGURATION(1), then the HID driver takes the interface.', detail: 'Endpoints are now live. The keyboard reports keys through interrupt endpoint 0x81; class 08 would go to a mass storage driver.', ms: 4000 },
]

const HOST_X = 196
const DEV_X = 594
const CY = 178 // cable y

type Stage = { chip: 'SETUP' | 'DATA' | 'STATUS'; label: string; from: number; to: number; win: [number, number] }
/* Control read: DATA is IN (device → host), so STATUS is a zero-length OUT (host → device). */
const FULL: Stage[] = [
  { chip: 'SETUP', label: 'SETUP 8B', from: HOST_X, to: DEV_X, win: [0, 0.3] },
  { chip: 'DATA', label: 'DATA IN', from: DEV_X, to: HOST_X, win: [0.36, 0.66] },
  { chip: 'STATUS', label: 'STATUS OUT 0B', from: HOST_X, to: DEV_X, win: [0.72, 0.98] },
]
/* No DATA stage: STATUS is a zero-length IN (device → host). */
const NODATA: Stage[] = [
  { chip: 'SETUP', label: 'SETUP 8B', from: HOST_X, to: DEV_X, win: [0, 0.4] },
  { chip: 'STATUS', label: 'STATUS IN 0B', from: DEV_X, to: HOST_X, win: [0.56, 0.96] },
]
const PERIOD = 3.2

/** One stage of a control transfer: a packet crossing the cable inside its time window, plus a glow on the
    matching stage chip. Both read the same clock, so packet and chip always stay in step. */
function StageAnim({ st, chipX }: { st: Stage; chipX: number }) {
  const time = useTime()
  const phase = useTransform(time, (t) => ((t / 1000) % PERIOD) / PERIOD)
  const [a, b] = st.win
  const x = useTransform(phase, (v) => {
    if (v <= a) return st.from
    if (v >= b) return st.to
    const k = (v - a) / (b - a)
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    return st.from + (st.to - st.from) * e
  })
  const opacity = useTransform(phase, (v) => (v >= a && v <= b ? 1 : 0))
  return (
    <g>
      <motion.rect x={chipX} y={62} width={100} height={34} fill="none" stroke="var(--viz-fg)" strokeWidth={2.2} filter="url(#viz-glow)" style={{ opacity }} />
      <motion.g style={{ x, y: CY, opacity }}>
        <circle r={5} fill="var(--viz-fg)" filter="url(#viz-glow)" />
        <text y={-20} textAnchor="middle" fill="var(--viz-fg)" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{st.label}</text>
      </motion.g>
    </g>
  )
}

const CHIPS = [{ label: 'SETUP', x: 240 }, { label: 'DATA', x: 360 }, { label: 'STATUS', x: 480 }]

const REQ: Record<number, [string, string]> = {
  2: ['talk to address 0, endpoint 0', 'no address assigned yet'],
  3: ['every control transfer has 3 stages', 'the SETUP payload is always 8 bytes'],
  4: ['GET_DESCRIPTOR (device, 8 bytes)', 'setup: 80 06 00 01 00 00 08 00'],
  5: ['SET_ADDRESS (5)', 'setup: 00 05 05 00 00 00 00 00'],
  6: ['GET_DESCRIPTOR (device, 18 bytes)', 'setup: 80 06 00 01 00 00 12 00'],
  7: ['GET_DESCRIPTOR (configuration, 34)', 'setup: 80 06 00 02 00 00 22 00'],
  8: ['SET_CONFIGURATION (1)', 'setup: 00 09 01 00 00 00 00 00'],
}

const DESC8 = ['12', '01', '10', '01', '00', '00', '00', '08']
const DESC18 = [...DESC8, '6D', '04', '1C', 'C3', '00', '01', '01', '02', '00', '01']

export default function UsbEnumeration() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const noData = s === 5 || s === 8
        const stages = s >= 3 ? (noData ? NODATA : FULL) : []
        const devSub = s <= 1 ? 'attached · powered' : s <= 4 ? 'default · address 0' : s <= 7 ? 'address 5' : 'configured'
        return (
          <Scene label={meta.summary}>
            {/* host side */}
            <Block x={20} y={40} w={180} h={56} label="host controller" sub="UHCI · OHCI · EHCI · xHCI" state={s === 0 ? 'on' : 'off'} />
            <Wire from={[80, 96]} to={[80, 118]} />
            <Block x={20} y={120} w={120} h={150} label="root hub" state={s === 0 ? 'on' : 'off'} />
            {[0, 1, 2, 3].map((p) => (
              <Block key={p} x={140} y={128 + p * 35} w={52} h={30} label={`port ${p + 1}`} mono size={10.5}
                state={p === 1 && (s === 1 || s === 2) ? 'on' : p === 1 && s >= 1 ? 'off' : s === 0 ? 'off' : 'dim'} />
            ))}
            <Pulse x={166} y={CY} on={s === 1} />

            {/* cable and device */}
            <motion.line x1={192} x2={DEV_X} y1={CY} y2={CY} stroke="var(--viz-fg)" strokeWidth={2} initial={false}
              animate={{ pathLength: s >= 1 ? 1 : 0, opacity: s >= 1 ? 1 : 0 }} transition={{ duration: 0.6 }} />
            <Appear on={s >= 1} dx={40} dy={0}>
              <Block x={600} y={130} w={180} h={96} label="USB keyboard" sub={devSub} state={s === 1 || s === 2 || s === 5 || s === 8 ? 'on' : 'off'} />
              <Block x={600} y={232} w={180} h={28} label="EP0 · control" mono size={11} state={s >= 2 ? 'off' : 'dim'} />
            </Appear>
            <Appear on={s >= 8}>
              <Block x={600} y={264} w={180} h={28} label="EP1 IN · interrupt" mono size={11} state="on" />
            </Appear>
            <Label x={220} y={160} size={11} on={s === 1}>wait ≥ 100 ms, then reset ≥ 50 ms</Label>
            <Label x={220} y={160} size={11} on={s === 2}>port enabled · device at address 0</Label>

            {/* control transfer stages */}
            <Appear on={s >= 3}>
              <Label x={240} y={52} size={11} dim>CONTROL TRANSFER ON EP0</Label>
              {CHIPS.map((c) => (
                <Block key={c.label} x={c.x} y={62} w={100} h={34} label={c.label} mono size={12}
                  state={c.label === 'DATA' && noData ? 'hatch' : 'off'} />
              ))}
              <Wire from={[340, 79]} to={[358, 79]} />
              <Wire from={[460, 79]} to={[478, 79]} />
            </Appear>
            {stages.map((st) => (
              <StageAnim key={`${s}-${st.chip}`} st={st} chipX={CHIPS.find((c) => c.label === st.chip)!.x} />
            ))}

            {/* the current request */}
            {Object.entries(REQ).map(([k, [name, bytes]]) => (
              <g key={k}>
                <Label x={220} y={206} size={12.5} weight={500} on={s === +k}>{name}</Label>
                <Label x={220} y={226} size={11} dim on={s === +k}>{bytes}</Label>
              </g>
            ))}
            <Label x={220} y={246} size={11} dim on={noData}>no DATA stage</Label>

            {/* first 8 bytes of the device descriptor */}
            <Appear on={s === 4}>
              <Label x={120} y={296} size={11} dim>DEVICE DESCRIPTOR · FIRST 8 BYTES (DATA STAGE)</Label>
              <BitField x={120} y={310} cellW={70} h={30} bits={DESC8} showIndex={false} active={4}
                fields={[[0, 1, 'length 18'], [1, 1, 'type 1'], [2, 2, 'USB 1.10'], [4, 3, 'class / sub / proto 0'], [7, 1, 'max pkt 8']]} />
              <Label x={120} y={396} size={11.5}>bMaxPacketSize0 = 8 → EP0 moves at most 8 bytes per packet</Label>
            </Appear>

            {/* address change */}
            <Appear on={s === 5}>
              <Block x={160} y={316} w={200} h={56} label="address 0" sub="default state" mono state="dim" />
              <Wire from={[364, 344]} to={[436, 344]} />
              <Block x={440} y={316} w={200} h={56} label="address 5" sub="address state" mono state="on" />
              <Label x={400} y={400} size={11} anchor="middle" dim>wValue = 5 (any free address 1 … 127)</Label>
            </Appear>

            {/* full device descriptor */}
            <Appear on={s === 6}>
              <Label x={40} y={296} size={11} dim>DEVICE DESCRIPTOR · ALL 18 BYTES</Label>
              <BitField x={40} y={310} cellW={40} h={30} bits={DESC18} showIndex={false} active={1}
                fields={[[0, 8, 'first 8 bytes (seen before)'], [8, 4, 'vendor 046D · product C31C'], [12, 2, 'rel 1.00'], [14, 3, 'strings'], [17, 1, 'cfgs']]} />
              <Label x={40} y={396} size={11.5}>bNumConfigurations = 1 → one configuration to read next</Label>
            </Appear>

            {/* configuration tree and driver */}
            <Appear on={s >= 7}>
              <Label x={40} y={292} size={11} dim>CONFIGURATION DESCRIPTOR · 9 + 9 + 9 + 7 = 34 BYTES IN ONE READ</Label>
              <Block x={40} y={302} w={160} h={50} label="configuration 1" sub="9 B · wTotalLength 34" size={13} state={s === 7 ? 'on' : 'off'} />
              <Block x={220} y={302} w={160} h={50} label="interface 0 · HID" sub="9 B · class 03/01/01" size={13} state={s >= 7 ? 'on' : 'off'} />
              <Block x={400} y={302} w={160} h={50} label="HID descriptor 0x21" sub="9 B · report desc len" size={13} state={s === 7 ? 'on' : 'off'} />
              <Block x={580} y={302} w={160} h={50} label="endpoint 0x81" sub="7 B · interrupt IN" size={13} state={s === 7 ? 'on' : 'off'} />
            </Appear>
            <Wire from={[200, 327]} to={[217, 327]} on={s >= 7} delay={0.2} />
            <Wire from={[380, 327]} to={[397, 327]} on={s >= 7} delay={0.4} />
            <Wire from={[560, 327]} to={[577, 327]} on={s >= 7} delay={0.6} />
            <Wire from={[300, 352]} to={[300, 380]} on={s >= 8} />
            <Appear on={s >= 8}>
              <Block x={200} y={384} w={200} h={40} label="HID keyboard driver" size={13} state="fill" />
              <Block x={440} y={384} w={240} h={40} label="class 08 → mass storage" mono size={11} state="dim" />
              <Label x={40} y={400} size={11} dim>pick a driver by</Label>
              <Label x={40} y={416} size={11} dim>interface class</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
