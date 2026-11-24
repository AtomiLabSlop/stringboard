/* Stringboard board page */
{
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const GAME = new URLSearchParams(location.search).get('game') || 'gta6';
const VW = 1100, VH = 1000;
const COL = { red: '#c0262d', yellow: '#f2c230', green: '#3c9a4a', blue: '#2f6fc0', white: '#f4f2ee', black: '#1c1c1c' };
const CARD_BG = { white: '#ffffff', cream: '#f3ead7', tan: '#c9a67a', slate: '#3d3f44', black: '#141414' };
const DEF = { cardSize: 1, imgSize: 1, shape: 'rect', rounded: false, style: 'photo', font: 'sans', fontSize: 1, tilt: 3, bg: 'cork', frame: 'darkwood', strColor: 'red', tension: .25, pinColor: 'red', penColor: 'red', lamp: false };

let S, st, view, scale = 1, mode = null, selNote = null, openCard = null, undoNow = null;
const board = $('#board'), stage = $('#stage'), cardsEl = $('#cards'), notesEl = $('#notes'), strSvg = $('#strings'), ink = $('#ink');
const els = {};

let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { if (!SB.setState(GAME, st)) toast('Could not save – browser storage is full.'); }, 250); }
function toast(msg, action, fn) {
  const t = $('#toast'); t.innerHTML = ''; t.append(msg);
  if (action) { const b = document.createElement('button'); b.textContent = action; b.onclick = () => { fn(); t.classList.remove('on'); }; t.append(b); }
  t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), action ? 7000 : 3500);
}
const lum = hex => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 2000) / 1000 - 1; };

/* ---------- silhouettes (generic, original) ---------- */
function sil(c) {
  const col = c.masked ? '#5f5953' : '#8f877c';
  if (c.grp) {
    const head = (x, r, f) => `<circle cx="${x}" cy="${46 - r}" r="${r}" fill="${f}"/><path d="M${x - r * 2} 80 Q${x - r * 2} 52 ${x} 52 Q${x + r * 2} 52 ${x + r * 2} 80Z" fill="${f}"/>`;
    return `<svg viewBox="0 0 110 80" preserveAspectRatio="xMidYMax meet">${head(30, 9, col)}${head(80, 9, col)}${head(55, 11, c.masked ? '#77706a' : '#a39b90')}${c.masked ? '<text x="55" y="34" text-anchor="middle" font-size="16" font-weight="700" fill="#f4efe4">?</text>' : ''}</svg>`;
  }
  return `<svg viewBox="0 0 110 80" preserveAspectRatio="xMidYMax meet"><circle cx="55" cy="30" r="14" fill="${col}"/><path d="M25 80 Q25 50 55 50 Q85 50 85 80Z" fill="${col}"/></svg>`;
}

/* ---------- build ---------- */
function buildCards() {
  S.chars.forEach(c => {
    const d = document.createElement('div');
    d.className = 'card' + (c.main ? ' main' : '') + (c.note ? ' note-card' : '');
    d.dataset.id = c.id; d.tabIndex = 0; d.setAttribute('role', 'button');
    d.innerHTML = `<div class="pht">${sil(c)}<img alt="" referrerpolicy="no-referrer"><i class="xx"></i></div><div class="nm"></div><div class="rl"></div>`;
    d.querySelector('img').addEventListener('error', e => { e.target.parentNode.classList.remove('has'); });
    cardsEl.append(d); els[c.id] = d;
    dragify(d, () => st.pos[c.id] || { x: c.x, y: c.y }, p => { st.pos[c.id] = p; }, () => openCardPanel(c.id));
    d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCardPanel(c.id); } });
  });
}
const byId = id => S.chars.find(c => c.id === id);
const custom = id => (st.cards[id] = st.cards[id] || {});
function roleAt(c, v) { let r = c.r; (c.rs || []).forEach(([s, t]) => { if (s <= v) r = t; }); return r; }

