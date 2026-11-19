// Background worker: tries deals in turn and reports which ones the solver can win.
importScripts('../solver.js');
onmessage = e => {
  const { suits, start, count, step = 1, opts } = e.data;
  for (let k = 0; k < count; k++) {
    const seed = start + k * step;
    const d = Spider.deal(suits, seed);
    const t0 = Date.now();
    const r = opts && opts.dfs ? Spider.solve(d.cols, d.stock, opts.nodes || 100000) : Spider.solveStaged(d.cols, d.stock, opts);
    postMessage({ suits, seed, won: r.won, nodes: r.nodes, moves: r.moves, ms: Date.now() - t0 });
  }
  postMessage({ finished: true });
};
