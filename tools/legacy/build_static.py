"""Build the static site for COGNIA · Build an OS.

Step 2 of the build (run wikiconv.py first). Inputs:
  tools/cache/articles/*.json      converted OSDev Wiki articles (CC0)
  tools/source/curriculum.json     the learning path
  tools/source/method.md           the teaching method
Output: index.html, method.html, credits.html, learn/, library/, assets/js/search-index.js
"""
import json, os, re, glob, html, shutil
import pypandoc, hashlib

TOOLS = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(TOOLS)
SRC = os.path.join(TOOLS, 'source')
YEAR = '2026'
PRODUCT = 'Build an OS'
COPYRIGHT = f'© {YEAR} Dron Guin, Founder, Cognia Labs.'
WIKI = 'https://wiki.osdev.org/'
DUMP = 'https://archive.org/details/wiki-wiki.osdev.org-20251230'
LEVELS = {1: 'Beginner', 2: 'Medium', 3: 'Advanced', 4: 'Master'}

ASSET_V = hashlib.md5((open(os.path.join(WEB, 'assets/css/site.css'), 'rb').read() + open(os.path.join(WEB, 'assets/js/site.js'), 'rb').read())).hexdigest()[:8]
E = lambda s: html.escape(str(s), quote=True)

MARK = ('<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M30 6H8v28h22" stroke-linecap="square" '
        'stroke-linejoin="miter"/><circle cx="21" cy="20" r="3.6" stroke-linecap="round"/></svg>')
WM = ('<svg class="mark hero-wm" viewBox="0 0 40 40" aria-hidden="true"><path d="M30 6H8v28h22"/>'
      '<circle cx="21" cy="20" r="3.6" stroke-linecap="round"/></svg>')
FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23000'/%3E"
           "%3Cpath d='M30 6H8v28h22' fill='none' stroke='%23fff' stroke-width='3'/%3E%3Ccircle cx='21' cy='20' r='3.6' fill='none' stroke='%23fff' stroke-width='3'/%3E%3C/svg%3E")


def slug(t):
    t = t.replace('+', '_plus').replace('#', '_sharp')
    t = re.sub(r'--$', '_minus_minus', t)
    return re.sub(r'[^A-Za-z0-9]+', '_', t).strip('_')


def trunc(s, n):
    s = s or ''
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0].rstrip(',;:.') + '…'


def lvl(n):
    if not n:
        return ''
    n = int(n)
    dots = ''.join(f'<b class="{"on" if i < n else ""}"></b>' for i in range(4))
    return f'<span class="lvl" title="Difficulty: {LEVELS.get(n, "")}"><i>{dots}</i>{LEVELS.get(n, "")}</span>'


def mins(m):
    m = int(m or 0)
    return f'{m} min' if m < 60 else (f'{m // 60} h {m % 60} min' if m % 60 else f'{m // 60} h')


# ------------------------------------------------------------------ data
A = {}
for f in glob.glob(os.path.join(TOOLS, 'cache', 'articles', '*.json')):
    d = json.load(open(f, encoding='utf-8'))
    A[d['title']] = d
CUR = json.load(open(os.path.join(SRC, 'curriculum.json'), encoding='utf-8'))
METHOD_MD = open(os.path.join(SRC, 'method.md'), encoding='utf-8').read()

LESSONS = []  # flat ordered list
for ti, t in enumerate(CUR['tracks'], 1):
    t['n'] = ti
    t['all'] = []
    for mi, m in enumerate(t['modules'], 1):
        m['n'] = mi
        for li, l in enumerate(m['lessons'], 1):
            l['code'] = f'{ti}.{mi}.{li}'
            l['track'], l['module'] = t, m
            l['idx'] = len(LESSONS)
            LESSONS.append(l)
            t['all'].append(l)
BYID = {l['id']: l for l in LESSONS}
USED_IN = {}
for l in LESSONS:
    for a in l.get('articles', []):
        USED_IN.setdefault(a, []).append((l, 'primary'))
    for a in l.get('further', []):
        USED_IN.setdefault(a, []).append((l, 'further'))
missing = sorted({a for l in LESSONS for a in l.get('articles', []) + l.get('further', []) if a not in A})
if missing:
    raise SystemExit(f'curriculum references unknown articles: {missing}')

BACK = {}
for t, d in A.items():
    for x in d['links']:
        if x != t:
            BACK.setdefault(x, set()).add(t)
