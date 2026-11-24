/* Stringboard board page */
{
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const GAME = new URLSearchParams(location.search).get('game') || 'gta6';
const VW = 1100, VH = 1000;
const COL = { red: '#c0262d', yellow: '#f2c230', green: '#3c9a4a', blue: '#2f6fc0', white: '#f4f2ee', black: '#1c1c1c' };
const CARD_BG = { white: '#ffffff', cream: '#f3ead7', tan: '#c9a67a', slate: '#3d3f44', black: '#141414' };
const DEF = { cardSize: 1, imgSize: 1, shape: 'rect', rounded: false, cardRounded: false, style: 'authentic', font: 'sans', fontSize: 1, tilt: 3, bg: 'cork', frame: 'darkwood', strColor: 'red', tension: .25, pinColor: 'red', penColor: 'red', penSize: 'fine', lamp: false };

let IMGS = {};
let S, st, view, scale = 1, mode = null, selNote = null, openCard = null, undoNow = null;
const board = $('#board'), stage = $('#stage'), cardsEl = $('#cards'), notesEl = $('#notes'), strSvg = $('#strings'), ink = $('#ink'), pinSvg = $('#pins');
const els = {};

let saveT;
function save() {
  clearTimeout(saveT); saveT = setTimeout(() => { if (!SB.setState(GAME, st)) toast('Could not save – browser storage is full.'); }, 250);
  if (!hist.mute) { clearTimeout(hist.t); hist.t = setTimeout(commitHist, 600); }
}
/* ---------- undo / redo: snapshots of the board, last 10 actions. Rapid changes (sliders, typing) group into one step. ---------- */
const HIST_MAX = 10;
const hist = { u: [], r: [], last: null, t: null, mute: false };
function commitHist() {
  const cur = JSON.stringify(st);
  if (hist.last === null) { hist.last = cur; return; }
  if (cur === hist.last) return;
  hist.u.push(hist.last); if (hist.u.length > HIST_MAX) hist.u.shift();
  hist.r = []; hist.last = cur; updHistBtns();
}
function updHistBtns() { $('#undoBtn').disabled = !hist.u.length; $('#redoBtn').disabled = !hist.r.length; }
function restore(json) {
  hist.last = json; st = JSON.parse(json); view = st.now;
  hist.mute = true; save(); hist.mute = false;
  hideNoteBar(); syncSettings(); applySettings(); renderTimeline();
  if (openCard) { if (els[openCard] && !els[openCard].hidden) openCardPanel(openCard); else closePanel('cardPanel'); }
  updHistBtns();
}
function undo() { clearTimeout(hist.t); commitHist(); if (!hist.u.length) return; hist.r.push(hist.last); restore(hist.u.pop()); }
function redo() { clearTimeout(hist.t); commitHist(); if (!hist.r.length) return; hist.u.push(hist.last); restore(hist.r.pop()); }
function toast(msg, action, fn) {
  const t = $('#toast'); t.innerHTML = ''; t.append(msg);
  if (action) { const b = document.createElement('sl-button'); b.size = 'small'; b.variant = 'primary'; b.outline = true; b.textContent = action; b.onclick = () => { fn(); t.classList.remove('on'); }; t.append(b); }
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
    d.innerHTML = `<div class="pht">${sil(c)}<img alt="" referrerpolicy="no-referrer" draggable="false"><i class="xx"></i></div><div class="nm"></div><div class="rl"></div><svg class="cink" aria-hidden="true"></svg>`;
    d.querySelector('img').addEventListener('error', e => { e.target.parentNode.classList.remove('has'); });
    cardsEl.append(d); els[c.id] = d;
    dragify(d, () => st.pos[c.id] || { x: c.x, y: c.y }, p => { st.pos[c.id] = p; }, () => openCardPanel(c.id));
    d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCardPanel(c.id); } });
  });
}
const byId = id => S.chars.find(c => c.id === id);
const custom = id => (st.cards[id] = st.cards[id] || {});
/* Stacking: cards under strings 10+, strings 500, cards over strings 600+, notes 900, pins 1000. Last moved card is highest in its layer. */
function cardZ(id) { const i = st.order.indexOf(id); return ((st.cards[id] || {}).over ? 600 : 10) + (i < 0 ? 0 : i + 1); }
function bringToFront(id) { st.order = st.order.filter(x => x !== id).concat(id); S.chars.forEach(c => { els[c.id].style.zIndex = cardZ(c.id); }); }
function roleAt(c, v) { let r = c.r; (c.rs || []).forEach(([s, t]) => { if (s <= v) r = t; }); return r; }

