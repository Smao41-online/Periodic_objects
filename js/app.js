/* Renders the periodic table from window.PERIODIC_DB and drives the
   search filter, category legend and the per-element detail dialog. */
(function () {
  'use strict';

  const DB = window.PERIODIC_DB;
  const ISO = window.ISOTOPE_DB || {};
  const byNumber = new Map(DB.map((el) => [el.number, el]));
  const zBySymbol = new Map(DB.map((el) => [el.symbol, el.number]));

  // Optional localization: a page may define window.LOCALE (see
  // data/locale_cs.js) before this script loads; everything falls back to the
  // English strings baked into the data and this file.
  const LOC = window.LOCALE || null;
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

  let activeCategory = null; // legend filter, null = all
  let openNumber = null;     // element currently shown in the dialog

  // ---- table -------------------------------------------------------------

  function buildTable() {
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
    for (const cat of CATEGORIES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'legend-chip';
      chip.style.setProperty('--chip-color', `var(${catVar(cat)})`);
      chip.setAttribute('aria-pressed', 'false');
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
  const SERIES = (LOC && LOC.series) || ['thorium series (4n)', 'neptunium series (4n+1)',
    'uranium series (4n+2)', 'actinium series (4n+3)'];

  function chainHTML(z, a) {
    const { steps, end } = decayChain(z, a);
    const parts = [];
    for (const s of steps) {
      const stable = s.rec && s.rec.h === 'stable';
      parts.push(
        `<span class="chain-pill${stable ? ' stable' : ''}">
           <b>${nuclideName(s.z, s.a)}</b>
           <small>${s.rec ? halfLifeText(s.rec) : '?'}</small>
         </span>`);
      if (s.via) parts.push(`<span class="chain-arrow">—${branchText(s.via)}→</span>`);
    }
    if (end === 'fission') parts.push(`<span class="chain-pill fission"><b>${L('fissionFragments', 'fission fragments')}</b><small>SF</small></span>`);
    if (end === 'edge' || end === 'unknown') parts.push('<span class="chain-arrow">…?</span>');
    let note = '';
    if (z >= 81 && steps.some((s) => s.via && s.via[0] === 'A')) {
      note = `<div class="chain-note">${L('memberOf', 'Member of the')} ${SERIES[a % 4]}.</div>`;
    }
    return `<div class="chain">${parts.join('')}</div>${note}`;
  }

  function isoRow(el, rec) {
    const stable = rec.h === 'stable';
    const abBar = rec.ab !== null
      ? `<span class="ab-bar" style="--w:${Math.max(rec.ab, 1.5)}%"></span>${rec.ab}%` : '—';
    const decays = stable
      ? '<span class="stable-badge">stable</span>'
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
        <p class="iso-hint">${L('isoHint', 'Click a radioactive isotope to trace its decay chain.')}</p>
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

  // Expand/collapse decay chains from the isotope table (event delegation —
  // the table is re-rendered for every element).
  detailBody.addEventListener('click', (e) => {
    const row = e.target.closest('.iso-row.radioactive');
    if (row) toggleChain(row);
  });
  detailBody.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.iso-row.radioactive');
    if (row) { e.preventDefault(); toggleChain(row); }
  });

  function toggleChain(row) {
    const next = row.nextElementSibling;
    if (next && next.classList.contains('chain-row')) { next.remove(); return; }
    const tr = document.createElement('tr');
    tr.className = 'chain-row';
    tr.innerHTML = `<td colspan="8">${chainHTML(openNumber, Number(row.dataset.a))}</td>`;
    row.after(tr);
  }

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

  document.getElementById('detail-close').addEventListener('click', () => dialog.close());
  document.getElementById('prev-el').addEventListener('click', () => openDetail(openNumber - 1));
  document.getElementById('next-el').addEventListener('click', () => openDetail(openNumber + 1));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // click on the backdrop
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && openNumber > 1) openDetail(openNumber - 1);
    if (e.key === 'ArrowRight' && openNumber < DB.length) openDetail(openNumber + 1);
  });

  buildTable();
  buildLegend();
})();
