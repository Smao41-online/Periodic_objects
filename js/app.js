/* Renders the periodic table from window.PERIODIC_DB and drives the
   search filter, category legend and the per-element detail dialog. */
(function () {
  'use strict';

  const DB = window.PERIODIC_DB;
  const byNumber = new Map(DB.map((el) => [el.number, el]));

  // Fixed legend order — roughly the reading order of the table itself.
  const CATEGORIES = [
    'alkali metal', 'alkaline earth metal', 'transition metal',
    'post-transition metal', 'metalloid', 'reactive nonmetal',
    'noble gas', 'lanthanide', 'actinide', 'unknown',
  ];
  const catVar = (cat) => `--cat-${cat.replace(/ /g, '-')}`;
  const catLabel = (cat) => (cat === 'unknown' ? 'unknown properties' : cat);

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
      btn.title = `${el.name} (${el.number}) — ${catLabel(el.category)}`;
      btn.setAttribute('aria-label', `${el.name}, atomic number ${el.number}`);
      btn.innerHTML = `
        <span class="num">${el.number}</span>
        <span class="sym">${el.symbol}</span>
        <span class="name">${el.name}</span>
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
      `${DB.length} elements · ${new Set(DB.map((e) => e.category)).size} categories`;
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
    return el.phase === 'Gas' ? 'Density (g/L, STP)' : 'Density (g/cm³)';
  }

  function openDetail(number) {
    const el = byNumber.get(number);
    openNumber = number;

    const shells = el.shells
      .map((n, i) => `<span class="shell"><b>${n}</b> ${String.fromCharCode(75 + i)}</span>`)
      .join('');

    detailBody.innerHTML = `
      <div class="detail-head" style="--cat: var(${catVar(el.category)})">
        <div class="detail-tile"><span class="sym">${el.symbol}</span><span class="num">${el.number}</span></div>
        <div>
          <h2 id="detail-name">${el.name}</h2>
          <span class="cat-chip"><span class="swatch"></span>${catLabel(el.category_detail)}</span>
        </div>
      </div>
      <p class="detail-summary">${el.summary}</p>
      <div class="props">
        ${prop('Atomic mass (u)', el.atomic_mass)}
        ${prop('Phase at STP', el.phase)}
        ${prop('Group · Period · Block', `${el.group} · ${el.period} · ${el.block}`)}
        ${prop(densityLabel(el), fmtNum(el.density))}
        ${prop('Melting point', kelvin(el.melt))}
        ${prop('Boiling point', kelvin(el.boil))}
        ${prop('Electronegativity (Pauling)', fmtNum(el.electronegativity_pauling))}
        ${prop('Electron affinity (kJ/mol)', fmtNum(el.electron_affinity))}
        ${prop('1st ionization energy (kJ/mol)', fmtNum(el.first_ionization))}
        ${prop('Molar heat (J/mol·K)', fmtNum(el.molar_heat))}
        ${prop('Appearance', el.appearance ?? '—')}
        ${prop('Discovered by', el.discovered_by ?? '—')}
        ${prop('Named by', el.named_by ?? '—')}
        ${prop('Electron configuration', fmtConfig(el.electron_configuration_semantic), true)}
        ${prop('Electron shells', `<span class="shells">${shells}</span>`, true)}
      </div>
      <div class="detail-src">Source: <a href="${el.source}" target="_blank" rel="noopener">Wikipedia — ${el.name}</a></div>`;

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
