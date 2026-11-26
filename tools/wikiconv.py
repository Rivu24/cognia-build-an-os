"""Convert OSDev Wiki wikitext (CC0) into clean HTML fragments for the platform.

Step 1 of the build. Reads tools/source/osdev-wiki-20251230.json, writes
tools/cache/articles/<slug>.json  ({title, html, toc, categories, rating, flags, ...}).

The article text itself is never rewritten: templates are rendered into
equivalent notices, links are pointed at local pages, images at local copies.
"""
import json, os, re, sys, html as H
from concurrent.futures import ThreadPoolExecutor
import mwparserfromhell as mwp
import pypandoc
from urllib.parse import unquote
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(ROOT)
SRC = os.path.join(ROOT, 'source', 'osdev-wiki-20251230.json')
OUT = os.path.join(ROOT, 'cache', 'articles')
IMG_DIR = os.path.join(WEB, 'assets', 'wiki')
WIKI = 'https://wiki.osdev.org/'

LEVELS = {'0': 'Not rated', '1': 'Beginner', '2': 'Medium', '3': 'Advanced', '4': 'Master'}
LANG_MAP = {'asm': 'nasm', 'nasm': 'nasm', 'x86asm': 'nasm', 'gas': 'gnuassembler', 'att': 'gnuassembler',
            'make': 'makefile', 'makefile': 'makefile', 'sh': 'bash', 'shell': 'bash', 'console': 'bash',
            'c++': 'cpp', 'cxx': 'cpp', 'dos': 'dosbat', 'winbatch': 'dosbat', 'batch': 'dosbat',
            'text': '', 'gdb': '', 'lscript': '', 'freebasic': '', 'qbasic': '', 'cobol': '', 'nix': '', 'zig': '', 'autoconf': ''}

NOTICES = {  # template (lowercased, spaces) -> (kind, text)
    'stub': ('stub', 'This page on the OSDev Wiki is a stub: it covers the basics but is not complete.'),
    'in progress': ('progress', 'This page on the OSDev Wiki is a work in progress and may be incomplete.'),
    'beginnerswarning': ('warn', "Before this page: have you read [[Getting Started]], [[Beginner Mistakes]] and some of the [[:Category:OS theory|OS theory]]?"),
    'firstperson': ('style', 'This page is written in the first person; the wiki marks it for a more neutral rewrite.'),
    'tone': ('style', "This page's tone or style differs from the rest of the wiki."),
    'tutorialtone': ('style', "This tutorial's tone differs from the rest of the wiki."),
    'tutorialexplain': ('style', 'The wiki flags this tutorial as needing more explanation of what its code does. Read the code, do not just copy it.'),
    'disputed': ('warn', 'The factual accuracy of this page is disputed on the OSDev Wiki. Cross-check with official specifications.'),
    'video warning': ('warn', 'Writing to video hardware directly can, on some old monitors, cause damage. Test in an emulator first.'),
    'humor': ('style', 'This page is humorous. Do not take it as technical guidance.'),
    'outdated': ('warn', 'Parts of this page may be outdated.'),
    'clarify': ('style', 'Parts of this page need clarification.'),
    'convert': ('style', 'This page is marked for conversion on the OSDev Wiki.'),
}


def slug(t):
    t = t.replace('+', '_plus').replace('#', '_sharp')
    t = re.sub(r'--$', '_minus_minus', t)
    return re.sub(r'[^A-Za-z0-9]+', '_', t).strip('_')


def norm_title(t):
    t = t.replace('_', ' ').strip()
    t = re.sub(r'\s+', ' ', t)
    return t[:1].upper() + t[1:] if t else t


def mw_decode(a):
    return re.sub(r'\.([0-9A-Fa-f]{2})', lambda m: chr(int(m.group(1), 16)), a)


def anchor_id(text):
    return re.sub(r'[^a-z0-9]+', '_', text.lower()).strip('_')


