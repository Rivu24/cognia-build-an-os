import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Menu, Search, Sun, Moon, Play } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Lockup, COPYRIGHT, WIKI } from '@/components/brand'
import { SearchDialog } from '@/components/layout/SearchDialog'
import { MusicPlayer } from '@/components/music/MusicPlayer'
import { onboarding, useOnboarding } from '@/lib/onboarding'
import { Bar } from '@/components/learn/bits'
import { actions, useDone, useStore } from '@/lib/progress'
import { makePlan, prereqModules, useAnswers } from '@/components/prereq/selfcheck'
import { useNextLesson, usePrereqProgress } from '@/lib/next'
import { usePulse } from '@/components/home/hooks'
import { cn } from '@/lib/utils'
import { SfxVolume } from '@/components/music/SfxVolume'
import { sfx } from '@/lib/sfx'

/** a whoosh when a panel opens or closes (any way: button, shortcut, Escape, overlay, swipe) */
function usePanelSound(open: boolean) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) return void (first.current = false)
    if (open) sfx.open()
    else sfx.close()
  }, [open])
}

/* Pages put context navigation (lesson outline, table of contents) into the rail through this slot. */
const RailCtx = createContext<(n: ReactNode) => void>(() => {})
export function useRail(node: ReactNode, deps: unknown[]) {
  const set = useContext(RailCtx)
  useEffect(() => {
    set(node)
    return () => set(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

const NAV = [
  { to: '/basics', label: 'Prerequisites' },
  { to: '/path', label: 'Learning path' },
  { to: '/lab', label: 'Concept Lab' },
  { to: '/library', label: 'Library' },
]

/** True on /basics and on a prerequisite lesson: there "up next" means the next prerequisite. */
function usePrereqContext() {
  const { pathname } = useLocation()
  const pre = usePrereqProgress()
  const id = pathname.startsWith('/learn/') ? pathname.split('/')[2] : ''
  const inPrereq = pathname === '/basics' || (!!id && pre.path?.byId[id]?.section === 'prereq')
  // with a self-check plan, the next prerequisite is the plan's first open lesson (the same as the /basics button)
  const answers = useAnswers()
  const done = useDone()
  const { next, allKnown } = useMemo(() => {
    if (!pre.path) return { next: pre.next, allKnown: false }
    const mods = prereqModules(pre.path)
    const plan = makePlan(mods, answers, done)
    const allKnown = mods.length > 0 && plan.marked === mods.length && plan.modules.length === 0
    // a plan that is finished (or "I know all of it") hands over to the core path
    return { next: plan.modules.length > 0 || plan.marked === mods.length ? plan.first : pre.next, allKnown }
  }, [pre.path, pre.next, answers, done])
  return { ...pre, next, allKnown, inPrereq: inPrereq && !!next }
}

/* The one answer to "what do I read next?", always at the top of the rail. */
function UpNext() {
  const { path, next, started, coreDone, coreTotal } = useNextLesson()
  const pre = usePrereqContext()
  const { pathname } = useLocation()
  const pulse = usePulse()
  if (pre.inPrereq && pre.next) return <PrereqUpNext next={pre.next} done={pre.done} total={pre.total} />
  if (!path) {
    return (
      <div className="bg-soft p-4" aria-hidden>
        <div className="h-3 w-16 bg-soft-2" />
        <div className="mt-4 h-4 w-11/12 bg-soft-2" />
        <div className="mt-2 h-4 w-2/3 bg-soft-2" />
        <div className="mt-6 h-10 bg-soft-2" />
      </div>
    )
  }
  if (!next) {
    return (
      <section aria-label="Up next" className="bg-soft p-4">
        <div className="eyebrow">All done</div>
        <p className="mt-2.5 text-[15px] leading-snug font-medium">You have finished every lesson on the path.</p>
        {pathname !== '/path' && <Link to="/path" className="mt-4 flex h-10 items-center justify-between bg-foreground px-4 text-[13.5px] font-medium text-background transition-opacity hover:opacity-85">
          Review the path <ArrowRight className="size-4" />
        </Link>}
      </section>
    )
  }
  const here = pathname === `/learn/${next.id}`
  /* the path page leads with its own large "up next" card: one solid button on screen is enough */
  const pageHasIt = pathname === '/path'
  return (
    <section aria-label="Up next" className="bg-soft p-4">
      <div className="eyebrow flex items-center gap-2">
        <motion.span className="dot size-1.5 text-foreground" {...pulse} />
        Up next
      </div>
      <Link to={`/learn/${next.id}`} className="group mt-3 block">
        <span className="block font-mono text-[11px] text-muted-foreground">{next.code} · Track {next.trackN}</span>
        <span className="mt-1 line-clamp-3 block text-[15px] leading-snug font-medium text-balance group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">{next.title}</span>
      </Link>
      <Bar className="mt-4" value={coreTotal ? coreDone / coreTotal : 0} />
      <div className="mt-2 font-mono text-[11px] text-muted-foreground">
        {coreDone} / {coreTotal} core lessons
      </div>
      {here ? (
        <div className="mt-4 flex h-10 items-center gap-2 border border-line-strong px-4 text-[13.5px] text-muted-foreground">
          <span className="dot size-1.5 text-foreground" /> You are reading it
        </div>
      ) : pageHasIt ? null : (
        <Link to={`/learn/${next.id}`} className="mt-4 flex h-10 items-center justify-between bg-foreground px-4 text-[13.5px] font-medium text-background transition-opacity hover:opacity-85">
          {started ? 'Continue' : 'Start'} <ArrowRight className="size-4" />
        </Link>
      )}
      {coreDone === 0 && pre.total > 0 && !pre.allKnown && pathname !== '/basics' && (
        <Link to="/basics" className="group mt-3 block text-[12.5px] leading-snug text-muted-foreground transition-colors hover:text-foreground">
          <Tail text={pre.done > 0 ? `Continue the prerequisites (${pre.done}/${pre.total})` : 'New to C or assembly? Start with the prerequisites'} />
        </Link>
      )}
    </section>
  )
}

/** A quiet link label whose arrow never wraps onto a line of its own. */
function Tail({ text }: { text: string }) {
  const i = text.lastIndexOf(' ')
  return (
    <>
      {text.slice(0, i + 1)}
      <span className="whitespace-nowrap">{text.slice(i + 1)}<ArrowRight className="ml-1 inline size-3 align-[-1px] transition-transform group-hover:translate-x-0.5" /></span>
    </>
  )
}

/* On /basics and inside a prerequisite lesson the rail follows the Prerequisites section. */
function PrereqUpNext({ next, done, total }: { next: NonNullable<ReturnType<typeof usePrereqProgress>['next']>; done: number; total: number }) {
  const { pathname } = useLocation()
  const pulse = usePulse()
  const here = pathname === `/learn/${next.id}`
  return (
    <section aria-label="Up next" className="bg-soft p-4">
      <div className="eyebrow flex items-center gap-2">
        <motion.span className="dot size-1.5 text-foreground" {...pulse} />
        Up next · Prerequisites
      </div>
      <Link to={`/learn/${next.id}`} className="group mt-3 block">
        <span className="block font-mono text-[11px] text-muted-foreground">{next.code} · {next.module.title}</span>
        <span className="mt-1 line-clamp-3 block text-[15px] leading-snug font-medium text-balance group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">{next.title}</span>
      </Link>
      <Bar className="mt-4" value={total ? done / total : 0} />
      <div className="mt-2 font-mono text-[11px] text-muted-foreground">{done} / {total} prerequisites</div>
      {here ? (
        <div className="mt-4 flex h-10 items-center gap-2 border border-line-strong px-4 text-[13.5px] text-muted-foreground">
          <span className="dot size-1.5 text-foreground" /> You are reading it
        </div>
      ) : pathname === '/basics' ? null : (
        <Link to={`/learn/${next.id}`} className="mt-4 flex h-10 items-center justify-between bg-foreground px-4 text-[13.5px] font-medium text-background transition-opacity hover:opacity-85">
          {done > 0 ? 'Continue' : 'Start'} <ArrowRight className="size-4" />
        </Link>
      )}
      <Link to="/path" className="group mt-3 block text-[12.5px] leading-snug text-muted-foreground transition-colors hover:text-foreground">
        <Tail text="Skip to the learning path" />
      </Link>
    </section>
  )
}

function RailBody({ extra, onSearch }: { extra: ReactNode; onSearch: () => void }) {
  const theme = useStore((s) => s.theme)
  return (
    <div className="flex min-h-full flex-col">
      <div className="px-5 pt-6">
        <Link to="/" aria-label="COGNIA Build an OS home" className="inline-block"><Lockup /></Link>
      </div>

      <div className="px-5 pt-7"><UpNext /></div>

      <nav className="px-5 pt-7" aria-label="Site">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) => cn('group flex items-center gap-3 py-[7px] text-[15px] leading-snug transition-colors',
              isActive ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {({ isActive }) => (
              <>
                <span className={cn('h-px w-3 shrink-0 transition-all', isActive ? 'w-5 bg-foreground' : 'bg-line-strong group-hover:w-5 group-hover:bg-foreground')} />
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex gap-2 px-5 pt-6">
        <button onClick={onSearch} className="inline-flex h-9 flex-1 cursor-pointer items-center gap-2 border border-line px-3 text-[13px] text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground">
          <Search className="size-3.5" /> Search <span className="ml-auto font-mono text-[10.5px] text-faint">Ctrl K</span>
        </button>
        <button
          onClick={() => actions.setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center border border-line text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground"
        >
          {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </button>
      </div>
      <SfxVolume className="px-5 pt-2" />

      {extra && <div className="pt-7 pb-2">{extra}</div>}

      <div className="mt-auto px-5 pt-10 pb-6 text-[11.5px] leading-relaxed text-faint">
        <div className="mb-3 flex gap-2 text-[12.5px] text-muted-foreground">
          <Link className="hover:text-foreground" to="/method">How we teach</Link>
          <span className="text-faint" aria-hidden>·</span>
          <Link className="hover:text-foreground" to="/credits">Credits</Link>
        </div>
        {COPYRIGHT}<br />Lesson content: <a className="underline decoration-line-strong underline-offset-2 hover:text-foreground" href={WIKI} target="_blank" rel="noopener">OSDev Wiki</a> contributors, <Link className="underline decoration-line-strong underline-offset-2 hover:text-foreground" to="/credits">CC0</Link>.
      </div>
    </div>
  )
}

/* Mobile header: the lockup, then one compact way back into the path. */
function MobileContinue() {
  const info = useNextLesson()
  const pre = usePrereqContext()
  const { path, started } = info
  if (!path) return <span className="h-9 w-[76px] bg-soft" aria-hidden />
  const next = pre.inPrereq ? pre.next : info.next
  const to = next ? `/learn/${next.id}` : '/path'
  const label = next ? `${started ? 'Continue' : 'Start'} ${pre.inPrereq ? 'prerequisite' : 'lesson'} ${next.code}: ${next.title}` : 'Review the path'
  return (
    <Link to={to} aria-label={label} title={label}
      className="inline-flex h-9 items-center gap-1.5 bg-foreground px-3 font-mono text-[12px] font-medium text-background transition-opacity hover:opacity-85">
      <Play className="size-3.5 fill-current" />
      {next ? next.code : 'Path'}
    </Link>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  // during the home onboarding the journey owns the screen; the shell arrives when it ends
  const ob = useOnboarding()
  const arrive = !ob && onboarding.hasArrived() ? ' ob-arrive' : ''
  const [extra, setExtra] = useState<ReactNode>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  usePanelSound(open)
  usePanelSound(search)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName || '')
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setSearch(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <RailCtx.Provider value={setExtra}>
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }} className="fixed top-2 -left-[999px] z-[999] bg-foreground px-3 py-2 text-background focus:left-2">Skip to content</a>
      <aside className={'fixed inset-y-0 left-0 z-40 hidden w-[280px] overflow-y-auto border-r border-line bg-background [scrollbar-width:thin]' + (ob ? '' : ' lg:block') + arrive}>
        <RailBody extra={extra} onSearch={() => setSearch(true)} />
      </aside>
      <header className={'sticky top-0 z-40 h-14 items-center justify-between gap-3 border-b border-line bg-background/90 px-4 backdrop-blur-md lg:hidden' + (ob ? ' hidden' : ' flex') + arrive}>
        <Link to="/" aria-label="COGNIA Build an OS home" className="min-w-0">
          <Lockup className="max-[419px]:[&>.wordmark]:hidden max-[419px]:[&>span:last-child]:border-0 max-[419px]:[&>span:last-child]:pl-0" />
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <MobileContinue />
          <button onClick={() => setSearch(true)} aria-label="Search" className="inline-flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"><Search className="size-[18px]" /></button>
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="-mr-2 inline-flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"><Menu className="size-5" /></button>
        </div>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[min(88vw,320px)] gap-0 overflow-y-auto p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <RailBody extra={extra} onSearch={() => { setOpen(false); setSearch(true) }} />
        </SheetContent>
      </Sheet>
      <main id="main" tabIndex={-1} className={'min-w-0 outline-none' + (ob ? '' : ' lg:ml-[280px]')}>
        {children}
        {!ob && <Footer />}
      </main>
      <SearchDialog open={search} onOpenChange={setSearch} />
      {!ob && <MusicPlayer />}
    </RailCtx.Provider>
  )
}

function Footer() {
  return (
    <footer className="grid gap-5 border-t border-line px-6 pt-10 pb-28 text-[13px] leading-relaxed text-muted-foreground sm:px-10 md:grid-cols-2 md:gap-14 lg:px-14">
      <div>
        <b className="font-medium text-foreground">{COPYRIGHT}</b> All rights reserved in the platform: its design, curriculum, teaching method, motion graphics, code and original text. COGNIA and the COGNIA mark are marks of Cognia Labs.
      </div>
      <div>
        Every article comes from the <a className="text-foreground underline decoration-line-strong underline-offset-2" href={WIKI} target="_blank" rel="noopener">OSDev Wiki</a>, written by its community and released under <a className="text-foreground underline decoration-line-strong underline-offset-2" href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0 1.0</a>. Thank you. <Link className="text-foreground underline decoration-line-strong underline-offset-2" to="/credits">Full credits</Link>.
      </div>
    </footer>
  )
}
