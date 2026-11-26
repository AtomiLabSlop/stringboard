/* Shared story helpers for Stringboard (landing + board) */
window.SB = (() => {
  const norm = s => (s || '').toLowerCase().replace(/[’`´]/g, "'").normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cache = {};
  async function load(game) {
    if (!cache[game]) cache[game] = fetch('data/' + encodeURIComponent(game) + '.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('No data'); return r.json(); });
    return cache[game];
  }
  /* Default card images: data/<game>-images.json → { images: { id: { url, credit } } }. Missing file = no defaults. */
  async function loadImages(game) {
    try {
      const r = await fetch('data/' + encodeURIComponent(game) + '-images.json', { cache: 'no-cache' });
      if (!r.ok) return {};
      const d = await r.json(), out = {};
      Object.entries((d && d.images) || {}).forEach(([id, v]) => {
        const url = typeof v === 'string' ? v : v && v.url;
        if (url && /^https:\/\//i.test(url.trim())) out[id] = { url: url.trim(), credit: (v && v.credit) || '' };
      });
      return out;
    } catch (e) { return {}; }
  }
  const maxChapter = S => S.steps[S.steps.length - 1].ch;
  function chapterStart(S, ch) {
    const i = S.steps.findIndex(s => s.ch >= ch);
    return i < 0 ? S.steps.length - 1 : i;
  }
  function chapterEnd(S, ch) {
    let e = -1;
    S.steps.forEach((s, i) => { if (s.ch <= ch) e = i; });
    return e < 0 ? 0 : e;
  }
  /* Best matching step in (from, to]. Returns index or -1. Never looks past `to`. */
  const STOP = new Set('the and for but not you your yours she her hers him his they them their its was were are did does done had has have get got just now then than that this these those with from into onto out off over under again some any all one two who what when where why how went go goes going came come made make took take saw see met meet first last next after before about also very still back there here our ours mine'.split(' '));
  function match(S, text, from, to) {
    // whole-word matching only, and common filler words never count as a match
    const clean = s => norm(s).replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const t = ' ' + clean(text) + ' ';
    if (t.trim().length < 3) return -1;
    let best = -1, bestScore = 0;
    for (let i = Math.max(0, from + 1); i <= to; i++) {
      const s = S.steps[i];
      const words = [...(s.kw || []), s.title];
      S.chars.filter(c => c.a === i).forEach(c => { words.push(c.n); words.push(c.n.split(' ')[0]); });
      let score = 0;
      new Set(words.map(clean)).forEach(w => { if (w.length > 2 && !STOP.has(w) && t.includes(' ' + w + ' ')) score += w.length > 8 ? 2 : 1; });
      if (score > bestScore || (score === bestScore && score > 0 && i > best)) { bestScore = score; best = i; }
    }
    return bestScore > 0 ? best : -1;
  }
  /* ---------- smart matching: a small sentence-embedding model running in the browser (Transformers.js) ----------
     Only steps in (from, to] are ever compared, so nothing past the player's chapter is looked at. */
  const TF_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
  let extractorP = null; const listeners = new Set();
  function getExtractor(model, onProgress) {
    if (onProgress) listeners.add(onProgress);
    if (!extractorP) {
      const files = {};
      extractorP = import(TF_URL).then(({ pipeline }) => pipeline('feature-extraction', model, {
        dtype: 'q8',
        progress_callback: p => {
          if (p.status === 'progress' && p.total) {
            files[p.file] = [p.loaded, p.total];
            const v = Object.values(files), L = v.reduce((a, f) => a + f[0], 0), T = v.reduce((a, f) => a + f[1], 0);
            listeners.forEach(fn => fn(L, T));
          }
        }
      })).catch(e => { extractorP = null; throw e; });
    }
    return extractorP.finally(() => onProgress && listeners.delete(onProgress));
  }
  async function modelCached(model) {
    try { const c = await caches.open('transformers-cache'); return (await c.keys()).some(r => r.url.includes(model)); } catch (e) { return false; }
  }
  /* Keywords first; if they find nothing, ask the language model. Returns { i, how }. */
  async function smartMatch(S, text, from, to, onProgress) {
    const kw = match(S, text, from, to);
    if (kw >= 0) return { i: kw, how: 'keywords' };
    // filler like "i did the" says nothing about where you are, so don't ask the model to guess
    const content = norm(text).replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
    if (!S.matcher || content.length < 2 || to <= from) return { i: -1, how: 'none' };
    const ext = await getExtractor(S.matcher.model, onProgress);
    const idx = []; for (let i = Math.max(0, from + 1); i <= to; i++) idx.push(i);
    const docs = idx.map(i => S.steps[i].title + '. ' + S.steps[i].text + ' ' + S.chars.filter(c => c.a === i).map(c => c.n).join(', '));
    const out = (await ext([String(text).trim(), ...docs], { pooling: 'mean', normalize: true })).tolist();
    const q = out[0]; let best = -1, bestSim = 0;
    out.slice(1).forEach((v, k) => { const sim = v.reduce((a, x, j) => a + x * q[j], 0); if (sim > bestSim) { bestSim = sim; best = idx[k]; } });
    return bestSim >= 0.4 ? { i: best, how: 'model' } : { i: -1, how: 'none' };
  }
  const fmtMB = b => (b / 1e6).toFixed(1);
  /* per-game page background behind the UI */
  function applyBackground(S, entry) {
    const img = (S && S.background) || (entry && entry.background);
    const b = img && /^[\w./-]+$/.test(img) ? new URL(img, location.href).href
      : entry && entry.theme && window.SBTheme ? SBTheme.url(entry.id, entry.theme)
      : new URL('assets/bg/default.webp', location.href).href; // calm default before anything is chosen
    document.body.classList.toggle('has-bg', !!b);
    if (b) document.body.style.setProperty('--game-bg', `url("${b}")`); else document.body.style.removeProperty('--game-bg');
  }
  /* ---------- progress units per category ----------
     game:   chapters; the board shows everything up to the START of the chapter entered.
     series: episodes as "S2E5" (or 2x05, or an absolute number); stored as season*100+episode; shows up to the END of that episode.
     movie:  minutes watched; shows up to that minute.
     book:   page number; shows up to that page. */
  const UNITS = {
    game:   { label: 'Chapter', placeholder: 'Enter chapter number, e.g. 1', help: 'The board shows everything up to the <b>start</b> of the chapter you enter. If Chapter 3 has just begun, enter 3.', upTo: false },
    series: { label: 'Last episode watched', placeholder: 'e.g. S2E5', help: 'Enter the last episode you finished, like S2E5. The board shows everything up to the end of it.', upTo: true },
    movie:  { label: 'Minutes watched', placeholder: 'e.g. 45', help: 'How far into the film you are, in minutes. The board shows everything up to that point.', upTo: true },
    book:   { label: 'Page', placeholder: 'e.g. 120', help: 'The page you are on. Page numbers differ between editions, so check the edition noted for this book.', upTo: true }
  };
  const typeOf = S => (S && S.type) || 'game';
  function parsePos(type, str) {
    const v = String(str || '').trim();
    if (type === 'series') {
      const m = v.match(/^s?(\d{1,2})\s*[ex]\s*(\d{1,3})$/i);
      if (m && +m[2] >= 1) return +m[1] * 100 + +m[2];
    }
    return /^\d{1,4}$/.test(v) && +v >= 1 ? +v : 0;
  }
  /* Sagas (several films or books as one story): data.parts = [{ n, short }], data.unit = 'Minute' | 'Chapter'.
     A position is part * 1000 + minute/chapter, so the whole saga is one timeline. */
  const isSaga = S => !!(S && Array.isArray(S.parts));
  function unitsOf(S) {
    if (!isSaga(S)) return UNITS[typeOf(S)];
    const min = S.unit === 'Minute';
    return { label: min ? 'Minutes watched' : 'Chapter', placeholder: min ? 'e.g. 45' : 'e.g. 12', upTo: true, partLabel: S.partLabel || (min ? 'Film' : 'Book'),
      help: min ? 'Pick the film you are watching and how many minutes in you are. The board shows everything up to that point, including the earlier films.'
                : 'Pick the book you are reading and the chapter you have finished. The board shows everything up to the end of that chapter, including the earlier books.' };
  }
  function posOf(S, str, part) {
    if (!isSaga(S)) return parsePos(typeOf(S), str);
    const v = String(str || '').trim();
    return part >= 1 && part <= S.parts.length && /^\d{1,3}$/.test(v) && +v >= 1 ? part * 1000 + +v : 0;
  }
  /* how a step's position reads in the chapter box: "Chapter 3", "S2E5", "Blade Runner 2049", "Goblet of Fire · Ch. 12" */
  function posLabel(S, ch) {
    if (isSaga(S)) { const p = S.parts[Math.floor(ch / 1000) - 1]; return p ? p.short + (S.unit === 'Chapter' ? ' · Ch. ' + (ch % 1000) : '') : ''; }
    const ty = typeOf(S); return ty === 'series' ? fmtPos('series', ch) : ty === 'game' ? 'Chapter ' + ch : ty === 'book' ? 'Page ' + ch : 'Minute ' + ch;
  }
  function fmtPos(type, n) { return type === 'series' ? `S${Math.floor(n / 100)}E${n % 100}` : String(n); }
  /* index of the step the board should open at for position n */
  function basePos(S, n) { return UNITS[typeOf(S)].upTo ? chapterEnd(S, n) : chapterStart(S, n); }
  async function catalog() { try { const r = await fetch('data/catalog.json', { cache: 'no-cache' }); return r.ok ? r.json() : null; } catch (e) { return null; } }
  const KEY = g => 'stringboard:' + g + ':v1';
  function getState(g) { try { return JSON.parse(localStorage.getItem(KEY(g))) || {}; } catch (e) { return {}; } }
  function setState(g, st) { try { localStorage.setItem(KEY(g), JSON.stringify(st)); return true; } catch (e) { return false; } }
  return { norm, load, applyBackground, UNITS, typeOf, parsePos, fmtPos, isSaga, unitsOf, posOf, posLabel, basePos, catalog, loadImages, smartMatch, modelCached, fmtMB, maxChapter, chapterStart, chapterEnd, match, getState, setState };
})();
