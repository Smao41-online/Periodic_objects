# Periodic Objects

An interactive periodic table of all **118 known elements**, where every element
is an object in a local database.

## How it works

| Part | Role |
|------|------|
| `data/elements.js` | The element database: an array of 118 element objects (`window.PERIODIC_DB`), one per known element, with physical, chemical and historical data. |
| `data/isotopes.js` | The isotope database (`window.ISOTOPE_DB`): all ~3,500 known nuclide ground states from the NUBASE2020 evaluation, grouped by atomic number. |
| `js/app.js` | Renders the table dynamically from the database and drives search, category filtering, the detail dialog, the isotope table and decay-chain tracing. |
| `css/style.css` | Theme-aware styles (light + dark) with a colorblind-validated category palette. |
| `index.html` | The page shell (English). |
| `PSChP.html` | Czech entry page — *Periodická soustava chemických prvků*. Same code and databases; defaults to Czech. |
| `data/locale_cs.js` | Czech localization layer: UI strings, category/phase names, Czech element names + summaries. Locales register in `window.LOCALES`; the EN/CS toggle switches them live. |
| `rawdata/` | Backup of the raw source datasets (Periodic-Table-JSON, NUBASE2020) and the scripts that regenerate the databases from them. |

No build step and no dependencies — open `index.html` in any modern browser,
or serve the folder statically:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Features

- Full 18-column periodic table layout, including the detached lanthanide and
  actinide rows with `57–71` / `89–103` markers.
- **Click any element** to open its data record: atomic mass, phase, density,
  melting/boiling points (K and °C), electronegativity, electron affinity,
  first ionization energy, molar heat, electron configuration, shell
  occupancy, appearance, discoverer, and a summary with a Wikipedia source link.
- **Isotopes**: each element card lists every known isotope — half-life,
  natural abundance (with bars), decay modes with branching ratios, spin/parity,
  atomic mass, metastable-isomer count, and year of discovery. Stable isotopes
  are badged; a summary line names the most abundant isotope and the
  longest-lived radioisotope.
- **Decay chains**: click any radioactive isotope to trace its decay series —
  the dominant branch is followed step by step (e.g. ²³⁸U → ²³⁴Th → … → ²⁰⁶Pb)
  down to a stable nuclide or spontaneous fission, with the classical series
  (thorium 4n, neptunium 4n+1, uranium 4n+2, actinium 4n+3) identified for
  heavy nuclides.
- **Nuclide pop-up**: click any nuclide inside a decay chain (or a decay
  product) to open an enlarged pop-up with its full record — protons/neutrons/
  nucleons, mass, half-life, spin, abundance, discovery year, isomer count,
  every decay branch with its daughter nuclide, and the onward decay chain in
  large type. Chains are navigable: each nuclide in the pop-up is clickable.
- **Language toggle**: EN/CS switch in the header changes the whole UI —
  element names, summaries, labels, categories — live, without reloading;
  the choice is remembered (localStorage). `index.html` defaults to English,
  `PSChP.html` to Czech.
- Navigate between elements from the dialog (Prev/Next buttons or arrow keys).
- Live search by name, symbol or atomic number.
- Clickable legend chips to filter by category.
- Automatic light/dark theme.

## Data schema

Each element object looks like:

```js
{
  number: 26, symbol: "Fe", name: "Iron",
  atomic_mass: 55.845,
  category: "transition metal",     // normalized, used for coloring
  category_detail: "transition metal",
  group: 8, period: 4, block: "d",
  xpos: 8, ypos: 4,                 // position in the table grid
  phase: "Solid",
  density: 7.874,                   // g/cm³ (g/L for gases)
  melt: 1811, boil: 3134,           // K
  electronegativity_pauling: 1.83,
  electron_affinity: 14.785,        // kJ/mol
  first_ionization: 762.5,          // kJ/mol
  electron_configuration_semantic: "[Ar] 3d⁶ 4s²",
  shells: [2, 8, 14, 2],
  discovered_by: "…", named_by: "…",
  summary: "…", source: "https://en.wikipedia.org/wiki/Iron"
}
```

Each isotope record in `data/isotopes.js` looks like:

```js
{
  a: 238,                    // mass number
  m: 238.050787,             // atomic mass (u)
  h: "4.463 Gy", hs: 1.4e17, // half-life (display string / seconds)
  jp: "0+",                  // spin and parity
  ab: 99.2742,               // natural abundance (%)
  y: 1896,                   // year of discovery
  dm: [["A","=",100], ["SF","=",5.44e-5], ["2B-","=",2.2e-10]], // decay modes
  isomers: 1                 // known metastable isomers
}
```

## Data sources

- Element data derived from
  [Bowserinator/Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON),
  licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- Isotope data from the **NUBASE2020 evaluation**: F.G. Kondev, M. Wang,
  W.J. Huang, S. Naimi, G. Audi,
  [Chin. Phys. C45, 030001 (2021)](https://doi.org/10.1088/1674-1137/abddae).
