/* Anatomy of a 512-byte boot sector (MBR) and what the BIOS does with it.
   Sources: OSDev Wiki "MBR (x86)" (layout, partition entry), "Bootloader" (512-byte limit, two stages),
   "Boot Sequence" (0x55 0xAA at 510/511, DL, 446 bytes), "Babystep2" (INT 10h, AH=0Eh print loop). */
import { motion } from 'motion/react'
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, Appear, Pulse } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'

export const meta: VizMeta = {
  id: 'boot-sector-anatomy',
  title: 'Anatomy of a boot sector',
  summary: 'The 512-byte boot sector byte by byte: 446 bytes of code, four 16-byte partition entries at 0x1BE, the 0x55 0xAA signature, and what happens when the BIOS runs it.',
  lessons: ['t1m2l3', 't1m2l4'],
  articles: ['Bootloader', 'MBR (x86)'],
  group: 'Boot',
  order: 123,
}

const steps: VizStep[] = [
  { caption: 'A boot sector is exactly 512 bytes: the first sector (LBA 0) of the disk.', detail: 'On a hard disk this sector is the MBR. The BIOS reads it before anything else on the disk.' },
  { caption: 'Bytes 0–445 are code: raw machine instructions, no headers.', detail: 'The MBR table lists 440 bytes of code plus an optional 4-byte disk ID and 2 reserved bytes; leave those out and the code gets 446.' },
  { caption: 'At 0x1BE: four partition entries, 16 bytes each.', detail: 'Byte 0 is 0x80 for the active partition. Bytes 8–11 hold its first LBA, little-endian: 00 08 00 00 = 0x800 = 2048.', ms: 3800 },
  { caption: 'Bytes 510–511 must be 0x55 then 0xAA, or the BIOS will not boot it.', detail: 'Read as one 16-bit little-endian word at 0x7DFE, the signature is 0xAA55. NASM pads with times 510-($-$$) db 0.' },
  { caption: 'The BIOS copies all 512 bytes to 0x7C00 and jumps there, DL = boot drive.', detail: 'CPU in 16-bit real mode, CS:IP = 0000:7C00 (some BIOSes use 07C0:0000, the same byte). Do not trust other registers: set DS and a stack yourself.', ms: 3800 },
  { caption: 'The code prints with INT 10h, AH = 0Eh: one character per call.', detail: 'lodsb loads the next byte of the string into AL; the BIOS teletype function draws it and moves the cursor. A zero byte ends the loop.', ms: 4200 },
  { caption: 'Then it stops in an endless loop: hang: jmp hang.', detail: 'There is nothing to return to. Bytes EB FE are a short jump back to itself.' },
  { caption: '446 bytes is not enough to load a real kernel.', detail: 'Finding the partition, reading a filesystem, loading the kernel, switching to protected mode and setting up a stack: it does not fit.', ms: 3800 },
  { caption: 'So a tiny first stage loads a larger second stage. That is how GRUB works.', detail: 'Stage 1 lives in the MBR; stage 2 sits in sectors after it (here, before the partition at LBA 2048). Stage 2 reads the filesystem and loads your kernel.', ms: 4200 },
]

// x positions of the sector strip
const X0 = 40
const XT = 520 // 0x1BE
const XS = 700 // 0x1FE
const X1 = 760
const SY = 62
const SH = 38

const CODE_BYTES = ['31', 'C0', '8E', 'D8', 'BE', '15', '7C', 'FC', 'AC', '08', 'C0', '74', '06', 'B4', '0E']
const CODE_FIELDS: [number, number, string][] = [
  [0, 2, 'xor ax,ax'], [2, 2, 'mov ds,ax'], [4, 3, 'mov si,msg'], [7, 1, 'cld'], [8, 1, 'lodsb'], [9, 2, 'or al,al'], [11, 2, 'jz hang'], [13, 2, 'mov ah,0Eh'],
]
const PART_BYTES = ['80', '20', '21', '00', '0C', 'FE', 'FF', 'FF', '00', '08', '00', '00', '00', 'F8', '3F', '00']
const PART_FIELDS: [number, number, string][] = [[0, 1, 'flag'], [1, 3, 'CHS start'], [4, 1, 'type'], [5, 3, 'CHS end'], [8, 4, 'LBA start'], [12, 4, 'sector count']]

