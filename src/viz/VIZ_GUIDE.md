# Writing a motion graphic (concept animation)

Each animation teaches one OS mechanism, step by step, to a beginner who knows C but not hardware. It sits at the top of the lessons listed in its `meta.lessons`, and in the Concept Lab (`#/lab/<id>`).

## Files and ownership
- One file per concept: `src/viz/concepts/<id>.tsx`. `<id>` is kebab-case and equals `meta.id`.
- The registry picks files up automatically. **Do not edit** `src/viz/core/*`, `src/viz/registry.ts`, pages, or other agents' concept files. If you need a helper, define it inside your own file.
- Reference implementation (quality bar): `src/viz/concepts/paging-translation.tsx`. Read it first.

## Contract
```tsx
import { VizStage } from '../core/VizStage'
import { Scene, Block, Wire, Packet, Label, BitField, MemoryMap, Pulse, Appear } from '../core/primitives'
import type { VizMeta, VizStep } from '../core/types'
export const meta: VizMeta = { id, title, summary, lessons: ['t6m2l1', ...], articles: ['Exact Wiki Title'], group: 'Memory', order: 640 }
const steps: VizStep[] = [{ caption, detail?, ms? }, ...]          // 5 to 9 steps
export default function X() { return <VizStage meta={meta} steps={steps}>{(s) => <Scene label={meta.summary}>…</Scene>}</VizStage> }
```
- `lessons`: real lesson ids from `public/data/curriculum.json` (first = the main lesson). `articles`: exact titles that exist in `public/data/index.json` (field `t`).
- `order`: track number × 100 + position (e.g. track 6 → 600–699), used to sort the gallery.
- Scene coordinates: viewBox `0 0 800 450`. Keep 20 px margins. Minimum font size 10.5 (labels), body labels 12–14.

## How to animate
- The scene is a pure function of the step `s`. Keep elements mounted and change their state (`state`, `on`, `active`) so stepping backwards and forwards is smooth. Use `<Appear on={s >= 2}>` for parts that enter, `<Wire on>` for connections that draw, `<Packet>` for data or control moving, `<Pulse>` to point at the thing the caption talks about.
- Each step changes one idea. The caption says what is happening in plain words (≤ 90 characters); `detail` adds the why or the number (≤ 200 characters).
- Show real, correct values (addresses, port numbers, bit layouts, register names) taken from the OSDev Wiki articles (wikitext in `tools/source/osdev-wiki-20251230.json`, or rendered HTML in `public/data/a/<slug>.json`). A learner must be able to check every number against the reading. Do not invent behaviour.
- Motion has meaning: something moving = data or control flowing; glow (`state="on"`) = "look here now"; `dim` = not relevant to this step; `fill` = selected/written; `hatch` = reserved/unusable.

## Brand rules (strict)
- Monochrome only. Use CSS tokens: `var(--viz-fg)`, `var(--viz-dim)`, `var(--viz-faint)`, `var(--viz-glow)`, `var(--viz-bg)`. Never hex colours, never Tailwind colour classes. Light theme must work.
- Square corners (no `rx`). Round shapes only for dots/packets/pulses. Fonts: `var(--font-sans)` / `var(--font-mono)` (Label is mono by default).
- Voice: direct, plain, specific, never talks down. Never use: synergy, innovative, empower, leverage, disrupt, best-in-class, seamless, next-gen, unlock, game-changer.

## Check your work (required)
1. Type-check: `npx tsc -b` from `web/`. Fix every error in your files (ignore errors that are only in other agents' files).
2. Capture every step: `node tools/shoot.mjs viz <id> <scratch-dir>` (dev server runs at http://127.0.0.1:5173). It writes one PNG per step plus `<id>-light-last.png`, and prints `BROWSER ERRORS` if any.
3. Open every PNG with the Read tool. Fix: overlapping text, text crossing lines/boxes, elements outside the stage, unreadable sizes, steps where nothing visibly changes, light-theme invisibility. Repeat until clean.