/* ---------- render ---------- */
function applySettings() {
  const s = st.set;
  stage.className = 'stage st-' + s.style + ' font-' + s.font + (s.shape === 'circle' ? ' st-circle' : '') + (s.rounded && s.shape !== 'circle' ? ' st-rounded' : '') + (s.cardRounded ? ' st-cardround' : '');
  board.className = 'board bg-' + s.bg;
  $('#frame').className = 'frame f-' + s.frame;
  document.body.classList.toggle('lamp-on', s.lamp);
  $('#lampBtn').checked = s.lamp;
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
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; d.style.zIndex = cardZ(c.id);
    d.style.rotate = (hash(c.id) * s.tilt).toFixed(2) + 'deg';
    const bg = cu.bg ? CARD_BG[cu.bg] : null;
    if (bg) { const dark = lum(bg) < .35; d.style.setProperty('--bgc', bg); d.style.setProperty('--fg', dark ? '#f4efe4' : '#231a12'); d.style.setProperty('--fg2', dark ? '#cbbfa9' : '#5a4a3a'); }
    else ['--bgc', '--fg', '--fg2'].forEach(k => d.style.removeProperty(k));
    d.classList.toggle('dead', !!c.dead && view >= c.dead);
    d.querySelector('.nm').textContent = cu.n || c.n;
    d.querySelector('.rl').textContent = cu.r || roleAt(c, view);
    const ph = d.querySelector('.pht'), img = ph.querySelector('img');
    const src = cu.img || (IMGS[c.id] && IMGS[c.id].url);
    if (src) { if (img.getAttribute('src') !== src) img.src = src; ph.classList.add('has'); }
    else { img.removeAttribute('src'); ph.classList.remove('has'); }
    d.setAttribute('aria-label', (cu.n || c.n) + ', ' + d.querySelector('.rl').textContent);
  });
  requestAnimationFrame(() => S.chars.forEach(c => renderCardInk(c.id)));
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
  const pc = COL[s.pinColor]; let pout = '';
  pins.forEach(id => { const [x, y] = pinOf(id); pout += `<circle cx="${x + 1.5}" cy="${y + 2.5}" r="6" fill="rgba(0,0,0,.35)"/><circle cx="${x}" cy="${y}" r="6.5" fill="${pc}" stroke="rgba(0,0,0,.45)" stroke-width="1"/><circle cx="${x - 2}" cy="${y - 2}" r="2" fill="rgba(255,255,255,.65)"/>`; });
  strSvg.innerHTML = out; pinSvg.innerHTML = pout;
}
function renderTimeline() {
  const tl = $('#tl'); tl.max = st.now; tl.value = view;
  const s = S.steps[view];
  $('#capT').textContent = (view === st.now ? 'Now · ' : '') + 'Chapter ' + s.ch + ' · ' + s.title + '.';
  $('#capD').textContent = s.text;
  requestAnimationFrame(fitCaption);
}
/* Show a "…" button only when the description doesn't fit on one line. */
function fitCaption() {
  const cap = $('#cap'), txt = $('#capTxt'), btn = $('#capMore');
  if (cap.classList.contains('open')) { btn.hidden = false; return; }
  btn.hidden = txt.scrollWidth <= txt.clientWidth + 1;
}
$('#capMore').addEventListener('click', () => {
  const cap = $('#cap'), open = !cap.classList.contains('open');
  cap.classList.toggle('open', open);
  const b = $('#capMore'); b.setAttribute('aria-expanded', open); b.textContent = open ? 'Less' : '…';
  b.setAttribute('aria-label', open ? 'Show less' : 'Show full description');
  if (!open) fitCaption();
});