const ASM: [string, string][] = [
  ['[ORG 0x7C00]', ''],
  ['  xor ax, ax', '31 C0'],
  ['  mov ds, ax', '8E D8'],
  ['  mov si, msg', 'BE 15 7C'],
  ['  cld', 'FC'],
  ['next: lodsb', 'AC'],
  ['  or al, al', '08 C0'],
  ['  jz hang', '74 06'],
  ['  mov ah, 0x0E', 'B4 0E'],
  ['  int 0x10', 'CD 10'],
  ['  jmp next', 'EB F5'],
  ['hang: jmp hang', 'EB FE'],
  ["msg db 'Hello World',0", ''],
]
const LY = 168 // first listing line baseline
const LH = 20

const MSG = 'Hello World'
const BLOCKS = ['partition', 'filesystem', 'disk read', 'A20 + GDT', 'protected mode', 'stack + jump']
const NEEDS = ['find the boot partition', 'find the kernel on the filesystem', 'read it from disk (INT 13h)', 'enable A20, load a GDT', 'switch to protected mode', 'set up a stack, jump to kernel']

export default function BootSectorAnatomy() {
  return (
    <VizStage meta={meta} steps={steps}>
      {(s) => (
        <Scene label={meta.summary}>
          {/* ===== the 512-byte strip (always visible) ===== */}
          <Label x={X0} y={26} size={11} dim>SECTOR 0 · 512 BYTES</Label>
          <Label x={X0} y={SY - 8} size={10.5} dim>0x000</Label>
          <Label x={XT} y={SY - 8} size={10.5} dim anchor="middle">0x1BE</Label>
          <Label x={XS} y={SY - 8} size={10.5} dim anchor="middle">0x1FE</Label>
          <Label x={X1} y={SY - 8} size={10.5} dim anchor="end">0x200</Label>
          <Block x={X0} y={SY} w={XT - X0} h={SH} label="bootstrap code" size={13}
            state={s === 1 || s === 5 || s === 6 || s === 7 || s === 8 ? 'on' : s === 2 || s === 3 ? 'dim' : 'off'} />
          {[0, 1, 2, 3].map((i) => (
            <Block key={i} x={XT + i * 45} y={SY} w={45} h={SH} label={`${i + 1}`} mono size={12}
              state={s === 2 ? (i === 0 ? 'fill' : 'on') : s === 1 || s === 3 || s >= 5 ? 'dim' : 'off'} />
          ))}
          <Block x={XS} y={SY} w={30} h={SH} label="55" mono size={12} state={s === 3 ? 'fill' : s === 1 || s === 2 || s >= 5 ? 'dim' : 'off'} />
          <Block x={XS + 30} y={SY} w={30} h={SH} label="AA" mono size={12} state={s === 3 ? 'fill' : s === 1 || s === 2 || s >= 5 ? 'dim' : 'off'} />
          <Label x={(X0 + XT) / 2} y={SY + SH + 16} size={11} anchor="middle" dim={s !== 1 && s !== 7}>446 bytes</Label>
          <Label x={(XT + XS) / 2} y={SY + SH + 16} size={11} anchor="middle" dim={s !== 2}>4 × 16 bytes</Label>
          <Label x={X1} y={SY + SH + 16} size={11} anchor="end" dim={s !== 3}>2 bytes</Label>
          <Pulse x={XS + 30} y={SY + SH / 2} on={s === 3} r={18} />

          {/* ===== step 0: where it lives on the disk ===== */}
          <Appear on={s === 0}>
            <Label x={X0} y={292} size={11} dim>THE DISK, SECTOR BY SECTOR (512 B EACH)</Label>
            {Array.from({ length: 9 }).map((_, i) => (
              <Block key={i} x={X0 + i * 80} y={300} w={80} h={44} mono size={11} label={i === 8 ? '…' : `LBA ${i}`} state={i === 0 ? 'on' : 'dim'} />
            ))}
            <line x1={X0} y1={300} x2={X0} y2={SY + SH} stroke="var(--viz-faint)" strokeDasharray="4 4" />
            <line x1={X0 + 80} y1={300} x2={X1} y2={SY + SH} stroke="var(--viz-faint)" strokeDasharray="4 4" />
          </Appear>
          <Packet on={s === 0} points={[[80, 300], [400, 102]]} duration={1.6} label="512 B" />

          {/* ===== step 1: machine code bytes ===== */}
          <Appear on={s === 1}>
            <Label x={100} y={182} size={11} dim>FIRST 15 BYTES, AS THE CPU SEES THEM</Label>
            <BitField x={100} y={200} cellW={40} h={32} bits={CODE_BYTES} fields={CODE_FIELDS} showIndex={false} active={s === 1 ? undefined : undefined} />
            <Label x={100} y={300} size={12}>Execution starts at byte 0. There is no file format:</Label>
            <Label x={100} y={320} size={12}>every byte is either an instruction or data.</Label>
          </Appear>
          <Wire d={`M${X0 + 2} ${SY + SH + 2} L100 196`} on={s === 1} dashed arrow={false} dim />

          {/* ===== step 2: one partition entry ===== */}
          <Appear on={s === 2}>
            <Label x={80} y={188} size={11} dim>ENTRY 1 AT 0x1BE · 16 BYTES</Label>
            <BitField x={80} y={206} cellW={40} h={32} bits={PART_BYTES} fields={PART_FIELDS} showIndex={false} active={s === 2 ? 4 : undefined} />
            <Label x={100} y={300} size={11.5}>0x80 = active (bit 7)</Label>
            <Label x={420} y={300} size={11.5}>00 08 00 00 → 0x00000800 = LBA 2048</Label>
            <Label x={100} y={330} size={11} dim>0x1BE, 0x1CE, 0x1DE, 0x1EE: entries 1 to 4, not aligned to 32 bits</Label>
          </Appear>
          <Wire d={`M${XT} ${SY + SH + 24} L80 172`} on={s === 2} dashed arrow={false} dim />
          <Wire d={`M${XT + 45} ${SY + SH + 24} L720 172`} on={s === 2} dashed arrow={false} dim />
          <Pulse x={114} y={296} on={s === 2} r={12} />

          {/* ===== step 3: signature ===== */}
          <Appear on={s === 3}>
            <Label x={300} y={188} size={11} dim>END OF YOUR BOOT.ASM</Label>
            <Block x={300} y={198} w={460} h={110} state="off" />
            <Label x={316} y={226} size={12.5}>times 510-($-$$) db 0</Label>
            <Label x={316} y={256} size={12.5}>db 0x55</Label>
            <Label x={316} y={286} size={12.5}>db 0xAA</Label>
            <Label x={744} y={226} size={11} dim anchor="end">; pad to 510</Label>
            <Label x={744} y={256} size={11} dim anchor="end">; byte 510</Label>
            <Label x={744} y={286} size={11} dim anchor="end">; byte 511</Label>
            <Label x={300} y={346} size={12}>BIOS check: byte[510] == 0x55 and byte[511] == 0xAA</Label>
            <Label x={300} y={370} size={12} dim>no match: try the next boot device</Label>
          </Appear>
          <Wire d={`M${XS + 30} ${SY + SH + 22} L${XS + 30} 196`} on={s === 3} />

          {/* ===== step 4: loaded at 0x7C00 ===== */}
          <Appear on={s === 4}>
            <Label x={X0} y={196} size={11} dim>RAM (FIRST 64 KiB, NOT TO SCALE)</Label>
            <Block x={X0} y={206} w={120} h={46} label="IVT + BDA" size={12} state="dim" />
            <Block x={X0 + 120} y={206} w={160} h={46} label="free" size={12} state="dim" />
            <Block x={X0 + 280} y={206} w={200} h={46} label="your boot sector" size={13} state="on" />
            <Block x={X0 + 480} y={206} w={240} h={46} label="free" size={12} state="dim" />
            {([[X0, '0x0000'], [X0 + 120, '0x0500'], [X0 + 280, '0x7C00'], [X0 + 480, '0x7E00']] as const).map(([x, t]) => (
              <Label key={t} x={x} y={268} size={10.5} dim={t !== '0x7C00' && t !== '0x7E00'} anchor={x === X0 ? 'start' : 'middle'}>{t}</Label>
            ))}
            <Block x={X0} y={300} w={210} h={50} label="CS:IP = 0000:7C00" mono size={12.5} state="on" />
            <Block x={X0 + 230} y={300} w={210} h={50} label="DL = 0x80" sub="boot drive (1st disk)" mono size={12.5} state="on" />
            <Block x={X0 + 460} y={300} w={260} h={50} label="16-bit real mode" sub="other registers: undefined" size={12.5} state="off" />
          </Appear>
          <Packet on={s === 4} points={[[400, SY + SH], [400, 150], [420, 206]]} duration={1.6} label="copy 512 B" />

          {/* ===== steps 5-6: the program runs ===== */}
          <Appear on={s === 5 || s === 6}>
            <Label x={X0} y={146} size={11} dim>BOOT.ASM (BABYSTEP2)</Label>
            {ASM.map(([code, hex], i) => (
              <g key={i}>
                <Label x={X0 + 10} y={LY + i * LH} size={12} dim={s === 6 && i !== 11}>{code}</Label>
                <Label x={400} y={LY + i * LH} size={11} anchor="end" dim>{hex}</Label>
              </g>
            ))}
          </Appear>
          {/* program counter bar */}
          <motion.rect x={X0} width={370} height={LH} fill="none" stroke="var(--viz-fg)" strokeWidth={1.4}
            initial={false}
            animate={s === 5
              ? { opacity: 1, y: [5, 6, 7, 8, 9, 10, 5].map((i) => LY + i * LH - 14) }
              : s === 6 ? { opacity: 1, y: LY + 11 * LH - 14 } : { opacity: 0, y: LY + 5 * LH - 14 }}
            transition={s === 5 ? { duration: 2.4, repeat: Infinity, ease: 'linear', times: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1] } : { duration: 0.4 }}
            filter="url(#viz-glow)" />
          {/* hang loop */}
          <Appear on={s === 6}>
            <path d={`M412 ${LY + 11 * LH - 10} C 440 ${LY + 11 * LH - 34}, 440 ${LY + 11 * LH + 14}, 412 ${LY + 11 * LH}`} fill="none" stroke="var(--viz-fg)" strokeWidth={1.4} markerEnd="url(#viz-arrow)" />
          </Appear>
          <Packet on={s === 6} points={[[412, LY + 11 * LH - 10], [432, LY + 11 * LH - 18], [436, LY + 11 * LH - 4], [412, LY + 11 * LH]]} duration={0.9} r={4} />

          <Appear on={s === 5 || s === 6}>
            <Label x={460} y={146} size={11} dim>SCREEN</Label>
            <Block x={460} y={156} w={300} h={130} state={s === 5 ? 'on' : 'off'} />
            {MSG.split('').map((ch, i) => (
              <Label key={i} x={478 + i * 10} y={186} size={15} on={s === 5 || s === 6} delay={s === 5 ? 0.3 + i * 0.2 : 0}>{ch}</Label>
            ))}
            <motion.g initial={false} animate={{ x: s === 5 ? [0, 0, 110] : 110 }} transition={s === 5 ? { duration: 2.5, times: [0, 0.12, 1], ease: 'linear' } : { duration: 0 }}>
              <motion.rect x={478} y={194} width={9} height={3} fill="var(--viz-fg)"
                initial={false} animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            </motion.g>
            <Label x={460} y={318} size={12}>INT 0x10, AH = 0x0E: teletype output</Label>
            <Label x={460} y={340} size={12}>AL = character to print</Label>
            <Label x={460} y={362} size={11} dim>each call prints one character</Label>
          </Appear>
          <Packet on={s === 5} points={[[400, LY + 9 * LH - 4], [460, 200], [520, 186]]} duration={1.2} label="AL" />

          {/* ===== step 7: does not fit ===== */}
          <Appear on={s === 7}>
            <Label x={X0} y={150} size={11} dim>WHAT A LOADER MUST DO</Label>
            {NEEDS.map((t, i) => (
              <Label key={t} x={X0 + 10} y={176 + i * 24} size={12.5} on={s === 7} delay={0.2 + i * 0.25}>{`+ ${t}`}</Label>
            ))}
            <Label x={460} y={150} size={11} dim>446-BYTE BUDGET</Label>
            <Block x={460} y={280} w={160} h={120} state="on" />
            <Label x={540} y={420} size={12} anchor="middle" weight={500}>446 B</Label>
          </Appear>
          {BLOCKS.map((t, i) => (
            <motion.g key={t} initial={false}
              animate={{ opacity: s === 7 ? 1 : 0, y: s === 7 ? 0 : -30 }}
              transition={{ delay: s === 7 ? 0.2 + i * 0.25 : 0, duration: 0.45 }}>
              <rect x={466} y={366 - i * 40} width={148} height={28} fill="var(--viz-bg)" stroke={i < 3 ? 'var(--viz-fg)' : 'var(--viz-dim)'} strokeDasharray={i < 3 ? undefined : '4 3'} />
              <text x={540} y={384 - i * 40} textAnchor="middle" fill={i < 3 ? 'var(--viz-fg)' : 'var(--viz-dim)'} style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{t}</text>
            </motion.g>
          ))}
          <Appear on={s === 7} delay={s === 7 ? 1.8 : 0}>
            <Wire d="M650 270 L650 166" on={s === 7} delay={s === 7 ? 1.8 : 0} arrow />
            <Label x={662} y={214} size={12} weight={500}>overflow</Label>
            <Label x={662} y={232} size={11} dim>does not fit</Label>
          </Appear>

          {/* ===== step 8: two stages ===== */}
          <Appear on={s === 8}>
            <Label x={X0} y={170} size={11} dim>DISK</Label>
            <Block x={X0} y={180} w={150} h={56} label="LBA 0: MBR" sub="stage 1 · 446 B" size={13} state="on" />
            <Block x={X0 + 150} y={180} w={250} h={56} label="LBA 1 … 2047" sub="stage 2 · much larger" size={13} state="on" />
            <Block x={X0 + 400} y={180} w={320} h={56} label="partition at LBA 2048" sub="filesystem with /boot/kernel" size={13} state="off" />
            <Label x={X0} y={300} size={11} dim>RAM</Label>
            <Block x={X0} y={310} w={150} h={50} label="stage 1" sub="0x7C00" size={13} state="off" />
            <Block x={X0 + 210} y={310} w={190} h={50} label="stage 2" sub="filesystem, protected mode" size={13} state="off" />
            <Block x={X0 + 460} y={310} w={260} h={50} label="your kernel" sub="loaded and started" size={13} state="fill" />
          </Appear>
          <Wire from={[X0 + 150, 335]} to={[X0 + 208, 335]} on={s === 8} delay={0.4} />
          <Wire from={[X0 + 400, 335]} to={[X0 + 458, 335]} on={s === 8} delay={0.8} />
          <Packet on={s === 8} points={[[X0 + 275, 236], [X0 + 275, 272], [X0 + 305, 310]]} duration={1.4} label="load" />
          <Packet on={s === 8} points={[[X0 + 560, 236], [X0 + 560, 272], [X0 + 590, 310]]} duration={1.4} delay={0.7} label="load" />
        </Scene>
      )}
    </VizStage>
  )
}
