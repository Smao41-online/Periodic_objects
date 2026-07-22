// Builds PSChP_Win.html — a single self-contained file for older Windows
// browsers. The app JS is transpiled to ES5 (older Chrome chokes on `??` and
// other ES2020 syntax); color-mix() is handled at runtime by app.js's legacy
// paint path plus a CSS @supports fallback; a few CSS features that old engines
// lack (min() widths, flex gap) get static fallbacks here.
const fs = require('fs');
const path = require('path');
const babel = require(path.join(process.env.BABELDIR, '@babel/core'));

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// --- CSS: replace features unsupported by old engines ----------------------
let css = read('css/style.css');
css = css
  .replace('width: min(880px, calc(100vw - 32px));', 'max-width: 880px; width: 94%;')
  .replace('max-height: min(88vh, 860px);', 'max-height: 88vh;')
  .replace('.nuclide { width: min(760px, calc(100vw - 32px)); }',
           '.nuclide { max-width: 760px; width: 94%; }');

// Legacy flex-gap fallback: browsers predating flex `gap` (< Chrome 84) drop it,
// so top-of-page chips would butt together. Applied only where `gap` is
// unsupported, so modern engines are untouched. Kept to low-risk chrome
// elements (not the decay-tree connectors, which degrade to tighter spacing).
css += `

/* Legacy flex-gap fallback for very old engines (ignored where gap is supported) */
@supports not (gap: 1px) {
  .controls > * { margin-left: 8px; }
  .controls > *:first-child { margin-left: 0; }
  .legend > * { margin: 0 6px 6px 0; }
  .legend-chip > * + * { margin-left: 6px; }
  .dk-legend > * { margin: 0 14px 6px 0; }
  .dk-legend-item > * + * { margin-left: 6px; }
  .app-header > * { margin-bottom: 8px; }
}
`;

// --- JS: concat data + locale, transpile the app to ES5 --------------------
const elements = read('data/elements.js');
const isotopes = read('data/isotopes.js');
const locale = read('data/locale_cs.js');
const appSrc = read('js/app.js');

const out = babel.transformSync(appSrc, {
  babelrc: false, configFile: false,
  presets: [[path.join(process.env.BABELDIR, '@babel/preset-env'),
    { targets: { ie: '11' }, exclude: ['transform-typeof-symbol'] }]],
});
const appES5 = out.code;

// --- assemble the standalone page ------------------------------------------
const html = `<!DOCTYPE html>
<html lang="cs" data-default-lang="cs">
<head>
<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Periodická soustava chemických prvků (kompatibilní verze)</title>
<style>
${css}
</style>
</head>
<body>
<div class="app">
  <header class="app-header">
    <div class="titles">
      <h1>Periodická soustava chemických prvků</h1>
      <p class="subtitle">Všech 118 známých prvků — klikněte na kterýkoli prvek pro úplný datový záznam.</p>
    </div>
    <div class="controls">
      <input id="search" type="search" placeholder="Hledat název, značku nebo číslo…" autocomplete="off" aria-label="Hledat prvky">
      <div class="lang-toggle" role="group" aria-label="Jazyk">
        <button type="button" data-lang="en" aria-pressed="false">EN</button>
        <button type="button" data-lang="cs" aria-pressed="true">CS</button>
      </div>
    </div>
  </header>
  <nav id="legend" class="legend" aria-label="Kategorie prvků"></nav>
  <div class="table-scroll">
    <main id="table" class="ptable" aria-label="Mřížka periodické tabulky"></main>
  </div>
  <footer class="app-footer">
    <span id="count-note"></span>
    <span id="data-credit">Data o prvcích: <a href="https://github.com/Bowserinator/Periodic-Table-JSON" target="_blank" rel="noopener">Periodic-Table-JSON</a> (CC BY-SA 3.0). Izotopová data: <a href="https://doi.org/10.1088/1674-1137/abddae" target="_blank" rel="noopener">NUBASE2020</a>. Teploty v K, energie v kJ/mol.</span>
    <span>Kompatibilní verze pro starší prohlížeče.</span>
  </footer>
</div>

<dialog id="detail" class="detail" aria-labelledby="detail-name">
  <div class="detail-inner">
    <button class="close-btn" id="detail-close" aria-label="Zavřít">✕</button>
    <div id="detail-body"></div>
    <div class="detail-nav">
      <button id="prev-el" class="nav-btn">← Předchozí</button>
      <button id="next-el" class="nav-btn">Další →</button>
    </div>
  </div>
</dialog>

<dialog id="nuclide" class="detail nuclide" aria-labelledby="nuclide-name">
  <div class="detail-inner">
    <button class="close-btn" id="nuclide-close" aria-label="Zavřít">✕</button>
    <div id="nuclide-body"></div>
  </div>
</dialog>

<script>
document.documentElement.setAttribute("data-default-lang", "cs");
/* tiny polyfills for older engines */
if (window.NodeList && !NodeList.prototype.forEach) NodeList.prototype.forEach = Array.prototype.forEach;
if (window.HTMLCollection && !HTMLCollection.prototype.forEach) HTMLCollection.prototype.forEach = Array.prototype.forEach;
if (!Number.isFinite) Number.isFinite = function (v) { return typeof v === 'number' && isFinite(v); };
</script>
<script>${elements}</script>
<script>${isotopes}</script>
<script>${locale}</script>
<script>${appES5}</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'PSChP_Win.html'), html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log('wrote PSChP_Win.html (' + kb + ' KB)');
console.log('app ES5 contains "=>":', appES5.includes('=>'));
console.log('app ES5 contains "??":', appES5.includes('??'));
console.log('app ES5 contains "const ":', /\bconst /.test(appES5));
