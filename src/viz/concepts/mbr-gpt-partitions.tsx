/* mbr-gpt-partitions: a disk as a row of LBAs; the MBR partition table in LBA 0 (four 16-byte entries at 0x1BE,
   signature 0x55 0xAA at 510) and the GPT layout (protective MBR, "EFI PART" header at LBA 1, 128 x 128-byte
   entries from LBA 2, backup entries + header at the end of the disk).
   Worked example MBR: entry 1 = 0x80, ID 0x0C, LBA 2048, 204800 sectors; entry 2 = 0x00, ID 0x83, LBA 206848, 409600. */
import type { ReactNode } from 'react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'mbr-gpt-partitions',
  title: 'Partition tables: MBR and GPT',
  summary: 'Where the partition table lives on a disk: four 16-byte MBR entries in LBA 0, or a GPT header at LBA 1 with 128 entries and a backup at the end.',
  lessons: ['t9m1l2'],
  articles: ['Partition Table', 'GPT'],
  group: 'Storage',
  order: 912,
}

const steps: VizStep[] = [
  { caption: 'A disk is just a row of 512-byte sectors, numbered from LBA 0.', detail: 'LBA means logical block address. A partition is a range of LBAs; a small table at the start of the disk says where each range begins and how long it is.' },
  { caption: 'MBR: LBA 0 holds boot code, four 16-byte partition entries and 0x55 0xAA.', detail: 'The entries start at offset 0x1BE (446). The two signature bytes at offset 510 mark a valid boot sector.' },
  { caption: 'Each entry gives a type, a start LBA and a length in sectors.', detail: 'Entry 1: bootable (0x80), system ID 0x0C, starts at LBA 2048, 204800 sectors = 100 MiB. A system ID of 0 means the entry is unused.' },
  { caption: 'Start and length are 32-bit, so MBR cannot describe space past 2 TiB.', detail: '2³² sectors × 512 bytes = 2 TiB. Four entries is also a hard limit. GPT was made to replace this scheme.' },
  { caption: 'GPT keeps a protective MBR at LBA 0: one entry of type 0xEE.', detail: 'It starts at LBA 1 and covers the disk. Tools that only know MBR see one partition they do not understand and leave it alone.' },
  { caption: 'LBA 1 holds the GPT header. It starts with the 8 bytes "EFI PART".', detail: 'It says where the entry array starts (LBA 2), how many entries there are (128) and the size of each (128 bytes), and carries CRC32 checksums.' },
  { caption: 'LBA 2–33: 128 entries × 128 bytes, each with type GUID, start, end and name.', detail: '16 KiB = 32 sectors, 4 entries per sector. Start and end are 64-bit LBAs. An all-zero type GUID marks an unused entry.' },
  { caption: 'A backup header sits in the last sector, with a copy of the entries before it.', detail: 'Header field 0x20 holds the LBA of the backup header: the last sector, N−1. If the primary header fails its CRC check, read the backup.', ms: 4200 },
]

type St = 'on' | 'off' | 'dim' | 'fill' | 'hatch'
const MY = 34
const GY = 134
const SH = 46

function Seg({ x, y, w, label, sub, state, show = true }: { x: number; y: number; w: number; label?: string; sub?: string; state: St; show?: boolean }) {
  return <Block x={x} y={y} w={w} h={SH} label={show ? label : undefined} sub={show ? sub : undefined} size={13} state={state} />
}

function Cell({ x, y, children, on = true, dim, weight, size = 11.5, anchor }: { x: number; y: number; children: ReactNode; on?: boolean; dim?: boolean; weight?: number; size?: number; anchor?: 'start' | 'middle' | 'end' }) {
  return <Label x={x} y={y} size={size} on={on} dim={dim} weight={weight} anchor={anchor}>{children}</Label>
}

const MBR_ROWS = [
  ['1', '0x80', '0x0C', '2048', '204800', '100 MiB'],
  ['2', '0x00', '0x83', '206848', '409600', '200 MiB'],
  ['3', '0x00', '0x00', '0', '0', 'unused'],
  ['4', '0x00', '0x00', '0', '0', 'unused'],
]
const MBR_COLS = [48, 92, 192, 300, 440, 580]

const HDR_ROWS: [string, string, string][] = [
  ['0x00', 'signature', '"EFI PART"'],
  ['0x10', 'header CRC32', 'checksum'],
  ['0x18', 'this header LBA', '1'],
  ['0x20', 'backup header LBA', 'N−1 (last)'],
  ['0x48', 'entry array LBA', '2'],
  ['0x50', 'entry count', '128'],
  ['0x54', 'entry size', '128 B'],
]

