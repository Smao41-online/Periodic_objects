// Parses the NUBASE2020 fixed-width evaluation file into data/isotopes.js.
// Ground states (i=0) become isotope records keyed by Z; isomer lines (i=1,2)
// only increment the ground state's isomer counter.
const fs = require('fs');

const UNIT_SECONDS = {
  ys: 1e-24, zs: 1e-21, as: 1e-18, fs: 1e-15, ps: 1e-12, ns: 1e-9,
  us: 1e-6, ms: 1e-3, s: 1, m: 60, h: 3600, d: 86400,
  y: 31556926, ky: 31556926e3, My: 31556926e6, Gy: 31556926e9,
  Ty: 31556926e12, Py: 31556926e15, Ey: 31556926e18, Zy: 31556926e21, Yy: 31556926e24,
};
const KEV_PER_U = 931494.10242;

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const db = {};   // Z -> map A -> record

function col(line, from, to) { return line.slice(from - 1, to).trim(); }

function parseBR(br) {
  // "B-=99.5 5;B-n=0.5 5" / "IS=99.9855 78" / "A~100;SF<0.001" / "B+=?"
  const out = { abundance: null, modes: [] };
  if (!br) return out;
  for (const part of br.split(';')) {
    const m = part.trim().match(/^([A-Za-z0-9+\-*]+?)\s*([=~<>])\s*(.*)$/);
    if (!m) continue;
    const [, mode, rel, rest] = m;
    const valStr = rest.split(/\s+/)[0].replace(/#/g, '');
    const val = valStr === '?' || valStr === '' ? null : parseFloat(valStr);
    if (mode === 'IS') { out.abundance = val; continue; }
    if (mode === 'IT') continue; // not meaningful for ground states
    out.modes.push([mode, rel, Number.isFinite(val) ? val : null]);
  }
  return out;
}

let parsed = 0;
for (const line of lines) {
  if (!line || line.startsWith('#')) continue;
  const A = parseInt(col(line, 1, 3), 10);
  const zzzi = col(line, 5, 8);
  const Z = parseInt(zzzi.slice(0, 3), 10);
  const i = zzzi[3];
  if (!Number.isFinite(A) || !Number.isFinite(Z) || Z < 1 || Z > 118) continue;

  if (i !== '0') {
    // isomer/level line — count true isomers (i=1,2) on the ground state
    if ((i === '1' || i === '2') && db[Z] && db[Z][A]) db[Z][A].isomers++;
    continue;
  }

  const massExcStr = col(line, 19, 31).replace(/#/g, '');
  const massExc = massExcStr ? parseFloat(massExcStr) : null;
  const atomicMass = massExc === null ? null : +(A + massExc / KEV_PER_U).toFixed(6);

  const tRaw = col(line, 70, 78);
  const tEstimated = tRaw.includes('#');
  const tVal = tRaw.replace(/#/g, '');
  const unit = col(line, 79, 80);
  let halfLife, halfLifeSec;
  if (tVal === 'stbl') { halfLife = 'stable'; halfLifeSec = Infinity; }
  else if (tVal === 'p-unst') { halfLife = 'p-unst'; halfLifeSec = 0; }
  else if (tVal && UNIT_SECONDS[unit]) {
    halfLife = `${tVal} ${unit}`;
    halfLifeSec = parseFloat(tVal) * UNIT_SECONDS[unit];
  } else { halfLife = null; halfLifeSec = null; }

  const jpi = col(line, 89, 102).replace(/T=.*$/, '').replace(/[*#]/g, '').trim() || null;
  const yearStr = col(line, 115, 118);
  const year = yearStr ? parseInt(yearStr, 10) : null;
  const { abundance, modes } = parseBR(col(line, 120, 209));

  (db[Z] ??= {})[A] = {
    a: A,
    m: atomicMass,
    h: halfLife,          // display string, 'stable', 'p-unst' or null
    hs: halfLifeSec,      // seconds (Infinity = stable, 0 = unbound, null = unknown)
    he: tEstimated || undefined,   // half-life from systematics
    jp: jpi,
    ab: abundance,        // natural abundance in %
    y: Number.isFinite(year) ? year : null,
    dm: modes,            // [[mode, relation, percent|null], ...]
    isomers: 0,
  };
  parsed++;
}

// maps of A-sorted arrays; drop the temporary isomers=0 noise by keeping key order stable
const out = {};
for (const z of Object.keys(db).map(Number).sort((a, b) => a - b)) {
  out[z] = Object.values(db[z]).sort((a, b) => a.a - b.a);
}

const header = `// Isotope database — every known nuclide ground state, grouped by atomic number.
// Data: NUBASE2020 evaluation — F.G. Kondev, M. Wang, W.J. Huang, S. Naimi,
// G. Audi, Chin. Phys. C45, 030001 (2021). Parsed fields per isotope:
//   a: mass number, m: atomic mass (u), h: half-life (display), hs: half-life (s),
//   he: half-life estimated from systematics, jp: spin/parity, ab: natural
//   abundance (%), y: year of discovery, dm: decay modes [mode, relation, %],
//   isomers: number of known metastable isomers.
window.ISOTOPE_DB = `;
fs.writeFileSync(process.argv[3], header + JSON.stringify(out) + ';\n');

const total = Object.values(out).reduce((s, arr) => s + arr.length, 0);
const stable = Object.values(out).flat().filter((r) => r.h === 'stable').length;
console.log(`parsed ${parsed} ground states -> ${total} isotopes (${stable} stable), Z=1..${Math.max(...Object.keys(out).map(Number))}`);
const modes = new Set(); Object.values(out).flat().forEach(r => r.dm.forEach(d => modes.add(d[0])));
console.log('decay modes seen:', [...modes].sort().join(' '));
