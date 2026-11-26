import { lazy, useLayoutEffect, useState, type ComponentType } from 'react'
import { Route, Routes } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoading } from '@/components/layout/PageLoading'
import { RouteTransition, useShownLocation, identityOf, sectionOf } from '@/components/transition'
import { SmoothScroll, smoothScroll } from '@/components/motion'
import Home from '@/pages/Home'

/* Lazy pages that render directly once their code is in. A transition starts loading the destination's code while
   the shutter closes; when it has arrived the page renders in the same commit as the swap, with no Suspense
   round trip (React holds a shown fallback for at least 300 ms, which would keep the shutter closed longer). */
function page(load: () => Promise<{ default: ComponentType }>) {
  let ready: ComponentType | undefined
  const get = () => load().then((m) => (ready = m.default, m))
  const Lazy = lazy(get)
  function Page() {
    const [C] = useState<ComponentType>(() => ready ?? Lazy) // fixed per mount, so a page never remounts
    return <C />
  }
  Page.preload = () => void get().catch(() => {})
  return Page
}
const PrereqPage = page(() => import('@/pages/PrereqPage'))
const PathPage = page(() => import('@/pages/PathPage'))
const LessonPage = page(() => import('@/pages/LessonPage'))
const LibraryPage = page(() => import('@/pages/LibraryPage'))
const ArticlePage = page(() => import('@/pages/ArticlePage'))
const ConceptLab = page(() => import('@/pages/ConceptLab'))
const MethodPage = page(() => import('@/pages/MethodPage'))
const CreditsPage = page(() => import('@/pages/CreditsPage'))
const NotFound = page(() => import('@/pages/NotFound'))

function preload(pathname: string) {
  const deep = pathname.split('/').length > 2
  const pages: Record<string, { preload: () => void } | null> = {
    '': null,
    basics: PrereqPage,
    path: PathPage,
    learn: LessonPage,
    library: deep ? ArticlePage : LibraryPage,
    lab: ConceptLab,
    method: MethodPage,
    credits: CreditsPage,
  }
  const sec = sectionOf(pathname)
  ;(sec in pages ? pages[sec] : NotFound)?.preload()
}

/* Scroll to the top when the page shown changes. It follows the shown location, so during a section transition
   the scroll happens while the shutter covers the screen. Anchor-only changes (/library/:slug/:anchor) keep their
   own scroll. */
function ScrollTop() {
  const id = identityOf(useShownLocation().pathname)
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    // a glide still under way (or Lenis' remembered target) must not drag the new page back down
    smoothScroll.get()?.scrollTo(0, { immediate: true, force: true })
  }, [id])
  return null
}

export default function App() {
  return (
    <SmoothScroll>
      <AppShell>
        <RouteTransition
          fallback={<PageLoading />}
          preload={preload}
          routes={(location) => (
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/basics" element={<PrereqPage />} />
              <Route path="/path" element={<PathPage />} />
              <Route path="/learn/:id" element={<LessonPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/library/:slug" element={<ArticlePage />} />
              <Route path="/library/:slug/:anchor" element={<ArticlePage />} />
              <Route path="/lab" element={<ConceptLab />} />
              <Route path="/lab/:id" element={<ConceptLab />} />
              <Route path="/method" element={<MethodPage />} />
              <Route path="/credits" element={<CreditsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        >
          <ScrollTop />
        </RouteTransition>
      </AppShell>
    </SmoothScroll>
  )
}