class Ctx:
    def __init__(self, pages):
        self.pages = pages
        self.articles = {}
        self.redirects = {}
        for k, v in pages.items():
            if v['ns'] != 0:
                continue
            m = re.match(r'\s*#redirect\s*:?\s*\[\[([^\]|]+)', v['text'], re.I)
            if m:
                self.redirects[norm_title(k)] = m.group(1).strip()
            else:
                self.articles[norm_title(k)] = k
        self.lower = {k.lower(): k for k in self.articles}
        self.images = {}
        if os.path.isdir(IMG_DIR):
            for f in os.listdir(IMG_DIR):
                self.images[f.lower()] = f
                self.images[f.lower().replace(' ', '_')] = f

    def resolve(self, title):
        """Return (canonical article title or None, anchor)."""
        t, _, anc = title.partition('#')
        t = norm_title(t)
        for _ in range(4):
            if t in self.articles:
                return self.articles[t], anc
            if t.lower() in self.lower:
                return self.articles[self.lower[t.lower()]], anc
            if t in self.redirects:
                r = self.redirects[t]
                t, _, a2 = r.partition('#')
                t = norm_title(t)
                anc = anc or a2
                continue
            break
        return None, anc

    def image(self, name):
        n = name.split(':', 1)[-1].strip().replace(' ', '_')
        n = n[:1].upper() + n[1:]
        return self.images.get(n.lower())


# ---------------------------------------------------------------- templates

def params(tpl):
    pos, named = [], {}
    for p in tpl.params:
        v = str(p.value).strip()
        if p.showkey:
            named[str(p.name).strip()] = v
        else:
            pos.append(v)
    return pos, named


def notice(kind, text, label=None):
    lab = label or {'stub': 'Stub', 'progress': 'In progress', 'warn': 'Read first', 'style': 'Wiki note',
                    'note': 'Note', 'warning': 'Warning'}.get(kind, 'Note')
    return f'\n<div class="wk-note wk-{kind}"><span class="wk-note-label">{lab}</span>\n\n{text}\n\n</div>\n'


def navbox(ctx, tpl_text):
    """Render a SmallNavBox-style template as a simple related-links box."""
    code = mwp.parse(tpl_text)
    for t in code.filter_templates(recursive=False):
        if 'navbox' in str(t.name).lower():
            pos, named = params(t)
            out = [f'<div class="wk-navbox"><div class="wk-navbox-title">\n{named.get("Name", "Related")}\n</div>']
            idx = sorted({int(n) for k in named for n in re.findall(r'^(?:Group|List)(\d+)$', k)})
            for i in idx:
                g, l = named.get(f'Group{i}', ''), named.get(f'List{i}', '')
                l = re.sub(r'</?div>', '', l).replace('<br />', ' · ').replace('<br/>', ' · ').replace('<br>', ' · ')
                l = re.sub(r'(\s*·\s*)+$', '', l.strip())
                out.append(f'<div class="wk-navbox-row"><span class="wk-navbox-group">{g}</span>\n{l}\n</div>')
            out.append('</div>')
            return '\n' + '\n'.join(out) + '\n'
    return ''


