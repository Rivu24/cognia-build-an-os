/* Answering a ping: one frame's trip up the network stack and the reply's trip back down.
   Values are a worked example on a QEMU-style network: we are 10.0.2.15 (MAC 52:54:00:12:34:56),
   the neighbour pinging us is 10.0.2.2 (MAC 52:55:0a:00:02:02). EtherTypes, ARP opcodes, the IPv4 protocol
   number and ICMP types come from the Network Stack, ARP and ICMP articles. */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'network-packet-path',
  title: 'Answering a ping: up and down the stack',
  summary: 'A frame lands in the NIC RX ring, climbs Ethernet, ARP, IPv4 and ICMP, and an echo reply goes back down through the TX ring.',
  lessons: ['t13m1l3', 't13m1l1', 't13m1l2'],
  articles: ['Network Stack', 'Address Resolution Protocol', 'Internet Control Message Protocol'],
  group: 'Devices',
  order: 1313,
}

const steps: VizStep[] = [
  { caption: '10.0.2.2 wants to ping us at 10.0.2.15. First it needs our MAC address.', detail: 'Ethernet delivers frames by 6-byte MAC address, not by IP. The sender has only our IP, so it must ask.' },
  { caption: 'A broadcast frame arrives: the NIC DMAs it into the RX ring and raises an IRQ.', detail: 'The driver gave the card a ring of receive buffers in RAM. The card copies the frame there itself, then interrupts the CPU.' },
  { caption: 'The driver hands the frame to Ethernet. EtherType 0x0806 means ARP.', detail: 'The 14-byte Ethernet header is dst MAC, src MAC, EtherType. dst FF:FF:FF:FF:FF:FF is a broadcast: every host on the LAN sees it.', ms: 3600 },
  { caption: 'ARP request (opcode 1): who has 10.0.2.15? That is us, so we reply (opcode 2).', detail: 'The reply carries our MAC, 52:54:00:12:34:56. It goes straight back down: Ethernet, driver, TX ring, wire.', ms: 4200 },
  { caption: 'Now the real ping frame arrives. EtherType 0x0800 means IPv4.', detail: 'This time dst MAC is ours, so the frame is for us. Same path as before: DMA into the RX ring, IRQ, driver, Ethernet.' },
  { caption: 'The 20-byte IPv4 header: destination 10.0.2.15 is us, protocol 1 means ICMP.', detail: 'Protocol 1 = ICMP, 6 = TCP, 17 = UDP. The IP layer checks the address and passes the payload up to the right handler.' },
  { caption: 'ICMP type 8, code 0: an echo request with an id and a sequence number.', detail: 'Ping fills the data with 56 bytes it expects back: 8-byte ICMP header + 56 = 64 bytes, + 20 IPv4 = 84.' },
  { caption: 'Build the reply: type 0, swap the addresses, keep id, seq and data, new checksum.', detail: 'The id and sequence must not change: that is how the pinger ties the reply to its request. Checksum: add all 16-bit words, fold the carries, invert.', ms: 4000 },
  { caption: 'The reply goes back down the stack, into the TX ring and out of the NIC.', detail: 'Each layer writes its header in front of the payload. The card DMAs the frame out of the TX ring and the pinger prints a line.', ms: 4200 },
]

