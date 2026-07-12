// Transforms the Bowserinator Periodic-Table-JSON dataset into the app's
// database file (data/elements.js). Keeps elements 1..118 and the fields the
// app uses; normalizes categories for coloring while preserving the original.
const fs = require('fs');
const src = require('./PeriodicTable.json');

function normalizeCategory(cat) {
  if (cat.startsWith('unknown')) return 'unknown';
  if (cat === 'diatomic nonmetal' || cat === 'polyatomic nonmetal') return 'reactive nonmetal';
  return cat;
}

const elements = src.elements
  .filter(e => e.number >= 1 && e.number <= 118)
  .map(e => ({
    number: e.number,
    symbol: e.symbol,
    name: e.name,
    atomic_mass: e.atomic_mass,
    category: normalizeCategory(e.category),
    category_detail: e.category,
    group: e.group,
    period: e.period,
    block: e.block,
    xpos: e.xpos,
    ypos: e.ypos,
    phase: e.phase,
    appearance: e.appearance ?? null,
    density: e.density ?? null,               // g/L for gases, g/cm3 for solids/liquids
    melt: e.melt ?? null,                     // K
    boil: e.boil ?? null,                     // K
    molar_heat: e.molar_heat ?? null,         // J/(mol.K)
    electronegativity_pauling: e.electronegativity_pauling ?? null,
    electron_affinity: e.electron_affinity ?? null,        // kJ/mol
    first_ionization: (e.ionization_energies && e.ionization_energies[0]) ?? null, // kJ/mol
    electron_configuration: e.electron_configuration,
    electron_configuration_semantic: e.electron_configuration_semantic,
    shells: e.shells,
    discovered_by: e.discovered_by ?? null,
    named_by: e.named_by ?? null,
    summary: e.summary,
    source: e.source,
  }))
  .sort((a, b) => a.number - b.number);

const header = `// Periodic element database — one object per known element (1..118).
// Data derived from Bowserinator/Periodic-Table-JSON (CC BY-SA 3.0)
// https://github.com/Bowserinator/Periodic-Table-JSON
// Temperatures are Kelvin; density is g/L for gases and g/cm³ otherwise;
// energies are kJ/mol.
window.PERIODIC_DB = `;

fs.writeFileSync(process.argv[2], header + JSON.stringify(elements, null, 1) + ';\n');
console.log('wrote', elements.length, 'elements to', process.argv[2]);