def render_templates(ctx, text, title, depth=0):
    code = mwp.parse(text)
    tpls = [t for t in code.filter_templates(recursive=True)
            if not any(isinstance(a, mwp.nodes.Template) for a in code.get_ancestors(t))]
    for t in tpls:
        name = str(t.name).strip().replace('_', ' ')
        lname = name.lower()
        if lname.startswith('template:'):
            lname = lname[9:]
            name = name[9:]
        pos, named = params(t)
        # render nested templates inside params first
        pos = [render_templates(ctx, v, title, depth + 1) if '{{' in v else v for v in pos]
        named = {k: (render_templates(ctx, v, title, depth + 1) if '{{' in v else v) for k, v in named.items()}
        rep = None
        if name.startswith(':') and depth < 2:
            canon, _ = ctx.resolve(name[1:])
            rep = render_templates(ctx, re.sub(r'<noinclude>.*?</noinclude>', '', ctx.pages[canon]['text'], flags=re.S), title, depth + 1) if canon else ''
        elif lname.startswith(('displaytitle', 'fullurl', 'defaultsort')):
            rep = ''
        elif lname == 'editthis':
            rep = pos[0] if pos else ''
        elif lname == 'intelmanuallink':
            rep = "Intel 80386 Programmer's Reference Manual, chapter " + (pos[0] if pos else '') + (f', section {pos[1]}' if len(pos) > 1 and pos[1] else '')
        elif lname == 'wikitable':
            rep = 'class="wikitable"'
        elif lname in ('na', 'n/a', 'unknown'):
            rep = f'<span class="wk-na">{pos[0] if pos else "N/A"}</span>'
        elif lname == 'abbr':
            rep = f'<span class="wk-abbr" title="{H.escape(pos[1]) if len(pos) > 1 else ""}">{pos[0] if pos else ""}</span>'
        elif lname in ('yes', 'no', 'maybe'):
            label = pos[0] if pos else name.capitalize()
            rep = f'<span class="wk-{lname}">{label}</span>'
        elif lname == 'main':
            rep = ':<span class="wk-main">Main article: ' + ', '.join(f'[[{x}]]' for x in pos) + '</span>' if pos else ''
        elif lname in ('rating', 'ratingicon'):
            lv = (pos[0] if pos else named.get('level', '0')).strip() or '0'
            rep = f'<span class="wk-rating" data-level="{H.escape(lv)}">Difficulty: {LEVELS.get(lv, lv)}</span>'
            if lname == 'rating':
                rep = '\n' + rep + '\n'
        elif lname in NOTICES:
            kind, txt = NOTICES[lname]
            rep = notice(kind, txt)
        elif lname in ('warning',):
            rep = notice('warning', pos[0] if pos else '')
        elif lname == 'note' and pos and len(pos[0]) <= 12 and ' ' not in pos[0]:
            rep = f'<span class="wk-endnote" id="endnote_{anchor_id(pos[0])}">[{pos[0]}]</span>'
        elif lname in ('quotation', 'quote'):
            body = pos[0] if pos else named.get('1', '')
            src = (pos[1] if len(pos) > 1 else named.get('2', '')).strip()
            rep = notice('note', body + (f'\n\n<span class="wk-quote-src">— {src}</span>' if src else ''), 'Quote')
        elif lname in ('note', 'notebox', 'box', 'tip'):
            rep = notice('note', pos[0] if pos else named.get('1', ''))
        elif lname == 'anchor':
            rep = ''.join(f'<span id="{anchor_id(x)}"></span>' for x in pos)
        elif lname in ('pagename', 'fullpagename'):
            rep = title
        elif lname == 'book':
            parts = [f"'''{named.get('title', '')}'''"]
            for k, lab in (('author', 'Author(s)'), ('year', 'Year'), ('ISBN', 'ISBN'), ('supp', 'Supplementary material')):
                if named.get(k):
                    parts.append(f"''{lab}:'' {named[k]}")
            if named.get('comment') or named.get('description'):
                parts.append(named.get('comment') or named.get('description'))
            rep = '\n<div class="wk-book">\n' + '<br />\n'.join(parts) + '\n</div>\n'
        elif lname == 'osproject':
            nm = named.get('OSName', '')
            pic = named.get('Pic', '').strip()
            desc = named.get('OSDescription', '').strip()
            labels = {'OSAuthor': 'Author', 'OSAuthors': 'Authors', 'OSLicense': 'Licence', 'OSURL': 'Website', 'OSHomepage': 'Website',
                      'OSStatus': 'Status', 'OSContact': 'Contact', 'OSLanguage': 'Language', 'OSArch': 'Architecture'}
            rows = [(labels.get(k, re.sub(r'^OS', '', k) or k), v) for k, v in named.items()
                    if k not in ('OSName', 'Pic', 'OSDescription') and v.strip()]
            body = '<br />\n'.join(f"''{k}:'' {v}" for k, v in rows)
            rep = (f'\n<div class="wk-card">\n<div class="wk-card-title">\n{nm}\n</div>\n' + (f'{pic}\n\n' if pic else '') +
                   (f'{desc}\n\n' if desc else '') + f'{body}\n</div>\n')
        elif lname.startswith('infobox'):
            rows = ''.join(f'<tr><th>{k}</th><td>\n{v}\n</td></tr>' for k, v in named.items() if v and k not in ('image',))
            rep = f'\n<table class="wk-infobox">{rows}</table>\n'
        elif lname == 'ref' and pos:
            rep = f'<sup class="wk-ref">[[#endnote_{anchor_id(pos[0])}|{pos[0]}]]</sup>'
        elif lname in ('ref', 'which', 'how', 'citation needed', 'cn', 'clarify me'):
            rep = '' if lname in ('ref',) else f'<sup class="wk-flag">[{lname}?]</sup>'
        elif lname in ('floats', 'flex columns', 'stylenav', 'nocatbox', 'welcome', 'tocright', 'clear', 'stub-section'):
            rep = pos[0] if (pos and lname in ('flex columns',)) else ''
        else:
            tp = ctx.pages.get('Template:' + name[:1].upper() + name[1:])
            if tp and 'NavBox' in tp['text'] and depth < 3:
                rep = navbox(ctx, re.sub(r'<noinclude>.*?</noinclude>', '', tp['text'], flags=re.S))
            elif tp and depth < 3 and not pos and not named and '{{{' not in tp['text'] and '{{#' not in tp['text']:
                body = re.sub(r'<noinclude>.*?</noinclude>', '', tp['text'], flags=re.S)
                body = re.sub(r'</?includeonly>', '', body)
                rep = render_templates(ctx, body, title, depth + 1)
            else:
                rep = ''  # unknown / parser-function template: dropped (logged)
                ctx_unknown.setdefault(name, 0)
                ctx_unknown[name] += 1
        try:
            code.replace(t, rep)
        except ValueError:
            pass
    return str(code)


