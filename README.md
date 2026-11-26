# COGNIA · Build an OS

A learning platform that teaches operating-system development top to bottom. Every lesson opens with a step-by-step motion graphic of the mechanism, then the full text of the matching [OSDev Wiki](https://wiki.osdev.org/) article (CC0), then a checkpoint you prove in QEMU.

© 2026 Dron Guin, Founder, Cognia Labs. See [NOTICE.md](NOTICE.md) for what that covers and for the OSDev Wiki credit.

## Run it

Requires Node 20+.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (works from any folder or static host; routes use the URL hash)
npm run preview    # serve dist/
```

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Base UI), Motion (`motion/react`), lucide icons. The COGNIA brand tokens live in `src/index.css`: black canvas, Instrument Sans with JetBrains Mono, hairlines, square corners. The UI and the animations are monochrome, and light theme is opt-in.

## Layout

| Path | What it is |
| --- | --- |
| `src/pages/` | Home, Prerequisites (`/basics`), Learning path, Lesson player, Concept Lab, Library, Article, How we teach, Credits |
| `src/components/intro/` | The opening sequence (Three.js): boot log, 3D mark, wormhole, tunnel. Plays on every load except on the home page (which has the journey); `?intro` forces it, `?intro=svg` the no-WebGL version |
| `src/components/journey/` | The home page journey: scroll scrubs one 3D story (Big Bang, galaxy, a full turn around the Sun through its corona, Earth, the ISS, Voyager, the COGNIA wormhole). `story.ts` holds the chapters and captions, `scene.ts` the Three.js scene, `sound.ts` the generated sound design (offered by a prompt). Models and maps live in `public/journey/` (credits in NOTICE.md) |
| `src/components/transition/` | Route transitions: shutter between sections, slide within one |
| `src/components/motion/` | Shared motion kit (weighted reveals, parallax, smooth scroll). Read its `index.ts` notes before adding motion |
| `src/viz/` | Motion graphics. `core/` holds the player (`VizStage`) and SVG primitives. Each `concepts/<id>.tsx` file is one animation, registered automatically. Read `VIZ_GUIDE.md` before writing one. |
| `src/components/` | shadcn/ui components (`ui/`), app shell, article renderer, learning widgets |
| `src/lib/` | Data loading, progress (kept in the browser only), helpers |
| `public/data/` | Generated content: curriculum, article index, one JSON file per article |
| `public/wiki/` | Images from the OSDev Wiki |
| `music/` | Tracks for the music player |
| `tools/` | The content pipeline (Python) and `shoot.mjs`, a screenshot helper for visual checks |

## Music

Drop audio files (mp3, m4a, ogg, opus, wav, flac) into `music/`. Each one joins the player's queue automatically: straight away in `npm run dev`, and on the next `npm run build` for the published site. Name files `Title - Artist.mp3` to show an artist line; a plain `Title.mp3` works too. The player (`src/components/music/`, engine in `src/lib/music.ts`) keeps playing across pages and never starts on its own. It has shuffle, loop (off, all, one), seek, volume and a live spectrum, and responds to the keyboard's media keys.

## Content pipeline

Requires Python 3.10+ and `pip install mwparserfromhell pypandoc_binary beautifulsoup4`.

```sh
cd tools
python wikiconv.py   # OSDev Wiki wikitext -> clean HTML (tools/cache)
python export.py     # -> public/data (curriculum, index, articles, method)
```

- `tools/source/osdev-wiki-20251230.json`: articles, templates and categories from the WikiTeam dump of the OSDev Wiki, 30 December 2025 (<https://archive.org/details/wiki-wiki.osdev.org-20251230>).
- `tools/source/curriculum.json`: tracks, modules and lessons. Each lesson's `articles` and `further` fields hold exact wiki titles.
- `tools/source/prereqs.json`: the Prerequisites section (lessons `p1l1`…), exported alongside the path but kept out of its numbering and counts.
- `tools/source/method.md`: the teaching method, rendered on the "How we teach" page.
- An animation is attached to lessons through `meta.lessons` in its concept file.

## Visual checks

With `npm run dev` running:

```sh
node tools/shoot.mjs viz paging-translation ./shots       # one PNG per animation step, plus the light theme
node tools/shoot.mjs page path ./shots/path.png 390 860   # any route, any viewport
node tools/music-check.mjs ./shots                        # drives every music player control on desktop and phone
node tools/journey-check.mjs ./shots 1280 800              # screenshots the home journey at each chapter (dev server)
```
