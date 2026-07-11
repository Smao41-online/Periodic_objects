# Periodic Objects

An interactive periodic table of all **118 known elements**, where every element
is an object in a local database.

## How it works

| Part | Role |
|------|------|
| `data/elements.js` | The database: an array of 118 element objects (`window.PERIODIC_DB`), one per known element, with physical, chemical and historical data. |
| `js/app.js` | Renders the table dynamically from the database and drives search, category filtering and the detail dialog. |
| `css/style.css` | Theme-aware styles (light + dark) with a colorblind-validated category palette. |
| `index.html` | The page shell. |

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

## Data source

Element data derived from
[Bowserinator/Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON),
licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