ctx_unknown = {}


MAGIC = re.compile(r'__(?:NOTOC|TOC|FORCETOC|NOEDITSECTION|NEWSECTIONLINK|NONEWSECTIONLINK|NOGALLERY|HIDDENCAT|INDEX|NOINDEX|'
                   r'STATICREDIRECT|DISAMBIG|NOTITLECONVERT|NOCONTENTCONVERT|NOTC|NOCC)__')
CODE_SPAN = re.compile(r'<(syntaxhighlight|source|pre|nowiki|code|tt|math)\b[^>]*>.*?</\1\s*>', re.S | re.I)
BLOCK_TAG = re.compile(r'^\s*</?(div|table|tr|td|th|ul|ol|li|center|blockquote|p|h[1-6]|dl|dd|dt|gallery|references)\b', re.I)


def mask_code(text):
    store = []

    def keep(m):
        store.append(m.group(0))
        return f'\x00{len(store) - 1}\x00'
    return CODE_SPAN.sub(keep, text), store


def unmask(text, store):
    for _ in range(3):
        text = re.sub(r'\x00(\d+)\x00', lambda m: store[int(m.group(1))], text)
    return text


def balance_quotes(line):
    """MediaWiki closes '' and ''' left open at the end of a line; pandoc does not."""
    runs = re.findall(r"'{2,}", line)
    bold = sum(1 for r in runs if len(r) in (3, 5)) % 2
    ital = sum(1 for r in runs if len(r) in (2, 5)) % 2
    return line + ("'''" if bold else '') + ("''" if ital else '')


def strip_inline_markup(s):
    s = re.sub(r'</?nowiki\s*/?>', '', s)
    s = re.sub(r"'''(.*?)'''", r'\1', s)
    s = re.sub(r"''(.*?)''", r'\1', s)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'\[(?:https?|ftp)://\S+\s+([^\]]*)\]', r'\1', s)
    s = re.sub(r'</?(b|i|u|code|tt|span|font|big|small|strong|em)\b[^>]*>', '', s)
    return s


