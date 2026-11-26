/* Renders a verbatim OSDev Wiki article (HTML produced by tools/wikiconv.py + export.py). */
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ExternalLink } from 'lucide-react'
import { useStore } from '@/lib/progress'
import type { Article } from '@/lib/data'

export function prefixIds(html: string, p: string) {
  if (!p) return html
  return html.replace(/\bid="([^"]+)"/g, `id="${p}$1"`).replace(/href="#(?!\/)([^"]+)"/g, `href="#${p}$1"`)
}

export function WikiArticle({ article, idPrefix = '' }: { article: Article; idPrefix?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const copy = useStore((s) => s.copy)
  const html = useMemo(() => prefixIds(article.html, idPrefix), [article.html, idPrefix])

  // same-page anchors would fight the hash router: scroll instead of navigating
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (href.startsWith('#/')) {
        e.preventDefault()
        nav(href.slice(1))
      } else if (href.startsWith('#')) {
        e.preventDefault()
        document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (/^https?:/.test(href)) {
        a.target = '_blank'
        a.rel = 'noopener'
      }
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [nav])

  // copy buttons are opt-in (the wiki warns against copy-paste kernels)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.querySelectorAll('.copy-btn').forEach((b) => b.remove())
    if (!copy) return
    el.querySelectorAll('pre').forEach((pre) => {
      const box = pre.parentElement?.classList.contains('sourceCode') ? pre.parentElement : pre
      if (!box) return
      if (box === pre) {
        const w = document.createElement('div')
        w.className = 'sourceCode'
        pre.replaceWith(w)
        w.appendChild(pre)
      }
      const host = pre.parentElement!
      const b = document.createElement('button')
      b.className = 'copy-btn'
      b.type = 'button'
      b.textContent = 'Copy'
      b.onclick = () =>
        navigator.clipboard?.writeText(pre.innerText).then(
          () => { b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1400) },
          () => (b.textContent = 'Select + copy'),
        )
      host.appendChild(b)
    })
  }, [copy, html])

  return <div ref={ref} className="prose-wiki" dangerouslySetInnerHTML={{ __html: html }} />
}

export function SourceBar({ article }: { article: Article }) {
  return (
    <div className="mb-6 flex max-w-[760px] flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border border-line bg-soft px-4 py-3 text-[12.5px] text-muted-foreground">
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="font-mono text-[10.5px] tracking-[.1em] uppercase">From the OSDev Wiki</span>
        <b className="font-medium text-foreground">{article.title}</b>
        <span>last edited {article.updated} · <a className="underline" href={article.history} target="_blank" rel="noopener">authors ↗</a></span>
      </span>
      <span className="flex items-center gap-3">
        <a className="inline-flex items-center gap-1 underline" href={article.url} target="_blank" rel="noopener">Original page <ExternalLink className="size-3" /></a>
        <a className="underline" href="#/credits">CC0</a>
      </span>
    </div>
  )
}
