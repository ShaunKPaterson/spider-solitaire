'use strict';
// Spider Solitaire — game logic, layout and input.

const $ = s => document.querySelector(s);
const table = $('#table');

// ---------- Saved data ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('spider.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('spider.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const settings = Object.assign({ suits: 1, face: 'royal', back: 'navy', strictDeal: true, winnable: true }, store.get('settings', {}));
let stats = store.get('stats', {});
const saveSettings = () => store.set('settings', settings);
const statFor = n => (stats[n] = stats[n] || { played: 0, won: 0, best: null, streak: 0, bestStreak: 0 });

// ---------- State ----------
let S = null;          // { cols, stock, done, moves, score, suits, seed, won, counted }
let history = [];      // snapshots for undo
const els = new Map(); // card id -> element
let L = null;          // current layout
let pos = new Map();   // card id -> {x, y}
let hintList = null, hintAt = 0;

// Pick the next deal: from the list of solver-proven winnable deals, or any random shuffle.
function pickSeed(suits) {
  const list = settings.winnable && typeof WINNABLE !== 'undefined' && WINNABLE[suits];
  if (!list || !list.length) {
    if (settings.winnable) setTimeout(() => toast(`No checked ${suits}-suit deals yet, so this one is random`), 900);
    return { seed: Math.floor(Math.random() * 2 ** 31), winnable: false };
  }
  // avoid repeating a deal until most of the list has been played
  const recent = store.get('recent' + suits, []);
  const fresh = list.filter(s => !recent.includes(s));
  const pool = fresh.length ? fresh : list;
  const seed = pool[Math.floor(Math.random() * pool.length)];
  recent.push(seed);
  store.set('recent' + suits, recent.slice(-Math.floor(list.length * .8)));
  return { seed, winnable: true };
}

function newGame(suits = settings.suits, seed = null, winnable = false) {
  if (seed === null) ({ seed, winnable } = pickSeed(suits));
  const { cols, stock } = Spider.deal(suits, seed);
  const cards = [...cols.flat(), ...stock];
  S = { cols, stock, done: [], moves: 0, score: 500, suits, seed, winnable, won: false, counted: false };
  history = [];
  hintList = null;
  buildCards();
  layout();
  // start every card at the deck, then deal it out
  for (const c of cards) { pos.set(c.id, { x: L.stockX, y: L.stockY }); place(els.get(c.id), L.stockX, L.stockY, 0); els.get(c.id).style.opacity = 0; }
  requestAnimationFrame(() => requestAnimationFrame(() => render({ stagger: true })));
  save();
}

// A game counts as played once you make the first move.
function countPlayed() {
  if (S.counted) return;
  S.counted = true;
  statFor(S.suits).played++;
  store.set('stats', stats);
}

const snapshot = () => JSON.stringify({ cols: S.cols, stock: S.stock, done: S.done, moves: S.moves, score: S.score });
function pushHistory() { history.push(snapshot()); if (history.length > 1000) history.shift(); }
function save() { store.set('game', { S, history: history.slice(-300) }); updateRail(); }

// ---------- Rules ----------
function movableFrom(c, i) {
  const col = S.cols[c];
  if (!col[i] || !col[i].up) return false;
  for (let j = i; j < col.length - 1; j++)
    if (col[j + 1].s !== col[j].s || col[j + 1].r !== col[j].r - 1) return false;
  return true;
}
function canDrop(d, card) {
  const col = S.cols[d];
  if (!col.length) return true;
  const top = col[col.length - 1];
  return top.up && top.r === card.r + 1;
}
function flipTop(c) { const col = S.cols[c]; if (col.length && !col[col.length - 1].up) col[col.length - 1].up = true; }

// Remove a finished King-to-Ace run from the bottom of a column.
function collect(c) {
  const col = S.cols[c];
  if (col.length < 13) return false;
  const run = col.slice(-13);
  for (let j = 0; j < 13; j++) if (!run[j].up || run[j].r !== 13 - j || run[j].s !== run[0].s) return false;
  col.splice(-13);
  S.done.push(run[0].s);
  S.score += 100;
  flipTop(c);
  return true;
}

function moveRun(src, i, dst) {
  countPlayed();
  pushHistory();
  const run = S.cols[src].splice(i);
  S.cols[dst].push(...run);
  flipTop(src);
  S.moves++; S.score--;
  const cleared = collect(dst);
  afterChange(cleared);
}

