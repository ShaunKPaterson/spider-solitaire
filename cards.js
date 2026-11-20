// cards.js — draws every card face and back as SVG, so the game needs no image files.
// Cards are 200 x 310 units (taller than a standard card, like most phone solitaire games).
// Faces are cached as data URLs for speed.
const Cards = (() => {
  const W = 200, H = 310;
  const PH = 224;   // height of the picture panel on Jack, Queen and King
  const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RED = '#c4122f', BLACK = '#17181c';
  const isRed = s => s === 1 || s === 2;            // 0 spades, 1 hearts, 2 diamonds, 3 clubs
  const suitColour = s => isRed(s) ? RED : BLACK;

  // Suit shapes drawn in a 100 x 100 box.
  function suitShape(s, fill) {
    switch (s) {
      case 0: return `<path fill="${fill}" d="M50 4C50 4 8 38 8 62C8 79 23 87 36 81C41 79 45 75 47 70C46 82 41 90 32 96H68C59 90 54 82 53 70C55 75 59 79 64 81C77 87 92 79 92 62C92 38 50 4 50 4Z"/>`;
      case 1: return `<path fill="${fill}" d="M50 94C50 94 5 62 5 32C5 16 17 6 30 6C40 6 47 12 50 21C53 12 60 6 70 6C83 6 95 16 95 32C95 62 50 94 50 94Z"/>`;
      case 2: return `<path fill="${fill}" d="M50 3C60 20 74 36 90 50C74 64 60 80 50 97C40 80 26 64 10 50C26 36 40 20 50 3Z"/>`;
      default: return `<g fill="${fill}"><circle cx="50" cy="27" r="21"/><circle cx="26" cy="58" r="21"/><circle cx="74" cy="58" r="21"/><rect x="38" y="40" width="24" height="22"/><path d="M46 56C46 76 40 88 30 96H70C60 88 54 76 54 56Z"/></g>`;
    }
  }
  // Place a suit symbol with its top-left at (x,y), `size` units wide; flip turns it upside down.
  const suit = (s, x, y, size, fill, flip) =>
    `<g transform="translate(${x} ${y}) scale(${size / 100})${flip ? ' rotate(180 50 50)' : ''}">${suitShape(s, fill)}</g>`;

  // Classic pip positions: [column (0 left,1 middle,2 right), row 0..1]
  const PIPS = {
    2: [[1, 0], [1, 1]],
    3: [[1, 0], [1, .5], [1, 1]],
    4: [[0, 0], [2, 0], [0, 1], [2, 1]],
    5: [[0, 0], [2, 0], [1, .5], [0, 1], [2, 1]],
    6: [[0, 0], [2, 0], [0, .5], [2, .5], [0, 1], [2, 1]],
    7: [[0, 0], [2, 0], [1, .25], [0, .5], [2, .5], [0, 1], [2, 1]],
    8: [[0, 0], [2, 0], [1, .25], [0, .5], [2, .5], [1, .75], [0, 1], [2, 1]],
    9: [[0, 0], [2, 0], [0, 1 / 3], [2, 1 / 3], [1, .5], [0, 2 / 3], [2, 2 / 3], [0, 1], [2, 1]],
    10: [[0, 0], [2, 0], [1, 1 / 6], [0, 1 / 3], [2, 1 / 3], [0, 2 / 3], [2, 2 / 3], [1, 5 / 6], [0, 1], [2, 1]],
  };

  const FONT = `font-family="Roboto, 'Segoe UI', Arial, sans-serif" font-weight="700"`;

  function index(rank, s, col) {
    const label = RANKS[rank];
    const fit = label === '10' ? ` textLength="70" lengthAdjust="spacingAndGlyphs"` : '';
    return `<text x="14" y="62" ${FONT} font-size="62" fill="${col}"${fit}>${label}</text>` +
      suit(s, 136, 14, 50, col);
  }

  function frame(inner) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
      `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="13" fill="#fff" stroke="#9a9a9a" stroke-width="2"/>` +
      inner + `</svg>`;
  }

  // ---------- Picture cards ----------
  // Each style is a palette plus a few drawing choices. The figure is drawn in a 156 x 196 panel.
  const STYLES = {
    royal: {
      name: 'Royal',
      blurb: 'Colourful and traditional: ermine, jewels and rich robes.',
      bg: '#fbf1dc', bgLine: '#ead7ae', frame: '#b8892b',
      skin: '#f3c9a2', cheek: '#ec9a8a', hair: ['#5b3a1e', '#7a4a22', '#3b2614'],
      robe: { 13: ['#8e1b2b', '#1f3f8a'], 12: ['#2f6b3a', '#6b2c7a'], 11: ['#1f5c8a', '#b5651d'] },
      gold: '#e0b23a', goldDark: '#a77d18', line: '#3a2a1a', lineW: 2, features: 'full',
    },
    deco: {
      name: 'Art Deco',
      blurb: 'Gold figures on a dark sunburst, 1920s geometry.',
      bg: '#14213d', bgLine: '#1d2f55', frame: '#d4af37',
      skin: '#f2e3c4', cheek: null, hair: ['#d4af37', '#d4af37', '#d4af37'],
      robe: { 13: ['#0f1a30', '#0f1a30'], 12: ['#0f1a30', '#0f1a30'], 11: ['#0f1a30', '#0f1a30'] },
      gold: '#d4af37', goldDark: '#9c7c1e', line: '#d4af37', lineW: 2.2, features: 'deco',
    },
    modern: {
      name: 'Modern',
      blurb: 'Bold flat shapes, clean and easy to read.',
      bg: '#ffffff', bgLine: '#f1f1f1', frame: null,
      skin: '#f6d2b8', cheek: null, hair: ['#17181c', '#17181c', '#17181c'],
      robe: null, // uses the suit colour
      gold: '#f2b705', goldDark: '#c99400', line: 'none', lineW: 0, features: 'min',
    },
  };

  function background(st, s) {
    if (st === STYLES.deco) {
      let rays = '';
      for (let i = 0; i < 18; i++) {
        const a0 = Math.PI * (i / 18), a1 = Math.PI * ((i + .5) / 18);
        const r = 300, cx = 78, cy = PH;
        rays += `<path d="M${cx} ${cy}L${cx - r * Math.cos(a0)} ${cy - r * Math.sin(a0)}L${cx - r * Math.cos(a1)} ${cy - r * Math.sin(a1)}Z" fill="${st.bgLine}"/>`;
      }
      return `<rect width="156" height="${PH}" fill="${st.bg}"/>${rays}` +
        `<circle cx="78" cy="${PH}" r="150" fill="none" stroke="${st.gold}" stroke-width="1" opacity=".5"/>` +
        `<circle cx="78" cy="${PH}" r="128" fill="none" stroke="${st.gold}" stroke-width="1" opacity=".35"/>`;
    }
    if (st === STYLES.royal) {
      let d = '';
      for (let x = -PH; x < 156; x += 14) d += `M${x} ${PH}L${x + PH} 0`;
      for (let x = 0; x < 156 + PH; x += 14) d += `M${x} ${PH}L${x - PH} 0`;
      return `<rect width="156" height="${PH}" fill="${st.bg}"/><path d="${d}" stroke="${st.bgLine}" stroke-width="1.2"/>`;
    }
    // modern: a soft suit-coloured circle behind the figure
    return `<rect width="156" height="${PH}" fill="${st.bg}"/><circle cx="78" cy="120" r="70" fill="${isRed(s) ? '#fde8ea' : '#eceef3'}"/>`;
  }

  function figure(rank, s, st) {
    const L = st.line, LW = st.lineW;
    const stroke = L === 'none' ? '' : ` stroke="${L}" stroke-width="${LW}" stroke-linejoin="round"`;
    const sc = suitColour(s);
    const red = isRed(s);
    const robeMain = st.robe ? st.robe[rank][red ? 0 : 1] : sc;
    const robeAlt = st === STYLES.modern ? st.gold : st.gold;
    const hair = st.hair[rank - 11];
    let g = '';

    // Behind-the-head hair for the Queen
    if (rank === 12) {
      g += `<path d="M48 84C44 56 58 48 78 48C98 48 112 56 108 84L114 128C104 126 96 118 94 108H62C60 118 52 126 42 128Z" fill="${hair}"${stroke}/>`;
    }

    // Robe / shoulders
    g += `<path d="M10 196L22 140C30 122 54 114 78 114C102 114 126 122 134 140L146 196Z" fill="${robeMain}"${stroke}/>`;

    if (st === STYLES.deco) {
      // chevron bands down the robe
      for (let i = 0; i < 4; i++) {
        const y = 140 + i * 15;
        g += `<path d="M${40 - i * 4} ${y}L78 ${y + 12}L${116 + i * 4} ${y}" fill="none" stroke="${st.gold}" stroke-width="2"/>`;
      }
      g += `<path d="M78 114V196" stroke="${st.gold}" stroke-width="1.5"/>`;
    }

    // Rank-specific clothing
    if (rank === 13) {
      // ermine collar
      const ermine = st === STYLES.deco ? st.gold : '#fbfbf7';
      const spot = st === STYLES.deco ? st.bg : '#1b1b1b';
      g += `<path d="M24 138C40 120 60 116 78 116C96 116 116 120 132 138L124 150C110 136 94 132 78 132C62 132 46 136 32 150Z" fill="${ermine}"${stroke}/>`;
      if (st !== STYLES.modern) [[40, 136], [56, 128], [78, 125], [100, 128], [116, 136]].forEach(([x, y]) =>
        g += `<path d="M${x} ${y - 3}V${y + 4}M${x - 2.5} ${y + 1}H${x + 2.5}" stroke="${spot}" stroke-width="1.8"/>`);
    } else if (rank === 12) {
      // square neckline with a necklace
      g += `<path d="M58 116L78 140L98 116" fill="${st === STYLES.modern ? '#fff' : st.skin}"${stroke}/>`;
      g += `<path d="M60 118Q78 138 96 118" fill="none" stroke="${st.gold}" stroke-width="2.5"/>`;
      g += `<circle cx="78" cy="132" r="4" fill="${red ? '#e8364f' : '#2c6fd1'}" stroke="${st.gold}" stroke-width="1.5"/>`;
    } else {
      // Jack: tunic collar and buttons
      g += `<path d="M56 116L78 134L100 116L96 112H60Z" fill="${robeAlt}"${stroke}/>`;
      [148, 162, 176].forEach(y => g += `<circle cx="78" cy="${y}" r="3.2" fill="${robeAlt}"/>`);
    }

    // Suit emblem on the chest
    const emblemFill = st === STYLES.deco ? st.gold : (st === STYLES.modern ? '#ffffff' : '#fff8e6');
    g += `<circle cx="${rank === 11 ? 112 : 78}" cy="${rank === 11 ? 160 : 166}" r="15" fill="${emblemFill}"${st === STYLES.modern ? '' : ` stroke="${st.gold}" stroke-width="2"`}/>`;
    g += suit(s, (rank === 11 ? 112 : 78) - 10, (rank === 11 ? 160 : 166) - 10, 20, st === STYLES.deco ? st.bg : sc);

    // Neck and head
    g += `<rect x="70" y="96" width="16" height="20" fill="${st.skin}"${stroke}/>`;
    g += `<circle cx="78" cy="80" r="24" fill="${st.skin}"${stroke}/>`;

    // Hair on the head
    if (rank === 13) g += `<path d="M54 76C54 62 64 56 78 56C92 56 102 62 102 76C98 68 90 66 78 66C66 66 58 68 54 76Z" fill="${hair}"/>`;
    if (rank === 12) g += `<path d="M54 80C54 62 64 55 78 55C92 55 102 62 102 80C96 70 90 64 78 64C66 64 60 70 54 80Z" fill="${hair}"/>`;
    if (rank === 11) g += `<path d="M54 82C52 64 62 56 78 56C94 56 104 64 102 82L98 74C90 70 66 70 58 74Z" fill="${hair}"/>`;

    // Face
    if (st.features === 'full') {
      g += `<path d="M66 76Q70 73 74 76M82 76Q86 73 90 76" fill="none" stroke="${L}" stroke-width="1.6" stroke-linecap="round"/>`;
      g += `<circle cx="70" cy="80" r="2.2" fill="${L}"/><circle cx="86" cy="80" r="2.2" fill="${L}"/>`;
      g += `<path d="M78 82L76 89H80" fill="none" stroke="${L}" stroke-width="1.3" stroke-linecap="round"/>`;
      if (st.cheek) g += `<circle cx="65" cy="88" r="4" fill="${st.cheek}" opacity=".55"/><circle cx="91" cy="88" r="4" fill="${st.cheek}" opacity=".55"/>`;
      if (rank !== 13) g += `<path d="M71 94Q78 99 85 94" fill="none" stroke="${rank === 12 ? '#b8323f' : L}" stroke-width="1.8" stroke-linecap="round"/>`;
    } else if (st.features === 'deco') {
      g += `<path d="M66 79H74M82 79H90M78 80V88H80M72 95H84" fill="none" stroke="${st.bg}" stroke-width="2" stroke-linecap="square"/>`;
    } else {
      g += `<path d="M66 81Q70 78 74 81M82 81Q86 78 90 81" fill="none" stroke="#17181c" stroke-width="2.4" stroke-linecap="round"/>`;
    }

    // King's beard and moustache
    if (rank === 13) {
      g += `<path d="M55 84C56 106 66 118 78 118C90 118 100 106 101 84C96 94 88 98 78 98C68 98 60 94 55 84Z" fill="${hair}"${stroke}/>`;
      g += `<path d="M66 93Q72 88 78 92Q84 88 90 93Q84 96 78 94Q72 96 66 93Z" fill="${hair}"/>`;
    }

    // Headwear
    const gs = L === 'none' ? '' : ` stroke="${st === STYLES.deco ? st.goldDark : st.goldDark}" stroke-width="1.5" stroke-linejoin="round"`;
    if (rank === 13) {
      g += `<path d="M54 62L52 32L64 46L71 26L78 42L85 26L92 46L104 32L102 62Z" fill="${st.gold}"${gs}/>`;
      g += `<rect x="53" y="56" width="50" height="9" rx="2" fill="${st.goldDark}"/>`;
      [[64, 60.5, '#d62839'], [78, 60.5, '#2a7bd4'], [92, 60.5, '#2a9d55']].forEach(([x, y, c]) =>
        g += `<circle cx="${x}" cy="${y}" r="3" fill="${st === STYLES.deco ? st.bg : c}"/>`);
      [[52, 32], [71, 26], [85, 26], [104, 32]].forEach(([x, y]) => g += `<circle cx="${x}" cy="${y}" r="3" fill="${st.gold}"/>`);
    } else if (rank === 12) {
      g += `<path d="M58 60Q78 50 98 60L94 50L86 54L78 38L70 54L62 50Z" fill="${st.gold}"${gs}/>`;
      g += `<circle cx="78" cy="48" r="3.4" fill="${st === STYLES.deco ? st.bg : (red ? '#e8364f' : '#2c6fd1')}"/>`;
    } else {
      // Jack's cap with a feather
      const cap = st === STYLES.deco ? st.gold : (st === STYLES.modern ? sc : robeMain);
      g += `<path d="M98 54C108 40 118 26 134 14C126 32 116 46 104 58Z" fill="${st === STYLES.deco ? st.goldDark : (red ? '#f2b705' : '#d8452b')}"${stroke}/>`;
      g += `<path d="M50 66C48 48 62 40 80 40C98 40 108 50 106 62C90 56 68 58 50 66Z" fill="${cap}"${stroke}/>`;
      g += `<path d="M50 66C68 58 90 56 106 62" fill="none" stroke="${st.gold}" stroke-width="3"/>`;
    }

    // What each figure holds
    if (rank === 13) {
      // sceptre
      g += `<rect x="124" y="70" width="5" height="110" rx="2" fill="${st.gold}"${gs}/>`;
      g += `<circle cx="126.5" cy="66" r="9" fill="${st.gold}"${gs}/>`;
      g += `<path d="M126.5 52V60M122.5 56H130.5" stroke="${st.gold}" stroke-width="3"/>`;
      g += `<ellipse cx="126.5" cy="170" rx="9" ry="7" fill="${st.skin}"${stroke}/>`;
    } else if (rank === 12) {
      // a rose
      const petal = st === STYLES.deco ? st.gold : (red ? '#e8364f' : '#d64a7a');
      g += `<path d="M128 178C128 150 130 120 132 98" fill="none" stroke="${st === STYLES.deco ? st.gold : '#2f7d32'}" stroke-width="3"/>`;
      g += `<path d="M130 140Q142 132 146 120Q134 124 130 140Z" fill="${st === STYLES.deco ? st.gold : '#3e9d44'}"/>`;
      g += `<circle cx="132" cy="92" r="11" fill="${petal}"${stroke}/>`;
      g += `<path d="M126 92Q132 84 138 92Q132 98 126 92Z" fill="none" stroke="${st === STYLES.deco ? st.bg : '#7a1020'}" stroke-width="1.6"/>`;
      g += `<ellipse cx="128" cy="172" rx="9" ry="7" fill="${st.skin}"${stroke}/>`;
    } else {
      // sword held upright
      g += `<path d="M30 60L35 52L40 60V156H30Z" fill="${st === STYLES.deco ? st.skin : '#d9dde3'}"${stroke}/>`;
      g += `<rect x="20" y="156" width="30" height="6" rx="2" fill="${st.gold}"${gs}/>`;
      g += `<rect x="31" y="162" width="8" height="18" fill="${st.goldDark}"/>`;
      g += `<ellipse cx="35" cy="172" rx="9" ry="7" fill="${st.skin}"${stroke}/>`;
    }
    return g;
  }

  function faceCard(rank, s, styleKey) {
    const st = STYLES[styleKey] || STYLES.royal;
    const col = suitColour(s);
    const border = st.frame ? `<rect x="22" y="72" width="156" height="${PH}" rx="8" fill="none" stroke="${st.frame}" stroke-width="3"/>` : '';
    return frame(index(rank, s, col) +
      `<defs><clipPath id="p"><rect x="0" y="0" width="156" height="${PH}" rx="8"/></clipPath></defs>` +
      `<g transform="translate(22 72)" clip-path="url(#p)">${background(st, s)}<g transform="translate(0 ${PH - 196})">${figure(rank, s, st)}</g></g>` + border);
  }

  function numberCard(rank, s) {
    const col = suitColour(s);
    let body = index(rank, s, col);
    if (rank === 1) {
      body += `<circle cx="100" cy="190" r="72" fill="none" stroke="${col}" stroke-width="2" opacity=".25"/>`;
      body += suit(s, 50, 140, 100, col);
    } else {
      const xs = [50, 100, 150], top = 104, bottom = 276, size = 36;
      for (const [c, r] of PIPS[rank]) {
        const cx = xs[c], cy = top + r * (bottom - top);
        body += suit(s, cx - size / 2, cy - size / 2, size, col, r > .5);
      }
    }
    return frame(body);
  }

  // ---------- Card backs ----------
  const BACKS = {
    navy: { name: 'Navy', a: '#1b2f5e', b: '#28457f', c: '#c9a646' },
    claret: { name: 'Claret', a: '#6d1426', b: '#8c1d33', c: '#e2c27a' },
    forest: { name: 'Forest', a: '#16452c', b: '#1f5c3b', c: '#d9c37c' },
  };
  function back(key) {
    const k = BACKS[key] || BACKS.navy;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
      `<defs><pattern id="l" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
      `<rect width="20" height="20" fill="${k.a}"/><rect width="10" height="10" fill="${k.b}"/><rect x="10" y="10" width="10" height="10" fill="${k.b}"/></pattern></defs>` +
      `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="13" fill="#fff" stroke="#9a9a9a" stroke-width="2"/>` +
      `<rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="8" fill="url(#l)"/>` +
      `<rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="8" fill="none" stroke="${k.c}" stroke-width="3"/>` +
      `<rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="5" fill="none" stroke="${k.c}" stroke-width="1.2" opacity=".7"/>` +
      `<g transform="translate(70 125)">${suitShape(0, k.c).replace('<path', '<path opacity=".9" transform="scale(.6)"')}</g>` +
      `</svg>`;
  }

  const cache = new Map();
  const url = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  function faceURL(rank, s, styleKey) {
    const key = `${rank}-${s}-${styleKey}`;
    if (!cache.has(key)) cache.set(key, url(rank > 10 ? faceCard(rank, s, styleKey) : numberCard(rank, s)));
    return cache.get(key);
  }
  function backURL(key) {
    const k = 'back-' + key;
    if (!cache.has(k)) cache.set(k, url(back(key)));
    return cache.get(k);
  }

  return { faceURL, backURL, STYLES, BACKS, RANKS, isRed, W, H };
})();
