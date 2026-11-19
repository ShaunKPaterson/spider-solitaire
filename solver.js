// solver.js — the shuffle/deal shared by the game, and a solver that proves a deal can be won.
// The solver knows where every face-down card is, so "solved" means a winning line of play exists.
// It plays by the traditional rule (no dealing while a column is empty), so a deal it wins
// is winnable whichever rule the player chooses.
const Spider = (() => {
  function rng(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // The deal: 10 columns (6,6,6,6,5,5,5,5,5,5) with only the last card face up, 50 cards in the stock.
  function deal(suits, seed) {
    const rand = rng(seed);
    const suitList = suits === 1 ? [0] : suits === 2 ? [0, 1] : [0, 1, 2, 3];
    const cards = [];
    let id = 0;
    for (let d = 0; d < 8; d++) {
      const s = suitList[d % suitList.length];
      for (let r = 1; r <= 13; r++) cards.push({ id: id++, r, s, up: false });
    }
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    const cols = Array.from({ length: 10 }, () => []);
    let k = 0;
    for (let c = 0; c < 10; c++) {
      const n = c < 4 ? 6 : 5;
      for (let i = 0; i < n; i++) cols[c].push(cards[k++]);
      cols[c][n - 1].up = true;
    }
    return { cols, stock: cards.slice(k) };
  }

  // ---------- Solver ----------
  // A card is a small number: rank (1-13) + suit*16, plus 64 when face up.
  const R = x => x & 15, SU = x => (x >> 4) & 3, UP = 64;
  const code = c => c.r + c.s * 16 + (c.up ? UP : 0);

  function flip(col) { const n = col.length; if (n && !(col[n - 1] & UP)) col[n - 1] |= UP; }
  // Remove a finished King-to-Ace run from the end of a column; returns 1 if one was removed.
  function collect(col) {
    const n = col.length;
    if (n < 13) return 0;
    const s = SU(col[n - 1]);
    for (let j = 0; j < 13; j++) { const x = col[n - 1 - j]; if (!(x & UP) || R(x) !== j + 1 || SU(x) !== s) return 0; }
    col.length = n - 13;
    flip(col);
    return 1;
  }

  // Length of the same-suit descending run at the end of a column.
  function tailRun(col) {
    let n = col.length;
    if (!n) return 0;
    let k = 1;
    while (k < n) {
      const a = col[n - k - 1], b = col[n - k];
      if (!(a & UP) || R(a) !== R(b) + 1 || SU(a) !== SU(b)) break;
      k++;
    }
    return k;
  }

  function moves(cols, stockLeft, allowDeal = true) {
    const res = [];
    let firstEmpty = -1;
    for (let d = 0; d < 10; d++) if (!cols[d].length) { firstEmpty = d; break; }
    for (let c = 0; c < 10; c++) {
      const col = cols[c], n = col.length;
      for (let i = n - 1; i >= 0; i--) {
        const x = col[i];
        if (!(x & UP)) break;
        if (i < n - 1) { const y = col[i + 1]; if (R(y) !== R(x) - 1 || SU(y) !== SU(x)) break; }
        const r = R(x), s = SU(x);
        const b = i > 0 ? col[i - 1] : -1;
        const bUp = b >= 0 && (b & UP);
        const onRank = bUp && R(b) === r + 1;
        const natural = onRank && SU(b) === s;             // already sitting in its natural place
        const reveals = b >= 0 && !bUp, empties = i === 0, len = n - i;
        // The rule says empty columns must be filled before dealing, so tidy cards may need to move into one.
        const mustFill = stockLeft && firstEmpty >= 0;
        for (let d = 0; d < 10; d++) {
          if (d === c) continue;
          const dc = cols[d];
          let score;
          if (!dc.length) {
            if (d !== firstEmpty || empties) continue;
            if (onRank && !mustFill) continue;
            score = onRank ? -10 - len : (reveals ? 40 : 2) + len;
          } else {
            if (natural) continue;
            const t = dc[dc.length - 1];
            if (R(t) !== r + 1) continue;
            const same = SU(t) === s;
            if (onRank && !same) continue;                 // sideways: gains nothing
            score = (same ? 30 : 8) + (reveals ? 40 : 0) + (empties ? 35 : 0) + len;
            if (same && tailRun(dc) + len >= 13) score += 500;  // completes a run
          }
          res.push({ c, i, d, score });
        }
      }
    }
    res.sort((a, b) => b.score - a.score);
    if (allowDeal && stockLeft && firstEmpty < 0) res.push({ deal: true });
    return res;
  }

  function apply(cols, stock, m) {
    const nc = cols.slice();
    let gained = 0, nstock = stock;
    if (m.deal) {
      nstock = stock.slice();
      for (let c = 0; c < 10; c++) { nc[c] = cols[c].slice(); nc[c].push(nstock.pop() | UP); }
      for (let c = 0; c < 10; c++) gained += collect(nc[c]);
    } else {
      const src = nc[m.c] = cols[m.c].slice(), dst = nc[m.d] = cols[m.d].slice();
      const run = src.splice(m.i);
      for (const x of run) dst.push(x);
      flip(src);
      gained = collect(dst);
    }
    return { cols: nc, stock: nstock, gained };
  }

  const key = (cols, sl) => cols.map(c => c.join(',')).sort().join('/') + '#' + sl;

  // Depth-first search with good move ordering and memory of positions already explored.
  function solve(cols0, stock0, maxNodes = 200000) {
    const seen = new Set();
    let nodes = 0, won = false;
    const cols = cols0.map(col => col.map(code));
    const stock = stock0.map(code);
    const done0 = 8 - (cols.flat().length + stock.length) / 13;
    // explicit stack so long games don't overflow the call stack
    const stack = [{ cols, stock, done: done0, list: null, at: 0 }];
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.done === 8) { won = true; break; }
      if (!top.list) {
        if (++nodes > maxNodes) break;
        const k = key(top.cols, top.stock.length);
        if (seen.has(k)) { stack.pop(); continue; }
        seen.add(k);
        top.list = moves(top.cols, top.stock.length);
      }
      if (top.at >= top.list.length) { stack.pop(); continue; }
      const m = top.list[top.at++];
      const nx = apply(top.cols, top.stock, m);
      stack.push({ cols: nx.cols, stock: nx.stock, done: top.done + nx.gained, list: null, at: 0 });
    }
    return { won, nodes, moves: won ? stack.length - 1 : 0 };
  }

  // How promising a position looks: fewer hidden cards, more same-suit links, empty columns, finished runs.
  function evaluate(cols, stockLeft, done) {
    let v = done * 2000 + stockLeft * 4;
    for (const col of cols) {
      const n = col.length;
      if (!n) { v += 100; continue; }
      for (let i = 0; i < n; i++) {
        const x = col[i];
        if (!(x & UP)) { v -= 120; continue; }
        if (i + 1 < n) {
          const y = col[i + 1];
          if (R(x) === R(y) + 1) v += SU(x) === SU(y) ? 20 : 4;
        }
      }
      if (R(col[0]) === 13 && (col[0] & UP)) v += 6;       // a King at the head of a column is ideal
    }
    return v;
  }

  function heap() {
    const h = [];
    return {
      get size() { return h.length; },
      push(n) { h.push(n); let i = h.length - 1; while (i) { const p = (i - 1) >> 1; if (h[p].v >= h[i].v) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } },
      pop() {
        const top = h[0], last = h.pop();
        if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < h.length && h[l].v > h[m].v) m = l; if (r < h.length && h[r].v > h[m].v) m = r;
          if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } }
        return top;
      },
    };
  }

  // Explore positions reachable WITHOUT dealing, most promising first. Returns every position visited.
  function explore(start, budget, seen) {
    const q = heap(), visited = [];
    q.push(start);
    let nodes = 0;
    while (q.size && nodes < budget) {
      const s = q.pop();
      nodes++;
      visited.push(s);
      if (s.done === 8) return { won: s, visited, nodes };
      for (const m of moves(s.cols, s.stock.length, false)) {
        const nx = apply(s.cols, s.stock, m);
        const k = key(nx.cols, nx.stock.length);
        if (seen.has(k)) continue;
        seen.add(k);
        const done = s.done + nx.gained;
        q.push({ cols: nx.cols, stock: nx.stock, done, v: evaluate(nx.cols, 0, done), depth: s.depth + 1 });
      }
    }
    return { won: null, visited, nodes };
  }

  // Staged search: between deals, find the tidiest positions reachable; deal from the best few; repeat.
  function solveStaged(cols0, stock0, opts = {}) {
    const beam = opts.beam || 6, per = opts.per || 4000, keep = opts.keep || 3;
    const cols = cols0.map(col => col.map(code));
    const stock = stock0.map(code);
    const done0 = 8 - (cols.flat().length + stock.length) / 13;
    let frontier = [{ cols, stock, done: done0, v: 0, depth: 0 }];
    let nodes = 0;
    for (;;) {
      const seen = new Set();   // positions from different stages can never match, so remember one stage at a time
      const cands = [];
      const last = !frontier[0].stock.length;
      for (const f of frontier) {
        const r = explore(f, last ? per * 3 : per, seen);
        nodes += r.nodes;
        if (r.won) return { won: true, nodes, moves: r.won.depth };
        // best few dealable positions from this branch (no empty columns allowed before a deal)
        r.visited.filter(s => s.cols.every(c => c.length)).sort((a, b) => b.v - a.v).slice(0, keep).forEach(s => cands.push(s));
      }
      if (last || !cands.length) return { won: false, nodes, moves: 0 };
      cands.sort((a, b) => b.v - a.v);
      frontier = cands.slice(0, beam).map(s => {
        const nx = apply(s.cols, s.stock, { deal: true });
        return { cols: nx.cols, stock: nx.stock, done: s.done + nx.gained, v: 0, depth: s.depth + 1 };
      });
    }
  }

  return { deal, solve, solveStaged, rng };
})();
if (typeof module !== 'undefined') module.exports = Spider;
