/* Build an OS — COGNIA. Small, dependency-free behaviour layer.
   Progress lives in this browser only (localStorage). No tracking, no streaks, no nagging. */
(function () {
  'use strict';
  var KEY = 'cognia-osb-';
  function get(k, d) { try { var v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { } }
  var root = document.documentElement;
  var ROOT = document.body.getAttribute('data-root') || '';

  /* theme */
  var saved = get('theme', null);
  if (saved) root.setAttribute('data-theme', saved);
  function curTheme() {
    var t = root.getAttribute('data-theme');
    return t || 'dark';  /* brand: black canvas by default; light is opt-in */
  }
  function paintThemeBtns() {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.textContent = curTheme() === 'dark' ? 'Light theme' : 'Dark theme';
    });
  }
  document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var n = curTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', n); set('theme', n); paintThemeBtns();
    });
  });
  paintThemeBtns();

  /* mobile nav */
  document.querySelectorAll('[data-nav-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var o = document.body.classList.toggle('nav-open');
      b.setAttribute('aria-expanded', o ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function (e) {
    if (document.body.classList.contains('nav-open') && !e.target.closest('.rail') && !e.target.closest('[data-nav-toggle]')) {
      document.body.classList.remove('nav-open');
    }
  });

  /* progress */
  var done = get('done', {});
  function paintProgress() {
    document.querySelectorAll('[data-lesson]').forEach(function (el) {
      el.classList.toggle('done', !!done[el.getAttribute('data-lesson')]);
    });
    document.querySelectorAll('[data-track-progress]').forEach(function (el) {
      var ids = el.getAttribute('data-track-progress').split(',');
      var n = ids.filter(function (i) { return done[i]; }).length;
      var bar = el.querySelector('i'); if (bar) bar.style.width = (ids.length ? (100 * n / ids.length) : 0) + '%';
      var lab = el.parentNode.querySelector('.bar-l'); if (lab) lab.textContent = n + ' / ' + ids.length + ' done';
    });
    var mark = document.querySelector('[data-mark]');
    if (mark) {
      var id = mark.getAttribute('data-mark');
      mark.textContent = done[id] ? 'Completed ✓  (undo)' : 'Mark lesson complete';
      mark.classList.toggle('primary', !done[id]);
    }
    var order0 = (document.querySelector('[data-continue]') || {getAttribute: function () { return ''; }}).getAttribute('data-continue');
    if (order0) {
      var nx = order0.split(',').filter(function (i) { return !done[i]; })[0];
      document.querySelectorAll('.lessons li.next').forEach(function (li) { li.classList.remove('next'); });
      var nli = nx && document.querySelector('.lessons li[data-lesson="' + nx + '"]');
      if (nli) nli.classList.add('next');
    }
    document.querySelectorAll('[data-needs]').forEach(function (el) {
      var need = el.getAttribute('data-needs').split(',');
      var left = need.filter(function (i) { return !done[i]; }).length;
      var st = el.querySelector('.needs-state');
      if (st) st.textContent = left ? '· ' + left + ' of ' + need.length + ' still to do' : '· ready to start ✓';
    });
    var cont = document.querySelector('[data-continue]');
    if (cont) {
      var order = (cont.getAttribute('data-continue') || '').split(',');
      var next = order.filter(function (i) { return !done[i]; })[0];
      var any = order.some(function (i) { return done[i]; });
      if (any && next) { cont.href = ROOT + 'learn/' + next + '.html'; cont.textContent = 'Continue where you left off'; }
      else if (any && !next) { cont.textContent = 'Path complete — open the Library'; cont.href = ROOT + 'library/index.html'; }
    }
  }
  var mk = document.querySelector('[data-mark]');
  if (mk) mk.addEventListener('click', function () {
    var id = mk.getAttribute('data-mark');
    if (done[id]) delete done[id]; else done[id] = Date.now();
    set('done', done); paintProgress();
  });
  paintProgress();

  /* copy buttons: off by default (the wiki warns against copy-paste kernels); opt in */
  function paintCopy() {
    var on = !!get('copy', false);
    document.body.classList.toggle('show-copy', on);
    document.querySelectorAll('[data-copy-toggle]').forEach(function (b) { b.textContent = on ? 'Hide copy buttons' : 'Show copy buttons'; });
  }
  document.querySelectorAll('[data-copy-toggle]').forEach(function (b) {
    b.addEventListener('click', function () { set('copy', !get('copy', false)); paintCopy(); });
  });
  paintCopy();

  /* copy buttons on code */
  document.querySelectorAll('.prose div.sourceCode, .prose > pre').forEach(function (box) {
    var pre = box.tagName === 'PRE' ? box : box.querySelector('pre');
    if (!pre) return;
    if (box.tagName === 'PRE') {
      var w = document.createElement('div'); w.className = 'sourceCode';
      box.parentNode.insertBefore(w, box); w.appendChild(box); box = w;
    }
    var b = document.createElement('button');
    b.className = 'copy'; b.type = 'button'; b.textContent = 'Copy';
    b.addEventListener('click', function () {
      var txt = pre.innerText;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
        b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1400);
      }, function () { b.textContent = 'Select + copy'; });
    });
    box.appendChild(b);
  });

  /* TOC scrollspy */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc-rail a[href^="#"]'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[decodeURIComponent(a.getAttribute('href').slice(1))] = a; });
    var obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) {
          tocLinks.forEach(function (a) { a.classList.remove('active'); });
          map[e.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-70px 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) obs.observe(el); });
  }

  /* library filter */
  var lf = document.getElementById('lib-filter');
  if (lf) {
    var items = Array.prototype.slice.call(document.querySelectorAll('#lib-list li[data-s]'));
    var lvSel = document.getElementById('lib-level');
    var countEl = document.getElementById('lib-count');
    function run() {
      var q = lf.value.trim().toLowerCase(), lv = lvSel ? lvSel.value : '';
      var n = 0;
      items.forEach(function (li) {
        var ok = (!q || li.getAttribute('data-s').indexOf(q) !== -1) && (!lv || li.getAttribute('data-l') === lv);
        li.hidden = !ok; if (ok) n++;
      });
      document.querySelectorAll('#lib-list .letter').forEach(function (h) {
        var el = h.nextElementSibling, any = false;
        while (el && !el.classList.contains('letter')) { if (!el.hidden) any = true; el = el.nextElementSibling; }
        h.hidden = !any;
      });
      if (countEl) countEl.textContent = n + ' articles';
    }
    lf.addEventListener('input', run); if (lvSel) lvSel.addEventListener('change', run);
    var qs = new URLSearchParams(location.search).get('q'); if (qs) { lf.value = qs; }
    run();
  }

  /* search (index loaded from assets/js/search-index.js so it works from file://) */
  var dlg = document.getElementById('search');
  var inp = dlg && dlg.querySelector('input');
  var res = dlg && dlg.querySelector('.search-res');
  var loaded = false, sel = 0, hits = [];
  function load(cb) {
    if (loaded || window.OSB_INDEX) { loaded = true; return cb(); }
    var s = document.createElement('script'); s.src = ROOT + 'assets/js/search-index.js';
    s.onload = function () { loaded = true; cb(); }; document.head.appendChild(s);
  }
  function open() {
    if (!dlg) return;
    dlg.classList.add('open'); document.body.classList.remove('nav-open');
    load(function () { inp.focus(); inp.select(); search(); });
  }
  function close() { if (dlg) dlg.classList.remove('open'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function search() {
    var q = inp.value.trim().toLowerCase();
    var idx = window.OSB_INDEX || [];
    if (!q) { hits = idx.filter(function (d) { return d.k === 'Lesson'; }).slice(0, 8); }
    else {
      var terms = q.split(/\s+/);
      hits = idx.map(function (d) {
        var t = d.t.toLowerCase(), h = d.h || '', s = 0;
        for (var i = 0; i < terms.length; i++) {
          var w = terms[i];
          if (t === q) s += 100;
          if (t.indexOf(w) === 0) s += 30; else if (t.indexOf(w) !== -1) s += 18;
          else if (h.indexOf(w) !== -1) s += 6;
          else if ((d.s || '').toLowerCase().indexOf(w) !== -1) s += 3;
          else return null;
        }
        if (d.k === 'Lesson') s += 4;
        return { d: d, s: s };
      }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).slice(0, 40).map(function (x) { return x.d; });
    }
    sel = 0;
    res.innerHTML = hits.length ? hits.map(function (d, i) {
      return '<li><a href="' + ROOT + d.u + '"' + (i === 0 ? ' class="sel"' : '') + '><span class="k">' + esc(d.k) + '</span><b>' + esc(d.t) + '</b>' + (d.s ? '<span>' + esc(d.s) + '</span>' : '') + '</a></li>';
    }).join('') : '<li class="search-hint">No match. Try a shorter word, e.g. “paging”, “GDT”, “FAT”.</li>';
  }
  if (dlg) {
    inp.addEventListener('input', search);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    inp.addEventListener('keydown', function (e) {
      var as = res.querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!as.length) return;
        as[sel] && as[sel].classList.remove('sel');
        sel = (sel + (e.key === 'ArrowDown' ? 1 : as.length - 1)) % as.length;
        as[sel].classList.add('sel'); as[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && as[sel]) { location.href = as[sel].href; }
    });
  }
  document.querySelectorAll('[data-search-open]').forEach(function (b) { b.addEventListener('click', open); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { close(); document.body.classList.remove('nav-open'); }
    var typing = /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '');
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); open(); }
  });
})();