def space_pre(text, store):
    """Lines starting with one space are MediaWiki preformatted text: emit real <pre> blocks."""
    lines = text.split('\n')
    out, buf, depth = [], [], 0

    def flush():
        while buf and not buf[-1].strip():
            buf.pop()
        if buf:
            body = '\n'.join(strip_inline_markup(unmask(b, store)) for b in buf)
            body = re.sub(r'</?(syntaxhighlight|source|pre)\b[^>]*>', '', body)
            out.append('<pre>' + H.unescape(body) + '</pre>')
        buf.clear()
    for i, line in enumerate(lines):
        st = line.lstrip()
        if st.startswith('{|'):
            depth += 1
        if depth == 0 and line.startswith(' ') and st and not BLOCK_TAG.match(line) and not st.startswith('{|'):
            buf.append(line[1:])
            continue
        if buf and not line.strip() and i + 1 < len(lines) and lines[i + 1].startswith(' ') and lines[i + 1].strip():
            buf.append('')
            continue
        flush()
        out.append(line)
        if depth and st.startswith('|}'):
            depth -= 1
    flush()
    return '\n'.join(out)


def structural(text):
    text, store = mask_code(text)
    text = MAGIC.sub('', text)
    # indented tables (":{|") lose the indent; pandoc cannot parse them otherwise
    text = re.sub(r'(?m)^[:*#]+\s*(\{\|)', r'\1', text)
    lines = []
    for line in text.split('\n'):
        m = re.match(r'^(={1,6})(.+?)\1\s*$', line)
        if m and '=' in m.group(2):  # '=' inside a heading confuses pandoc
            line = m.group(1) + m.group(2).replace('=', '&#61;') + m.group(1)
        elif "''" in line:
            line = balance_quotes(line)
        lines.append(line)
    text = '\n'.join(lines)
    # thumbnails / framed images on their own paragraph so they become captioned figures
    def iso(m):
        return '\n\n' + m.group(0) + '\n\n'
    out = []
    for line in text.split('\n'):
        if not line.lstrip().startswith(('|', '!', '*', '#', ':', ';', '{|')) and re.search(r'\[\[\s*(?:File|Image)\s*:[^\]]*\|\s*(?:thumb|thumbnail|frame)\b', line, re.I):
            line = re.sub(r'\[\[\s*(?:File|Image)\s*:(?:[^\[\]]|\[\[[^\]]*\]\])*\|\s*(?:thumb|thumbnail|frame)\b(?:[^\[\]]|\[\[[^\]]*\]\])*\]\]', iso, line, flags=re.I)
        out.append(line)
    text = '\n'.join(out)
    text = space_pre(text, store)
    text = unmask(text, store)
    # MediaWiki decodes entities inside <pre>; pandoc shows them literally
    text = re.sub(r'(<pre\b[^>]*>)(.*?)(</pre>)', lambda m: m.group(1) + H.unescape(re.sub(r'</?nowiki\s*/?>', '', m.group(2))) + m.group(3), text, flags=re.S | re.I)
    return text


def preprocess(ctx, title, text):
    cats = sorted(set(c.strip() for c in re.findall(r'\[\[\s*Category\s*:\s*([^\]|]+)', text, re.I)))
    text = re.sub(r'\[\[\s*Category\s*:[^\]]*\]\]', '', text, flags=re.I)
    text = re.sub(r'[‎‏‪-‮﻿]', '', text)  # invisible direction marks (break image names)
    text = re.sub(r'^\{\|\s*border(?=\s|$)(?!\s*=)', '{| border="1"', text, flags=re.M)
    text = re.sub(r'<noinclude>.*?</noinclude>', '', text, flags=re.S)
    # [[http://url label]] is an external link in MediaWiki, not a wikilink
    text = re.sub(r'\[\[\s*((?:https?|ftp):?//[^\s\]|]+)[\s|]*([^\]]*)\]\]', lambda m: f'[{m.group(1)} {m.group(2).strip() or m.group(1)}]', text)
    # inline source/syntaxhighlight (enclose="none" or inline) is inline code
    text = re.sub(r'<(source|syntaxhighlight)\b([^>]*\b(?:enclose\s*=\s*"?(?:none|inline)"?|inline)\b[^>]*)>(.*?)</\1\s*>',
                  lambda m: '<code>' + H.escape(m.group(3)) + '</code>', text, flags=re.S | re.I)
    # code language normalisation
    def fixlang(m):
        tag, attrs = m.group(1), m.group(2)
        lm = re.search(r'\blang\s*=\s*"?([\w+#-]+)"?', attrs, re.I)
        lang = lm.group(1).lower() if lm else ''
        lang = LANG_MAP.get(lang, lang)
        if lang == 'nasm':
            pass
        return f'<syntaxhighlight lang="{lang}">' if lang else '<syntaxhighlight>'
    text = re.sub(r'<(syntaxhighlight|source)\b([^>]*)>', fixlang, text, flags=re.I)
    text = re.sub(r'</source>', '</syntaxhighlight>', text, flags=re.I)
    # GAS-flavoured asm blocks highlighted as such
    def gas(m):
        body = m.group(1)
        if re.search(r'%[re]?[a-d]x|%[re]?sp|\.section|\.global|\.globl|movl|pushl', body):
            return '<syntaxhighlight lang="gnuassembler">' + body + '</syntaxhighlight>'
        return m.group(0)
    text = re.sub(r'<syntaxhighlight lang="nasm">(.*?)</syntaxhighlight>', gas, text, flags=re.S)
    rating = None
    m = re.search(r'\{\{\s*[Rr]ating\s*\|\s*(\d)', text)
    if m:
        rating = int(m.group(1))
    flags = []
    for f, pat in (('stub', r'\{\{\s*[Ss]tub'), ('inprogress', r'\{\{\s*In[ _]Progress')):
        if re.search(pat, text):
            flags.append(f)
    text = render_templates(ctx, text, title)
    text = structural(text)
    text, raw = clean_tables(text)
    return text, cats, rating, flags, raw