/* ---------- render ---------- */
function applySettings() {
  const s = st.set;
  stage.className = 'stage st-' + s.style + ' font-' + s.font + (s.shape === 'circle' ? ' st-circle' : '') + (s.rounded && s.shape !== 'circle' ? ' st-rounded' : '');
  board.className = 'board bg-' + s.bg;
  $('#frame').className = 'frame f-' + s.frame;
  document.body.classList.toggle('lamp-on', s.lamp);
  $('#lampBtn').setAttribute('aria-checked', s.lamp);
  $('#pen').style.setProperty('--pc', COL[s.penColor]);
  renderCards(); renderNotes(); renderInk();
}
function renderCards() {
  const s = st.set;
  S.chars.forEach(c => {
    const d = els[c.id], cu = st.cards[c.id] || {}, vis = c.a <= view;
    d.hidden = !vis; if (!vis) return;
    const p = st.pos[c.id] || { x: c.x, y: c.y };
    const w = (c.main ? 160 : 130) * s.cardSize;
    d.style.setProperty('--cw', w + 'px');
    d.style.setProperty('--phh', (c.main ? 104 : 80) * s.imgSize * s.cardSize + 'px');
    d.style.setProperty('--fs', 13.5 * s.fontSize * s.cardSize + 'px');
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    d.style.rotate = (hash(c.id) * s.tilt).toFixed(2) + 'deg';
    const bg = cu.bg ? CARD_BG[cu.bg] : null;
    if (bg) { const dark = lum(bg) < .35; d.style.setProperty('--bgc', bg); d.style.setProperty('--fg', dark ? '#f4efe4' : '#231a12'); d.style.setProperty('--fg2', dark ? '#cbbfa9' : '#5a4a3a'); }
    else ['--bgc', '--fg', '--fg2'].forEach(k => d.style.removeProperty(k));
    d.classList.toggle('dead', !!c.dead && view >= c.dead);
    d.querySelector('.nm').textContent = cu.n || c.n;
    d.querySelector('.rl').textContent = cu.r || roleAt(c, view);
    const ph = d.querySelector('.pht'), img = ph.querySelector('img');
    if (cu.img) { if (img.getAttribute('src') !== cu.img) img.src = cu.img; ph.classList.add('has'); }
    else { img.removeAttribute('src'); ph.classList.remove('has'); }
    d.setAttribute('aria-label', (cu.n || c.n) + ', ' + d.querySelector('.rl').textContent);
  });
  requestAnimationFrame(renderStrings);
}
function pinOf(id) {
  const d = els[id], c = byId(id), p = st.pos[id] || { x: c.x, y: c.y };
  const w = d.offsetWidth, h = d.offsetHeight, a = hash(id) * st.set.tilt * Math.PI / 180, dd = h / 2 - 7;
  const cx = p.x + w / 2, cy = p.y + h / 2;
  return [cx + dd * Math.sin(a), cy - dd * Math.cos(a)];
}
function renderStrings() {
  const s = st.set, col = COL[s.strColor];
  let out = '', pins = new Set();
  S.links.forEach(([a, b, step]) => {
    if (step > view || byId(a).a > view || byId(b).a > view) return;
    const [x1, y1] = pinOf(a), [x2, y2] = pinOf(b), len = Math.hypot(x2 - x1, y2 - y1);
    const sag = s.tension * len * .28;
    const w = a === 'jason' && b === 'lucia' ? 3.4 : 2;
    out += `<path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag} ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity=".92"/>`;
    pins.add(a); pins.add(b);
  });
  S.chars.forEach(c => { if (c.a <= view) pins.add(c.id); });
  const pc = COL[s.pinColor];
  pins.forEach(id => { const [x, y] = pinOf(id); out += `<circle cx="${x + 1.5}" cy="${y + 2.5}" r="6" fill="rgba(0,0,0,.35)"/><circle cx="${x}" cy="${y}" r="6.5" fill="${pc}" stroke="rgba(0,0,0,.45)" stroke-width="1"/><circle cx="${x - 2}" cy="${y - 2}" r="2" fill="rgba(255,255,255,.65)"/>`; });
  strSvg.innerHTML = out;
}
function renderTimeline() {
  const tl = $('#tl'); tl.max = st.now; tl.value = view;
  const s = S.steps[view];
  $('#capT').textContent = (view === st.now ? 'Now · ' : '') + 'Chapter ' + s.ch + ' · ' + s.title + '.';
  $('#capD').textContent = s.text;
}