const ENTRY_FIELDS: [string, string, string, number][] = [
  ['0x00', 'type', 'GUID 16', 70],
  ['0x10', 'unique', 'GUID 16', 70],
  ['0x20', 'start', 'LBA 8', 50],
  ['0x28', 'end', 'LBA 8', 50],
  ['0x30', 'attr', '8', 40],
  ['0x38', 'name', '72', 60],
]

export default function MbrGptPartitions() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => {
        const mbrView = s >= 1 && s <= 3
        const gptView = s >= 4
        const mState = (k: 'mbr' | 'gap' | 'p1' | 'p2' | 'free'): St => {
          if (s === 0) return k === 'gap' || k === 'free' ? 'off' : 'off'
          if (gptView) return 'dim'
          if (k === 'gap') return 'hatch'
          if (k === 'free') return 'dim'
          if (s === 1) return k === 'mbr' ? 'on' : 'off'
          if (s === 2) return k === 'p1' ? 'on' : 'off'
          return k === 'p1' || k === 'p2' ? 'on' : 'off'
        }
        const gState = (k: 'pmbr' | 'hdr' | 'ent' | 'data' | 'ent2' | 'hdr2'): St => {
          if (s === 4) return k === 'pmbr' ? 'on' : 'off'
          if (s === 5) return k === 'hdr' ? 'on' : k === 'pmbr' ? 'off' : 'off'
          if (s === 6) return k === 'ent' ? 'on' : 'off'
          if (s === 7) return k === 'hdr2' || k === 'ent2' ? 'on' : k === 'hdr' || k === 'ent' ? 'off' : 'dim'
          return 'off'
        }
        let ex = 420
        return (
          <Scene label={meta.summary}>
            {/* ---------- MBR disk ---------- */}
            <Label x={20} y={MY + 22} size={14} mono={false} weight={600} dim={gptView}>{s === 0 ? 'Disk' : 'MBR disk'}</Label>
            <Label x={20} y={MY + 38} size={10.5} dim>{s === 0 ? 'LBA 0 … N−1' : 'LBA →'}</Label>
            <Seg x={110} y={MY} w={64} label="MBR" state={mState('mbr')} show={s >= 1} />
            <Seg x={174} y={MY} w={76} label="unused" state={mState('gap')} show={s >= 1} />
            <Seg x={250} y={MY} w={260} label="partition 1" sub="LBA 2048 … 206847" state={mState('p1')} show={s >= 1} />
            <Seg x={510} y={MY} w={200} label="partition 2" sub="LBA 206848 …" state={mState('p2')} show={s >= 1} />
            <Seg x={710} y={MY} w={70} label="free" state={mState('free')} show={s >= 1} />
            {/* raw sectors overlay for step 0 */}
            <Appear on={s === 0} dy={0}>
              {Array.from({ length: 33 }, (_, i) => (
                <line key={i} x1={110 + (i + 1) * 20} x2={110 + (i + 1) * 20} y1={MY} y2={MY + SH} stroke="var(--viz-faint)" />
              ))}
              <Block x={110} y={MY} w={20} h={SH} state="on" />
              <Label x={120} y={MY + 60} size={10.5} anchor="middle">0</Label>
              <Label x={140} y={MY + 60} size={10.5} anchor="middle">1</Label>
              <Label x={160} y={MY + 60} size={10.5} anchor="middle">2</Label>
              <Label x={180} y={MY + 60} size={10.5} anchor="middle">3</Label>
              <Label x={445} y={MY + 60} size={10.5} anchor="middle" dim>each cell = one 512-byte sector</Label>
              <Label x={780} y={MY + 60} size={10.5} anchor="end">N−1</Label>
              <path d={`M190 ${MY + 72} L190 ${MY + 80} L410 ${MY + 80} L410 ${MY + 72}`} fill="none" stroke="var(--viz-fg)" />
              <Label x={300} y={MY + 98} size={11.5} anchor="middle">a partition = start LBA + sector count</Label>
              <Wire d={`M120 ${MY + SH + 20} C 120 230, 200 250, 246 270`} dashed dim />
              <Block x={250} y={250} w={300} h={70} label="one sector = 512 bytes" sub="LBA n starts at byte n × 512" size={14} state="on" />
              <Label x={400} y={360} size={11.5} anchor="middle" dim>The partition table says which ranges belong to which partition.</Label>
            </Appear>
            <Appear on={s >= 1} dy={0}>
              {([[110, '0'], [174, '1'], [250, '2048'], [510, '206848'], [710, '616448']] as [number, string][]).map(([x, t]) => (
                <Label key={t} x={x + 3} y={MY + 60} size={10.5} dim={gptView}>{t}</Label>
              ))}
            </Appear>
            <Pulse x={142} y={MY + SH / 2} on={s === 1} r={14} />
            <Pulse x={272} y={MY + SH / 2} on={s === 2} r={12} />

            {/* ---------- GPT disk ---------- */}
            <Appear on={gptView}>
              <Label x={20} y={GY + 22} size={14} mono={false} weight={600}>GPT disk</Label>
              <Label x={20} y={GY + 38} size={10.5} dim>LBA →</Label>
              <Seg x={110} y={GY} w={64} label="PMBR" state={gState('pmbr')} />
              <Seg x={174} y={GY} w={64} label="header" state={gState('hdr')} />
              <Seg x={238} y={GY} w={92} label="entries" sub="128 × 128 B" state={gState('ent')} />
              <Seg x={330} y={GY} w={280} label="partitions" sub="LBA 34 … −34" state={gState('data')} />
              <Seg x={610} y={GY} w={92} label="entries" sub="backup" state={gState('ent2')} />
              <Seg x={702} y={GY} w={78} label="header" sub="backup" state={gState('hdr2')} />
              {([[110, '0'], [174, '1'], [238, '2–33'], [330, '34'], [610, '−33 … −2'], [702, '−1']] as [number, string][]).map(([x, t]) => (
                <Label key={t} x={x + 3} y={GY + 60} size={10.5} dim>{t}</Label>
              ))}
              <Label x={780} y={GY + 76} size={10.5} anchor="end" dim>negative LBA = counted back from the last sector</Label>
            </Appear>
            <Pulse x={142} y={GY + SH / 2} on={s === 4} r={14} />
            <Pulse x={206} y={GY + SH / 2} on={s === 5} r={14} />
            <Pulse x={284} y={GY + SH / 2} on={s === 6} r={14} />
            {/* primary -> backup */}
            <Wire d={`M206 ${GY} C 300 104, 650 104, 741 ${GY}`} on={s === 7} dashed />
            <Wire d={`M284 ${GY} C 380 118, 560 118, 656 ${GY}`} on={s === 7} dashed delay={0.3} />
            <Packet on={s === 7} points={[[206, GY - 4], [320, 116], [480, 111], [640, 116], [741, GY - 4]]} duration={2.4} />

            {/* zoom connectors */}
            <Wire from={[110, MY + SH + 2]} to={[40, 254]} on={mbrView} dashed dim arrow={false} />
            <Wire from={[174, MY + SH + 2]} to={[760, 254]} on={mbrView} dashed dim arrow={false} />
            <Wire from={[142, GY + SH + 2]} to={[142, 230]} on={s === 4} dashed dim />
            <Wire from={[206, GY + SH + 2]} to={[206, 244]} on={s >= 5} dashed dim />
            <Wire d={`M286 ${GY + SH + 2} C 290 220, 400 214, 440 246`} on={s >= 6} dashed dim />

            {/* ---------- detail: MBR sector (also used for the protective MBR) ---------- */}
            <Appear on={mbrView || s === 4}>
              <Label x={40} y={244} size={11} dim>{s === 4 ? 'LBA 0 · PROTECTIVE MBR · 512 BYTES' : 'LBA 0 · MBR · 512 BYTES'}</Label>
              {(['0', '0x1BE', '0x1CE', '0x1DE', '0x1EE', '0x1FE'] as string[]).map((o, i) => (
                <Label key={o} x={(i === 0 ? 40 : 340 + (i - 1) * 90) + 3} y={268} size={10.5} dim>{o}</Label>
              ))}
              <Block x={40} y={274} w={300} h={40} label="boot code" sub="446 bytes" size={13} state={s === 1 ? 'off' : 'dim'} />
              {[0, 1, 2, 3].map((i) => (
                <Block key={i} x={340 + i * 90} y={274} w={90} h={40} label={s === 4 ? (i === 0 ? 'type 0xEE' : 'zero') : `entry ${i + 1}`} sub="16 B" size={12}
                  state={s === 4 ? (i === 0 ? 'on' : 'dim') : s === 1 ? 'on' : s === 2 ? (i === 0 ? 'on' : i === 1 ? 'off' : 'dim') : i <= 1 ? 'off' : 'dim'} />
              ))}
              <Block x={700} y={274} w={60} h={40} label="55 AA" sub="510" mono size={12} state={s === 1 ? 'on' : 'off'} />
            </Appear>

            <Appear on={s === 2 || s === 3}>
              {['#', 'boot 0x00', 'ID 0x04', 'start LBA 0x08', 'sectors 0x0C', 'size'].map((h, i) => (
                <Cell key={h} x={MBR_COLS[i]} y={338} size={10.5} dim>{h}</Cell>
              ))}
              {MBR_ROWS.map((r, ri) => (
                <g key={ri}>
                  <Block x={40} y={344 + ri * 20} w={720} h={20} state={s === 2 && ri === 0 ? 'on' : ri >= 2 ? 'dim' : 'off'} />
                  {r.map((v, ci) => (
                    <Cell key={ci} x={MBR_COLS[ci]} y={358 + ri * 20} dim={ri >= 2} weight={s === 2 && ri === 0 ? 600 : 400}>{v}</Cell>
                  ))}
                </g>
              ))}
            </Appear>
            {/* 32-bit fields */}
            <Appear on={s === 3}>
              <rect x={290} y={326} width={270} height={102} fill="none" stroke="var(--viz-fg)" strokeWidth={2} filter="url(#viz-glow)" />
              <Label x={760} y={244} size={11.5} anchor="end" weight={600}>4-byte fields: 2³² × 512 B = 2 TiB max</Label>
            </Appear>

            {/* protective MBR entry */}
            <Appear on={s === 4}>
              <Cell x={40} y={346}>entry 1: boot 0x00 · type 0xEE (GPT protective)</Cell>
              <Cell x={40} y={368}>start LBA 0x00000001 · ends at the last sector (or 0xFFFFFFFF)</Cell>
              <Cell x={40} y={390}>entries 2–4: all zero · signature 55 AA as usual</Cell>
              <Cell x={40} y={418} dim>An MBR-only tool sees one full-disk partition of an unknown type.</Cell>
            </Appear>

            {/* ---------- detail: GPT header ---------- */}
            <Appear on={s >= 5}>
              <Label x={40} y={244} size={11} dim>LBA 1 · GPT HEADER</Label>
              {HDR_ROWS.map(([o, f, v], i) => {
                const hot = (s === 5 && i !== 1 && i !== 2 && i !== 3) || (s === 7 && i === 3) || (s === 6 && (i >= 4))
                return (
                  <g key={o}>
                    <Block x={40} y={252 + i * 24} w={350} h={24} state={hot ? 'on' : s === 7 || s === 6 ? 'dim' : 'off'} />
                    <Cell x={50} y={268 + i * 24} size={11} dim>{o}</Cell>
                    <Cell x={100} y={268 + i * 24} size={11.5}>{f}</Cell>
                    <Cell x={380} y={268 + i * 24} size={11.5} anchor="end" weight={hot ? 700 : 400}>{v}</Cell>
                  </g>
                )
              })}
            </Appear>

            {/* ---------- detail: entry array ---------- */}
            <Appear on={s >= 6}>
              <Label x={760} y={244} size={11} anchor="end" dim>LBA 2–33 · 128 ENTRIES × 128 B = 16 KiB</Label>
              {Array.from({ length: 32 }, (_, c) =>
                Array.from({ length: 4 }, (_, r) => (
                  <Block key={`${c}-${r}`} x={420 + c * 10.6} y={252 + r * 12} w={9} h={10} state={c === 0 && r < 2 ? 'fill' : s === 7 ? 'dim' : 'off'} />
                )),
              )}
              <Label x={420} y={314} size={10.5} dim>LBA 2 (4 per sector)</Label>
              <Label x={760} y={314} size={10.5} anchor="end" dim>LBA 33</Label>
              {ENTRY_FIELDS.map(([o, l, sub, w]) => {
                const x = ex
                ex += w
                const hot = s === 6 && (l === 'type' || l === 'start' || l === 'end')
                return (
                  <g key={o}>
                    <Label x={x + 2} y={338} size={10.5} dim>{o}</Label>
                    <Block x={x} y={344} w={w} h={40} label={l} sub={sub} size={12} state={hot ? 'on' : s === 7 ? 'dim' : 'off'} />
                  </g>
                )
              })}
              <Label x={420} y={404} size={11} dim={s === 7}>entry 0: start LBA 2048, end LBA 206847</Label>
              <Label x={420} y={422} size={11} dim>all-zero type GUID = unused entry</Label>
            </Appear>
          </Scene>
        )
      }}
    </VizStage>
  )
}