CELL_ATTR = re.compile(r'^\s*((?:[a-zA-Z-]+\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s|]+)\s*)+)\|(?!\|)(.*)$', re.S)


def table_to_html(lines):
    """Render a MediaWiki table with rowspan/colspan as raw HTML (pandoc drops cells in these).
    Cell contents are converted by pandoc separately so links/code/markup still work."""
    rows, caption, cur = [], '', None

    def add_cell(kind, raw):
        nonlocal cur
        if cur is None:
            cur = []
            rows.append(cur)
        m = CELL_ATTR.match(raw)
        attrs, content = (m.group(1), m.group(2)) if m and not raw.lstrip().startswith('[') else ('', raw)
        span = ''.join(f' {k.lower()}="{v}"' for k, v in re.findall(r'\b(rowspan|colspan)\s*=\s*"?(\d+)"?', attrs, re.I))
        cur.append([kind, span, content])
    for line in lines[1:-1]:
        s = line.strip()
        if s.startswith('|-'):
            cur = None
        elif s.startswith('|+'):
            caption = s[2:].strip()
        elif s.startswith('!'):
            for c in s[1:].split('!!'):
                for c2 in c.split('||'):
                    add_cell('th', c2)
        elif s.startswith('|'):
            for c in s[1:].split('||'):
                add_cell('td', c)
        elif cur:
            cur[-1][2] += '\n' + line
    cells = [c for r in rows for c in r]
    if not cells:
        return None
    sep = '\n\nOSBCELLSEP\n\n'
    try:
        conv = pypandoc.convert_text(sep.join(c[2].strip() or ' ' for c in cells), 'html5', format='mediawiki',
                                     extra_args=['--wrap=none', '--preserve-tabs'])
    except Exception:
        return None
    parts = re.split(r'<p>OSBCELLSEP</p>', conv)
    if len(parts) != len(cells):
        return None
    for c, h in zip(cells, parts):
        h = h.strip()
        mm = re.fullmatch(r'<p>(.*?)</p>', h, re.S)
        c[2] = mm.group(1) if mm and '<p>' not in mm.group(1) else h
    body = ''.join('<tr>' + ''.join(f'<{k}{sp}>{h}</{k}>' for k, sp, h in r) + '</tr>' for r in rows)
    cap = f'<caption>{H.escape(caption)}</caption>' if caption else ''
    return f'<table>{cap}{body}</table>'


