/* Stringboard board page */
{
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const GAME = new URLSearchParams(location.search).get('game') || 'gta6';
const VW = 1100, VH = 1000;
const COL = { red: '#9b2423', yellow: '#b98b2e', green: '#4f5d3a', blue: '#2b4562', white: '#e6e0d3', black: '#262522' };
const COL_NAME = { red: 'Oxblood', yellow: 'Ochre', green: 'Olive', blue: 'Ink blue', white: 'Bone', black: 'Graphite', line: 'Fishing line' };
const LINE = 'rgba(226,232,236,.55)'; // fishing line: clear nylon, strings only
const CARD_BG = { white: '#f5f2eb', cream: '#e9dfcb', tan: '#b49873', sage: '#a7ae9a', slate: '#3e4247', black: '#1d1c1a' };
const DEF = { cardSize: 1, imgSize: 1, shape: 'rect', rounded: false, cardRounded: false, style: 'authentic', font: 'sans', fontSize: 1, tilt: 3, bg: 'cork', frame: 'darkwood', strColor: 'red', tension: .25, pinColor: 'red', penColor: 'red', penSize: 'fine', cardBg: null, lamp: false, strW: 'normal', strSee: false, couples: true, facts: 'back' };
const STR_W = { thin: 1.3, normal: 2, thick: 3.2 };

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
const HIST_MAX = 100;
const hist = { u: [], r: [], last: null, t: null, mute: false };
const imgPool = new Map(), imgKey = new Map();
const snap = s => JSON.stringify(s, (k, v) => {
  if (typeof v === 'string' && v.length > 2000 && v.startsWith('data:')) {
    let key = imgKey.get(v); if (!key) { key = '\u0000img' + imgPool.size; imgPool.set(key, v); imgKey.set(v, key); } return key;
  } return v; });
const unsnap = j => JSON.parse(j, (k, v) => typeof v === 'string' && v.startsWith('\u0000img') ? imgPool.get(v) : v);
function commitHist() {
  const cur = snap(st);
  if (hist.last === null) { hist.last = cur; return; }
  if (cur === hist.last) return;
  hist.u.push(hist.last); if (hist.u.length > HIST_MAX) hist.u.shift();
  hist.r = []; hist.last = cur; updHistBtns();
}
function updHistBtns() { $('#undoBtn').disabled = !hist.u.length; $('#redoBtn').disabled = !hist.r.length; }
function restore(json) {
  hist.last = json; st = unsnap(json); view = Math.min(view, st.now);
  hist.mute = true; save(); hist.mute = false;
  hideNoteBar(); syncSettings(); applySettings(); renderTimeline(); nbSync();
  if (openCard) { if (els[openCard] && !els[openCard].hidden) openCardPanel(openCard); else closePanel('cardPanel'); }
  updHistBtns();
}
function undo() { clearTimeout(hist.t); commitHist(); if (!hist.u.length) return; hist.r.push(hist.last); restore(hist.u.pop()); }
function redo() { clearTimeout(hist.t); commitHist(); if (!hist.r.length) return; hist.u.push(hist.last); restore(hist.r.pop()); }
function toast(msg, action, fn, action2, fn2) {
  const t = $('#toast'); t.innerHTML = ''; t.append(msg);
  [[action, fn], [action2, fn2]].forEach(([a, f], i) => { if (!a) return; const b = document.createElement('sl-button'); b.size = 'small'; b.variant = i ? 'default' : 'primary'; b.outline = true; b.textContent = a; b.onclick = () => { f(); t.classList.remove('on'); }; t.append(b); });
  t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), action ? 10000 : 3500);
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
    d.innerHTML = `<div class="phw"><div class="pht">${sil(c)}<img alt="" referrerpolicy="no-referrer" draggable="false"></div>${XSVG}</div><div class="nm"></div><div class="rl"></div><ul class="cf"></ul>` +
      `<div class="back"><div class="bn"></div><ul class="bf"></ul></div><svg class="cink" aria-hidden="true"></svg>` +
      `<svg class="curl" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="cg-${c.id}" x1=".66" y1=".66" x2=".18" y2=".18">` +
      `<stop offset="0" class="s0"/><stop offset=".12" class="s1"/><stop offset=".42" class="s2"/><stop offset=".78" class="s3"/><stop offset="1" class="s4"/></linearGradient></defs>` +
      `<path d="M100 0 C82 36 36 66 -16 84 Q-8 95 0 100 Q70 70 100 0Z" fill="url(#cg-${c.id})"/><path d="M100 0 Q70 70 0 100" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="1"/></svg>` +
      `<button class="corner" type="button" tabindex="-1" aria-label="Turn card over"></button><button class="cset" type="button" tabindex="-1" aria-label="Card settings"><sl-icon name="sliders2"></sl-icon></button>`;
    d.querySelector('.corner').addEventListener('click', e => { e.stopPropagation(); cornerClick(c.id); });
    d.querySelector('.cset').addEventListener('click', e => { e.stopPropagation(); openCardPanel(c.id); });
    d.addEventListener('pointerenter', () => hotCard(d));
    d.querySelector('img').addEventListener('error', e => { e.target.dataset.failed = e.target.getAttribute('src') || ''; e.target.parentNode.classList.remove('has'); });
    d.querySelector('img').addEventListener('load', e => { delete e.target.dataset.failed; });
    cardsEl.append(d); els[c.id] = d;
    dragify(d, () => st.pos[c.id] || { x: c.x, y: c.y }, p => { st.pos[c.id] = p; followPartner(c.id); }, () => { if (flipped.has(c.id) || expanded.has(c.id)) cornerClick(c.id); });
    d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCardPanel(c.id); } });
  });
}
const byId = id => S.chars.find(c => c.id === id);
/* hand-drawn red cross for characters who died, a little wider than the photo */
const XSVG = `<svg class="xx" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g filter="url(#inkRough)" fill="none" stroke="#a8201a" stroke-width="7.5" stroke-linecap="round" opacity=".92"><path d="M4 7 C30 32 62 66 97 94"/><path d="M95 5 C68 34 40 60 6 96"/><path d="M12 14 C34 36 58 60 88 86" stroke-width="3" opacity=".5"/></g></svg>`;
const flipped = new Set(), expanded = new Set();
/* the lifted corner leaves a hole the pointer falls through; keep the card "hot" while the pointer is anywhere inside its box */
function hotCard(d) {
  if (d.classList.contains('hot')) return; d.classList.add('hot');
  const off = e => { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { d.classList.remove('hot'); document.removeEventListener('pointermove', off); } };
  document.addEventListener('pointermove', off);
}          // view-only: which cards are turned over / opened up
const factsMode = id => (st.cards[id] || {}).facts || st.set.facts;
function cornerClick(id) {
  const m = factsMode(id), d = els[id];
  if (m === 'peek') { expanded.has(id) ? expanded.delete(id) : expanded.add(id); renderCards(); return; }
  if (m !== 'back') return;
  d.classList.add('turning');                               // squeeze, swap side, open again
  setTimeout(() => { flipped.has(id) ? flipped.delete(id) : flipped.add(id); renderCards(); d.classList.remove('turning'); }, 140);
}
/* couples the story has confirmed by this point (data: [a, b, from]) */
const couplesAt = v => st.set.couples ? (S.couples || []).filter(([a, b, s]) => s <= v && byId(a).a <= v && byId(b).a <= v) : [];
const partnerOf = (id, v = view) => { const p = couplesAt(v).find(([a, b]) => a === id || b === id); return p ? (p[0] === id ? p[1] : p[0]) : null; };
/* dragging one half of a couple: it may move around its partner, but never more than a small gap away; further and the partner follows */
function followPartner(id) {
  const o = partnerOf(id); if (!o || !els[o] || els[o].hidden) return;
  const a = st.pos[id], b = st.pos[o] || { x: byId(o).x, y: byId(o).y }, A = els[id], B = els[o];
  const ax = a.x + A.offsetWidth / 2, ay = a.y + A.offsetHeight / 2, bx = b.x + B.offsetWidth / 2, by = b.y + B.offsetHeight / 2;
  const maxD = (A.offsetWidth + B.offsetWidth) / 2 + 40, d = Math.hypot(bx - ax, by - ay);
  if (d <= maxD) return;
  const k = maxD / d, nb = { x: Math.round(ax + (bx - ax) * k - B.offsetWidth / 2), y: Math.round(ay + (by - ay) * k - B.offsetHeight / 2) };
  st.pos[o] = nb; B.style.left = nb.x + 'px'; B.style.top = nb.y + 'px';
}
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
    const bgKey = cu.bg || (!c.note && s.cardBg), bg = bgKey ? CARD_BG[bgKey] : null;
    if (bg) { const dark = lum(bg) < .35; d.style.setProperty('--bgc', bg); d.style.setProperty('--fg', dark ? '#f4efe4' : '#231a12'); d.style.setProperty('--fg2', dark ? '#cbbfa9' : '#5a4a3a'); }
    else ['--bgc', '--fg', '--fg2'].forEach(k => d.style.removeProperty(k));
    d.classList.toggle('dead', !!c.dead && view >= c.dead);
    const facts = c.f.filter(([st0]) => st0 <= view).map(([, x]) => x), fm = factsMode(c.id);
    if (fm !== 'back') flipped.delete(c.id); if (fm !== 'peek') expanded.delete(c.id);
    const shown = fm === 'below' || expanded.has(c.id) ? facts : fm === 'peek' ? facts.slice(0, 3) : [];
    const li = x => { const l = document.createElement('li'); l.textContent = x; return l; };
    d.querySelector('.cf').replaceChildren(...shown.map(li));
    d.querySelector('.bf').replaceChildren(...(facts.length ? facts : ['Nothing yet.']).map(li));
    d.querySelector('.bn').textContent = cu.n || c.n;
    d.classList.toggle('flipped', flipped.has(c.id));
    d.classList.toggle('m-back', fm === 'back' && !c.note); d.classList.toggle('m-peek', fm === 'peek' && facts.length > 3); d.classList.toggle('open', expanded.has(c.id));
    d.querySelector('.corner').setAttribute('aria-label', fm === 'peek' ? (expanded.has(c.id) ? 'Show less' : 'Show everything') : flipped.has(c.id) ? 'Turn card face up' : 'Turn card over');
    d.querySelector('.nm').textContent = cu.n || c.n;
    d.querySelector('.rl').textContent = cu.r || roleAt(c, view);
    const ph = d.querySelector('.pht'), img = ph.querySelector('img');
    const src = cu.img || (IMGS[c.id] && IMGS[c.id].url);
    if (src) { if (img.getAttribute('src') !== src) { delete img.dataset.failed; img.src = src; } ph.classList.toggle('has', img.dataset.failed !== src); }
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
  const s = st.set, line = s.strColor === 'line', col = line ? LINE : COL[s.strColor], base = STR_W[s.strW] || 2;
  const pairs = new Set(couplesAt(view).map(([a, b]) => [a, b].sort().join('|')));
  let out = '', pins = new Set();
  S.links.forEach(([a, b, step]) => {
    if (step > view || byId(a).a > view || byId(b).a > view) return;
    if (pairs.has([a, b].sort().join('|'))) { pins.add(a); pins.add(b); return; } // couples sit together, no string
    const [x1, y1] = pinOf(a), [x2, y2] = pinOf(b), len = Math.hypot(x2 - x1, y2 - y1);
    const sag = s.tension * len * .28, d = `M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag} ${x2} ${y2}`;
    out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${base}" stroke-linecap="round" opacity="${line ? 1 : .94}"/>`;
    if (line) out += `<path d="${d}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="${Math.max(.6, base * .3)}" stroke-linecap="round" transform="translate(-.4 -.5)"/>`;
    pins.add(a); pins.add(b);
  });
  // see-through: where a string crosses a card, it fades so the card shows through
  let mask = '';
  if (s.strSee) {
    let holes = '';
    S.chars.forEach(c => { const el = els[c.id]; if (!el || el.hidden) return;
      const p = st.pos[c.id] || { x: c.x, y: c.y }, w = el.offsetWidth, h = el.offsetHeight, a = (hash(c.id) * s.tilt).toFixed(2);
      holes += `<rect x="${p.x}" y="${p.y}" width="${w}" height="${h}" fill="#4a4a4a" transform="rotate(${a} ${p.x + w / 2} ${p.y + h / 2})"/>`; });
    mask = `<defs><mask id="strMask" maskUnits="userSpaceOnUse" x="-20000" y="-20000" width="40000" height="40000"><rect x="-20000" y="-20000" width="40000" height="40000" fill="#fff"/>${holes}</mask></defs>`;
    out = `${mask}<g mask="url(#strMask)">${out}</g>`;
  }
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
  $('#tlPrev').disabled = view <= 0; $('#tlNext').disabled = view >= st.now;
}
/* chapter box: pops up for 5 s when you move through the story; chevron opens the details, pin keeps it up */
let capT = null, capPinned = false, capOpen = false;
const capBox = $('#capBox');
// line the box up with the slider track: same left edge, same width
function placeCap() { const t = $('#tl').getBoundingClientRect(), p = $('.tl').getBoundingClientRect(); capBox.style.left = (t.left - p.left) + 'px'; capBox.style.width = t.width + 'px'; }
addEventListener('resize', placeCap);
function flashCap() {
  placeCap(); capBox.classList.add('on'); clearTimeout(capT);
  if (!capPinned) capT = setTimeout(() => { if (!capBox.matches(':hover')) capHide(); else flashCap(); }, 4000);
}
function capHide() { if (capPinned) return; capBox.classList.remove('on'); setDetails(false); }
function setDetails(open) {
  capOpen = open; $('#capD').hidden = !open; $('#capPin').hidden = !open; capBox.classList.toggle('open', open);
  $('#capMore').name = open ? 'chevron-up' : 'chevron-down'; $('#capMore').label = open ? 'Hide details' : 'Show details'; $('#capMore').setAttribute('aria-expanded', open);
  if (!open && capPinned) setPin(false);
}
function setPin(on) {
  capPinned = on; $('#capPin').name = on ? 'pin-fill' : 'pin-angle'; $('#capPin').label = on ? 'Let it hide again' : 'Keep this visible';
  capBox.classList.toggle('pinned', on); if (on) clearTimeout(capT); else flashCap();
}
$('#capMore').addEventListener('click', () => { setDetails(!capOpen); flashCap(); });
$('#capPin').addEventListener('click', () => setPin(!capPinned));
capBox.addEventListener('pointerleave', () => { if (!capPinned) flashCap(); });
function stepTo(v) { v = Math.max(0, Math.min(st.now, v)); if (v === view) return; view = v; renderTimeline(); renderCards(); flashCap(); if (openCard) openCardPanel(openCard); }
$('#tlPrev').addEventListener('click', () => stepTo(view - 1));
$('#tlNext').addEventListener('click', () => stepTo(view + 1));
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
  $('#mapStage').style.transform = stage.style.transform; // the map sits under the lamp's shading, so it darkens like the board
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
/* pinch / ctrl+wheel zoom: proportional to how far you scroll, so a trackpad glides and a mouse notch is a small step */
board.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault();
  const dy = Math.max(-60, Math.min(60, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
  zoomTo(zoom * Math.exp(-dy * .0035), e.clientX, e.clientY);
}, { passive: false });
/* drag the empty board to pan */
board.addEventListener('pointerdown', e => {
  if (mode || e.button > 0 || e.target.closest('.card,.note,.panel,#noteBar,.zoom')) return;
  const sx = e.clientX, sy = e.clientY, p0 = { ...pan }; let moved = false;
  const mv = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; board.classList.add('panning'); pan.x = p0.x + dx; pan.y = p0.y + dy; layout(); };
  const up = () => { board.removeEventListener('pointermove', mv); board.removeEventListener('pointerup', up); board.removeEventListener('pointercancel', up); board.classList.remove('panning'); if (moved && openCard) placeCardPanel(openCard); };
  board.setPointerCapture(e.pointerId); board.addEventListener('pointermove', mv); board.addEventListener('pointerup', up); board.addEventListener('pointercancel', up);
});
const ro = new ResizeObserver(() => { layout(); if (openCard) placeCardPanel(openCard); });
function toVirtual(e) { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; }

