"""Export platform data for the React app (step 2; run wikiconv.py first).

Writes public/data/:
  curriculum.json      learning path (from tools/source/curriculum.json)
  index.json           one entry per article: title, slug, summary, categories, rating, words, headings
  meta.json            counts, contributors, provenance
  method.html          the teaching method (tools/source/method.md rendered by pandoc)
  a/<slug>.json        each article: html, toc, credit fields, backlinks, lessons using it

Links inside article HTML are rewritten for the hash router:
  library/<slug>.html#x  ->  #/library/<slug>/x       category  ->  #/library?cat=<name>
  assets/wiki/<file>     ->  wiki/<file>               (served from public/wiki)
"""
import glob, json, os, re, shutil
from urllib.parse import quote
import pypandoc

TOOLS = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(TOOLS)
OUT = os.path.join(WEB, 'public', 'data')
SRC = os.path.join(TOOLS, 'source')


def rewrite(html):
    html = re.sub(r'href="\{\{ROOT\}\}library/index\.html#cat-([^"]+)"', lambda m: f'href="#/library?cat={m.group(1)}"', html)
    html = re.sub(r'href="\{\{ROOT\}\}library/([^"#]+)\.html(?:#([^"]*))?"',
                  lambda m: f'href="#/library/{m.group(1)}' + (f'/{m.group(2)}' if m.group(2) else '') + '"', html)
    html = html.replace('{{ROOT}}assets/wiki/', 'wiki/')
    html = html.replace('{{ROOT}}', '')
    return html


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, 'a'))
    arts = [json.load(open(f, encoding='utf-8')) for f in glob.glob(os.path.join(TOOLS, 'cache', 'articles', '*.json'))]
    arts.sort(key=lambda d: d['title'].lower())
    by_title = {d['title']: d for d in arts}
    cur = json.load(open(os.path.join(SRC, 'curriculum.json'), encoding='utf-8'))
    # the Prerequisites section: its own track, kept apart from the numbered path (see src/lib/data.ts)
    pre_path = os.path.join(SRC, 'prereqs.json')
    if os.path.exists(pre_path):
        cur['prereqs'] = json.load(open(pre_path, encoding='utf-8'))

    used = {}
    for t in cur['tracks'] + ([cur['prereqs']] if cur.get('prereqs') else []):
        for m in t['modules']:
            for l in m['lessons']:
                for a in l.get('articles', []):
                    used.setdefault(a, []).append({'id': l['id'], 'title': l['title'], 'kind': 'primary'})
                for a in l.get('further', []):
                    used.setdefault(a, []).append({'id': l['id'], 'title': l['title'], 'kind': 'further'})
    missing = sorted(a for a in used if a not in by_title)
    if missing:
        raise SystemExit(f'curriculum references unknown articles: {missing}')

    back = {}
    for d in arts:
        for x in d['links']:
            if x != d['title']:
                back.setdefault(x, set()).add(d['title'])

    index = []
    for d in arts:
        index.append({'t': d['title'], 's': d['slug'], 'sum': d['summary'], 'c': d['categories'], 'r': d.get('rating'),
                      'w': d['words'], 'h': ' '.join(x['text'] for x in d['toc']), 'f': d['flags'],
                      'l': len(used.get(d['title'], []))})
        rec = {'title': d['title'], 'slug': d['slug'], 'html': rewrite(d['html']), 'toc': d['toc'], 'categories': d['categories'],
               'rating': d.get('rating'), 'flags': d['flags'], 'words': d['words'], 'summary': d['summary'],
               'updated': d['updated'], 'authors': d['authors'], 'url': d['url'],
               'history': 'https://wiki.osdev.org/index.php?title=' + quote(d['title'].replace(' ', '_')) + '&action=history',
               'backlinks': [{'t': b, 's': by_title[b]['slug']} for b in sorted(back.get(d['title'], []))],
               'lessons': used.get(d['title'], [])}
        with open(os.path.join(OUT, 'a', d['slug'] + '.json'), 'w', encoding='utf-8') as f:
            json.dump(rec, f, ensure_ascii=False, separators=(',', ':'))

    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'curriculum.json'), 'w', encoding='utf-8') as f:
        json.dump(cur, f, ensure_ascii=False, separators=(',', ':'))
    contributors = sorted({u for d in arts for u in d['authors']}, key=str.lower)
    cats = sorted({c for d in arts for c in d['categories']}, key=str.lower)
    meta = {'articles': len(arts), 'categories': cats, 'contributors': contributors,
            'dump': 'https://archive.org/details/wiki-wiki.osdev.org-20251230', 'dumpDate': '2025-12-30',
            'wiki': 'https://wiki.osdev.org/'}
    with open(os.path.join(OUT, 'meta.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, separators=(',', ':'))
    method = open(os.path.join(SRC, 'method.md'), encoding='utf-8').read()
    with open(os.path.join(OUT, 'method.html'), 'w', encoding='utf-8') as f:
        f.write(pypandoc.convert_text(method, 'html5', format='gfm', extra_args=['--wrap=none']))
    print(f'exported {len(arts)} articles, {sum(len(m["lessons"]) for t in cur["tracks"] for m in t["modules"])} lessons, '
          f'{len(contributors)} contributors')


if __name__ == '__main__':
    main()