def clean_tables(text):
    """Pandoc's MediaWiki reader is strict about table syntax; normalise it.
    Tables using rowspan/colspan are rendered to raw HTML and returned as placeholders."""
    raw = {}
    src = text.split('\n')
    pre_out, i = [], 0
    while i < len(src):
        if src[i].lstrip().startswith('{|'):
            j, depth = i, 0
            while j < len(src):
                st = src[j].lstrip()
                if st.startswith('{|'):
                    depth += 1
                elif st.startswith('|}'):
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            block = src[i:j + 1]
            inner_nested = sum(1 for b in block if b.lstrip().startswith('{|')) > 1
            if j < len(src) and not inner_nested and re.search(r'\b(rowspan|colspan)\s*=', '\n'.join(block), re.I):
                h = table_to_html(block)
                if h:
                    key = f'OSBRAWTABLE{len(raw)}X'
                    raw[key] = h
                    pre_out += ['', key, '']
                    i = j + 1
                    continue
            pre_out += block
            i = j + 1
            continue
        pre_out.append(src[i])
        i += 1
    out, depth = [], 0
    for line in pre_out:
        s = line.lstrip()
        if s.startswith('{|'):
            if depth == 0 and out and out[-1].strip():
                out.append('')  # pandoc needs a blank line before a table
            depth += 1
            out.append('{|')
            continue
        if depth and s.startswith('|}'):
            depth -= 1
            out.append('|}' + s[2:])
            continue
        if depth and s[:1] in ('|', '!'):
            # drop unbalanced-quote attribute junk on row/caption lines
            if s.startswith('|-'):
                out.append('|-')
                continue
            if s.startswith(('|+', '|}')):
                out.append(s)
                continue
            lead, rest = s[0], s[1:]
            sep = '||' if lead == '|' else '!!'
            cells = []
            for c in rest.split(sep):
                if c.strip() == '-':  # a cell holding only '-' is misread as a row separator
                    c = ' &#45; '
                # a lone '=' in a cell without an attribute separator confuses pandoc
                if '|' not in re.sub(r'\[\[.*?\]\]|\[[^\]]*\]', '', c) and '=' in c and '[' not in c and '<' not in c:
                    c = c.replace('=', '&#61;')
                cells.append(c)
            out.append(lead + sep.join(cells))
            continue
        out.append(line)
    return chr(10).join(out), raw


def postprocess(ctx, title, html_s):
    soup = BeautifulSoup(html_s, 'html.parser')
    links = set()
    # headings: ids in MediaWiki style, lowercase
    toc = []
    used = set()
    heads = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
    shift = 1 if any(h.name == 'h1' for h in heads) else 0  # keep hierarchy when the article uses '=' headings
    for h in heads:
        base = anchor_id(h.get_text()) or 'section'
        hid, n = base, 2
        while hid in used:
            hid, n = f'{base}_{n}', n + 1
        used.add(hid)
        h['id'] = hid
        lvl = min(6, int(h.name[1]) + shift)
        h.name = f'h{lvl}'
        if lvl in (2, 3):
            toc.append({'id': hid, 'text': h.get_text(' ', strip=True), 'level': lvl})
    for a in soup.find_all('a'):
        href = a.get('href', '')
        cls = a.get('class') or []
        if 'wikilink' in cls:
            a['class'] = [c for c in cls if c != 'wikilink']
            if not a['class']:
                del a['class']
            if a.get('title') == a.get_text():
                del a['title']
            target = unquote(H.unescape(href)).replace('_', ' ').lstrip(':').strip()
            if target.startswith('#'):
                a['href'] = '#' + anchor_id(mw_decode(target[1:]))
                continue
            if re.match(r'(?i)\s*category\s*:', target):
                cat = target.split(':', 1)[1].strip()
                cat = cat[:1].upper() + cat[1:]
                a['href'] = f'{{{{ROOT}}}}library/index.html#cat-{slug(cat)}'
                continue
            if re.match(r'(?i)(https?|ftp):', target):
                a['href'] = unquote(H.unescape(href))
                a['class'] = ['ext']
                a['rel'] = 'noopener'
                continue
            canon, anc = ctx.resolve(target)
            if canon:
                links.add(canon)
                a['href'] = f'{{{{ROOT}}}}library/{slug(canon)}.html' + (f'#{anchor_id(mw_decode(anc))}' if anc else '')
                a['data-wiki'] = canon
            else:
                a['href'] = WIKI + target.replace(' ', '_')
                a['class'] = ['ext', 'wk-missing']
                a['rel'] = 'noopener'
        elif href.startswith('#cb'):
            a.unwrap()  # code line anchors
        elif href.startswith('http'):
            a['rel'] = 'noopener'
            a['class'] = (a.get('class') or []) + ['ext']
    for img in soup.find_all('img'):
        src = H.unescape(img.get('src', ''))
        local = ctx.image(src)
        if local:
            img['src'] = '{{ROOT}}assets/wiki/' + local
        elif not src.startswith('http'):
            img['src'] = WIKI + 'Special:FilePath/' + src.split(':', 1)[-1]
        img['loading'] = 'lazy'
        if not img.get('alt'):
            img['alt'] = ''
        for k in ('width', 'height', 'style'):
            if k in img.attrs:
                del img[k]
    for t in soup.find_all('table'):
        if t.find_parent('table') or 'wk-infobox' in (t.get('class') or []):
            continue
        wrap = soup.new_tag('div', attrs={'class': 'table-wrap'})
        t.wrap(wrap)
    for tag in soup.find_all(style=True):
        del tag['style']
    for tag in soup.find_all(['font', 'center', 'big', 'small']):
        tag.unwrap() if tag.name in ('font', 'center', 'big') else None
    return str(soup), toc, sorted(links)