/* ---------- scaling: board keeps a fixed virtual space so cards stay put relative to the map ---------- */
/* zoom + pan (not part of the saved board) */
let zoom = 1; const pan = { x: 0, y: 0 }; const ZMIN = 0.5, ZMAX = 3;
/* visible cards in board space: bounding box + centre point */
function cardsBox() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sx = 0, sy = 0, n = 0;
  (S ? S.chars : []).forEach(c => {
    const d = els[c.id]; if (!d || d.hidden) return;
    const p = st.pos[c.id] || { x: c.x, y: c.y }, w = d.offsetWidth, h = d.offsetHeight;
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + w); y1 = Math.max(y1, p.y + h);
    sx += p.x + w / 2; sy += p.y + h / 2; n++;
  });
  return n ? { x0, y0, x1, y1, cx: sx / n, cy: sy / n } : null;
}
/* never let panning push the centre of all cards out of view */
function clampPan(r) {
  const b = cardsBox(); if (!b) return;
  const tx = (r.width - VW * scale) / 2, ty = (r.height - VH * scale) / 2;
  const sx = tx + pan.x + b.cx * scale, sy = ty + pan.y + b.cy * scale;
  if (sx < 0) pan.x -= sx; if (sx > r.width) pan.x -= sx - r.width;
  if (sy < 0) pan.y -= sy; if (sy > r.height) pan.y -= sy - r.height;
}
function layout() {
  const r = board.getBoundingClientRect();
  scale = Math.min(r.width / VW, r.height / VH) * zoom;
  clampPan(r);
  stage.style.transform = `translate(${(r.width - VW * scale) / 2 + pan.x}px,${(r.height - VH * scale) / 2 + pan.y}px) scale(${scale})`;
  $('#zPct').textContent = Math.round(zoom * 100) + '%';
  board.classList.toggle('zoomed', zoom > 1);
}
function zoomTo(z, cx, cy) {
  const r = board.getBoundingClientRect();
  z = Math.min(ZMAX, Math.max(ZMIN, z));
  if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  const v = toVirtual({ clientX: cx, clientY: cy });
  const base = Math.min(r.width / VW, r.height / VH), s2 = base * z;
  pan.x = (cx - r.left) - v.x * s2 - (r.width - VW * s2) / 2;
  pan.y = (cy - r.top) - v.y * s2 - (r.height - VH * s2) / 2;
  if (z === 1) { pan.x = 0; pan.y = 0; }
  zoom = z; layout(); if (openCard) placeCardPanel(openCard); hideNoteBar();
}
$('#zIn').addEventListener('click', () => zoomTo(zoom * 1.25));
$('#zOut').addEventListener('click', () => zoomTo(zoom / 1.25));
$('#zFit').addEventListener('click', () => {
  const b = cardsBox(); if (!b) return;
  const r = board.getBoundingClientRect(), base = Math.min(r.width / VW, r.height / VH), M = 10;
  const s = Math.min((r.width - 2 * M) / (b.x1 - b.x0), (r.height - 2 * M) / (b.y1 - b.y0));
  zoom = Math.min(ZMAX, Math.max(ZMIN, s / base)); const s2 = base * zoom;
  pan.x = r.width / 2 - ((b.x0 + b.x1) / 2) * s2 - (r.width - VW * s2) / 2;
  pan.y = r.height / 2 - ((b.y0 + b.y1) / 2) * s2 - (r.height - VH * s2) / 2;
  layout(); if (openCard) placeCardPanel(openCard); hideNoteBar();
});
$('#zPct').addEventListener('click', () => { pan.x = pan.y = 0; zoomTo(1); });
board.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomTo(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY); }, { passive: false });
/* drag the empty board to pan */
board.addEventListener('pointerdown', e => {
  if (mode || e.button > 0 || e.target.closest('.card,.note,.panel,#noteBar,.zoom')) return;
  const sx = e.clientX, sy = e.clientY, p0 = { ...pan }; let moved = false;
  const mv = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; board.classList.add('panning'); pan.x = p0.x + dx; pan.y = p0.y + dy; layout(); };
  const up = () => { board.removeEventListener('pointermove', mv); board.removeEventListener('pointerup', up); board.removeEventListener('pointercancel', up); board.classList.remove('panning'); if (moved && openCard) placeCardPanel(openCard); };
  board.setPointerCapture(e.pointerId); board.addEventListener('pointermove', mv); board.addEventListener('pointerup', up); board.addEventListener('pointercancel', up);
});
const ro = new ResizeObserver(() => { layout(); fitCaption(); if (openCard) placeCardPanel(openCard); });
function toVirtual(e) { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; }