CONTRIBUTORS = sorted({u for d in A.values() for u in d['authors']}, key=str.lower)
N_PRIMARY = len({a for l in LESSONS for a in l.get('articles', [])})
TOTAL_MIN = sum(int(l.get('minutes', 0)) for l in LESSONS)
CATS = {}
for t, d in A.items():
    for c in d['categories']:
        CATS.setdefault(c, []).append(t)


# ------------------------------------------------------------------ layout
def rail(root, active, extra=''):
    nav = [('index.html', 'Start', 'home'), ('method.html', 'How we teach', 'method'),
           ('learn/index.html', 'Learning path', 'learn'), ('library/index.html', 'Library', 'library'),
           ('credits.html', 'Credits and licence', 'credits')]
    items = ''.join(f'<a class="ni{" active" if k == active else ""}" href="{root}{u}"'
                    f'{" aria-current=page" if k == active else ""}>{E(lab)}</a>' for u, lab, k in nav)
    return f'''<nav class="rail" id="rail" aria-label="Site">
<div class="rail-brand">
  <a class="lock" href="{root}index.html" aria-label="COGNIA {PRODUCT} home">{MARK}<span class="lock-master">COGNIA</span><span class="lock-product">{PRODUCT}</span></a>
  <div class="rail-sub">Learn operating-system development, top to bottom. Content from the OSDev Wiki.</div>
  <div class="rail-tools"><button class="btn" type="button" data-search-open>Search <kbd>/</kbd></button><button class="btn" type="button" data-theme-toggle>Light theme</button></div>
</div>
<div class="ng"><div class="nl">{PRODUCT}</div>{items}</div>
{extra}
<div class="rail-foot">{COPYRIGHT}<br>Lesson content: <a href="{WIKI}" rel="noopener">OSDev Wiki</a> contributors, <a href="{root}credits.html">CC0</a>.</div>
</nav>'''


def footer(root):
    return f'''<footer class="foot">
<div><b>{COPYRIGHT}</b> All rights reserved in the platform: its design, curriculum, teaching method, code and original text.<br>
COGNIA and the COGNIA mark are marks of Cognia Labs.</div>
<div>Every article on this platform comes from the <a href="{WIKI}" rel="noopener">OSDev Wiki</a>, written by its community and released under <a href="https://creativecommons.org/publicdomain/zero/1.0/" rel="noopener">CC0 1.0</a>. Thank you. <a href="{root}credits.html">Full credits</a>.</div>
</footer>'''


def page(path, title, body, active='', rail_extra='', desc=''):
    depth = path.count('/')
    root = '../' * depth
    body = body.replace('{{ROOT}}', root)
    rail_extra = rail_extra.replace('{{ROOT}}', root)
    full = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc or 'Learn to build an operating system, top to bottom, with lessons drawn from the OSDev Wiki. A COGNIA learning platform.')}">