/* ---------- dragging (cards + notes) ---------- */
function dragify(el, get, set, onClick) {
  el.addEventListener('pointerdown', e => {
    if (mode || e.button > 0 || e.target.closest('.corner,.cset,.back ul')) return;
    if (e.target.closest('.txt') && document.activeElement === e.target.closest('.txt')) return;
    if (!e.target.closest('.txt')) e.preventDefault();
    const start = toVirtual(e), p0 = { ...get() }; let moved = false;
    el.setPointerCapture(e.pointerId);
    const mv = ev => {
      const v = toVirtual(ev), dx = v.x - start.x, dy = v.y - start.y;
      if (!moved && Math.hypot(dx, dy) * scale < 5) return;
      if (!moved) { moved = true; el.classList.add('drag'); hideNoteBar(); if (el.classList.contains('card')) bringToFront(el.dataset.id); }
      const np = { x: Math.round(p0.x + dx), y: Math.round(p0.y + dy) };   // anywhere: the board pans and zooms to follow
      el.style.left = np.x + 'px'; el.style.top = np.y + 'px'; set(np);
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
  $('#cpFactsMode').value = factsMode(id);
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
$('#cpFactsMode').addEventListener('sl-change', e => { if (!openCard) return; custom(openCard).facts = e.target.value === st.set.facts ? undefined : e.target.value; save(); renderCards(); });
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
function swatches(el, key, labelPrefix, withLine) {
  el.innerHTML = '';
  Object.entries(withLine ? { ...COL, line: LINE } : COL).forEach(([k, v]) => {
    const b = document.createElement('button'); b.type = 'button'; b.style.setProperty('--c', v); if (k === 'line') b.className = 'sw-line';
    b.title = COL_NAME[k] || k; b.setAttribute('aria-label', labelPrefix + ' ' + (COL_NAME[k] || k)); b.setAttribute('aria-pressed', st.set[key] === k);
    b.onclick = () => { st.set[key] = k; save(); applySettings(); swatches(el, key, labelPrefix); };
    el.append(b);
  });
}
function syncSettings() {
  const s = st.set;
  $('#sCard').value = s.cardSize; $('#sImg').value = s.imgSize; $('#sFont').value = s.fontSize; $('#sTilt').value = s.tilt; $('#sTen').value = s.tension;
  $('#sCardRound').checked = s.cardRounded;
  $('#sRound').checked = s.rounded; $('#sRound').disabled = s.shape === 'circle';
  ['shape', 'style', 'font', 'bg', 'frame', 'strW', 'facts'].forEach(k => { $('#g-' + k).value = s[k]; });
  $('#sSee').checked = s.strSee; $('#sCouples').checked = s.couples;
  const cb = $('#swCardBg'); cb.innerHTML = '';
  Object.entries({ default: null, ...CARD_BG }).forEach(([k, v]) => {
    const b = document.createElement('button'); b.type = 'button';
    b.style.setProperty('--c', v || '#f6f1e6'); b.title = k === 'default' ? 'Default' : k;
    b.setAttribute('aria-label', 'All cards colour ' + b.title); b.setAttribute('aria-pressed', (s.cardBg || 'default') === k);
    b.onclick = () => {
      st.set.cardBg = k === 'default' ? null : k;
      Object.values(st.cards).forEach(cu => { delete cu.bg; });
      save(); applySettings(); syncSettings(); if (openCard) openCardPanel(openCard);
    };
    cb.append(b);
  });
  swatches($('#swStr'), 'strColor', 'String', true); swatches($('#swPin'), 'pinColor', 'Pin'); swatches($('#swPen'), 'penColor', 'Marker');
}
[['#sCard', 'cardSize'], ['#sImg', 'imgSize'], ['#sFont', 'fontSize'], ['#sTilt', 'tilt'], ['#sTen', 'tension']].forEach(([sel, k]) =>
  $(sel).addEventListener('sl-input', e => { st.set[k] = +e.target.value; save(); applySettings(); }));
$('#sRound').addEventListener('sl-change', e => { st.set.rounded = e.target.checked; save(); applySettings(); });
$('#sCardRound').addEventListener('sl-change', e => { st.set.cardRounded = e.target.checked; save(); applySettings(); });
['shape', 'style', 'font', 'bg', 'frame', 'strW'].forEach(k => $('#g-' + k).addEventListener('sl-change', e => { st.set[k] = e.target.value; save(); applySettings(); syncSettings(); }));
$('#g-facts').addEventListener('sl-change', e => {             // board-wide choice replaces every card's own choice
  if (e.target.value === st.set.facts) return;
  st.set.facts = e.target.value; Object.values(st.cards).forEach(cu => { delete cu.facts; });
  save(); applySettings(); if (openCard) openCardPanel(openCard);
  if (e.target.value !== 'back') toast('Cards grew taller and may overlap. Tidy them up?', 'Tidy up', arrangeAll);
});
$('#sSee').addEventListener('sl-change', e => { st.set.strSee = e.target.checked; save(); renderStrings(); });
$('#sCouples').addEventListener('sl-change', e => { st.set.couples = e.target.checked; save(); renderStrings(); });
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
$('#arrangeAll').addEventListener('click', arrangeAll);
$('#arrangeTray').addEventListener('click', arrangeAll);
$('#resetAll').addEventListener('click', () => {
  Object.assign(st, { pos: {}, cards: {}, ink: [], cardInk: {}, notes: [], order: [], notebook: '', nb: null, set: Object.assign({}, DEF) });
  flipped.clear(); expanded.clear(); closePanel('info');
  syncSettings(); applySettings(); nbSync();
  requestAnimationFrame(() => { Object.assign(st.pos, arrange(visIds(st.now), { spread: 900 })); renderCards(); save(); clearTimeout(hist.t); commitHist();
    toast('Everything is back to a fresh board. Your progress stayed.', 'Undo', undo); });
});
$('#cpArrange').addEventListener('click', () => { if (openCard) arrangeAround(openCard); });
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


/* ---------- auto-arrange: a small force layout. Linked cards pull together (short strings), cards never overlap.
   Only cards visible at your progress take part, so the layout never hints at what's still to come. ---------- */
const visIds = v => S.chars.filter(c => c.a <= v).map(c => c.id);
const visLinks = v => S.links.filter(([a, b, s]) => s <= v && byId(a).a <= v && byId(b).a <= v);
function cardSize(id) {
  const c = byId(id), d = els[id], w = (c.main ? 160 : 130) * st.set.cardSize;
  return d && !d.hidden && d.offsetWidth ? { w: d.offsetWidth, h: d.offsetHeight } : { w, h: w * 1.35 };
}
function neighbours(id, v) { const n = new Set(); visLinks(v).forEach(([a, b]) => { if (a === id) n.add(b); if (b === id) n.add(a); }); return [...n]; }
// movable: ids allowed to move. anchor: pull back toward the starting spot (0 = free, higher = gentler changes).
// maxMove: hard cap on how far a card may travel. init: optional starting positions for cards without one.
function arrange(movable, { v = st.now, anchor = 0, maxMove = Infinity, iters = 220, spread = 0, init = {} } = {}) {
  const ids = visIds(v), mv = new Set(movable);
  const N = ids.map(id => { const c = byId(id), s = cardSize(id), p = init[id] || st.pos[id] || { x: c.x, y: c.y };
    return { id, w: s.w, h: s.h, x: p.x + s.w / 2, y: p.y + s.h / 2, ox: p.x + s.w / 2, oy: p.y + s.h / 2, m: mv.has(id), nb: [] }; });
  const ix = Object.fromEntries(N.map((n, i) => [n.id, i]));
  visLinks(v).forEach(([a, b]) => { if (ix[a] != null && ix[b] != null) { N[ix[a]].nb.push(ix[b]); N[ix[b]].nb.push(ix[a]); } });
  const CP = couplesAt(v).map(([a, b]) => [ix[a], ix[b]]).filter(([a, b]) => a != null && b != null);
  CP.forEach(([a, b]) => { for (let k = 0; k < 3; k++) { N[a].nb.push(b); N[b].nb.push(a); } }); // couples: much stronger pull
  const pad = 30, M = N.filter(n => n.m);
  // a big cast needs more room than the board's base area: grow it, keeping the shape
  const need = N.reduce((s, n) => s + (n.w + pad) * (n.h + pad), 0) * 1.5, g = Math.max(1, Math.sqrt(need / (VW * VH))), BW = VW * g, BH = VH * g;
  const clamp = n => {
    const dx = n.x - n.ox, dy = n.y - n.oy, d = Math.hypot(dx, dy);
    if (d > maxMove) { n.x = n.ox + dx / d * maxMove; n.y = n.oy + dy / d * maxMove; }
    n.x = Math.min(BW - n.w / 2 - 8, Math.max(n.w / 2 + 8, n.x)); n.y = Math.min(BH - n.h / 2 - 8, Math.max(n.h / 2 + 8, n.y));
  };
  const separate = () => { // push overlapping cards apart along the shorter way out
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const A = N[i], B = N[j]; if (!A.m && !B.m) continue;
      let dx = B.x - A.x, dy = B.y - A.y; if (!dx && !dy) { dx = hash(A.id + B.id) || .5; dy = hash(B.id + A.id); }
      const ox = (A.w + B.w) / 2 + pad - Math.abs(dx), oy = (A.h + B.h) / 2 + pad - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue;
      const wa = A.m ? (B.m ? .5 : 1) : 0, wb = B.m ? (A.m ? .5 : 1) : 0;
      if (ox < oy) { const s = Math.sign(dx) * ox; A.x -= s * wa; B.x += s * wb; } else { const s = Math.sign(dy) * oy; A.y -= s * wa; B.y += s * wb; }
    }
  };
  // Fruchterman–Reingold: linked cards attract, every card gently pushes the others away
  const K = 170 * st.set.cardSize;
  for (let it = 0; it < iters; it++) {
    const temp = 40 * (1 - it / iters) + 2, fx = new Float64Array(N.length), fy = new Float64Array(N.length);
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const A = N[i], B = N[j]; if (!A.m && !B.m) continue;
      const dx = B.x - A.x || .1, dy = B.y - A.y, d2 = Math.max(dx * dx + dy * dy, 100), d = Math.sqrt(d2);
      if (d > 3 * K) continue;
      const f = K * K / d2 * (spread ? 1 : .6);
      fx[i] -= dx * f; fy[i] -= dy * f; fx[j] += dx * f; fy[j] += dy * f;
    }
    N.forEach((A, i) => A.nb.forEach(j => { if (j < i) return; const B = N[j], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, f = d / K;
      fx[i] += dx * f; fy[i] += dy * f; fx[j] -= dx * f; fy[j] -= dy * f; }));
    N.forEach((n, i) => {
      if (!n.m) return;
      if (spread) { fx[i] += (BW / 2 - n.x) * .02; fy[i] += (BH / 2 - n.y) * .02; }
      if (anchor) { fx[i] += (n.ox - n.x) * anchor * 4; fy[i] += (n.oy - n.y) * anchor * 4; }
      const d = Math.hypot(fx[i], fy[i]) || 1, step = Math.min(d, temp);
      n.x += fx[i] / d * step; n.y += fy[i] / d * step;
    });
    separate(); M.forEach(clamp);
  }
  for (let r = 0; r < 40; r++) { separate(); M.forEach(clamp); }
  // anything still overlapping goes to the nearest free spot (spiral search outward)
  const hits = (n, x, y) => N.some(o => o !== n && Math.abs(o.x - x) < (o.w + n.w) / 2 + pad - 4 && Math.abs(o.y - y) < (o.h + n.h) / 2 + pad - 4);
  M.forEach(n => {
    if (!hits(n, n.x, n.y)) return;
    for (let r = 20; r < 3000; r += 20) {
      let found = false;
      for (let a = 0; a < 360; a += 360 / Math.max(8, r / 12)) {
        const x = n.x + r * Math.cos(a * Math.PI / 180), y = n.y + r * Math.sin(a * Math.PI / 180);
        if (x < n.w / 2 + 8 || y < n.h / 2 + 8 || hits(n, x, y)) continue; // may go past the base area: the board grows
        n.x = x; n.y = y; found = true; break;
      }
      if (found) break;
    }
  });
  // a movable half of a couple settles right beside its partner if that spot is free
  CP.forEach(([a, b]) => { [[N[a], N[b]], [N[b], N[a]]].some(([m, o]) => {
    if (!m.m) return false;
    const gap = (m.w + o.w) / 2 + pad, side = m.x < o.x ? -1 : 1;
    for (const [x, y] of [[o.x + side * gap, o.y], [o.x - side * gap, o.y]]) if (!hits(m, x, y)) { m.x = x; m.y = y; return true; }
    return false; }); });
  const out = {}; M.forEach(n => { out[n.id] = { x: Math.round(n.x - n.w / 2), y: Math.round(n.y - n.h / 2) }; });
  return out;
}
// glide cards to their new spots, then record one undo step
function moveCards(target, msg) {
  const from = {}; Object.keys(target).forEach(id => { const c = byId(id); from[id] = st.pos[id] || { x: c.x, y: c.y }; });
  const t0 = performance.now(), D = 380;
  const frame = now => {
    const k = Math.min(1, (now - t0) / D), e = 1 - (1 - k) ** 3;
    Object.keys(target).forEach(id => { const a = from[id], b = target[id]; st.pos[id] = { x: Math.round(a.x + (b.x - a.x) * e), y: Math.round(a.y + (b.y - a.y) * e) };
      const d = els[id]; if (d) { d.style.left = st.pos[id].x + 'px'; d.style.top = st.pos[id].y + 'px'; } });
    renderStrings();
    if (k < 1) requestAnimationFrame(frame);
    else { renderCards(); save(); clearTimeout(hist.t); commitHist(); if (msg) toast(msg, 'Undo', undo); }
  };
  requestAnimationFrame(frame);
}
function arrangeAll() { moveCards(arrange(visIds(st.now), { spread: 900 }), 'Cards arranged: connected cards are close together.'); }
function arrangeAround(id) {
  const ids = [id, ...neighbours(id, st.now)];
  moveCards(arrange(ids, { anchor: .05, maxMove: 220, iters: 180 }), 'Moved this card and the cards it connects to.');
}
// cards that just became visible get a spot next to the cards they connect to
function placeNew(ids, v) {
  const init = {};
  ids.forEach(id => { const ns = neighbours(id, v).filter(n => !ids.includes(n)), c = byId(id);
    if (ns.length) { const ps = ns.map(n => st.pos[n] || { x: byId(n).x, y: byId(n).y });
      init[id] = { x: ps.reduce((s, p) => s + p.x, 0) / ps.length + hash(id) * 90, y: ps.reduce((s, p) => s + p.y, 0) / ps.length + 120 + hash(id + 'y') * 40 }; }
    else init[id] = { x: c.x, y: c.y }; });
  Object.assign(st.pos, arrange(ids, { v, init, iters: 200 }));
}

/* ---------- timeline + progress update ---------- */
$('#tl').addEventListener('sl-input', e => { view = +e.target.value; renderTimeline(); renderCards(); flashCap(); if (openCard) openCardPanel(openCard); });
$('#updBtn').addEventListener('click', () => { const ty = SB.typeOf(S), U = SB.UNITS[ty]; $('#uCh').label = U.label; $('#uCh').placeholder = U.placeholder; $('#uProg').hidden = true; $('#uCh').value = SB.fmtPos(ty, S.steps[st.now].ch); $('#uTxt').value = ''; $('#uMsg').textContent = ''; $('#uMsg').className = 'status'; $('#upd').show(); });
$('#uCancel').addEventListener('click', () => $('#upd').hide());
$('#uGo').addEventListener('click', async () => {
  if ($('#uGo').loading) return;
  const msg = $('#uMsg'), v = String($('#uCh').value ?? '').trim();
  const ty = SB.typeOf(S), pos = SB.parsePos(ty, v);
  if (!pos) { msg.textContent = 'Enter your position, e.g. ' + SB.UNITS[ty].placeholder.replace(/^.*e\.g\. /, '') + '.'; msg.className = 'status no'; return; }
  const ch = Math.min(pos, SB.maxChapter(S)), cur = S.steps[st.now].ch;
  const base = ch > cur ? SB.basePos(S, ch) : st.now;
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
  undoNow = st.now; const fresh = S.chars.filter(c => c.a > st.now && c.a <= next).map(c => c.id);
  st.now = next; view = next;
  $('#upd').hide(); renderTimeline(); renderCards();
  if (fresh.length) placeNew(fresh, next);
  renderCards(); save(); clearTimeout(hist.t); commitHist();
  if (fresh.length) {
    const around = [...new Set(fresh.flatMap(id => [id, ...neighbours(id, next)]))];
    toast(`${fresh.length} new card${fresh.length > 1 ? 's' : ''} pinned up. Tidy the cards connected to ${fresh.length > 1 ? 'them' : 'it'}?`, 'Tidy up',
      () => moveCards(arrange(around, { anchor: .05, maxMove: 220, iters: 180 }), 'Tidied the new cards and their connections.'));
  } else toast('Board updated. New things are pinned up.', 'Undo', undo);
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (mode) setMode(mode); closePanel('info'); closePanel('cardPanel'); hideNoteBar(); capHide(); if (!nbPinned) nbOpen(false); } });
/* Smooth, sketchy marker lines: points are eased while drawing and joined with curves. */
/* Chaikin corner-cutting: rounds off the jitter of hand-drawn input */
function chaikin(P, n) {
  for (let it = 0; it < n && P.length > 2; it++) {
    const Q = [P[0]];
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[i + 1];
      Q.push([x0 * .75 + x1 * .25, y0 * .75 + y1 * .25], [x0 * .25 + x1 * .75, y0 * .25 + y1 * .75]);
    }
    Q.push(P[P.length - 1]); P = Q;
  }
  return P;
}
function smoothD(pts, k) {
  const P = chaikin(pts.map(p => [p[0] * k, p[1] * k]), 2);
  if (P.length < 3) return 'M' + P.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
    d += ` Q${P[i][0].toFixed(1)} ${P[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const L = P[P.length - 1]; return d + ` L${L[0].toFixed(1)} ${L[1].toFixed(1)}`;
}
const PEN_W = { fine: 1, medium: 2, wide: 4 };
/* Marker strokes. Fine = bullet tip with round ends. Medium/Wide = chisel tip: even width, square ends,
   a faint lighter streak down the middle and slightly rough edges, like a dry-erase marker. */
function strokeSvg(s, k, w) {
  const mult = PEN_W[s.w] || 1, sw = w * mult, col = COL[s.c];
  if (mult >= 2) {
    const d = smoothD(s.p, k);
    return `<g opacity=".88" filter="url(#inkRough)"><path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="butt" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="${sw * .35}" stroke-linecap="butt" stroke-linejoin="round"/></g>`;
  }
  const a = s.p[0], b = s.p[s.p.length - 1];
  return `<g opacity=".88" filter="url(#inkRough)"><path d="${smoothD(s.p, k)}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${a[0] * k}" cy="${a[1] * k}" r="${sw / 2}" fill="${col}"/><circle cx="${b[0] * k}" cy="${b[1] * k}" r="${sw / 2}" fill="${col}"/></g>`;
}
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
    sm = [sm[0] + (raw[0] - sm[0]) * .28, sm[1] + (raw[1] - sm[1]) * .28];
    const last = cur.p[cur.p.length - 1];
    if (Math.hypot(sm[0] - last[0], sm[1] - last[1]) < (1.5 + (PEN_W[cur.w] || 1)) * unit) return;
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
  const g = document.createElement('div'); g.className = 'ghost'; g.style.background = color === 'blue' ? '#c2d5df' : '#efd97c';
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

/* ---------- notebook: rises from the tray; tabbed pages you can name; pinned, it stays open while you work ---------- */
let nbPinned = false;
const NB_COL = ['#8f817a', '#a9b8c6', '#b3bab3', '#7c2b2e', '#b98b2e', '#5f6b4c'];
function nbData() {
  if (!st.nb) st.nb = { tabs: [{ n: 'Notes', t: typeof st.notebook === 'string' ? st.notebook : '', c: 0 }], cur: 0 };
  if (st.nb.cur >= st.nb.tabs.length) st.nb.cur = 0;
  return st.nb;
}
function nbSync() {
  const nb = nbData(), tab = nb.tabs[nb.cur];
  $('#nbText').value = tab.t; $('#nbName').value = tab.n; $('#nbDel').disabled = nb.tabs.length < 2;
  $('#nb').style.setProperty('--tab', NB_COL[tab.c % NB_COL.length]);
  const box = $('#nbTabs'); box.innerHTML = '';
  nb.tabs.forEach((tb, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'nbt' + (i === nb.cur ? ' on' : '');
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i === nb.cur); b.style.setProperty('--c', NB_COL[tb.c % NB_COL.length]); if ([1, 2].includes(tb.c % NB_COL.length)) b.style.color = 'rgba(30,30,30,.78)';
    const s = document.createElement('span'); s.textContent = tb.n || 'Untitled'; b.append(s);
    b.onclick = () => { nb.cur = i; save(); nbSync(); $('#nbText').focus(); };
    box.append(b);
  });
  // the closed notebook in the tray is a small copy of the open one
  $('#nbMiniName').textContent = tab.n || 'Untitled'; $('#nbMiniText').textContent = tab.t;
  $('#nbMiniTabs').replaceChildren(...nb.tabs.map((tb, i) => { const s = document.createElement('i'); s.style.background = NB_COL[tb.c % NB_COL.length]; if (i === nb.cur) s.className = 'on'; return s; }));
  if (nb.tabs.length < 6) {
    const add = document.createElement('button'); add.type = 'button'; add.className = 'nbt add'; add.setAttribute('aria-label', 'Add a tab'); add.textContent = '+';
    add.onclick = () => { const c = [0, 1, 2, 3, 4, 5].find(k => !nb.tabs.some(x => x.c === k)) ?? nb.tabs.length; nb.tabs.push({ n: 'New tab', t: '', c }); nb.cur = nb.tabs.length - 1; save(); nbSync(); $('#nbName').select(); };
    box.append(add);
  }
}
function nbOpen(open) {
  $('#nb').hidden = !open; $('#nbTab').setAttribute('aria-expanded', open); $('#nbTab').classList.toggle('out', open); $('.nbslot').classList.toggle('empty', open);
  if (open) { nbSync(); requestAnimationFrame(() => $('#nbText').focus()); }
}
$('#nbTab').addEventListener('click', () => nbOpen($('#nb').hidden));
$('#nbClose').addEventListener('click', () => nbOpen(false));
$('#nbPin').addEventListener('click', () => { nbPinned = !nbPinned; $('#nbPin').name = nbPinned ? 'pin-fill' : 'pin-angle'; $('#nbPin').label = nbPinned ? 'Unpin notebook' : 'Keep the notebook open'; $('#nb').classList.toggle('pinned', nbPinned); });
$('#nbText').addEventListener('input', e => { const nb = nbData(); nb.tabs[nb.cur].t = e.target.value; $('#nbMiniText').textContent = e.target.value; save(); });
$('#nbName').addEventListener('input', e => { const nb = nbData(); nb.tabs[nb.cur].n = e.target.value; save(); const s = $('#nbTabs .nbt.on span'); if (s) s.textContent = e.target.value || 'Untitled'; $('#nbMiniName').textContent = e.target.value || 'Untitled'; });
$('#nbName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#nbText').focus(); } });
$('#nbDel').addEventListener('click', () => {
  const nb = nbData(); if (nb.tabs.length < 2) return;
  const gone = nb.tabs[nb.cur].n || 'Untitled'; nb.tabs.splice(nb.cur, 1); nb.cur = Math.max(0, nb.cur - 1); save(); nbSync();
  clearTimeout(hist.t); commitHist(); toast(`Deleted the “${gone}” tab.`, 'Undo', undo);
});
document.addEventListener('pointerdown', e => { if (!nbPinned && !$('#nb').hidden && !e.target.closest('#nb,#nbTab')) nbOpen(false); }, true);
$('#aboutBtn').addEventListener('click', () => $('#about').show());

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
  await Promise.race([Promise.all(['sl-range', 'sl-radio-group', 'sl-radio-button', 'sl-switch', 'sl-button', 'sl-input', 'sl-dialog', 'sl-tab-group'].map(t => customElements.whenDefined(t))), new Promise(r => setTimeout(r, 4000))]);
  st = SB.getState(GAME);
  if (st.now == null) { location.replace('index.html'); return; }
  SB.loadImages(GAME).then(m => { IMGS = m; if (S) renderCards(); });
  try { S = await SB.load(GAME); } catch (e) { document.body.innerHTML = '<p style="padding:40px">Could not load the story data. <a href="index.html">Back</a></p>'; return; }
  SB.applyBackground(S);
  st.now = Math.min(st.now, S.steps.length - 1);
  st.set = Object.assign({}, DEF, st.set || {}); if (st.set.style === 'photo') st.set.style = 'authentic'; st.pos = st.pos || {}; st.cards = st.cards || {}; st.ink = st.ink || []; st.cardInk = st.cardInk || {}; st.notes = st.notes || []; st.order = st.order || [];
  view = st.now;
  buildCards(); syncSettings(); applySettings(); renderTimeline(); nbSync(); flashCap();
  hist.last = snap(st); updHistBtns();
  ro.observe(board); layout();
  document.fonts && document.fonts.ready.then(renderStrings);
  if (st.lay !== 1) { // smarter default: arrange every card you haven't placed yourself
    requestAnimationFrame(() => { const free = visIds(st.now).filter(id => !st.pos[id]);
      if (free.length) Object.assign(st.pos, arrange(free, { spread: 900 }));
      st.lay = 1; renderCards(); hist.last = snap(st); save(); });
  }
  save();
})();
}