function deal() {
  if (S.won) return;
  if (!S.stock.length) { toast('No more cards to deal'); return; }
  if (settings.strictDeal && S.cols.some(c => !c.length)) { toast('Fill every empty column before dealing'); return; }
  countPlayed();
  pushHistory();
  for (let c = 0; c < 10; c++) { const card = S.stock.pop(); card.up = true; S.cols[c].push(card); }
  S.moves++; S.score--;
  let cleared = false;
  for (let c = 0; c < 10; c++) cleared = collect(c) || cleared;
  afterChange(cleared, true);
}

function undo() {
  if (!history.length) return;
  const h = JSON.parse(history.pop());
  Object.assign(S, h);
  hintList = null;
  clearHint();
  render();
  save();
}

function afterChange(cleared, stagger) {
  hintList = null;
  clearHint();
  render({ stagger });
  save();
  if (S.done.length === 8) setTimeout(win, 700);
}

// ---------- Moves for taps and hints ----------
function destinations(c, i) {
  const card = S.cols[c][i];
  const out = [];
  for (let d = 0; d < 10; d++) {
    if (d === c || !canDrop(d, card)) continue;
    const col = S.cols[d];
    if (!col.length) { if (i > 0) out.push({ d, score: 1 }); continue; }
    out.push({ d, score: col[col.length - 1].s === card.s ? 4 : 2 });
  }
  return out.sort((a, b) => b.score - a.score || a.d - b.d);
}

function allMoves() {
  const res = [];
  S.cols.forEach((col, c) => {
    for (let i = col.length - 1; i >= 0 && movableFrom(c, i); i--) {
      const card = col[i], below = col[i - 1];
      const reveals = !!below && !below.up, empties = i === 0;
      const onRank = below && below.up && below.r === card.r + 1;
      if (onRank && below.s === card.s) continue;           // already in its natural place
      for (let d = 0; d < 10; d++) {
        if (d === c || !canDrop(d, card)) continue;
        const top = S.cols[d][S.cols[d].length - 1];
        let score;
        if (!top) {
          if (empties || onRank) continue;                  // pointless shuffle into a space
          score = reveals ? 3 : 1;
        } else {
          const same = top.s === card.s;
          if (onRank && !same) continue;                     // sideways move, gains nothing
          score = (same ? 4 : 2) + (reveals ? 3 : 0) + (empties ? 3 : 0) + (i > 0 && !empties && !reveals && !onRank ? 1 : 0);
        }
        res.push({ c, i, d, score });
      }
    }
  });
  return res.sort((a, b) => b.score - a.score);
}

function hint() {
  clearHint();
  if (S.won) return;
  if (!hintList) { hintList = allMoves(); hintAt = 0; }
  if (!hintList.length) {
    if (S.stock.length) { toast('No useful moves — try dealing'); const st = $('#stock'); st.classList.remove('pulse'); void st.offsetWidth; st.classList.add('pulse'); }
    else toast('No moves left — try Undo or a new game');
    return;
  }
  const m = hintList[hintAt++ % hintList.length];
  const ids = S.cols[m.c].slice(m.i).map(c => c.id);
  ids.forEach(id => els.get(id).classList.add('hint'));
  const dcol = S.cols[m.d];
  if (dcol.length) els.get(dcol[dcol.length - 1].id).classList.add('hint');
  else table.querySelectorAll('.slot')[m.d].classList.add('hint');
  clearTimeout(hint.t);
  hint.t = setTimeout(clearHint, 1600);
}
function clearHint() { table.querySelectorAll('.hint').forEach(e => e.classList.remove('hint')); }

// ---------- Layout and drawing ----------
function buildCards() {
  table.querySelectorAll('.card').forEach(e => e.remove());
  els.clear();
  pos.clear();
  const all = [...S.cols.flat(), ...S.stock];
  // completed cards no longer exist in state; make all 104 so undo can bring them back
  const ids = new Set(all.map(c => c.id));
  for (let id = 0; id < 104; id++) {
    const e = document.createElement('div');
    e.className = 'card';
    e.dataset.id = id;
    table.appendChild(e);
    els.set(id, e);
    if (!ids.has(id)) e.classList.add('gone');
  }
}

