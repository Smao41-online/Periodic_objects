/* Renders the periodic table from window.PERIODIC_DB and drives the
   search filter, category legend, the per-element detail dialog, the isotope
   tables with decay chains, the enlarged per-nuclide pop-up, and the live
   EN/CS language toggle (locales register themselves in window.LOCALES). */
(function () {
  'use strict';

  const DB = window.PERIODIC_DB;
  const ISO = window.ISOTOPE_DB || {};
  const LOCALES = window.LOCALES || {};
  const byNumber = new Map(DB.map((el) => [el.number, el]));
  const zBySymbol = new Map(DB.map((el) => [el.symbol, el.number]));

  // ---- localization --------------------------------------------------------

  // English page strings live here; other languages provide them via their
  // locale's ui map. LOC is null for English so every L() falls back.
  const STATIC_EN = {
    pageTitle: 'Periodic Table of the Elements',
    subtitle: 'All 118 known elements — click any element for its full data record.',
    searchPlaceholder: 'Search name, symbol or number…',
    searchAria: 'Search elements',
    prev: '← Prev',
    next: 'Next →',
    close: 'Close',
    credit: 'Element data: <a href="https://github.com/Bowserinator/Periodic-Table-JSON" target="_blank" rel="noopener">Periodic-Table-JSON</a> (CC BY-SA 3.0). Isotope data: <a href="https://doi.org/10.1088/1674-1137/abddae" target="_blank" rel="noopener">NUBASE2020</a>. Temperatures in K, energies in kJ/mol.',
  };

  let lang = null;
  let LOC = null;
  const L = (key, en) => (LOC && LOC.ui && LOC.ui[key]) || en;
  const elName = (el) => (LOC && LOC.elements[el.number] && LOC.elements[el.number][0]) || el.name;
  const elSummary = (el) => (LOC && LOC.elements[el.number] && LOC.elements[el.number][1]) || el.summary;
  const phaseLabel = (p) => (LOC && LOC.phases && LOC.phases[p]) || p;
  function elSource(el) {
    if (!LOC) return { url: el.source, label: `Wikipedia — ${el.name}` };
    const entry = LOC.elements[el.number] || [];
    const title = entry[2] || entry[0] || el.name;
    return {
      url: 'https://cs.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')),
      label: `Wikipedie — ${entry[0] || el.name}`,
    };
  }

  // Fixed legend order — roughly the reading order of the table itself.
  const CATEGORIES = [
    'alkali metal', 'alkaline earth metal', 'transition metal',
    'post-transition metal', 'metalloid', 'reactive nonmetal',
    'noble gas', 'lanthanide', 'actinide', 'unknown',
  ];
  const catVar = (cat) => `--cat-${cat.replace(/ /g, '-')}`;
  const catLabel = (cat) => {
    if (LOC && LOC.categories && LOC.categories[cat]) return LOC.categories[cat];
    return cat === 'unknown' ? 'unknown properties' : cat;
  };

  const tableEl = document.getElementById('table');
  const legendEl = document.getElementById('legend');
  const searchEl = document.getElementById('search');
  const dialog = document.getElementById('detail');
  const detailBody = document.getElementById('detail-body');
  const nuclideDialog = document.getElementById('nuclide');
  const nuclideBody = document.getElementById('nuclide-body');

  let activeCategory = null; // legend filter, null = all
  let openNumber = null;     // element currently shown in the dialog
  let openNuclideZA = null;  // [z, a] currently shown in the nuclide pop-up

  // ---- table -------------------------------------------------------------

  function buildTable() {
    tableEl.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (const el of DB) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'el';
      btn.dataset.number = el.number;
      btn.style.setProperty('--x', el.xpos);
      btn.style.setProperty('--y', el.ypos);
      btn.style.setProperty('--cat', `var(${catVar(el.category)})`);
      btn.title = `${elName(el)} (${el.number}) — ${catLabel(el.category)}`;
      btn.setAttribute('aria-label', `${elName(el)}, ${L('atomicNumber', 'atomic number')} ${el.number}`);
      btn.innerHTML = `
        <span class="num">${el.number}</span>
        <span class="sym">${el.symbol}</span>
        <span class="name">${elName(el)}</span>
        <span class="mass">${el.atomic_mass.toFixed(3).replace(/\.?0+$/, '')}</span>`;
      btn.addEventListener('click', () => openDetail(el.number));
      frag.appendChild(btn);
    }

    // Markers connecting the main grid to the detached f-block rows.
    for (const m of [
      { x: 3, y: 6, label: '57–71' },
      { x: 3, y: 7, label: '89–103' },
    ]) {
      const div = document.createElement('div');
      div.className = 'fmarker';
      div.style.setProperty('--x', m.x);
      div.style.setProperty('--y', m.y);
      div.textContent = m.label;
      frag.appendChild(div);
    }

    tableEl.appendChild(frag);
    document.getElementById('count-note').textContent =
      `${DB.length} ${L('elements', 'elements')} · ${new Set(DB.map((e) => e.category)).size} ${L('categories', 'categories')}`;
  }

  // ---- legend + search filtering ------------------------------------------

  function buildLegend() {
    legendEl.innerHTML = '';
    for (const cat of CATEGORIES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'legend-chip';
      chip.style.setProperty('--chip-color', `var(${catVar(cat)})`);
      chip.setAttribute('aria-pressed', String(activeCategory === cat));
      chip.innerHTML = `<span class="swatch"></span>${catLabel(cat)}`;
      chip.addEventListener('click', () => {
        activeCategory = activeCategory === cat ? null : cat;
        legendEl.querySelectorAll('.legend-chip').forEach((c) =>
          c.setAttribute('aria-pressed', String(c === chip && activeCategory !== null)));
        applyFilter();
      });
      legendEl.appendChild(chip);
    }
  }

  function matches(el, query) {
    if (activeCategory && el.category !== activeCategory) return false;
    if (!query) return true;
    return (
      el.name.toLowerCase().includes(query) ||
      elName(el).toLowerCase().includes(query) ||
      el.symbol.toLowerCase() === query ||
      el.symbol.toLowerCase().startsWith(query) ||
      String(el.number) === query
    );
  }

  function applyFilter() {
    const query = searchEl.value.trim().toLowerCase();
    for (const btn of tableEl.querySelectorAll('.el')) {
      const el = byNumber.get(Number(btn.dataset.number));
      btn.classList.toggle('dimmed', !matches(el, query));
    }
  }

  searchEl.addEventListener('input', applyFilter);

  // ---- language switching ---------------------------------------------------

  function applyStatics() {
    const S = (key) => L(key, STATIC_EN[key]);
    document.title = S('pageTitle');
    document.documentElement.lang = lang;
    document.querySelector('.titles h1').textContent = S('pageTitle');
    document.querySelector('.subtitle').textContent = S('subtitle');
    searchEl.placeholder = S('searchPlaceholder');
    searchEl.setAttribute('aria-label', S('searchAria'));
    document.getElementById('prev-el').textContent = S('prev');
    document.getElementById('next-el').textContent = S('next');
    document.querySelectorAll('.close-btn').forEach((b) => b.setAttribute('aria-label', S('close')));
    const credit = document.getElementById('data-credit');
    if (credit) credit.innerHTML = S('credit');
  }

  function setLang(next) {
    if (!LOCALES[next]) next = 'en';
    lang = next;
    LOC = next === 'en' ? null : LOCALES[next];
    try { localStorage.setItem('ptLang', lang); } catch (e) { /* private mode */ }
    document.querySelectorAll('.lang-toggle button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    applyStatics();
    buildTable();
    buildLegend();
    applyFilter();
    if (nuclideDialog.open) nuclideDialog.close();
    if (dialog.open && openNumber) openDetail(openNumber);
  }

  document.querySelectorAll('.lang-toggle button').forEach((b) =>
    b.addEventListener('click', () => setLang(b.dataset.lang)));

  // ---- detail dialog -------------------------------------------------------

  const fmtNum = (v) => (v === null || v === undefined ? '—' : String(v));
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const fmtConfig = (cfg) =>
    cfg.replace(/([spdf])(\d+)/g, (_, l, d) => l + [...d].map((c) => SUP[c]).join(''));
  const kelvin = (v) =>
    v === null || v === undefined ? '—' : `${v} K (${(v - 273.15).toFixed(1)} °C)`;

  function prop(key, value, wide) {
    return `<div class="prop${wide ? ' wide' : ''}"><div class="k">${key}</div><div class="v">${value}</div></div>`;
  }

  function densityLabel(el) {
    return el.phase === 'Gas' ? L('densityGas', 'Density (g/L, STP)') : L('density', 'Density (g/cm³)');
  }

  // ---- isotopes & decay chains ---------------------------------------------

  const supNum = (n) => [...String(n)].map((c) => SUP[c]).join('');
  const nuclideName = (z, a) => {
    const el = byNumber.get(z);
    return supNum(a) + (el ? el.symbol : `Z${z}`);
  };

  // Pretty names for NUBASE decay-mode codes.
  const MODE_LABEL = {
    'A': 'α', 'B-': 'β⁻', 'B+': 'β⁺', 'EC': 'ε', 'EC+B+': 'ε/β⁺', 'e+': 'β⁺',
    'SF': 'SF', 'IT': 'IT', 'n': 'n', '2n': '2n', 'p': 'p', '2p': '2p', '3p': '3p',
    'B-n': 'β⁻n', 'B-2n': 'β⁻2n', 'B-3n': 'β⁻3n', 'B-4n': 'β⁻4n',
    'B-p': 'β⁻p', 'B-d': 'β⁻d', 'B-t': 'β⁻t', 'B-A': 'β⁻α', 'B-SF': 'β⁻SF',
    'B+p': 'β⁺p', 'B+2p': 'β⁺2p', 'B+3p': 'β⁺3p', 'B+A': 'β⁺α', 'B+pA': 'β⁺pα',
    'B+SF': 'β⁺SF', '2B-': '2β⁻', '2B+': '2β⁺',
  };

  function modeLabel(mode) {
    if (MODE_LABEL[mode]) return MODE_LABEL[mode];
    const cl = mode.match(/^(\d+)([A-Z][a-z]?)/); // cluster emission, e.g. 24Ne
    return cl ? supNum(cl[1]) + cl[2] : mode;
  }

  // (ΔZ, ΔA) per decay mode; null = terminal (fission), undefined = unknown.
  function modeDelta(mode) {
    const T = {
      'A': [-2, -4], 'B-': [1, 0], '2B-': [2, 0], 'B+': [-1, 0], '2B+': [-2, 0],
      'EC': [-1, 0], 'EC+B+': [-1, 0], 'e+': [-1, 0],
      'p': [-1, -1], '2p': [-2, -2], '3p': [-3, -3], 'n': [0, -1], '2n': [0, -2],
      'B-n': [1, -1], 'B-2n': [1, -2], 'B-3n': [1, -3], 'B-4n': [1, -4],
      'B-p': [0, -1], 'B-d': [0, -2], 'B-t': [0, -3], 'B-A': [-1, -4],
      'B+p': [-2, -1], 'B+2p': [-3, -2], 'B+3p': [-4, -3], 'B+A': [-3, -4], 'B+pA': [-4, -5],
    };
    if (T[mode]) return T[mode];
    if (mode === 'SF' || mode === 'B-SF' || mode === 'B+SF') return null;
    const cl = mode.match(/^(\d+)([A-Z][a-z]?)/); // cluster: subtract the emitted nuclide
    if (cl && zBySymbol.has(cl[2])) return [-zBySymbol.get(cl[2]), -Number(cl[1])];
    return undefined;
  }

  const isotopesOf = (z) => ISO[z] || [];
  const findIso = (z, a) => isotopesOf(z).find((r) => r.a === a);

  function branchText([mode, rel, val]) {
    const label = modeLabel(mode);
    if (val === null) return `${label} ?`;
    const relSign = rel === '~' ? '≈' : rel === '=' ? '' : rel;
    return `${label} ${relSign}${val}%`;
  }

  function halfLifeText(rec) {
    if (rec.h === 'stable') return L('stable', 'stable');
    if (rec.h === 'p-unst') return L('unbound', 'unbound');
    if (rec.h === null) return '—';
    return (rec.he ? '≈ ' : '') + rec.h;
  }

  // Follow the dominant decay branch until a stable nuclide, fission or the
  // edge of known data. Returns the chain plus how it terminated.
  function decayChain(z, a) {
    const steps = [];
    const seen = new Set();
    let cur = { z, a };
    let end = 'unknown';
    for (let i = 0; i < 40; i++) {
      const key = cur.z + '-' + cur.a;
      if (seen.has(key)) { end = 'loop'; break; }
      seen.add(key);
      const rec = findIso(cur.z, cur.a);
      if (!rec) { steps.push({ ...cur, rec: null }); end = 'edge'; break; }
      if (rec.h === 'stable') { steps.push({ ...cur, rec }); end = 'stable'; break; }
      const dm = [...rec.dm].sort((x, y) => (y[2] ?? -1) - (x[2] ?? -1));
      const main = dm[0];
      if (!main) { steps.push({ ...cur, rec }); end = 'edge'; break; }
      const delta = modeDelta(main[0]);
      steps.push({ ...cur, rec, via: main });
      if (delta === null) { end = 'fission'; break; }
      if (delta === undefined) { end = 'edge'; break; }
      cur = { z: cur.z + delta[0], a: cur.a + delta[1] };
    }
    return { steps, end };
  }

  // The four classical heavy-element decay series, by A mod 4.
  const seriesName = (a) => ((LOC && LOC.series) || ['thorium series (4n)', 'neptunium series (4n+1)',
    'uranium series (4n+2)', 'actinium series (4n+3)'])[a % 4];

  function chainPill(z, a, rec, extraClass) {
    const stable = rec && rec.h === 'stable';
    const known = !!rec;
    return `<span class="chain-pill${stable ? ' stable' : ''}${decayClass(rec)}${known ? ' clickable' : ''}${extraClass || ''}"
      ${known ? `data-z="${z}" data-a="${a}" role="button" tabindex="0" title="${L('nuclideDetail', 'Show nuclide details')}"` : ''}>
      <b>${nuclideName(z, a)}</b>
      <small>${rec ? halfLifeText(rec) : '?'}</small>
    </span>`;
  }

  function chainHTML(z, a, big) {
    const { steps, end } = decayChain(z, a);
    const parts = [];
    for (const s of steps) {
      parts.push(chainPill(s.z, s.a, s.rec));
      if (s.via) parts.push(`<span class="chain-arrow">—${branchText(s.via)}→</span>`);
    }
    if (end === 'fission') parts.push(`<span class="chain-pill fission"><b>${L('fissionFragments', 'fission fragments')}</b><small>SF</small></span>`);
    if (end === 'edge' || end === 'unknown') parts.push('<span class="chain-arrow">…?</span>');
    let note = '';
    if (z >= 81 && steps.some((s) => s.via && s.via[0] === 'A')) {
      note = `<div class="chain-note">${L('memberOf', 'Member of the')} ${seriesName(a)}.</div>`;
    }
    return `<div class="chain${big ? ' big' : ''}">${parts.join('')}</div>${note}`;
  }

  function isoRow(el, rec) {
    const stable = rec.h === 'stable';
    const abBar = rec.ab !== null
      ? `<span class="ab-bar" style="--w:${Math.max(rec.ab, 1.5)}%"></span>${rec.ab}%` : '—';
    const decays = stable
      ? `<span class="stable-badge">${L('stable', 'stable')}</span>`
      : rec.dm.map((d) => `<span class="decay-chip">${branchText(d)}</span>`).join('') || '—';
    const isomers = rec.isomers ? `<span class="isomer-badge" title="${rec.isomers} ${L('isomerTitle', 'known metastable isomer(s)')}">+${rec.isomers}m</span>` : '';
    return `
      <tr class="iso-row${stable ? '' : ' radioactive'}" data-a="${rec.a}" ${stable ? '' : `tabindex="0" title="${L('showChain', 'Show decay chain')}"`}>
        <td class="nuc">${nuclideName(el.number, rec.a)}${isomers}</td>
        <td>${rec.a - el.number}</td>
        <td>${halfLifeText(rec)}</td>
        <td class="ab">${abBar}</td>
        <td class="decays">${decays}</td>
        <td>${rec.jp ?? '—'}</td>
        <td class="mass">${rec.m ?? '—'}</td>
        <td>${rec.y ?? '—'}</td>
      </tr>`;
  }

  function isotopesHTML(el) {
    const list = isotopesOf(el.number);
    if (!list.length) return '';
    const stable = list.filter((r) => r.h === 'stable');
    const radio = list.filter((r) => r.h !== 'stable');
    const longest = radio.filter((r) => Number.isFinite(r.hs) && r.hs > 0)
      .sort((x, y) => y.hs - x.hs)[0];
    const abundant = [...list].filter((r) => r.ab !== null).sort((x, y) => y.ab - x.ab)[0];

    const facts = [];
    if (abundant) facts.push(`${L('mostAbundant', 'most abundant')} ${nuclideName(el.number, abundant.a)} (${abundant.ab}%)`);
    if (longest) facts.push(`${L('longestLived', 'longest-lived radioisotope')} ${nuclideName(el.number, longest.a)} (${halfLifeText(longest)})`);
    if (!stable.length) facts.push(L('noStable', 'no stable isotopes'));

    return `
      <section class="iso-section">
        <h3>${L('isotopes', 'Isotopes')} <span class="iso-count">${list.length} ${L('known', 'known')} · ${stable.length} ${L('stableCount', 'stable')} · ${radio.length} ${L('radioactiveCount', 'radioactive')}</span></h3>
        ${facts.length ? `<p class="iso-facts">${facts.join(' · ')}</p>` : ''}
        <p class="iso-hint">${L('isoHint', 'Click a radioactive isotope to trace its decay chain; click any nuclide in a chain for its enlarged detail.')}</p>
        <div class="iso-scroll">
          <table class="iso-table">
            <thead><tr>
              <th>${L('thNuclide', 'Nuclide')}</th><th>N</th><th>${L('thHalfLife', 'Half-life')}</th><th>${L('thAbundance', 'Abundance')}</th>
              <th>${L('thDecay', 'Decay modes')}</th><th>${L('thSpin', 'Spin')}</th><th>${L('thMass', 'Mass (u)')}</th><th>${L('thFound', 'Found')}</th>
            </tr></thead>
            <tbody>${list.map((r) => isoRow(el, r)).join('')}</tbody>
          </table>
        </div>
        <p class="iso-src">${L('isoSrc', 'Isotope data: NUBASE2020 evaluation (Kondev et&nbsp;al., Chin. Phys. C45, 030001). ≈ marks values estimated from systematics.')}</p>
      </section>`;
  }

  function toggleChain(row) {
    const next = row.nextElementSibling;
    if (next && next.classList.contains('chain-row')) { next.remove(); return; }
    const tr = document.createElement('tr');
    tr.className = 'chain-row';
    tr.innerHTML = `<td colspan="8">${chainHTML(openNumber, Number(row.dataset.a))}</td>`;
    row.after(tr);
  }

  // ---- branching decay tree ---------------------------------------------------

  let treeThreshold = 1;      // % — user-adjustable via the pop-up control
  const TREE_MAX_NODES = 120; // safety cap for pathological cases

  // Decay-energy color class from the dominant decay mode:
  // α yellow, β blue, γ/IT red, nucleon emission gray, stable white.
  function decayClass(rec) {
    if (!rec) return '';
    if (rec.h === 'stable') return ' dk-stable';
    if (rec.h === 'p-unst') return ' dk-n';
    const dm = [...rec.dm].sort((x, y) => (y[2] ?? -1) - (x[2] ?? -1));
    const m = dm[0] && dm[0][0];
    if (!m) return '';
    if (m === 'A' || /^\d/.test(m)) return ' dk-a';               // α & cluster emission
    if (m === 'IT') return ' dk-g';                               // γ transition
    if (m === 'SF') return ' dk-sf';
    if (m.startsWith('B') || m.startsWith('EC') || m === 'e+') return ' dk-b'; // β/ε (incl. β-delayed)
    if (/^\d?[np]$/.test(m) || m === '2n' || m === '2p' || m === '3p') return ' dk-n';
    return '';
  }

  // All quantified branches above the threshold; if nothing qualifies
  // (e.g. every branch is "?"), fall back to the dominant one so the tree
  // still continues.
  function significantBranches(rec) {
    const dm = [...rec.dm].sort((x, y) => (y[2] ?? -1) - (x[2] ?? -1));
    const sig = dm.filter((d) => d[2] !== null && d[2] >= treeThreshold);
    if (!sig.length && dm.length) sig.push(dm[0]);
    return sig;
  }

  // cum: running sum of half-lives from the first decay product down this
  // path (the root's own half-life is excluded — it is the "waiting time
  // before the chain starts", not part of the journey to stability).
  function buildDecayTree(z, a, state, path, cum, isRoot) {
    state.count++;
    const rec = findIso(z, a);
    const node = { z, a, rec, branches: [], term: null, cum: cum || 0 };
    if (!rec) { node.term = 'edge'; return node; }
    if (rec.h === 'stable') { node.term = 'stable'; return node; }
    const key = z + '-' + a;
    if (path.has(key)) { node.term = 'loop'; return node; }
    if (state.count > TREE_MAX_NODES) { node.term = 'truncated'; return node; }
    path.add(key);
    const childCum = (cum || 0) + (isRoot || !Number.isFinite(rec.hs) ? 0 : rec.hs);
    for (const d of significantBranches(rec)) {
      const delta = modeDelta(d[0]);
      if (delta === null) node.branches.push({ via: d, child: { term: 'fission' } });
      else if (delta === undefined) node.branches.push({ via: d, child: { term: 'unknown' } });
      else node.branches.push({ via: d, child: buildDecayTree(z + delta[0], a + delta[1], state, path, childCum, false) });
    }
    path.delete(key);
    return node;
  }

  // Human-readable duration from seconds (order-of-magnitude guide).
  const YEAR = 31556926;
  function humanizeS(s) {
    if (!Number.isFinite(s) || s <= 0) return null;
    const units = [
      [1e-9, 1e-12, 'ps'], [1e-6, 1e-9, 'ns'], [1e-3, 1e-6, 'µs'], [1, 1e-3, 'ms'],
      [60, 1, 's'], [3600, 60, 'min'], [86400, 3600, 'h'], [YEAR, 86400, 'd'],
      [YEAR * 1e3, YEAR, 'y'], [YEAR * 1e6, YEAR * 1e3, 'ky'],
      [YEAR * 1e9, YEAR * 1e6, 'My'], [Infinity, YEAR * 1e9, 'Gy'],
    ];
    for (const [limit, div, unit] of units) {
      if (s < limit) {
        const v = s / div;
        return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toPrecision(3)) + ' ' + unit;
      }
    }
    return null;
  }

  // Visual weight of a branch arm by its intensity.
  const weightClass = (v) => (v === null || v >= 50 ? 'w-main' : v >= 10 ? 'w-mid' : 'w-min');

  function treePill(node) {
    if (node.term === 'fission') {
      return `<span class="chain-pill fission"><b>${L('fissionFragments', 'fission fragments')}</b><small>SF</small></span>`;
    }
    if (node.term === 'unknown') return '<span class="chain-arrow">…?</span>';
    let suffix = '';
    if (node.term === 'loop') suffix = ' <span class="chain-arrow">↺</span>';
    if (node.term === 'truncated') suffix = ' <span class="chain-arrow">…</span>';
    return chainPill(node.z, node.a, node.rec) + suffix;
  }

  // Σ of half-lives badge shown beside stable leaves.
  function sumBadge(node) {
    if (node.term !== 'stable') return '';
    const t = humanizeS(node.cum);
    if (!t) return '';
    return `<span class="sum-chip" title="${L('sumTitle', 'Sum of half-lives from the first decay product down this path — a rough order-of-magnitude guide, not an exact duration.')}">Σt½ ≈ ${t}</span>`;
  }

  // Linear runs stack vertically at one indent level; the tree only nests
  // deeper at real branch points, so long chains don't drift off-screen.
  function treeChildren(node) {
    return node.branches.map((b) => {
      let rows = '';
      let cur = b;
      let tail = null;
      for (;;) {
        rows += `
          <div class="tree-node ${weightClass(cur.via[2])}">
            <span class="decay-chip">${branchText(cur.via)}</span>
            <span class="tree-arrow">→</span>
            ${treePill(cur.child)}
            ${sumBadge(cur.child)}
          </div>`;
        const kids = cur.child.branches;
        if (!kids || kids.length === 0) break;
        if (kids.length > 1) { tail = cur.child; break; }
        cur = kids[0];
      }
      return `<li class="${weightClass(b.via[2])}"><div class="tree-run">${rows}</div>${tail ? `<ul>${treeChildren(tail)}</ul>` : ''}</li>`;
    }).join('');
  }

  const THRESHOLDS = [0.1, 1, 5, 10];

  function colorLegendHTML() {
    const items = [
      ['dk-a', 'α', L('legendAlpha', 'α decay')],
      ['dk-b', 'β', L('legendBeta', 'β decay (β⁻/β⁺/ε)')],
      ['dk-g', 'γ', L('legendGamma', 'γ / isomeric transition')],
      ['dk-n', 'n', L('legendNucleon', 'n/p emission')],
      ['dk-stable', 'S', L('legendStable', 'stable')],
      ['dk-sf', 'SF', L('legendSF', 'spontaneous fission')],
    ];
    return `<div class="dk-legend">${items.map(([cls, glyph, label]) =>
      `<span class="dk-legend-item"><span class="dk-swatch ${cls}">${glyph}</span>${label}</span>`).join('')}</div>`;
  }

  function decayTreeHTML(z, a) {
    const root = buildDecayTree(z, a, { count: 0 }, new Set(), 0, true);
    if (!root.branches.length) return '';
    let note = '';
    const { steps } = decayChain(z, a);
    if (z >= 81 && steps.some((s) => s.via && s.via[0] === 'A')) {
      note = `<div class="chain-note">${L('memberOf', 'Member of the')} ${seriesName(a)}.</div>`;
    }
    const options = THRESHOLDS.map((t) =>
      `<option value="${t}" ${t === treeThreshold ? 'selected' : ''}>≥ ${t} %</option>`).join('');
    return `
      <div class="tree-head">
        <h4>${L('decayChainTitle', 'Decay chain')}</h4>
        <label class="tree-threshold">${L('thresholdLabel', 'Branch threshold')}
          <select id="tree-threshold">${options}</select>
        </label>
      </div>
      <p class="tree-note">${L('treeNote2', 'Branching tree — every decay branch above the chosen intensity is followed; arm weight mirrors intensity. Minor branches stay listed per nuclide under decay products.')}</p>
      ${colorLegendHTML()}
      <div class="decay-tree">
        ${treePill(root)}
        <ul>${treeChildren(root)}</ul>
      </div>
      ${note}`;
  }

  // ---- nuclide pop-up -------------------------------------------------------

  function decayProductsHTML(z, a, rec) {
    if (rec.h === 'stable' || !rec.dm.length) return '';
    const rows = rec.dm.map((d) => {
      const delta = modeDelta(d[0]);
      let target = '';
      if (delta === null) {
        target = `<span class="chain-pill fission"><b>${L('fissionFragments', 'fission fragments')}</b><small>SF</small></span>`;
      } else if (delta === undefined) {
        target = '<span class="chain-arrow">?</span>';
      } else {
        const dz = z + delta[0], da = a + delta[1];
        target = chainPill(dz, da, findIso(dz, da));
      }
      return `<div class="decay-product">
        <span class="decay-chip">${branchText(d)}</span>
        <span class="chain-arrow">→</span>
        ${target}
      </div>`;
    }).join('');
    return `<h4>${L('decayProducts', 'Decay products')}</h4><div class="decay-products">${rows}</div>`;
  }

  function openNuclide(z, a) {
    const rec = findIso(z, a);
    const el = byNumber.get(z);
    if (!rec || !el) return;
    openNuclideZA = [z, a];
    nuclideDialog.style.setProperty('--cat', `var(${catVar(el.category)})`);

    const stable = rec.h === 'stable';
    const chainSection = stable ? '' : decayTreeHTML(z, a);

    nuclideBody.innerHTML = `
      <div class="detail-head">
        <div class="detail-tile nuclide-tile">
          <span class="sym">${nuclideName(z, a)}</span>
          <span class="num">${elName(el)}</span>
        </div>
        <div>
          <h2 id="nuclide-name">${L('isotopeOf', 'Isotope of')} ${elName(el)} (${el.symbol})</h2>
          ${stable
            ? `<span class="stable-badge big-badge">${L('stable', 'stable')}</span>`
            : `<span class="cat-chip">${L('radioactive', 'radioactive')} · ${L('thHalfLife', 'Half-life')}: <b>&nbsp;${halfLifeText(rec)}</b></span>`}
        </div>
      </div>
      <div class="props nuclide-props">
        ${prop(L('protons', 'Protons (Z)'), z)}
        ${prop(L('neutrons', 'Neutrons (N)'), a - z)}
        ${prop(L('nucleons', 'Nucleons (A)'), a)}
        ${prop(L('thMass', 'Mass (u)'), rec.m ?? '—')}
        ${prop(L('thHalfLife', 'Half-life'), halfLifeText(rec) + (rec.he ? ` <small>(${L('estimated', 'estimated')})</small>` : ''))}
        ${prop(L('thSpin', 'Spin / parity'), rec.jp ?? '—')}
        ${prop(L('thAbundance', 'Natural abundance'), rec.ab !== null ? rec.ab + '%' : '—')}
        ${prop(L('thFound', 'Year discovered'), rec.y ?? '—')}
        ${prop(L('isomersLabel', 'Metastable isomers'), rec.isomers || '0')}
      </div>
      ${decayProductsHTML(z, a, rec)}
      ${chainSection}
      <div class="nuclide-foot">
        <button type="button" class="nav-btn" id="open-element">${L('openElement', 'Open element card')} — ${elName(el)}</button>
      </div>`;

    nuclideBody.querySelector('#open-element').addEventListener('click', () => {
      nuclideDialog.close();
      openDetail(z);
    });
    const thresholdSel = nuclideBody.querySelector('#tree-threshold');
    if (thresholdSel) thresholdSel.addEventListener('change', () => {
      treeThreshold = Number(thresholdSel.value);
      openNuclide(z, a);
    });

    if (!nuclideDialog.open) nuclideDialog.showModal();
    nuclideDialog.querySelector('.detail-inner').scrollTop = 0;
  }

  // ---- element detail rendering ---------------------------------------------

  function openDetail(number) {
    const el = byNumber.get(number);
    openNumber = number;
    dialog.style.setProperty('--cat', `var(${catVar(el.category)})`);

    const shells = el.shells
      .map((n, i) => `<span class="shell"><b>${n}</b> ${String.fromCharCode(75 + i)}</span>`)
      .join('');

    detailBody.innerHTML = `
      <div class="detail-head">
        <div class="detail-tile"><span class="sym">${el.symbol}</span><span class="num">${el.number}</span></div>
        <div>
          <h2 id="detail-name">${elName(el)}</h2>
          <span class="cat-chip"><span class="swatch"></span>${(LOC && LOC.categoriesDetail && LOC.categoriesDetail[el.category_detail]) || catLabel(el.category_detail) || el.category_detail}</span>
        </div>
      </div>
      <p class="detail-summary">${elSummary(el)}</p>
      <div class="props">
        ${prop(L('atomicMass', 'Atomic mass (u)'), el.atomic_mass)}
        ${prop(L('phase', 'Phase at STP'), phaseLabel(el.phase))}
        ${prop(L('gpb', 'Group · Period · Block'), `${el.group} · ${el.period} · ${el.block}`)}
        ${prop(densityLabel(el), fmtNum(el.density))}
        ${prop(L('melt', 'Melting point'), kelvin(el.melt))}
        ${prop(L('boil', 'Boiling point'), kelvin(el.boil))}
        ${prop(L('electronegativity', 'Electronegativity (Pauling)'), fmtNum(el.electronegativity_pauling))}
        ${prop(L('electronAffinity', 'Electron affinity (kJ/mol)'), fmtNum(el.electron_affinity))}
        ${prop(L('ionization', '1st ionization energy (kJ/mol)'), fmtNum(el.first_ionization))}
        ${prop(L('molarHeat', 'Molar heat (J/mol·K)'), fmtNum(el.molar_heat))}
        ${prop(L('appearance', 'Appearance'), el.appearance ?? '—')}
        ${prop(L('discoveredBy', 'Discovered by'), el.discovered_by ?? '—')}
        ${prop(L('namedBy', 'Named by'), el.named_by ?? '—')}
        ${prop(L('electronConfig', 'Electron configuration'), fmtConfig(el.electron_configuration_semantic), true)}
        ${prop(L('shellsLabel', 'Electron shells'), `<span class="shells">${shells}</span>`, true)}
      </div>
      ${isotopesHTML(el)}
      <div class="detail-src">${L('source', 'Source')}: <a href="${elSource(el).url}" target="_blank" rel="noopener">${elSource(el).label}</a></div>`;

    document.getElementById('prev-el').disabled = number <= 1;
    document.getElementById('next-el').disabled = number >= DB.length;

    if (!dialog.open) dialog.showModal();
    dialog.querySelector('.detail-inner').scrollTop = 0;
  }

  // ---- event wiring ----------------------------------------------------------

  // Chains and nuclide pills use event delegation — both dialog bodies are
  // re-rendered constantly.
  function chainPillTarget(e) {
    const pill = e.target.closest('.chain-pill.clickable');
    return pill ? [Number(pill.dataset.z), Number(pill.dataset.a)] : null;
  }

  function bodyClick(e) {
    const pill = chainPillTarget(e);
    if (pill) { openNuclide(pill[0], pill[1]); return; }
    const row = e.target.closest('.iso-row.radioactive');
    if (row) toggleChain(row);
  }
  function bodyKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const pill = chainPillTarget(e);
    if (pill) { e.preventDefault(); openNuclide(pill[0], pill[1]); return; }
    const row = e.target.closest('.iso-row.radioactive');
    if (row) { e.preventDefault(); toggleChain(row); }
  }
  detailBody.addEventListener('click', bodyClick);
  detailBody.addEventListener('keydown', bodyKeydown);
  nuclideBody.addEventListener('click', bodyClick);
  nuclideBody.addEventListener('keydown', bodyKeydown);

  document.getElementById('detail-close').addEventListener('click', () => dialog.close());
  document.getElementById('nuclide-close').addEventListener('click', () => nuclideDialog.close());
  document.getElementById('prev-el').addEventListener('click', () => openDetail(openNumber - 1));
  document.getElementById('next-el').addEventListener('click', () => openDetail(openNumber + 1));
  for (const dlg of [dialog, nuclideDialog]) {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close(); // click on the backdrop
    });
  }
  dialog.addEventListener('keydown', (e) => {
    if (nuclideDialog.open) return; // arrows belong to the pop-up while it is on top
    if (e.key === 'ArrowLeft' && openNumber > 1) openDetail(openNumber - 1);
    if (e.key === 'ArrowRight' && openNumber < DB.length) openDetail(openNumber + 1);
  });

  // ---- boot ------------------------------------------------------------------

  let initial = document.documentElement.getAttribute('data-default-lang') || 'en';
  try { initial = localStorage.getItem('ptLang') || initial; } catch (e) { /* private mode */ }
  setLang(initial);
})();