/* ---------- dragging (cards + notes) ---------- */
function dragify(el, get, set, onClick) {
  el.addEventListener('pointerdown', e => {
    if (mode || e.button > 0) return;
    if (e.target.closest('.txt') && document.activeElement === e.target.closest('.txt')) return;
    if (!e.target.closest('.txt')) e.preventDefault();
    const start = toVirtual(e), p0 = { ...get() }; let moved = false;
    el.setPointerCapture(e.pointerId);
    const mv = ev => {
      const v = toVirtual(ev), dx = v.x - start.x, dy = v.y - start.y;
      if (!moved && Math.hypot(dx, dy) * scale < 5) return;
      if (!moved) { moved = true; el.classList.add('drag'); hideNoteBar(); if (el.classList.contains('card')) bringToFront(el.dataset.id); }
      const np = { x: Math.round(Math.min(VW - 40, Math.max(-60, p0.x + dx))), y: Math.round(Math.min(VH - 30, Math.max(-20, p0.y + dy))) };
      set(np); el.style.left = np.x + 'px'; el.style.top = np.y + 'px';
      renderStrings();
    };
    const up = ev => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.classList.remove('drag');
      if (ev.type === 'pointercancel' && !moved) return;
      if (moved) { save(); if (openCard && el.dataset.id === openCard) placeCardPanel(openCard); } else onClick && onClick(e);
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
  $('#cpLayer').value = cu.over ? 'over' : 'under';
  $('#cpImgWrap').hidden = !!c.note;
  const def = IMGS[id]; $('#cpCredit').hidden = !(def && def.credit && !cu.img); $('#cpCredit').textContent = def && def.credit ? 'Default image: ' + def.credit : '';
  const kind = cu.img ? (cu.img.startsWith('data:') ? 'file' : 'url') : 'default';
  $$('#cpImg sl-button').forEach(b => b.variant = b.dataset.v === kind ? 'primary' : 'default');
  $('#cpUrlRow').hidden = kind !== 'url'; $('#cpUrl').value = kind === 'url' ? cu.img : '';
  $('#cpN').value = cu.n || c.n; $('#cpR').value = cu.r || roleAt(c, view);
  $('#cardPanel').hidden = false;
  placeCardPanel(id);
}
/* Put the card panel on whichever side of the board has room, so it never covers the card itself. */
function placeCardPanel(id) {
  const p = $('#cardPanel'), d = els[id];
  if (!d || d.hidden) { closePanel('cardPanel'); return; }
  const br = board.getBoundingClientRect(), cr = d.getBoundingClientRect(), m = 8, W = Math.min(340, br.width - 2 * m);
  const sp = { right: br.right - cr.right, left: cr.left - br.left, bottom: br.bottom - cr.bottom, top: cr.top - br.top };
  Object.assign(p.style, { left: 'auto', right: 'auto', top: 'auto', bottom: 'auto', width: 'auto', height: 'auto' });
  let side = sp.right >= W + 2 * m ? 'right' : sp.left >= W + 2 * m ? 'left' : null;
  if (!side) side = Object.entries({ right: sp.right * br.height, left: sp.left * br.height, bottom: sp.bottom * br.width, top: sp.top * br.width }).sort((a, b) => b[1] - a[1])[0][0];
  if (side === 'right' || side === 'left') {
    const w = Math.min(W, sp[side] - 2 * m);
    Object.assign(p.style, { [side]: m + 'px', top: m + 'px', bottom: m + 'px', width: Math.max(w, 160) + 'px' });
  } else {
    Object.assign(p.style, { left: m + 'px', right: m + 'px' });
    if (side === 'bottom') Object.assign(p.style, { top: (cr.bottom - br.top + m) + 'px', bottom: m + 'px' });
    else Object.assign(p.style, { top: m + 'px', bottom: (br.bottom - cr.top + m) + 'px' });
  }
}
$$('#cpImg sl-button').forEach(b => b.addEventListener('click', () => {
  const id = openCard, v = b.dataset.v; if (!id) return;
  $('#cpUrlRow').hidden = v !== 'url';
  if (v === 'default') { delete custom(id).img; save(); renderCards(); openCardPanel(id); }
  if (v === 'file') $('#cpFile').click();
  if (v === 'url') { $$('#cpImg sl-button').forEach(x => x.variant = x === b ? 'primary' : 'default'); setTimeout(() => $('#cpUrl').focus(), 50); }
}));
/* Image helpers: file -> small jpeg data URL, or an http(s) link. Images stay in this browser only. */
function setCardImageFromFile(id, f) {
  if (!f || !f.type.startsWith('image/')) { toast('That is not an image file.'); return; }
  const im = new Image();
  im.onload = () => {
    const k = Math.min(1, 360 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
    cv.width = im.width * k; cv.height = im.height * k; cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    custom(id).img = cv.toDataURL('image/jpeg', .82); URL.revokeObjectURL(im.src); save(); renderCards();
    if (openCard === id) openCardPanel(id);
  };
  im.onerror = () => toast('Could not read that image.');
  im.src = URL.createObjectURL(f);
}
function setCardImageFromUrl(id, u) {
  u = (u || '').trim().split(/\s+/)[0];
  if (!/^https?:\/\//i.test(u)) return false;
  custom(id).img = u; save(); renderCards(); if (openCard === id) openCardPanel(id); return true;
}
$('#cpFile').addEventListener('change', e => { if (openCard) setCardImageFromFile(openCard, e.target.files[0]); e.target.value = ''; });
$('#cpUrl').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#cpUrlGo').click(); } });
$('#cpUrlGo').addEventListener('click', () => { if (!setCardImageFromUrl(openCard, $('#cpUrl').value)) toast('Paste a link that starts with https://'); });

/* Drop an image file or image link onto a card */
let hoverCard = null;
cardsEl.addEventListener('pointerover', e => { const c = e.target.closest('.card'); hoverCard = c && !c.classList.contains('note-card') ? c.dataset.id : null; });
cardsEl.addEventListener('pointerleave', () => { hoverCard = null; });
cardsEl.addEventListener('dragover', e => {
  const c = e.target.closest('.card'); if (!c || c.classList.contains('note-card')) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  $$('.card.dropping').forEach(x => x !== c && x.classList.remove('dropping')); c.classList.add('dropping');
});
cardsEl.addEventListener('dragleave', e => { const c = e.target.closest('.card'); if (c && !c.contains(e.relatedTarget)) c.classList.remove('dropping'); });
cardsEl.addEventListener('drop', e => {
  const c = e.target.closest('.card'); if (!c || c.classList.contains('note-card')) return;
  e.preventDefault(); c.classList.remove('dropping');
  const id = c.dataset.id, f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
  if (f) { setCardImageFromFile(id, f); return; }
  const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  const html = e.dataTransfer.getData('text/html'), m = html && html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!setCardImageFromUrl(id, m ? m[1] : u)) toast('Drop an image file or an image link.');
});

/* Paste an image or a link while a card is open, hovered or focused */
document.addEventListener('paste', e => {
  const t = e.target;
  if (t.closest && t.closest('input,textarea,[contenteditable=true]')) return;
  const focusCard = document.activeElement && document.activeElement.closest && document.activeElement.closest('.card');
  const id = openCard || hoverCard || (focusCard && focusCard.dataset.id);
  if (!id || byId(id).note) return;
  const items = [...(e.clipboardData && e.clipboardData.items || [])];
  const img = items.find(i => i.kind === 'file' && i.type.startsWith('image/'));
  if (img) { e.preventDefault(); setCardImageFromFile(id, img.getAsFile()); toast('Image added to ' + (custom(id).n || byId(id).n) + '.'); return; }
  const txt = e.clipboardData.getData('text/plain');
  if (setCardImageFromUrl(id, txt)) { e.preventDefault(); toast('Image added to ' + (custom(id).n || byId(id).n) + '.'); }
});
$('#cpN').addEventListener('sl-input', e => { const c = byId(openCard); custom(openCard).n = e.target.value && e.target.value !== c.n ? e.target.value : undefined; $('#cpName').textContent = e.target.value || c.n; save(); renderCards(); });
$('#cpR').addEventListener('sl-input', e => { const c = byId(openCard); custom(openCard).r = e.target.value && e.target.value !== roleAt(c, view) ? e.target.value : undefined; save(); renderCards(); });
$('#cpLayer').addEventListener('sl-change', e => { if (!openCard) return; custom(openCard).over = e.target.value === 'over' || undefined; bringToFront(openCard); save(); renderCards(); });
$('#cpReset').addEventListener('click', () => { delete st.cards[openCard]; delete st.pos[openCard]; save(); renderCards(); openCardPanel(openCard); });

function applyPendingUrl() {
  if (!openCard || $('#cpUrlRow').hidden) return;
  const v = String($('#cpUrl').value || '').trim(), cur = (st.cards[openCard] || {}).img;
  if (v && v !== cur && !setCardImageFromUrl(openCard, v)) toast('Paste a link that starts with https://');
}
function closePanel(id) { if (id === 'cardPanel') applyPendingUrl(); $('#' + id).hidden = true; if (id === 'info') $('#infoBtn').setAttribute('aria-expanded', 'false'); if (id === 'cardPanel') openCard = null; }
$$('[data-close]').forEach(b => b.addEventListener('click', () => closePanel(b.dataset.close)));
document.addEventListener('pointerdown', e => {
  const t = e.target;
  if (!$('#info').hidden && !t.closest('#info,#infoBtn')) closePanel('info');
  if (!$('#cardPanel').hidden && !t.closest('#cardPanel,.card,#toast')) closePanel('cardPanel');
}, true);

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
  $('#sCardRound').checked = s.cardRounded;
  $('#sRound').checked = s.rounded; $('#sRound').disabled = s.shape === 'circle';
  ['shape', 'style', 'font', 'bg', 'frame'].forEach(k => { $('#g-' + k).value = s[k]; });
  swatches($('#swStr'), 'strColor', 'String'); swatches($('#swPin'), 'pinColor', 'Pin'); swatches($('#swPen'), 'penColor', 'Marker');
}
[['#sCard', 'cardSize'], ['#sImg', 'imgSize'], ['#sFont', 'fontSize'], ['#sTilt', 'tilt'], ['#sTen', 'tension']].forEach(([sel, k]) =>
  $(sel).addEventListener('sl-input', e => { st.set[k] = +e.target.value; save(); applySettings(); }));
$('#sRound').addEventListener('sl-change', e => { st.set.rounded = e.target.checked; save(); applySettings(); });
$('#sCardRound').addEventListener('sl-change', e => { st.set.cardRounded = e.target.checked; save(); applySettings(); });
['shape', 'style', 'font', 'bg', 'frame'].forEach(k => $('#g-' + k).addEventListener('sl-change', e => { st.set[k] = e.target.value; save(); applySettings(); syncSettings(); }));
$('#infoBtn').addEventListener('click', () => {
  const p = $('#info'), open = p.hidden; closePanel('cardPanel'); p.hidden = !open; $('#infoBtn').setAttribute('aria-expanded', open);
});
$('#lampBtn').addEventListener('sl-change', e => { st.set.lamp = e.target.checked; save(); applySettings(); });
$('#resetStyles').addEventListener('click', () => {
  const oldSet = st.set, oldBg = {};
  Object.entries(st.cards).forEach(([id, cu]) => { if (cu.bg) { oldBg[id] = cu.bg; delete cu.bg; } });
  st.set = Object.assign({}, DEF, { penColor: oldSet.penColor });
  save(); syncSettings(); applySettings();
  toast('Cards and board are back to default styles.', 'Undo', () => {
    st.set = oldSet; Object.entries(oldBg).forEach(([id, bg]) => custom(id).bg = bg); save(); syncSettings(); applySettings();
  });
});
$('#resetLayout').addEventListener('click', () => { st.pos = {}; save(); renderCards(); toast('Cards are back in their original places.'); });
$('#clearInk').addEventListener('click', () => { const old = st.ink, oldC = st.cardInk; st.ink = []; st.cardInk = {}; save(); renderInk(); renderCards(); toast('Drawings cleared.', 'Undo', () => { st.ink = old; st.cardInk = oldC; save(); renderInk(); renderCards(); }); });

/* ---------- save to file / open saved file ---------- */
$('#exportBtn').addEventListener('click', () => {
  const data = { app: 'stringboard', version: 1, game: GAME, saved: new Date().toISOString(), state: st };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `stringboard-${GAME}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Board saved to a file. Open it on any browser with "Open saved file".');
});
let pendingImport = null;
function applyImport(state) {
  const prev = st;
  st = state; st.set = Object.assign({}, DEF, st.set || {}); st.pos = st.pos || {}; st.cards = st.cards || {};
  st.ink = st.ink || []; st.cardInk = st.cardInk || {}; st.notes = st.notes || []; st.order = st.order || [];
  st.now = Math.max(0, Math.min(+st.now || 0, S.steps.length - 1)); view = st.now;
  save(); closePanel('info'); syncSettings(); applySettings(); renderTimeline();
  toast('Saved board opened.', 'Undo', () => { st = prev; view = st.now; save(); syncSettings(); applySettings(); renderTimeline(); });
}
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  f.text().then(txt => {
    let d; try { d = JSON.parse(txt); } catch (err) { toast("That file isn't a Stringboard save."); return; }
    if (!d || d.app !== 'stringboard' || !d.state || typeof d.state.now !== 'number') { toast("That file isn't a Stringboard save."); return; }
    if (d.game !== GAME) { toast('That save is for another game.'); return; }
    if (d.state.now > st.now) { pendingImport = d.state; $('#impWarn').show(); return; }
    applyImport(d.state);
  });
});
$('#impNo').addEventListener('click', () => { pendingImport = null; $('#impWarn').hide(); });
$('#impYes').addEventListener('click', () => { $('#impWarn').hide(); if (pendingImport) applyImport(pendingImport); pendingImport = null; });

/* ---------- timeline + progress update ---------- */
$('#tl').addEventListener('sl-input', e => { view = +e.target.value; renderTimeline(); renderCards(); if (openCard) openCardPanel(openCard); });
$('#updBtn').addEventListener('click', () => { $('#uProg').hidden = true; $('#uCh').value = String(S.steps[st.now].ch); $('#uTxt').value = ''; $('#uMsg').textContent = ''; $('#uMsg').className = 'status'; $('#upd').show(); });
$('#uCancel').addEventListener('click', () => $('#upd').hide());
$('#uGo').addEventListener('click', async () => {
  if ($('#uGo').loading) return;
  const msg = $('#uMsg'), v = String($('#uCh').value ?? '').trim();
  if (!/^\d{1,3}$/.test(v) || +v < 1) { msg.textContent = 'Enter a chapter number, e.g. 3.'; msg.className = 'status no'; return; }
  const ch = Math.min(+v, SB.maxChapter(S)), cur = S.steps[st.now].ch;
  const base = ch > cur ? SB.chapterStart(S, ch) : st.now;
  let m = -1;
  const txt = String($('#uTxt').value || '').trim();
  if (txt) {
    $('#uGo').loading = true;
    try {
      m = (await SB.smartMatch(S, txt, st.now, SB.chapterEnd(S, ch), (l, t) => {
        $('#uProg').hidden = false; $('#uBar').value = Math.round(l / t * 100);
        $('#uBarText').textContent = `Downloading language model… ${SB.fmtMB(l)} / ${SB.fmtMB(t)} MB (only once)`;
      })).i;
    } catch (e) { m = SB.match(S, txt, st.now, SB.chapterEnd(S, ch)); }
    $('#uGo').loading = false; $('#uProg').hidden = true;
  }
  const next = Math.max(base, m);
  if (next <= st.now) {
    msg.textContent = String($('#uTxt').value ?? '').trim() ? "Couldn't recognize that yet. Try a mission name or a character you just met." : 'Nothing new to add. Describe what happened, or enter a later chapter.';
    msg.className = 'status no'; return;
  }
  undoNow = st.now; st.now = next; view = next; save();
  $('#upd').hide(); renderTimeline(); renderCards();
  toast('Board updated. New things are pinned up.', 'Undo', () => { st.now = undoNow; view = undoNow; save(); renderTimeline(); renderCards(); });
});

/* ---------- ink: marker + eraser ---------- */
function setMode(m) {
  mode = mode === m ? null : m;
  $('#pen').setAttribute('aria-pressed', mode === 'pen'); $('#eraser').setAttribute('aria-pressed', mode === 'erase');
  board.classList.toggle('drawing', mode === 'pen'); board.classList.toggle('erasing', mode === 'erase');
  $('#penSizes').hidden = mode !== 'pen'; syncPenSize();
  if (mode) hideNoteBar();
}
$('#pen').addEventListener('click', () => setMode('pen'));
function syncPenSize() { $$('#penSizes sl-button').forEach(b => b.variant = b.dataset.v === st.set.penSize ? 'primary' : 'default'); }
$$('#penSizes sl-button').forEach(b => b.addEventListener('click', () => { st.set.penSize = b.dataset.v; save(); syncPenSize(); }));
$('#eraser').addEventListener('click', () => setMode('erase'));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (mode) setMode(mode); closePanel('info'); closePanel('cardPanel'); hideNoteBar(); } });
/* Smooth, sketchy marker lines: points are eased while drawing and joined with curves. */
function smoothD(pts, k) {
  const P = pts.map(p => [p[0] * k, p[1] * k]);
  if (P.length < 3) return 'M' + P.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
    d += ` Q${P[i][0].toFixed(1)} ${P[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const L = P[P.length - 1]; return d + ` L${L[0].toFixed(1)} ${L[1].toFixed(1)}`;
}
const PEN_W = { fine: 1, medium: 2, wide: 4 };
const strokeSvg = (s, k, w) => `<path d="${smoothD(s.p, k)}" fill="none" stroke="${COL[s.c]}" stroke-width="${w * (PEN_W[s.w] || 1)}" stroke-linecap="round" stroke-linejoin="round" opacity=".86"/>`;
function renderInk() { ink.innerHTML = st.ink.map(s => strokeSvg(s, 1, 4)).join(''); }
function renderCardInk(id) {
  const d = els[id]; if (!d) return;
  const w = d.offsetWidth; d.querySelector('.cink').innerHTML = (st.cardInk[id] || []).map(s => strokeSvg(s, w, 2.6)).join('');
}
/* Ink belongs to what you start on: board ink stays under the cards, card ink stays inside its card and moves with it. */
board.addEventListener('pointerdown', e => {
  if (!mode || e.target.closest('.panel,#noteBar')) return;
  e.preventDefault(); e.stopPropagation(); board.setPointerCapture(e.pointerId);
  const cardEl = e.target.closest('.card'), cid = cardEl ? cardEl.dataset.id : null;
  const toLocal = ev => {
    const v = toVirtual(ev);
    if (!cid) return [v.x, v.y];
    const c = byId(cid), p = st.pos[cid] || { x: c.x, y: c.y }, w = cardEl.offsetWidth, h = cardEl.offsetHeight;
    const a = -hash(cid) * st.set.tilt * Math.PI / 180, dx = v.x - (p.x + w / 2), dy = v.y - (p.y + h / 2);
    return [(dx * Math.cos(a) - dy * Math.sin(a) + w / 2) / w, (dx * Math.sin(a) + dy * Math.cos(a) + h / 2) / w];
  };
  const list = cid ? (st.cardInk[cid] = st.cardInk[cid] || []) : st.ink;
  const unit = cid ? 1 / cardEl.offsetWidth : 1;           // one virtual pixel in this stroke's units
  const rnd = v => cid ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10;
  const redraw = () => cid ? renderCardInk(cid) : renderInk();
  let cur = null, sm = toLocal(e);
  if (mode === 'pen') { cur = { c: st.set.penColor, w: st.set.penSize, p: [sm.map(rnd)] }; list.push(cur); }
  const erase = pt => {
    const keep = list.filter(s => !s.p.some(q => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < 14 * unit));
    if (keep.length !== list.length) { list.splice(0, list.length, ...keep); redraw(); }
  };
  if (mode === 'erase') erase(sm);
  const mv = ev => {
    const raw = toLocal(ev);
    if (!cur) { erase(raw); return; }
    sm = [sm[0] + (raw[0] - sm[0]) * .35, sm[1] + (raw[1] - sm[1]) * .35];
    const last = cur.p[cur.p.length - 1];
    if (Math.hypot(sm[0] - last[0], sm[1] - last[1]) < 1.5 * unit) return;
    cur.p.push(sm.map(rnd)); redraw();
  };
  const up = ev => {
    board.removeEventListener('pointermove', mv); board.removeEventListener('pointerup', up); board.removeEventListener('pointercancel', up);
    if (cur) {
      const raw = toLocal(ev); cur.p.push([sm[0] + (raw[0] - sm[0]) * .6, sm[1] + (raw[1] - sm[1]) * .6].map(rnd));
      if (cur.p.length < 2) cur.p.push([cur.p[0][0] + unit / 2, cur.p[0][1] + unit / 2]);
    }
    redraw(); save();
  };
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
  $$('#noteBar .seg').forEach(seg => [...seg.children].forEach(b => b.variant = n[seg.dataset.k] === b.dataset.v ? 'primary' : 'default'));
  const left = Math.max(6, Math.min(br.width - bar.offsetWidth - 6, r.left - br.left));
  const top = r.top - br.top - bar.offsetHeight - 10;
  bar.style.left = left + 'px'; bar.style.top = (top < 6 ? r.bottom - br.top + 10 : top) + 'px';
}
function hideNoteBar() { $('#noteBar').hidden = true; selNote = null; $$('.note').forEach(x => x.classList.remove('sel')); }
$$('#noteBar .seg sl-button').forEach(b => b.addEventListener('click', () => {
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
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const t = e.target; if (t.closest && t.closest('input,textarea,[contenteditable=true],sl-input,sl-textarea')) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
});
(async () => {
  await Promise.race([Promise.all(['sl-range', 'sl-radio-group', 'sl-radio-button', 'sl-switch', 'sl-button', 'sl-input', 'sl-dialog'].map(t => customElements.whenDefined(t))), new Promise(r => setTimeout(r, 4000))]);
  st = SB.getState(GAME);
  if (st.now == null) { location.replace('index.html'); return; }
  SB.loadImages(GAME).then(m => { IMGS = m; if (S) renderCards(); });
  try { S = await SB.load(GAME); } catch (e) { document.body.innerHTML = '<p style="padding:40px">Could not load the story data. <a href="index.html">Back</a></p>'; return; }
  SB.applyBackground(S);
  st.now = Math.min(st.now, S.steps.length - 1);
  st.set = Object.assign({}, DEF, st.set || {}); if (st.set.style === 'photo') st.set.style = 'authentic'; st.pos = st.pos || {}; st.cards = st.cards || {}; st.ink = st.ink || []; st.cardInk = st.cardInk || {}; st.notes = st.notes || []; st.order = st.order || [];
  view = st.now;
  buildCards(); syncSettings(); applySettings(); renderTimeline();
  hist.last = JSON.stringify(st); updHistBtns();
  ro.observe(board); layout();
  document.fonts && document.fonts.ready.then(renderStrings);
  save();
})();
}