/* ---------- scaling: board keeps a fixed virtual space so cards stay put relative to the map ---------- */
function layout() {
  const r = board.getBoundingClientRect();
  scale = Math.min(r.width / VW, r.height / VH);
  stage.style.transform = `translate(${(r.width - VW * scale) / 2}px,${(r.height - VH * scale) / 2}px) scale(${scale})`;
}
const ro = new ResizeObserver(layout);
function toVirtual(e) { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; }

/* ---------- dragging (cards + notes) ---------- */
function dragify(el, get, set, onClick) {
  el.addEventListener('pointerdown', e => {
    if (mode || e.button > 0) return;
    if (e.target.closest('.txt') && document.activeElement === e.target.closest('.txt')) return;
    const start = toVirtual(e), p0 = { ...get() }; let moved = false;
    el.setPointerCapture(e.pointerId);
    const mv = ev => {
      const v = toVirtual(ev), dx = v.x - start.x, dy = v.y - start.y;
      if (!moved && Math.hypot(dx, dy) * scale < 5) return;
      if (!moved) { moved = true; el.classList.add('drag'); hideNoteBar(); }
      const np = { x: Math.round(Math.min(VW - 40, Math.max(-60, p0.x + dx))), y: Math.round(Math.min(VH - 30, Math.max(-20, p0.y + dy))) };
      set(np); el.style.left = np.x + 'px'; el.style.top = np.y + 'px';
      renderStrings();
    };
    const up = () => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.classList.remove('drag');
      if (moved) save(); else onClick && onClick(e);
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
}

/* ---------- card panel ---------- */
function openCardPanel(id) {
  const c = byId(id), cu = st.cards[id] || {};
  openCard = id; closePanel('info');
  $('#cpName').textContent = cu.n || c.n;
  const ul = $('#cpFacts'); ul.innerHTML = '';
  c.f.filter(([s]) => s <= view).forEach(([, t]) => { const li = document.createElement('li'); li.textContent = t; ul.append(li); });
  if (!ul.children.length) ul.innerHTML = '<li>Nothing yet.</li>';
  $('#cpBg').innerHTML = '';
  Object.entries({ default: null, ...CARD_BG }).forEach(([k, v]) => {
    const b = document.createElement('button'); b.type = 'button';
    b.style.setProperty('--c', v || (c.note ? '#f2d96a' : '#f6f1e6')); b.title = k === 'default' ? 'Default' : k;
    b.setAttribute('aria-label', 'Card colour ' + b.title); b.setAttribute('aria-pressed', (cu.bg || 'default') === k);
    b.onclick = () => { custom(id).bg = k === 'default' ? undefined : k; save(); renderCards(); openCardPanel(id); };
    $('#cpBg').append(b);
  });
  $('#cpImgWrap').hidden = !!c.note;
  const kind = cu.img ? (cu.img.startsWith('data:') ? 'file' : 'url') : 'default';
  $$('input[name=img]').forEach(r => r.checked = r.value === kind);
  $('#cpUrlRow').hidden = kind !== 'url'; $('#cpUrl').value = kind === 'url' ? cu.img : '';
  $('#cpN').value = cu.n || c.n; $('#cpR').value = cu.r || roleAt(c, view);
  $('#cardPanel').hidden = false;
}
$$('input[name=img]').forEach(r => r.addEventListener('change', () => {
  const id = openCard; if (!id) return;
  $('#cpUrlRow').hidden = r.value !== 'url';
  if (r.value === 'default') { delete custom(id).img; save(); renderCards(); }
  if (r.value === 'file') $('#cpFile').click();
  if (r.value === 'url') $('#cpUrl').focus();
}));
$('#cpFile').addEventListener('change', e => {
  const f = e.target.files[0], id = openCard; if (!f || !id) return;
  const im = new Image();
  im.onload = () => {
    const k = Math.min(1, 360 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
    cv.width = im.width * k; cv.height = im.height * k; cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    custom(id).img = cv.toDataURL('image/jpeg', .82); URL.revokeObjectURL(im.src); e.target.value = ''; save(); renderCards();
  };
  im.src = URL.createObjectURL(f);
});
$('#cpUrlGo').addEventListener('click', () => {
  const u = $('#cpUrl').value.trim();
  if (!/^https?:\/\//i.test(u)) { toast('Paste a link that starts with https://'); return; }
  custom(openCard).img = u; save(); renderCards();
});
$('#cpN').addEventListener('input', e => { const c = byId(openCard); custom(openCard).n = e.target.value && e.target.value !== c.n ? e.target.value : undefined; $('#cpName').textContent = e.target.value || c.n; save(); renderCards(); });
$('#cpR').addEventListener('input', e => { const c = byId(openCard); custom(openCard).r = e.target.value && e.target.value !== roleAt(c, view) ? e.target.value : undefined; save(); renderCards(); });
$('#cpReset').addEventListener('click', () => { delete st.cards[openCard]; delete st.pos[openCard]; save(); renderCards(); openCardPanel(openCard); });

function closePanel(id) { $('#' + id).hidden = true; if (id === 'info') $('#infoBtn').setAttribute('aria-expanded', 'false'); if (id === 'cardPanel') openCard = null; }
$$('[data-close]').forEach(b => b.addEventListener('click', () => closePanel(b.dataset.close)));

/* ---------- settings panel ---------- */
function swatches(el, key, labelPrefix) {
  el.innerHTML = '';
  Object.entries(COL).forEach(([k, v]) => {
    const b = document.createElement('button'); b.type = 'button'; b.style.setProperty('--c', v);
    b.setAttribute('aria-label', labelPrefix + ' ' + k); b.setAttribute('aria-pressed', st.set[key] === k);
    b.onclick = () => { st.set[key] = k; save(); applySettings(); swatches(el, key, labelPrefix); };
    el.append(b);
  });
}
function syncSettings() {
  const s = st.set;
  $('#sCard').value = s.cardSize; $('#sImg').value = s.imgSize; $('#sFont').value = s.fontSize; $('#sTilt').value = s.tilt; $('#sTen').value = s.tension;
  $('#sRound').checked = s.rounded; $('#sRound').disabled = s.shape === 'circle'; $('#sRound').closest('label').classList.toggle('dis', s.shape === 'circle');
  ['shape', 'style', 'font', 'bg', 'frame'].forEach(k => $$(`input[name=${k}]`).forEach(r => r.checked = r.value === s[k]));
  swatches($('#swStr'), 'strColor', 'String'); swatches($('#swPin'), 'pinColor', 'Pin'); swatches($('#swPen'), 'penColor', 'Marker');
}
[['#sCard', 'cardSize'], ['#sImg', 'imgSize'], ['#sFont', 'fontSize'], ['#sTilt', 'tilt'], ['#sTen', 'tension']].forEach(([sel, k]) =>
  $(sel).addEventListener('input', e => { st.set[k] = +e.target.value; save(); applySettings(); }));
$('#sRound').addEventListener('change', e => { st.set.rounded = e.target.checked; save(); applySettings(); });
['shape', 'style', 'font', 'bg', 'frame'].forEach(k => $$(`input[name=${k}]`).forEach(r => r.addEventListener('change', () => { st.set[k] = r.value; save(); applySettings(); syncSettings(); })));
$('#infoBtn').addEventListener('click', () => {
  const p = $('#info'), open = p.hidden; closePanel('cardPanel'); p.hidden = !open; $('#infoBtn').setAttribute('aria-expanded', open);
});
$('#lampBtn').addEventListener('click', () => { st.set.lamp = !st.set.lamp; save(); applySettings(); });
$('#resetLayout').addEventListener('click', () => { st.pos = {}; save(); renderCards(); toast('Cards are back in their original places.'); });
$('#clearInk').addEventListener('click', () => { const old = st.ink; st.ink = []; save(); renderInk(); toast('Drawings cleared.', 'Undo', () => { st.ink = old; save(); renderInk(); }); });

/* ---------- timeline + progress update ---------- */
$('#tl').addEventListener('input', e => { view = +e.target.value; renderTimeline(); renderCards(); if (openCard) openCardPanel(openCard); });
$('#updBtn').addEventListener('click', () => { $('#uCh').value = S.steps[st.now].ch; $('#uTxt').value = ''; $('#uMsg').textContent = ''; $('#uMsg').className = 'status'; $('#upd').classList.add('on'); $('#uTxt').focus(); });
$('#uCancel').addEventListener('click', () => $('#upd').classList.remove('on'));
$('#uGo').addEventListener('click', () => {
  const msg = $('#uMsg'), v = $('#uCh').value.trim();
  if (!/^\d{1,3}$/.test(v) || +v < 1) { msg.textContent = 'Enter a chapter number, e.g. 3.'; msg.className = 'status no'; return; }
  const ch = Math.min(+v, SB.maxChapter(S)), cur = S.steps[st.now].ch;
  const base = ch > cur ? SB.chapterStart(S, ch) : st.now;
  const m = SB.match(S, $('#uTxt').value, st.now, SB.chapterEnd(S, ch));
  const next = Math.max(base, m);
  if (next <= st.now) {
    msg.textContent = $('#uTxt').value.trim() ? "Couldn't recognize that yet. Try a mission name or a character you just met." : 'Nothing new to add. Describe what happened, or enter a later chapter.';
    msg.className = 'status no'; return;
  }
  undoNow = st.now; st.now = next; view = next; save();
  $('#upd').classList.remove('on'); renderTimeline(); renderCards();
  toast('Board updated. New things are pinned up.', 'Undo', () => { st.now = undoNow; view = undoNow; save(); renderTimeline(); renderCards(); });
});

/* ---------- ink: marker + eraser ---------- */
function setMode(m) {
  mode = mode === m ? null : m;
  $('#pen').setAttribute('aria-pressed', mode === 'pen'); $('#eraser').setAttribute('aria-pressed', mode === 'erase');
  board.classList.toggle('drawing', mode === 'pen'); board.classList.toggle('erasing', mode === 'erase');
  if (mode) hideNoteBar();
}
$('#pen').addEventListener('click', () => setMode('pen'));
$('#eraser').addEventListener('click', () => setMode('erase'));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (mode) setMode(mode); closePanel('info'); closePanel('cardPanel'); $('#upd').classList.remove('on'); hideNoteBar(); } });
function strokePath(s) { return s.p.map((pt, i) => (i ? 'L' : 'M') + pt[0] + ' ' + pt[1]).join(''); }
function renderInk() { ink.innerHTML = st.ink.map(s => `<path d="${strokePath(s)}" fill="none" stroke="${COL[s.c]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`).join(''); }
board.addEventListener('pointerdown', e => {
  if (!mode || e.target.closest('.panel,#noteBar')) return; e.preventDefault(); e.stopPropagation(); board.setPointerCapture(e.pointerId);
  let cur = null;
  const at = ev => { const v = toVirtual(ev); return [Math.round(v.x * 10) / 10, Math.round(v.y * 10) / 10]; };
  if (mode === 'pen') { cur = { c: st.set.penColor, p: [at(e)] }; st.ink.push(cur); }
  const erase = pt => { const before = st.ink.length; st.ink = st.ink.filter(s => !s.p.some(q => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < 14)); if (st.ink.length !== before) renderInk(); };
  if (mode === 'erase') erase(at(e));
  const mv = ev => { const pt = at(ev); if (cur) { cur.p.push(pt); renderInk(); } else erase(pt); };
  const up = () => { board.removeEventListener('pointermove', mv); board.removeEventListener('pointerup', up); board.removeEventListener('pointercancel', up); if (cur && cur.p.length < 2) cur.p.push([cur.p[0][0] + .5, cur.p[0][1] + .5]); renderInk(); save(); };
  board.addEventListener('pointermove', mv); board.addEventListener('pointerup', up); board.addEventListener('pointercancel', up);
}, true);

/* ---------- sticky notes ---------- */
function renderNotes() {
  notesEl.innerHTML = '';
  st.notes.forEach(n => {
    const d = document.createElement('div');
    d.className = `note ${n.size} ${n.color} font-${n.font}` + (selNote === n.id ? ' sel' : '');
    d.style.left = n.x + 'px'; d.style.top = n.y + 'px'; d.style.rotate = n.rot + 'deg';
    const t = document.createElement('div'); t.className = 'txt'; t.contentEditable = 'true'; t.spellcheck = false; t.textContent = n.text || '';
    t.addEventListener('input', () => { n.text = t.innerText; save(); });
    t.addEventListener('focus', () => selectNote(n.id, d));
    d.append(t); notesEl.append(d);
    dragify(d, () => ({ x: n.x, y: n.y }), p => { n.x = p.x; n.y = p.y; }, ev => { selectNote(n.id, d); if (!ev.target.closest('.txt')) t.focus(); });
  });
}
function selectNote(id, el) {
  selNote = id; $$('.note').forEach(x => x.classList.remove('sel')); el.classList.add('sel');
  const n = st.notes.find(x => x.id === id), bar = $('#noteBar'), br = board.getBoundingClientRect(), r = el.getBoundingClientRect();
  bar.hidden = false;
  $$('#noteBar .seg').forEach(seg => [...seg.children].forEach(b => b.setAttribute('aria-pressed', n[seg.dataset.k] === b.dataset.v)));
  const left = Math.max(6, Math.min(br.width - bar.offsetWidth - 6, r.left - br.left));
  const top = r.top - br.top - bar.offsetHeight - 10;
  bar.style.left = left + 'px'; bar.style.top = (top < 6 ? r.bottom - br.top + 10 : top) + 'px';
}
function hideNoteBar() { $('#noteBar').hidden = true; selNote = null; $$('.note').forEach(x => x.classList.remove('sel')); }
$$('#noteBar .seg button').forEach(b => b.addEventListener('click', () => {
  const n = st.notes.find(x => x.id === selNote); if (!n) return;
  n[b.parentNode.dataset.k] = b.dataset.v; save(); const id = n.id; renderNotes();
  const el = [...notesEl.children][st.notes.indexOf(n)]; selectNote(id, el);
}));
$('#noteDel').addEventListener('click', () => {
  const i = st.notes.findIndex(x => x.id === selNote); if (i < 0) return;
  const [gone] = st.notes.splice(i, 1); save(); hideNoteBar(); renderNotes();
  toast('Note deleted.', 'Undo', () => { st.notes.splice(i, 0, gone); save(); renderNotes(); });
});
board.addEventListener('pointerdown', e => { if (!e.target.closest('.note,#noteBar')) hideNoteBar(); });
$$('.pad').forEach(pad => pad.addEventListener('pointerdown', e => {
  e.preventDefault(); const color = pad.dataset.color;
  const g = document.createElement('div'); g.className = 'ghost'; g.style.background = color === 'blue' ? '#c3e2f4' : '#fde96b';
  const place = ev => { g.style.left = ev.clientX + 'px'; g.style.top = ev.clientY + 'px'; };
  place(e); document.body.append(g); pad.setPointerCapture(e.pointerId);
  const mv = ev => place(ev);
  const up = ev => {
    pad.removeEventListener('pointermove', mv); pad.removeEventListener('pointerup', up); g.remove();
    const br = board.getBoundingClientRect();
    if (ev.clientX < br.left || ev.clientX > br.right || ev.clientY < br.top || ev.clientY > br.bottom) { toast('Drop the note onto the board.'); return; }
    const v = toVirtual(ev), n = { id: 'n' + Date.now(), x: Math.round(v.x - 75), y: Math.round(v.y - 75), color, size: 'M', font: 'hand', text: '', rot: +(Math.random() * 6 - 3).toFixed(1) };
    st.notes.push(n); save(); renderNotes();
    const el = notesEl.lastElementChild; el.querySelector('.txt').focus(); selectNote(n.id, el);
  };
  pad.addEventListener('pointermove', mv); pad.addEventListener('pointerup', up);
}));

/* ---------- start ---------- */
(async () => {
  st = SB.getState(GAME);
  if (st.now == null) { location.replace('index.html'); return; }
  try { S = await SB.load(GAME); } catch (e) { document.body.innerHTML = '<p style="padding:40px">Could not load the story data. <a href="index.html">Back</a></p>'; return; }
  st.now = Math.min(st.now, S.steps.length - 1);
  st.set = Object.assign({}, DEF, st.set || {}); st.pos = st.pos || {}; st.cards = st.cards || {}; st.ink = st.ink || []; st.notes = st.notes || [];
  view = st.now;
  buildCards(); syncSettings(); applySettings(); renderTimeline();
  ro.observe(board); layout();
  document.fonts && document.fonts.ready.then(renderStrings);
  save();
})();
}
