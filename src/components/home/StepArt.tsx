/* Three small looping illustrations for "How it works". Monochrome, drawn with the viz tokens so they follow the theme. */
import { motion } from 'motion/react'
import { useLoop } from './hooks'

const FG = 'var(--viz-fg)'
const DIM = 'var(--viz-dim)'
const FAINT = 'var(--viz-faint)'
const mono = { fontFamily: 'var(--font-mono)' }

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 280 180" className="block h-auto w-full" role="img" aria-label={label}>
      {children}
    </svg>
  )
}

/** 01 Watch it move: a pointer walks a row of memory cells and sets each bit, like a frame allocator. */
export function WatchArt() {
  const N = 8
  const { ref, step } = useLoop<HTMLDivElement>(N + 3, 620, N)
  const head = Math.min(step, N - 1)
  const x0 = 28
  const w = 28
  return (
    <div ref={ref}>
      <Frame label="A pointer moves along memory cells, setting each one">
        <text x={x0} y={42} fill={DIM} style={{ ...mono, fontSize: 10, letterSpacing: '.08em' }}>FRAME BITMAP</text>
        <motion.text x={252} y={42} textAnchor="end" fill={FG} style={{ ...mono, fontSize: 10 }}>
          {`0x${(Math.min(step, N) * 0x1000).toString(16).padStart(5, '0')}`}
        </motion.text>
        {Array.from({ length: N }, (_, i) => {
          const set = i < step
          return (
            <g key={i}>
              <motion.rect x={x0 + i * w} y={66} width={w} height={44} strokeWidth={1}
                initial={false} animate={{ fill: set ? FG : 'rgba(0,0,0,0)', stroke: set ? FG : FAINT }} transition={{ duration: 0.3 }} />
              <motion.text x={x0 + i * w + w / 2} y={93} textAnchor="middle" style={{ ...mono, fontSize: 13, fontWeight: 600 }}
                initial={false} animate={{ fill: set ? 'var(--viz-bg)' : DIM }} transition={{ duration: 0.3 }}>
                {set ? 1 : 0}
              </motion.text>
            </g>
          )
        })}
        {/* pointer */}
        <motion.g initial={false} animate={{ x: head * w, opacity: step >= N ? 0 : 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
          <path d={`M${x0 + w / 2} 120 l-6 9 h12 z`} fill={FG} />
          <line x1={x0 + w / 2} x2={x0 + w / 2} y1={129} y2={146} stroke={FG} strokeWidth={1} />
        </motion.g>
        <text x={x0} y={164} fill={DIM} style={{ ...mono, fontSize: 10 }}>{step >= N ? '8 frames allocated' : `alloc_frame() → ${head}`}</text>
      </Frame>
    </div>
  )
}

/** 02 Read the wiki: a page of text with a reading marker moving down it, line by line. */
export function ReadArt() {
  const lines = [0.92, 0.78, 0.86, 0.6, 0, 0.9, 0.82, 0.7, 0.44]
  const real = lines.map((l, i) => (l ? i : -1)).filter((i) => i >= 0)
  const { ref, step } = useLoop<HTMLDivElement>(real.length + 2, 700, real.length)
  const at = real[Math.min(step, real.length - 1)]
  const W = 168
  const x0 = 84
  return (
    <div ref={ref}>
      <Frame label="A wiki page being read line by line">
        <rect x={64} y={14} width={208} height={160} fill="none" stroke={FAINT} />
        <text x={x0} y={38} fill={FG} style={{ fontSize: 13, fontWeight: 600 }}>Paging</text>
        <text x={x0 + W} y={38} textAnchor="end" fill={DIM} style={{ ...mono, fontSize: 9 }}>OSDev Wiki</text>
        {lines.map((l, i) =>
          l ? (
            <motion.rect key={i} x={x0} y={54 + i * 12} height={4} width={W * l}
              initial={false} animate={{ fill: step < real.length && i === at ? FG : real.indexOf(i) < step ? DIM : FAINT }} transition={{ duration: 0.3 }} />
          ) : null,
        )}
        {/* reading marker in the margin */}
        <motion.rect x={72} width={2} height={10} fill={FG} initial={false}
          animate={{ y: 51 + at * 12, opacity: step < real.length ? 1 : 0 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }} />
        {/* outline on the left: the page's sections */}
        {[0, 1, 2, 3].map((k) => (
          <motion.rect key={k} x={10} y={40 + k * 16} height={3} width={k === 0 ? 38 : 30 - k * 3}
            initial={false} animate={{ fill: Math.floor((at / lines.length) * 4) === k ? FG : FAINT }} transition={{ duration: 0.3 }} />
        ))}
      </Frame>
    </div>
  )
}

/** 03 Prove it in QEMU: a terminal that builds, boots and passes the checkpoint. */
export function ProveArt() {
  const out = [
    { t: '$ make run', c: FG },
    { t: 'qemu-system-i386 -kernel myos.bin', c: DIM },
    { t: 'Booting from ROM...', c: DIM },
    { t: 'kernel: hello from kernel_main', c: FG },
    { t: '✓ checkpoint passed', c: FG, b: true },
  ]
  const { ref, step, active } = useLoop<HTMLDivElement>(out.length + 3, 760, out.length)
  return (
    <div ref={ref}>
      <Frame label="A terminal runs the kernel in QEMU and the checkpoint passes">
        <rect x={8} y={14} width={264} height={160} fill="none" stroke={FAINT} />
        <line x1={8} x2={272} y1={36} y2={36} stroke={FAINT} />
        <text x={20} y={29} fill={DIM} style={{ ...mono, fontSize: 9.5, letterSpacing: '.06em' }}>QEMU</text>
        {[0, 1, 2].map((k) => <rect key={k} x={242 + k * 9} y={23} width={5} height={5} fill={FAINT} />)}
        {out.map((l, i) => (
          <motion.text key={i} x={20} y={60 + i * 20} fill={l.c} style={{ ...mono, fontSize: 11, fontWeight: l.b ? 600 : 400 }}
            initial={false} animate={{ opacity: i < step ? 1 : 0 }} transition={{ duration: 0.18 }}>
            {l.t}
          </motion.text>
        ))}
        {/* cursor */}
        <motion.rect x={20} width={7} height={12} fill={FG} initial={false}
          animate={{ y: 50 + Math.min(step, out.length) * 20, opacity: active ? [1, 1, 0, 0] : 1 }}
          transition={{ y: { duration: 0 }, opacity: active ? { duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] } : { duration: 0 } }} />
      </Frame>
    </div>
  )
}
