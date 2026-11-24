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
  function match(S, text, from, to) {
    const t = ' ' + norm(text) + ' ';
    if (t.trim().length < 3) return -1;
    let best = -1, bestScore = 0;
    for (let i = Math.max(0, from + 1); i <= to; i++) {
      const s = S.steps[i];
      const words = [...(s.kw || []), s.title];
      S.chars.filter(c => c.a === i).forEach(c => { words.push(c.n); words.push(c.n.split(' ')[0]); });
      let score = 0;
      new Set(words.map(norm)).forEach(w => { if (w.length > 2 && t.includes(w)) score += w.length > 8 ? 2 : 1; });
      if (score > bestScore || (score === bestScore && score > 0 && i > best)) { bestScore = score; best = i; }
    }
    return bestScore > 0 ? best : -1;
  }
  const KEY = g => 'stringboard:' + g + ':v1';
  function getState(g) { try { return JSON.parse(localStorage.getItem(KEY(g))) || {}; } catch (e) { return {}; } }
  function setState(g, st) { try { localStorage.setItem(KEY(g), JSON.stringify(st)); return true; } catch (e) { return false; } }
  return { norm, load, loadImages, maxChapter, chapterStart, chapterEnd, match, getState, setState };
})();