function layout() {
  const tw = table.clientWidth, th = table.clientHeight;
  const gap = Math.max(3, Math.round(tw * .008));
  let cw = (tw - 11 * gap) / 10, ch = cw * 1.4;
  if (ch > th * .4) { ch = th * .4; cw = ch / 1.4; }
  const left = (tw - (10 * cw + 9 * gap)) / 2;
  const tr = table.getBoundingClientRect();
  const sr = $('#stock').getBoundingClientRect(), dr = $('#done').getBoundingClientRect();
  L = {
    cw, ch, gap, top: gap, availH: th - gap * 2,
    colX: Array.from({ length: 10 }, (_, c) => left + c * (cw + gap)),
    stockX: sr.left - tr.left + 2, stockY: sr.top - tr.top + 2,
    doneX: dr.left - tr.left + 2, doneY: dr.top - tr.top + 2,
  };
  table.style.setProperty('--cw', cw + 'px');
  table.style.setProperty('--ch', ch + 'px');
  table.querySelectorAll('.slot').forEach(e => e.remove());
  L.colX.forEach(x => {
    const s = document.createElement('div');
    s.className = 'slot';
    s.style.transform = `translate(${x}px, ${L.top}px)`;
    table.prepend(s);
  });
}

// Vertical position of each card in a column, squeezed to fit the screen.
function fan(col) {
  const n = col.length;
  if (!n) return [];
  let down = L.ch * .1, up = L.ch * .27;
  let nd = 0, nu = 0;
  for (let i = 1; i < n; i++) col[i - 1].up ? nu++ : nd++;
  const room = L.availH - L.ch;
  if (nd * down + nu * up > room) {
    up = nu ? Math.max((room - nd * down) / nu, L.ch * .16) : up;
    if (nd * down + nu * up > room) {
      down = Math.min(down, L.ch * .05);
      up = nu ? Math.max((room - nd * down) / nu, L.ch * .08) : up;
    }
  }
  const out = [0];
  for (let i = 1; i < n; i++) out.push(out[i - 1] + (col[i - 1].up ? up : down));
  return out;
}

function place(e, x, y, z) {
  e.style.transform = `translate(${x}px, ${y}px)`;
  e.style.zIndex = z;
}
function setFace(e, card) {
  const key = card.up ? `f${card.r}-${card.s}-${settings.face}` : `b-${settings.back}`;
  if (e.dataset.key !== key) {
    e.dataset.key = key;
    e.style.backgroundImage = `url("${card.up ? Cards.faceURL(card.r, card.s, settings.face) : Cards.backURL(settings.back)}")`;
  }
}

function render(opts = {}) {
  const seen = new Set();
  let delay = 0;
  S.cols.forEach((col, c) => {
    const offs = fan(col);
    col.forEach((card, i) => {
      const e = els.get(card.id);
      seen.add(card.id);
      const x = L.colX[c], y = L.top + offs[i];
      const wasHidden = e.classList.contains('gone') || e.style.opacity === '0';
      e.classList.remove('gone', 'drag');
      setFace(e, card);
      const old = pos.get(card.id);
      if (opts.stagger && old && (old.x !== x || old.y !== y) && wasHidden) {
        e.style.transitionDelay = (delay++ * 35) + 'ms';
      } else e.style.transitionDelay = '0ms';
      e.style.opacity = 1;
      place(e, x, y, 10 + i + (opts.stagger && wasHidden ? 100 : 0));
      pos.set(card.id, { x, y });
    });
  });
  // cards in the deck sit hidden on the deck; finished runs fly to the completed pile
  for (const card of S.stock) {
    const e = els.get(card.id);
    seen.add(card.id);
    e.style.transitionDelay = '0ms';
    e.style.opacity = 0;
    setFace(e, card);
    place(e, L.stockX, L.stockY, 1);
    pos.set(card.id, { x: L.stockX, y: L.stockY });
  }
  els.forEach((e, id) => {
    if (seen.has(id)) return;
    if (!e.classList.contains('gone')) {
      e.style.transitionDelay = '0ms';
      e.classList.add('gone');
      place(e, L.doneX, L.doneY, 300 + id % 13);
      pos.set(id, { x: L.doneX, y: L.doneY });
    }
  });
  // reset stagger delays once the deal has finished
  if (opts.stagger) setTimeout(() => els.forEach(e => e.style.transitionDelay = '0ms'), 40 * delay + 250);
  updateRail();
}