<meta name="color-scheme" content="dark">
<link rel="icon" href="{FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}assets/css/site.css?v={ASSET_V}">
<script>try{{var t=localStorage.getItem('cognia-osb-theme');if(t)document.documentElement.setAttribute('data-theme',JSON.parse(t))}}catch(e){{}}</script>
</head>
<body data-root="{root}">
<a class="skip" href="#main">Skip to content</a>
<header class="topbar"><a class="lock" href="{root}index.html">{MARK}<span class="lock-master">COGNIA</span><span class="lock-product">{PRODUCT}</span></a>
<span style="display:flex;gap:6px"><button class="btn" type="button" data-search-open aria-label="Search">Search</button><button class="btn" type="button" data-nav-toggle aria-controls="rail" aria-expanded="false">Menu</button></span></header>
{rail(root, active, rail_extra)}
<main class="main" id="main">
{body}
{footer(root)}
</main>
<div class="search-dlg" id="search" role="dialog" aria-modal="true" aria-label="Search">
<div class="search-box"><input class="input" type="search" placeholder="Search lessons and {len(A)} articles…" aria-label="Search"><ul class="search-res"></ul>
<div class="search-hint">↑ ↓ to move · Enter to open · Esc to close</div></div></div>
<script src="{root}assets/js/site.js?v={ASSET_V}"></script>
</body>
</html>
'''
    out = os.path.join(WEB, path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(full)


def source_bar(d, label='From the OSDev Wiki'):
    hist = WIKI + 'index.php?title=' + d['title'].replace(' ', '_') + '&action=history'
    return (f'<div class="source-bar"><span class="src-l"><span class="src-k">{label}</span><b>{E(d["title"])}</b>'
            f'<span>last edited {E(d["updated"])} · <a href="{E(hist)}" rel="noopener">authors ↗</a></span></span>'
            f'<span class="src-l"><a href="{E(d["url"])}" rel="noopener">Original page ↗</a><a href="{{{{ROOT}}}}credits.html">CC0</a></span></div>')


def prefix_ids(h, p):
    h = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{p}{m.group(1)}"', h)
    return re.sub(r'href="#([^"]+)"', lambda m: f'href="#{p}{m.group(1)}"', h)


# ------------------------------------------------------------------ lessons
def track_rail(t, cur_id):
    rows = []
    for m in t['modules']:
        rows.append(f'<div class="nl" style="margin-top:12px">{E(m["title"])}</div>')
        for l in m['lessons']:
            a = ' active' if l['id'] == cur_id else ''
            rows.append(f'<a class="ni{a}" data-lesson="{l["id"]}" href="{{{{ROOT}}}}learn/{l["id"]}.html"><span class="n">{l["code"]}</span><span>{E(l["title"])}</span></a>')
    return f'<div class="ng"><div class="nl">Track {t["n"]} · {E(t["title"])}</div></div><div class="ng" style="padding-top:0">{"".join(rows)}</div>'


STUCK_TITLES = ['Troubleshooting', 'Triple Fault', 'Kernel Debugging', "I Can't Get Interrupts Working", 'My Bootloader Does Not Work',
                "James Molloy's Tutorial Known Bugs", "Bran's Kernel Development Tutorial Known Bugs", "Brokenthorn's Known Bugs", 'Posting Checklist']
STUCK = ('<div class="stuck"><div class="k">Stuck?</div><div class="tags">' +
         ''.join(f'<a class="tag" href="{{{{ROOT}}}}library/{slug(x)}.html">{E(x)}</a>' for x in STUCK_TITLES if x in A) +
         '<a class="tag" href="https://forum.osdev.org/" rel="noopener">OSDev forum ↗</a></div></div>')


def build_lesson(l):
    t, m = l['track'], l['module']
    arts = [A[x] for x in l['articles']]
    prev_l = LESSONS[l['idx'] - 1] if l['idx'] > 0 else None
    next_l = LESSONS[l['idx'] + 1] if l['idx'] + 1 < len(LESSONS) else None
    prereq = ''.join(f'<li data-lesson="{p}"><a href="{{{{ROOT}}}}learn/{p}.html">{E(BYID[p]["code"])} {E(BYID[p]["title"])}</a></li>' for p in l.get('prereq', []) if p in BYID)
    reading = ''.join(f'<li><a href="#read-{i}">{E(a["title"])}</a> <span class="muted">· {max(1, round(a["words"] / 220))} min read</span></li>' for i, a in enumerate(arts, 1))
    objectives = ''.join(f'<li>{E(o)}</li>' for o in l.get('objectives', []))
    recall = []
    for pid in l.get('prereq', [])[:3]:
        pl = BYID.get(pid)
        if pl and pl.get('objectives'):
            q = re.sub(r'^(After this lesson,? )?you can ', '', pl['objectives'][0].strip(), flags=re.I).rstrip('.')
            recall.append(f'<li data-lesson="{pid}">Can you still {E(q[:1].lower() + q[1:])}? <a href="{{{{ROOT}}}}learn/{pid}.html">{pl["code"]}</a></li>')
    recall_html = f'<div class="brief full" style="margin-top:22px"><div><div class="k">Recall first (no score)</div><ul>{"".join(recall)}</ul></div></div>' if recall else ''
    head = f'''<header class="lesson-head">
<div class="eyebrow"><a href="{{{{ROOT}}}}learn/index.html">Learning path</a><span>/</span><a href="{{{{ROOT}}}}learn/index.html#{t["id"]}">Track {t["n"]} · {E(t["title"])}</a><span>/</span><span>{E(m["title"])}</span></div>
<h1 class="h1">{E(l["title"])}</h1>
<div class="meta-row"><span>Lesson {l["code"]} · {l["idx"] + 1} of {len(LESSONS)}</span>{lvl(l.get("level"))}<span>about {mins(l.get("minutes"))}</span><button class="btn" type="button" data-copy-toggle style="padding:5px 8px;font-size:11px">Show copy buttons</button></div>
{recall_html}
<div class="brief">
  <div><div class="k">Why this, why now</div><p>{E(l.get("why", ""))}</p></div>
  <div><div class="k">You will be able to</div><ul>{objectives}</ul></div>
  <div><div class="k">Reading</div><ul>{reading}</ul></div>
  <div><div class="k">Before this</div>{f"<ul>{prereq}</ul>" if prereq else "<p class=muted>Nothing. Start here.</p>"}</div>