def plain_summary(html_s, n=220):
    soup = BeautifulSoup(html_s, 'html.parser')
    for p in soup.find_all('p'):
        if p.find_parent(class_=re.compile('wk-')):
            continue
        t = p.get_text(' ', strip=True)
        if len(t) > 40:
            return (t[:n].rsplit(' ', 1)[0] + '…') if len(t) > n else t
    return ''


def convert_one(ctx, key):
    v = ctx.pages[key]
    title = v['title']
    text, cats, rating, flags, raw = preprocess(ctx, title, v['text'])
    try:
        out = pypandoc.convert_text(text, 'html5', format='mediawiki', extra_args=['--wrap=none', '--preserve-tabs'])
        for k, h in raw.items():
            out = out.replace(f'<p>{k}</p>', h).replace(k, h)
    except Exception as e:  # fall back: show the source as preformatted text, never lose content
        out = '<div class="wk-note wk-warn"><span class="wk-note-label">Rendering note</span><p>This page could not be fully formatted; its original text is shown below.</p></div><pre>' + H.escape(v['text']) + '</pre>'
        print('PANDOC FAIL', title, str(e)[:200], file=sys.stderr)
    html_s, toc, links = postprocess(ctx, title, out)
    words = len(re.sub(r'<[^>]+>', ' ', html_s).split())
    rec = dict(title=title, slug=slug(title), html=html_s, toc=toc, categories=cats, rating=rating, flags=flags,
               links=links, summary=plain_summary(html_s), words=words, updated=v['ts'][:10],
               revisions=v['revisions'], authors=v['authors'], url=WIKI + title.replace(' ', '_'))
    with open(os.path.join(OUT, slug(title) + '.json'), 'w', encoding='utf-8') as f:
        json.dump(rec, f, ensure_ascii=False)
    return title


def main():
    os.makedirs(OUT, exist_ok=True)
    pages = json.load(open(SRC, encoding='utf-8'))
    ctx = Ctx(pages)
    only = sys.argv[1:]
    keys = [ctx.articles[t] for t in ctx.articles] if not only else [ctx.resolve(t)[0] for t in only]
    with ThreadPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 2)) as ex:
        for i, t in enumerate(ex.map(lambda k: convert_one(ctx, k), keys)):
            if i % 100 == 0:
                print(i, t, flush=True)
    meta = dict(articles=sorted(ctx.articles.values()), redirects=ctx.redirects)
    json.dump(meta, open(os.path.join(ROOT, 'cache', 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('done', len(keys), 'unknown templates dropped:', sorted(ctx_unknown.items(), key=lambda x: -x[1])[:40])


if __name__ == '__main__':
    main()