function updateRail() {
  const deals = S.stock.length / 10;
  const st = $('#stock');
  st.innerHTML = deals
    ? Array.from({ length: deals }, (_, i) => `<img src="${Cards.backURL(settings.back)}" style="left:${i * 3}px;top:${-i * 0}px" alt="">`).join('') + `<span class="badge">${deals}</span>`
    : '<div class="empty"></div>';
  const dn = $('#done');
  dn.innerHTML = S.done.length
    ? S.done.map((s, i) => `<img src="${Cards.faceURL(13, s, settings.face)}" style="left:${i * 0}px;top:0" alt="">`).join('') + `<span class="badge">${S.done.length}/8</span>`
    : '<div class="empty"></div>';
  $('#bUndo').disabled = !history.length;
}

// ---------- Input: drag, tap ----------
let drag = null;
table.addEventListener('pointerdown', e => {
  if (drag || !S || S.won) return;
  const el = e.target.closest('.card');
  if (!el) return;
  const id = +el.dataset.id;
  let c = -1, i = -1;
  S.cols.forEach((col, ci) => { const k = col.findIndex(x => x.id === id); if (k >= 0) { c = ci; i = k; } });
  if (c < 0 || !S.cols[c][i].up) return;
  clearHint();
  if (!movableFrom(c, i)) { shake(el); return; }
  drag = { c, i, ids: S.cols[c].slice(i).map(x => x.id), x0: e.clientX, y0: e.clientY, moved: false, pid: e.pointerId };
  table.setPointerCapture(e.pointerId);
});
table.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pid) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.moved && Math.hypot(dx, dy) < 8) return;
  drag.moved = true;
  drag.dx = dx; drag.dy = dy;
  drag.ids.forEach((id, k) => {
    const el = els.get(id), p = pos.get(id);
    el.classList.add('drag');
    place(el, p.x + dx, p.y + dy, 500 + k);
  });
});
const endDrag = e => {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag;
  drag = null;
  if (!d.moved) { tapMove(d.c, d.i); return; }
  const card = S.cols[d.c][d.i];
  const x = pos.get(d.ids[0]).x + d.dx;
  // choose the legal column the dragged card overlaps most
  let best = -1, bestOverlap = 0;
  L.colX.forEach((cx, k) => {
    if (k === d.c || !canDrop(k, card)) return;
    const overlap = Math.min(x + L.cw, cx + L.cw) - Math.max(x, cx);
    if (overlap > bestOverlap) { bestOverlap = overlap; best = k; }
  });
  d.ids.forEach(id => els.get(id).classList.remove('drag'));
  if (best >= 0 && bestOverlap > L.cw * .25) moveRun(d.c, d.i, best);
  else render();
};
table.addEventListener('pointerup', endDrag);
table.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pid) { drag.moved = true; drag.dx = -1e6; endDrag(e); } });

function tapMove(c, i) {
  const dests = destinations(c, i);
  if (!dests.length) { shake(els.get(S.cols[c][i].id)); return; }
  moveRun(c, i, dests[0].d);
}
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Winning ----------
function win() {
  if (S.won) return;
  S.won = true;
  const st = statFor(S.suits);
  st.won++;
  st.streak++;
  st.bestStreak = Math.max(st.bestStreak, st.streak);
  if (st.best === null || S.moves < st.best) st.best = S.moves;
  store.set('stats', stats);
  save();
  const suit = S.done[S.done.length - 1] ?? 0;
  $('#winCards').innerHTML = [11, 12, 13].map(r => `<img src="${Cards.faceURL(r, suit, settings.face)}" alt="">`).join('');
  $('#winText').textContent = `${S.moves} moves · score ${S.score} · ${S.suits} suit${S.suits > 1 ? 's' : ''}`;
  $('#win').classList.add('open');
}
// Starting a new game while one is unfinished breaks the winning streak.
function abandon() { if (S && S.counted && !S.won) { statFor(S.suits).streak = 0; store.set('stats', stats); } }