</div>
</header>'''
    blocks = []
    toc = []
    for i, a in enumerate(arts, 1):
        h = a['html'] if len(arts) == 1 else prefix_ids(a['html'], f'r{i}-')
        p = '' if len(arts) == 1 else f'r{i}-'
        toc.append(f'<a class="ni" href="#read-{i}"><span class="n">R{i}</span><span>{E(a["title"])}</span></a>')
        toc += [f'<a class="ni sub" href="#{p}{x["id"]}">{E(x["text"])}</a>' for x in a['toc'] if x['level'] == 2][:14]
        blocks.append(f'''<section class="art-block" id="read-{i}">
<div class="art-num">READING {i} OF {len(arts)}</div>
<h2 class="art-title">{E(a["title"])}</h2>
{source_bar(a)}
<div class="prose">{h}</div>
</section>''')
    further = ''.join(f'<li><a href="{{{{ROOT}}}}library/{A[x]["slug"]}.html"><b>{E(x)}</b><span>{E(A[x]["summary"])}</span></a></li>' for x in l.get('further', []))
    pn = ''
    if prev_l:
        pn += f'<a class="prev" href="{{{{ROOT}}}}learn/{prev_l["id"]}.html"><span class="k">← PREVIOUS · {prev_l["code"]}</span><span class="t">{E(prev_l["title"])}</span></a>'
    if next_l:
        pn += f'<a class="next" href="{{{{ROOT}}}}learn/{next_l["id"]}.html"><span class="k">NEXT · {next_l["code"]} →</span><span class="t">{E(next_l["title"])}</span></a>'
    tail = f'''<section class="s">
<div class="checkpoint"><div class="k">Checkpoint</div><p>{E(l.get("checkpoint", ""))}</p>
<button class="btn primary" type="button" data-mark="{l["id"]}">Mark lesson complete</button></div>
{STUCK}
{f'<h2 class="h2" style="margin-top:36px">Go deeper (optional)</h2><ul class="further">{further}</ul>' if further else ''}
<div class="pn">{pn}</div>
</section>'''
    extra = (f'<div class="ng toc-rail"><div class="nl">This lesson</div>{"".join(toc)}</div>' + track_rail(t, l['id']))
    page(f'learn/{l["id"]}.html', f'{l["title"]} — {PRODUCT} · COGNIA', head + ''.join(blocks) + tail, 'learn', extra,
         desc=l.get('why', ''))


# ------------------------------------------------------------------ learn index
def build_learn_index():
    order = ','.join(l['id'] for l in LESSONS)
    rows = []
    seen_elective = False
    for t in CUR['tracks']:
        is_el = t['title'].lower().startswith('elective')
        if is_el and not seen_elective:
            seen_elective = True
            rows.append('<div id="electives" style="margin-top:44px"><div class="eyebrow">ELECTIVES</div><h2 class="h2">Pick by goal once the core runs</h2>'
                        '<p class="muted" style="font-size:14.5px">Each elective lists the core lessons it builds on, and says when you have finished them.</p></div>')
        elif not is_el and not rows:
            rows.append('<div id="core" style="margin-top:36px"><div class="eyebrow">CORE PATH</div><h2 class="h2">Take these in order</h2></div>')
        ids = ','.join(l['id'] for l in t['all'])
        tids = {l['id'] for l in t['all']}
        needs = sorted({p for l in t['all'] for p in l.get('prereq', []) if p not in tids and p in BYID}, key=lambda x: BYID[x]['idx'])
        tmin = sum(int(l.get('minutes', 0)) for l in t['all'])
        mods = []
        for m in t['modules']:
            ls = ''.join(f'<li data-lesson="{l["id"]}"><a href="{l["id"]}.html"><span class="n">{l["code"]}</span><span class="t">{E(l["title"])}</span>{lvl(l.get("level"))}<span class="m">{mins(l.get("minutes"))}</span></a></li>' for l in m['lessons'])
            mods.append(f'<div class="mod"><div class="mod-title">{E(m["title"])}</div><ul class="lessons">{ls}</ul></div>')
        rows.append(f'''<section class="track" id="{t["id"]}">
