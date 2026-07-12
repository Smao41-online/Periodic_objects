# Raw data backup

Source datasets and the build scripts that generate the app databases —
kept here so the project is fully reproducible offline.

| File | What it is | Regenerates |
|------|-----------|-------------|
| `PeriodicTableJSON.json` | Bowserinator/Periodic-Table-JSON (CC BY-SA 3.0) | `data/elements.js` via `transform_elements.js` |
| `nubase_3.mas20.txt` | NUBASE2020 evaluation (Kondev et al., Chin. Phys. C45, 030001) | `data/isotopes.js` via `parse_nubase.js` |

```bash
node transform_elements.js   # reads ./PeriodicTableJSON.json  -> ../data/elements.js
node parse_nubase.js nubase_3.mas20.txt ../data/isotopes.js
```

(`transform_elements.js` expects the JSON at `./PeriodicTable.json`; adjust the
require path or rename when re-running.)