// ---------- Menu ----------
function openMenu(tab = 'game') {
  showTab(tab);
  $('#strict').checked = settings.strictDeal;
  $('#winnable').checked = settings.winnable;
  document.querySelectorAll('#newGame .choice').forEach(b => b.classList.toggle('on', +b.dataset.suits === settings.suits));
  $('#gameInfo').textContent = `This game: ${S.suits} suit${S.suits > 1 ? 's' : ''} · ${S.winnable ? 'winnable deal' : 'random deal'} · ${S.moves} moves · score ${S.score} · ${S.done.length} of 8 runs complete`;
  drawLook();
  drawStats();
  $('#menu').classList.add('open');
}
const closeMenu = () => $('#menu').classList.remove('open');
function showTab(tab) {
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.dataset.page === tab));
}
function drawLook() {
  $('#faceChoices').innerHTML = Object.entries(Cards.STYLES).map(([k, st]) =>
    `<button class="choice${settings.face === k ? ' on' : ''}" data-face="${k}">` +
    [11, 12, 13].map((r, i) => `<img src="${Cards.faceURL(r, i === 1 ? 1 : 0, k)}" alt="">`).join('') +
    `<small>${st.name}</small></button>`).join('');
  $('#backChoices').innerHTML = Object.entries(Cards.BACKS).map(([k, b]) =>
    `<button class="choice${settings.back === k ? ' on' : ''}" data-back="${k}"><img src="${Cards.backURL(k)}" alt=""><small>${b.name}</small></button>`).join('');
}
function drawStats() {
  const rows = [1, 2, 4].map(n => {
    const s = statFor(n);
    const pct = s.played ? Math.round(100 * s.won / s.played) + '%' : '–';
    return `<tr><td>${n} suit${n > 1 ? 's' : ''}</td><td>${s.played}</td><td>${s.won}</td><td>${pct}</td><td>${s.best ?? '–'}</td><td>${s.streak}</td><td>${s.bestStreak}</td></tr>`;
  });
  $('#statsTable').innerHTML = '<tr><th></th><th>Played</th><th>Won</th><th>Win %</th><th>Fewest moves</th><th>Streak</th><th>Best streak</th></tr>' + rows.join('');
}

$('#bMenu').onclick = () => openMenu();
$('#mClose').onclick = closeMenu;
$('#menu').addEventListener('pointerdown', e => { if (e.target.id === 'menu') closeMenu(); });
document.querySelectorAll('.tabs [data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
$('#newGame').onclick = e => {
  const b = e.target.closest('[data-suits]');
  if (!b) return;
  settings.suits = +b.dataset.suits;
  saveSettings();
  abandon();
  closeMenu();
  newGame(settings.suits);
};
$('#restart').onclick = () => { abandon(); closeMenu(); newGame(S.suits, S.seed, S.winnable); };
$('#strict').onchange = e => { settings.strictDeal = e.target.checked; saveSettings(); };
$('#winnable').onchange = e => { settings.winnable = e.target.checked; saveSettings(); };
$('#faceChoices').onclick = e => {
  const b = e.target.closest('[data-face]');
  if (!b) return;
  settings.face = b.dataset.face; saveSettings(); drawLook(); render();
};
$('#backChoices').onclick = e => {
  const b = e.target.closest('[data-back]');
  if (!b) return;
  settings.back = b.dataset.back; saveSettings(); drawLook(); render();
};
$('#resetStats').onclick = () => { if (confirm('Clear all statistics?')) { stats = {}; store.set('stats', stats); drawStats(); } };
$('#winNew').onclick = () => { $('#win').classList.remove('open'); newGame(settings.suits); };

$('#bUndo').onclick = undo;
$('#bHint').onclick = hint;
$('#stock').onclick = deal;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.key === 'h') hint();
  if (e.key === 'd') deal();
});

let resizeT;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (S) { layout(); els.forEach(e => e.classList.add('drag')); render(); requestAnimationFrame(() => els.forEach(e => e.classList.remove('drag'))); } }, 120); });

// ---------- Start ----------
(function start() {
  const saved = store.get('game', null);
  if (saved && saved.S && saved.S.cols && !saved.S.won) {
    S = saved.S;
    history = saved.history || [];
    buildCards();
    layout();
    els.forEach(e => e.classList.add('drag'));
    render();
    requestAnimationFrame(() => els.forEach(e => e.classList.remove('drag')));
  } else newGame(settings.suits);
})();
