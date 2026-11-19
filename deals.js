// Deals the solver has proven winnable (seed numbers for Spider.deal), by number of suits.
// Generated with tools/generate.html.
const WINNABLE = (() => {
  const range = (from, to, skip) => { const a = []; for (let s = from; s <= to; s++) if (!skip.includes(s)) a.push(s); return a; };
  return {
    1: range(100000, 100399, [100005, 100080, 100136, 100146, 100148, 100213, 100347]),
    2: [200000, 200002, 200003, 200005, 200006, 200007, 200008, 200009, 200010, 200011, 200012, 200015, 200017, 200019, 200020, 200023],
    4: [],
  };
})();