/** Text that fades/slides in whenever its value changes (keyed by the value). */
function Val({ x, y, v, size = 11, dim, anchor = 'middle' }: { x: number; y: number; v: string; size?: number; dim?: boolean; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <motion.g key={v} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
      <text x={x} y={y} textAnchor={anchor} fill={dim ? 'var(--viz-dim)' : 'var(--viz-fg)'} style={{ fontSize: size, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
        {v}
      </text>
    </motion.g>
  )
}

/** One header field: a box with the value on top and the field name below. */
function Field({ x, y, w, h = 40, name, v, on, dim }: { x: number; y: number; w: number; h?: number; name: string; v: string; on?: boolean; dim?: boolean }) {
  return (
    <g>
      <Block x={x} y={y} w={w} h={h} state={on ? 'on' : dim ? 'dim' : 'off'} />
      <Val x={x + w / 2} y={y + 18} v={v} />
      <Label x={x + w / 2} y={y + 33} size={10.5} anchor="middle" dim>{name}</Label>
    </g>
  )
}

const US_MAC = '52:54:00:12:34:56'
const THEM_MAC = '52:55:0a:00:02:02'

export default function NetworkPacketPath() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const arp = s >= 1 && s <= 3
        const reply = s === 3 || s >= 7
        const eth = s <= 0 ? null
          : s <= 2 ? { dst: 'ff:ff:ff:ff:ff:ff', src: THEM_MAC, type: '0x0806' }
          : s === 3 ? { dst: THEM_MAC, src: US_MAC, type: '0x0806' }
          : s <= 6 ? { dst: US_MAC, src: THEM_MAC, type: '0x0800' }
          : { dst: THEM_MAC, src: US_MAC, type: '0x0800' }
        const layer = (k: string) => {
          const map: Record<string, number[]> = { icmp: [6, 7], ipv4: [5], arp: [3], eth: [2, 4], drv: [2], nic: [1] }
          return map[k].includes(s) ? 'on' : 'off'
        }
        return (
          <Scene label={meta.summary}>
            {/* ---- the pinger (left) ---- */}
            <Label x={20} y={40} size={11} dim>THEIR SHELL · 10.0.2.2</Label>
            <Block x={20} y={50} w={150} h={84} state={s === 0 || s === 8 ? 'on' : 'off'} />
            <Label x={30} y={72} size={11}>$ ping 10.0.2.15</Label>
            <Label x={30} y={98} size={10.5} on={s >= 8}>64 bytes from</Label>
            <Label x={30} y={116} size={10.5} on={s >= 8}>10.0.2.15: seq=1</Label>
            <Pulse x={152} y={68} on={s === 0} r={10} />

            <Appear on={s >= 3}>
              <Label x={20} y={168} size={11} dim>THEIR ARP CACHE</Label>
              <Block x={20} y={176} w={150} h={48} state={s === 3 ? 'on' : 'off'} />
              <Label x={30} y={196} size={10.5}>10.0.2.15 →</Label>
              <Label x={30} y={214} size={10.5}>{US_MAC}</Label>
            </Appear>

            <Block x={20} y={330} w={150} h={46} label="10.0.2.2" sub={THEM_MAC} mono size={13} state={s === 0 ? 'on' : 'off'} />
            <Label x={95} y={398} size={10.5} anchor="middle" dim>the pinger</Label>
            {/* the cable */}
            <line x1={170} x2={200} y1={353} y2={353} stroke="var(--viz-fg)" strokeWidth={2} />

            {/* ---- our stack (middle) ---- */}
            <Label x={200} y={40} size={11} dim>OUR KERNEL · 10.0.2.15</Label>
            <Block x={200} y={50} w={100} h={40} label="ICMP" size={13} state={layer('icmp')} />
            <Block x={200} y={102} w={100} h={40} label="IPv4" size={13} state={layer('ipv4')} />
            <Block x={310} y={102} w={100} h={40} label="ARP" size={13} state={layer('arp')} />
            <Block x={200} y={154} w={210} h={40} label="Ethernet" size={13} state={layer('eth')} />
            <Block x={200} y={206} w={210} h={40} label="NIC driver" size={13} state={layer('drv')} />
            {/* stack connectors */}
            <line x1={250} x2={250} y1={90} y2={102} stroke="var(--viz-faint)" />
            <line x1={250} x2={250} y1={142} y2={154} stroke="var(--viz-faint)" />
            <line x1={360} x2={360} y1={142} y2={154} stroke="var(--viz-faint)" />
            <line x1={305} x2={305} y1={194} y2={206} stroke="var(--viz-faint)" />

            {/* rings in RAM */}
            <Label x={200} y={272} size={10.5} dim>RX RING (RAM)</Label>
            <Label x={410} y={272} size={10.5} dim anchor="end">TX RING (RAM)</Label>
            {[0, 1, 2, 3].map((i) => (
              <Block key={`rx${i}`} x={200 + i * 22} y={280} w={22} h={26}
                state={(i === 0 && s === 1) || (i === 1 && s === 4) ? 'fill' : (i === 0 && s === 2) ? 'on' : 'off'} />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <Block key={`tx${i}`} x={322 + i * 22} y={280} w={22} h={26}
                state={(i === 0 && s === 3) || (i === 1 && s === 8) ? 'fill' : 'off'} />
            ))}
            <Block x={200} y={330} w={210} h={46} label="NIC" sub={US_MAC} size={13} state={layer('nic')} />
            <line x1={235} x2={235} y1={306} y2={330} stroke="var(--viz-faint)" />
            <line x1={366} x2={366} y1={306} y2={330} stroke="var(--viz-faint)" />
            <Label x={305} y={322} size={10.5} anchor="middle" dim>DMA</Label>

            {/* IRQ line: NIC → driver */}
            <Wire d="M410 342 L428 342 L428 226 L414 226" on={s === 1 || s === 4} dashed />
            <Label x={434} y={290} size={10.5} on={s === 1 || s === 4}>IRQ</Label>

            {/* packets: what is moving this step */}
            <Packet on={s === 1} points={[[170, 353], [211, 353], [211, 293]]} duration={1.6} />
            <Packet on={s === 2} points={[[211, 293], [305, 226], [305, 174]]} duration={1.8} />
            <Packet on={s === 3} points={[[305, 174], [360, 122], [360, 174], [360, 226], [333, 293], [333, 353], [170, 353], [95, 353]]} duration={3.4} label="reply" />
            <Packet on={s === 4} points={[[170, 353], [233, 353], [233, 293], [305, 226], [305, 174]]} duration={2.4} label="ping" />
            <Packet on={s === 5} points={[[250, 174], [250, 122]]} duration={1.2} />
            <Packet on={s === 6} points={[[250, 122], [250, 70]]} duration={1.2} />
            <Label x={310} y={68} size={10.5} on={s === 7}>builds the</Label>
            <Label x={310} y={82} size={10.5} on={s === 7}>echo reply</Label>
            <Packet on={s === 8} points={[[250, 70], [250, 122], [250, 174], [305, 226], [355, 293], [355, 353], [170, 353], [95, 353]]} duration={3.4} label="echo reply" />

            {/* ---- the frame, decoded (right) ---- */}
            <Appear on={s >= 1}>
              <Label x={460} y={40} size={11} dim>{reply ? 'FRAME WE SEND' : 'FRAME WE RECEIVED'}</Label>
              <Label x={460} y={58} size={10.5} dim>Ethernet header · 14 bytes</Label>
              {eth && (
                <>
                  <Field x={460} y={64} w={130} name="dst MAC" v={eth.dst} on={s === 3 || s === 8} />
                  <Field x={590} y={64} w={130} name="src MAC" v={eth.src} on={s === 3 || s === 8} />
                  <Field x={720} y={64} w={60} name="type" v={eth.type} on={s === 2 || s === 4} />
                </>
              )}
            </Appear>

            {/* ARP body */}
            <Appear on={arp}>
              <Label x={460} y={136} size={10.5} dim>ARP · 28 bytes</Label>
              <Field x={460} y={142} w={60} name="htype" v="1" />
              <Field x={520} y={142} w={80} name="ptype" v="0x0800" />
              <Field x={600} y={142} w={80} name="hlen/plen" v="6 / 4" />
              <Field x={680} y={142} w={100} name="opcode" v={s === 3 ? '2 reply' : '1 request'} on={s === 3} />
              <Field x={460} y={182} w={180} name="sender MAC" v={s === 3 ? US_MAC : THEM_MAC} />
              <Field x={640} y={182} w={140} name="sender IP" v={s === 3 ? '10.0.2.15' : '10.0.2.2'} />
              <Field x={460} y={222} w={180} name="target MAC" v={s === 3 ? THEM_MAC : '00:00:00:00:00:00'} />
              <Field x={640} y={222} w={140} name="target IP" v={s === 3 ? '10.0.2.2' : '10.0.2.15'} on={s === 2} />
            </Appear>

            {/* IPv4 body */}
            <Appear on={s >= 4}>
              <Label x={460} y={136} size={10.5} dim>IPv4 header · 20 bytes</Label>
              <Field x={460} y={142} w={70} name="version" v="4" />
              <Field x={530} y={142} w={70} name="IHL" v="5" />
              <Field x={600} y={142} w={80} name="TTL" v="64" />
              <Field x={680} y={142} w={100} name="protocol" v="1 ICMP" on={s === 5} />
              <Field x={460} y={182} w={160} name="src IP" v={reply ? '10.0.2.15' : '10.0.2.2'} on={s === 7} />
              <Field x={620} y={182} w={160} name="dst IP" v={reply ? '10.0.2.2' : '10.0.2.15'} on={s === 5 || s === 7} />
              <Field x={460} y={222} w={160} name="total length" v="84" />
              <Field x={620} y={222} w={160} name="header checksum" v={reply ? 'recomputed' : 'checked'} />
            </Appear>

            {/* ICMP body */}
            <Appear on={s >= 4}>
              <Label x={460} y={294} size={10.5} dim>ICMP · 8-byte header + data</Label>
              <Field x={460} y={300} w={70} name="type" v={reply ? '0 reply' : '8 echo'} on={s === 6 || s === 7} dim={s < 6} />
              <Field x={530} y={300} w={50} name="code" v="0" dim={s < 6} />
              <Field x={580} y={300} w={90} name="checksum" v={reply ? 'new' : 'ok'} on={s === 7} dim={s < 6} />
              <Field x={670} y={300} w={55} name="id" v="0x1c" dim={s < 6} />
              <Field x={725} y={300} w={55} name="seq" v="1" dim={s < 6} />
              <Field x={460} y={340} w={320} name="data: echoed back unchanged" v="56 bytes of payload" dim={s < 6} />
            </Appear>
            <Appear on={arp}>
              <Label x={620} y={320} size={11} anchor="middle" dim>no IP, no ICMP:</Label>
              <Label x={620} y={338} size={11} anchor="middle" dim>ARP rides directly on Ethernet</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