<div class="track-head"><div><div class="track-num">TRACK {t["n"]:02d} · {len(t["all"])} LESSONS · ABOUT {mins(tmin).upper()}</div>
<h2 class="track-title">{E(t["title"])}</h2><p class="track-sum">{E(t.get("summary", ""))}</p>
{f'<p class="track-goal"><b>GOAL</b>{E(t["goal"])}</p>' if t.get("goal") else ''}
{f'<p class="track-goal needs" data-needs="{",".join(needs)}"><b>BUILDS ON</b>' + ", ".join(f'<a href="{x}.html">{BYID[x]["code"]}</a>' for x in needs) + ' <span class="needs-state"></span></p>' if is_el and needs else ''}</div>
<div><div class="bar" data-track-progress="{ids}"><i></i></div><div class="bar-l">0 / {len(t["all"])} done</div></div></div>
{"".join(mods)}</section>''')
    tnav = ''.join(f'<a class="ni" href="#{t["id"]}"><span class="n">{t["n"]:02d}</span><span>{E(t["title"])}</span></a>' for t in CUR['tracks'])
    body = f'''<section class="s"><div class="wrap">
<div class="eyebrow">LEARNING PATH · {len(CUR["tracks"])} TRACKS · {len(LESSONS)} LESSONS · ABOUT {TOTAL_MIN // 60} HOURS</div>
<h1 class="h1">{E(CUR.get("name") or "The path")}</h1>
<p class="lead">Each lesson gives you the reason, the goal, the OSDev Wiki reading in full, and a checkpoint to prove it works before you move on. Take the core tracks in order; pick electives by interest once your kernel runs.</p>
<div class="hero-cta" style="margin-top:20px"><a class="btn primary" data-continue="{order}" href="{LESSONS[0]["id"]}.html">Start lesson 1.1.1</a><a class="btn" href="../method.html">How we teach</a></div>
{"".join(rows)}
</div></section>'''
    page('learn/index.html', f'Learning path — {PRODUCT} · COGNIA', body, 'learn', f'<div class="ng"><div class="nl">Tracks</div>{tnav}</div>')


# ------------------------------------------------------------------ library
def build_article(d):
    toc = ''.join(f'<a class="ni{" sub" if x["level"] == 3 else ""}" href="#{x["id"]}">{E(x["text"])}</a>' for x in d['toc'][:60])
    used = USED_IN.get(d['title'], [])
    used_html = ''.join(f'<a class="tag" href="{{{{ROOT}}}}learn/{l["id"]}.html">{l["code"]} {E(l["title"])}{" · further" if k == "further" else ""}</a>' for l, k in used)
    cats = ''.join(f'<a class="tag" href="{{{{ROOT}}}}library/index.html#cat-{slug(c)}">{E(c)}</a>' for c in d['categories'])
    back = sorted(BACK.get(d['title'], []))
    back_html = ''.join(f'<a class="tag" href="{{{{ROOT}}}}library/{A[b]["slug"]}.html">{E(b)}</a>' for b in back[:30])
    flags = ' · '.join(x for x in (('stub' if 'stub' in d['flags'] else ''), ('in progress' if 'inprogress' in d['flags'] else '')) if x)
    body = f'''<header class="lesson-head">
<div class="eyebrow"><a href="{{{{ROOT}}}}library/index.html">Library</a><span>/</span><span>{E(d["categories"][0]) if d["categories"] else "Article"}</span></div>
<h1 class="h1">{E(d["title"])}</h1>
<div class="meta-row">{lvl(d.get("rating"))}<span>{max(1, round(d["words"] / 220))} min read</span><span>{d["words"]:,} words</span>{f"<span>{flags}</span>" if flags else ""}<button class="btn" type="button" data-copy-toggle style="padding:5px 8px;font-size:11px">Show copy buttons</button></div>
{f'<div class="tags" style="margin-top:14px">{cats}</div>' if cats else ''}
{f'<div style="margin-top:14px"><div class="eyebrow" style="margin-bottom:6px">IN THE LEARNING PATH</div><div class="tags">{used_html}</div></div>' if used_html else ''}
</header>
<section class="art-block">
{source_bar(d)}
<div class="prose">{d["html"]}</div>
</section>
<section class="s"><div class="read">
<h2 class="h2">Credit</h2>
<p class="muted" style="font-size:14px">This article is reproduced from the <a href="{E(d["url"])}" rel="noopener">OSDev Wiki</a> (CC0 1.0), as it stood on {E(d["updated"])}. Recent editors recorded in our copy: {E(", ".join(d["authors"])) or "not recorded"}. Every author is listed in the page's <a href="{E(WIKI + 'index.php?title=' + d['title'].replace(' ', '_') + '&action=history')}" rel="noopener">full history on the OSDev Wiki</a>.</p>
{f'<h2 class="h2" style="margin-top:28px">Pages that link here</h2><div class="backlinks">{back_html}</div>' if back_html else ''}
</div></section>'''
    extra = f'<div class="ng toc-rail"><div class="nl">On this page</div>{toc}</div>' if toc else ''
    page(f'library/{d["slug"]}.html', f'{d["title"]} — OSDev Wiki · {PRODUCT}', body, 'library', extra, desc=d['summary'])


def build_library_index():
    items = sorted(A.values(), key=lambda d: d['title'].lower())
    rows, letter = [], None
    letters = []
    for d in items:
        L = d['title'][0].upper()
        L = L if L.isalpha() else '#'
        if L != letter:
            letter = L
            letters.append(L)
            rows.append(f'<li class="letter" id="l-{"num" if L == "#" else L}">{L}</li>')
        s = (d['title'] + ' ' + ' '.join(d['categories']) + ' ' + d['summary']).lower()
        rows.append(f'<li data-s="{E(s)}" data-l="{d.get("rating") or ""}"><a href="{d["slug"]}.html">{E(d["title"])}</a>{lvl(d.get("rating"))}<span class="sm">{E(trunc(d["summary"], 150))}</span></li>')
    az = ''.join(f'<a href="#l-{"num" if L == "#" else L}">{L}</a>' for L in letters)
    cats = ''.join(f'<div class="cat" id="cat-{slug(c)}"><h3>{E(c)}<span>{len(v)}</span></h3>' + ''.join(f'<a href="{A[t]["slug"]}.html">{E(t)}</a>' for t in sorted(v, key=str.lower)) + '</div>'
                   for c, v in sorted(CATS.items(), key=lambda x: x[0].lower()))
    body = f'''<section class="s"><div class="wrap">
<div class="eyebrow">LIBRARY · {len(A)} ARTICLES · {len(CATS)} CATEGORIES</div>
<h1 class="h1">The full OSDev Wiki, readable</h1>
<p class="lead">Every article from the OSDev Wiki, reformatted for reading. Use it as a reference while you follow the path, or browse by topic.</p>
<div class="filter"><input class="input" id="lib-filter" type="search" placeholder="Filter articles: paging, AHCI, FAT…" aria-label="Filter articles">
<select class="input" id="lib-level" aria-label="Difficulty"><option value="">Any difficulty</option><option value="1">Beginner</option><option value="2">Medium</option><option value="3">Advanced</option><option value="4">Master</option></select>
<span class="mono muted" id="lib-count" style="font-size:12px"></span></div>
<div class="az">{az}<a href="#categories">By category ↓</a></div>
<ul class="alist" id="lib-list">{"".join(rows)}</ul>
</div></section>
<section class="s" id="categories"><div class="wrap"><h2 class="h2">By category</h2><div class="cat-grid">{cats}</div></div></section>'''
    page('library/index.html', f'Library — {PRODUCT} · COGNIA', body, 'library')


# ------------------------------------------------------------------ home, method, credits
def build_home():
    cards = ''.join(f'''<a class="card" href="learn/index.html#{t["id"]}"><div class="card-k">TRACK {t["n"]:02d} · {len(t["all"])} LESSONS</div>
<div class="card-name">{E(t["title"])}</div><div class="card-text">{E(t.get("summary", ""))}</div></a>''' for t in CUR['tracks'])
    starters = [x for x in ('Introduction', 'Required Knowledge', 'Getting Started', 'Beginner Mistakes', 'Bare Bones', 'GCC Cross-Compiler') if x in A]
    st = ''.join(f'<li><a href="library/{A[x]["slug"]}.html"><b>{E(x)}</b><span>{E(A[x]["summary"])}</span></a></li>' for x in starters)
    body = f'''<section class="hero">{WM}
<div class="hero-lock">{MARK}<span class="wordmark">COGNIA</span><span class="prod">{PRODUCT}</span></div>
<h1 class="hero-title">Build an operating system, from the first boot to your own userland.</h1>
<p class="hero-lead">A reading-first path through the OSDev Wiki. {len(LESSONS)} lessons set {N_PRIMARY} articles in build order, each with a goal, the full text and a checkpoint you can observe. All {len(A)} articles are in the library.</p>
<div class="hero-cta"><a class="btn primary" href="learn/{LESSONS[0]["id"]}.html">Start the path</a><a class="btn" href="method.html">How we teach</a><a class="btn" href="library/index.html">Browse the library</a></div>
<div class="stats"><span><b>{len(CUR["tracks"])}</b>tracks</span><span><b>{len(LESSONS)}</b>lessons</span><span><b>{len(A)}</b>wiki articles</span><span><b>~{TOTAL_MIN // 60} h</b>guided path</span><span><b>CC0</b>content, credited on every page</span></div>
</section>
<section class="s"><div class="wrap">
<h2 class="h2">How a lesson works</h2>
<div class="steps">
<div class="step"><b>Why</b><span>One or two lines on why this piece comes now, and what breaks without it.</span></div>
<div class="step"><b>Goal</b><span>What you will be able to do at the end, stated so you can check it.</span></div>
<div class="step"><b>Read</b><span>The OSDev Wiki article, complete and unedited, set for long reading.</span></div>
<div class="step"><b>Build</b><span>Type the code, run it in QEMU, break it, fix it. The wiki shows how.</span></div>
<div class="step"><b>Checkpoint</b><span>A concrete test. Pass it, mark the lesson done, move on.</span></div>
</div>
<p class="muted" style="font-size:14.5px">Progress is saved in this browser only. No account, no streaks, no reminders.</p>
</div></section>
<section class="s"><div class="wrap">
<h2 class="h2">The tracks</h2>
<div class="cards">{cards}</div>
</div></section>
<section class="s"><div class="wrap">
<h2 class="h2">Read these first</h2>
<p class="muted">The wiki community's own advice for newcomers. Lesson 1 starts here too.</p>
<ul class="further" style="max-width:none;margin-top:14px">{st}</ul>
</div></section>
<section class="s"><div class="wrap read">
<h2 class="h2">Built on the OSDev Wiki</h2>
<p>Every article here was written by the <a href="{WIKI}" rel="noopener">OSDev Wiki</a> community over more than twenty years and dedicated to the public domain (CC0). We did not rewrite it. We put it in order, set it for reading, and added the frame around it: goals, checkpoints and the path. Each page names its source, its last edit and its contributors, and links back to the original.</p>
<p><a class="btn" href="credits.html">Credits and licence</a> <a class="btn" href="{WIKI}" rel="noopener">Visit the OSDev Wiki ↗</a></p>
</div></section>'''
    page('index.html', f'COGNIA {PRODUCT} — learn operating-system development', body, 'home')


def build_method():
    md_html = pypandoc.convert_text(METHOD_MD, 'html5', format='gfm', extra_args=['--wrap=none'])
    heads = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', md_html)
    toc = ''.join(f'<a class="ni" href="#{i}">{re.sub("<[^>]+>", "", t)}</a>' for i, t in heads)
    first_h1 = re.search(r'<h1[^>]*>(.*?)</h1>', md_html)
    title = re.sub('<[^>]+>', '', first_h1.group(1)) if first_h1 else 'How we teach'
    body = f'''<section class="s"><div class="wrap">
<div class="eyebrow">HOW WE TEACH</div>
<h1 class="h1">{title}</h1>
<div class="md toc-rail-target">{md_html}</div>
<p style="margin-top:32px"><a class="btn primary" href="learn/index.html">See the learning path</a></p>
</div></section>'''
    page('method.html', f'How we teach — {PRODUCT} · COGNIA', body, 'method', f'<div class="ng toc-rail"><div class="nl">On this page</div>{toc}</div>')


def build_credits():
    people = ', '.join(E(p) for p in CONTRIBUTORS)
    body = f'''<section class="s"><div class="wrap read">
<div class="eyebrow">CREDITS AND LICENCE</div>
<h1 class="h1">Credit where it is due</h1>
<p class="lead">This platform exists because the OSDev community wrote down, over two decades, how to build an operating system. Every article you read here is theirs.</p>
</div></section>
<section class="s"><div class="wrap read">
<h2 class="h2">The content: OSDev Wiki</h2>
<p>All {len(A)} articles are reproduced from the <a href="{WIKI}" rel="noopener">OSDev Wiki</a> (wiki.osdev.org). In the wiki's own words, all content added since 6 June 2011 is licensed under <a href="https://creativecommons.org/publicdomain/zero/1.0/" rel="noopener">CC0 1.0 Universal</a>; earlier contributions were relicensed by the authors who agreed (see <a href="{WIKI}User:Combuster/Relicensing" rel="noopener">User:Combuster/Relicensing</a>). The wiki's <a href="{WIKI}OSDev_Wiki:Copyrights" rel="noopener">Copyrights</a> page is the authority.</p>
<p>Some images on the wiki are third-party material, such as book covers, logos and screenshots of other software. They belong to their owners, are shown here for reference as they are on the wiki, and are not covered by CC0.</p>
<p>The copy used here is the WikiTeam dump of 30 December 2025, archived at the <a href="{DUMP}" rel="noopener">Internet Archive</a>. Article text is shown as written; we changed only formatting: wiki templates became on-brand notices, links point to local copies, and images are served locally. Each article page names its last edit date and the recent editors recorded in our copy, and links to the live original and its full author history. If a page has changed since, the live wiki is the authority.</p>
<p>Found an error in an article? Fix it at the source on the <a href="{WIKI}" rel="noopener">OSDev Wiki</a> so everyone benefits. Questions about OS development belong on the <a href="https://forum.osdev.org/" rel="noopener">OSDev forum</a>.</p>
</div></section>
<section class="s"><div class="wrap read">
<h2 class="h2">The platform: COGNIA</h2>
<p><b>{COPYRIGHT}</b> All rights reserved in the platform itself: its design, the curriculum and its sequencing, the teaching method, lesson framing text (goals, reasons, checkpoints), and the code. This copyright does not extend to the OSDev Wiki articles, which remain under CC0 and may be reused by anyone, nor to third-party images.</p>
<p>COGNIA and the COGNIA mark are marks of Cognia Labs. Set in Instrument Sans and JetBrains Mono.</p>
</div></section>
<section class="s"><div class="wrap read">
<h2 class="h2">Thank you, contributors</h2>
<p class="muted" style="font-size:14px">Our copy of the wiki records only each page's most recent revisions, so this list is partial: {len(CONTRIBUTORS):,} people appear in it. Everyone who ever wrote a page is listed in that page's history on the <a href="{WIKI}" rel="noopener">OSDev Wiki</a>. Thank you to all of them.</p>
<p style="font-size:13.5px;line-height:1.8;color:var(--muted)">{people}</p>
</div></section>'''
    page('credits.html', f'Credits and licence — {PRODUCT} · COGNIA', body, 'credits')


def build_search():
    idx = []
    for l in LESSONS:
        idx.append({'k': 'Lesson', 't': f'{l["code"]} {l["title"]}', 'u': f'learn/{l["id"]}.html', 's': trunc(l.get('why', ''), 160),
                    'h': ' '.join(l['articles']).lower()})
    for t in CUR['tracks']:
        idx.append({'k': 'Track', 't': t['title'], 'u': f'learn/index.html#{t["id"]}', 's': trunc(t.get('summary', ''), 160)})
    for d in sorted(A.values(), key=lambda d: d['title']):
        idx.append({'k': 'Article', 't': d['title'], 'u': f'library/{d["slug"]}.html', 's': trunc(d['summary'], 160),
                    'h': (' '.join(x['text'] for x in d['toc']) + ' ' + ' '.join(d['categories'])).lower()})
    with open(os.path.join(WEB, 'assets', 'js', 'search-index.js'), 'w', encoding='utf-8') as f:
        f.write('window.OSB_INDEX=' + json.dumps(idx, ensure_ascii=False, separators=(',', ':')) + ';')


def main():
    for d in ('learn', 'library'):
        p = os.path.join(WEB, d)
        if os.path.isdir(p):
            shutil.rmtree(p)
    for l in LESSONS:
        build_lesson(l)
    build_learn_index()
    for d in A.values():
        build_article(d)
    build_library_index()
    build_home()
    build_method()
    build_credits()
    build_search()
    print(f'built: {len(LESSONS)} lessons, {len(A)} articles, {len(CUR["tracks"])} tracks, {len(CONTRIBUTORS)} contributors, ~{TOTAL_MIN // 60} h')


if __name__ == '__main__':
    main()
