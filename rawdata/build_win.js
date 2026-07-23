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

// Dialog polyfill styling: only active when <html> gets the .dialog-polyfill
// class (added by the JS polyfill on engines without a native <dialog>).
css += `

/* Fallback modal presentation for engines lacking native <dialog> (e.g. IE11) */
.dialog-polyfill dialog { display: none; }
.dialog-polyfill dialog[open] {
  display: block; position: fixed; z-index: 1000;
  top: 50%; left: 50%; transform: translate(-50%, -50%);
  margin: 0; overflow: auto;
}
.dialog-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); z-index: 999; }
`;

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

/* Surface any script error on-screen instead of failing to a blank page —
   so problems on hard-to-reach machines report themselves. */
window.onerror = function (msg, src, line, col) {
  try {
    var d = document.getElementById("__err");
    if (!d) { d = document.createElement("div"); d.id = "__err";
      d.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#b00020;color:#fff;font:12px/1.4 monospace;padding:8px;white-space:pre-wrap;";
      (document.body || document.documentElement).appendChild(d); }
    d.appendChild(document.createTextNode("Chyba / Error: " + msg + "  @" + line + ":" + col + "\\n"));
  } catch (e) {}
  return false;
};

/* --- Polyfills for older engines (IE11 / legacy Edge on Windows 7) --------- */
(function () {
  if (window.NodeList && !NodeList.prototype.forEach) NodeList.prototype.forEach = Array.prototype.forEach;
  if (window.HTMLCollection && !HTMLCollection.prototype.forEach) HTMLCollection.prototype.forEach = Array.prototype.forEach;
  if (!Number.isFinite) Number.isFinite = function (v) { return typeof v === "number" && isFinite(v); };
  if (!Array.prototype.find) Array.prototype.find = function (pred, thisArg) {
    for (var i = 0; i < this.length; i++) if (pred.call(thisArg, this[i], i, this)) return this[i];
    return undefined;
  };
  if (!Array.prototype.indexOf) Array.prototype.indexOf = function (x) {
    for (var i = 0; i < this.length; i++) if (this[i] === x) return i; return -1;
  };
  if (!String.prototype.includes) String.prototype.includes = function (s, p) { return this.indexOf(s, p || 0) !== -1; };
  if (!String.prototype.startsWith) String.prototype.startsWith = function (s, p) { p = p || 0; return this.substr(p, s.length) === String(s); };
  if (!Array.prototype.includes) Array.prototype.includes = function (x) { return this.indexOf(x) !== -1; };

  // Map / Set: IE11 has them but ignores the iterable constructor argument, so
  // new Map(pairs) yields an empty map. Replace with a minimal, correct version
  // only when the native one is absent or broken.
  var mapOk = false;
  try { mapOk = (new Map([[1, 2]])).get(1) === 2; } catch (e) { mapOk = false; }
  if (!mapOk) {
    var PMap = function (iter) {
      this._k = []; this._v = [];
      if (iter) for (var i = 0; i < iter.length; i++) this.set(iter[i][0], iter[i][1]);
    };
    PMap.prototype.set = function (k, v) { var i = this._k.indexOf(k); if (i < 0) { this._k.push(k); this._v.push(v); } else this._v[i] = v; return this; };
    PMap.prototype.get = function (k) { var i = this._k.indexOf(k); return i < 0 ? undefined : this._v[i]; };
    PMap.prototype.has = function (k) { return this._k.indexOf(k) >= 0; };
    PMap.prototype["delete"] = function (k) { var i = this._k.indexOf(k); if (i < 0) return false; this._k.splice(i, 1); this._v.splice(i, 1); return true; };
    PMap.prototype.forEach = function (cb, t) { for (var i = 0; i < this._k.length; i++) cb.call(t, this._v[i], this._k[i], this); };
    try { Object.defineProperty(PMap.prototype, "size", { get: function () { return this._k.length; } }); } catch (e) {}
    window.Map = PMap;
  }
  var setOk = false;
  try { setOk = (new Set([1, 1])).size === 1; } catch (e) { setOk = false; }
  if (!setOk) {
    var PSet = function (iter) { this._v = []; if (iter) for (var i = 0; i < iter.length; i++) this.add(iter[i]); };
    PSet.prototype.add = function (v) { if (this._v.indexOf(v) < 0) this._v.push(v); return this; };
    PSet.prototype.has = function (v) { return this._v.indexOf(v) >= 0; };
    PSet.prototype["delete"] = function (v) { var i = this._v.indexOf(v); if (i < 0) return false; this._v.splice(i, 1); return true; };
    PSet.prototype.forEach = function (cb, t) { for (var i = 0; i < this._v.length; i++) cb.call(t, this._v[i], this._v[i], this); };
    try { Object.defineProperty(PSet.prototype, "size", { get: function () { return this._v.length; } }); } catch (e) {}
    window.Set = PSet;
  }

  // <dialog> polyfill: IE11 and pre-Chromium engines have no dialog element.
  if (typeof document.createElement("dialog").showModal !== "function") {
    document.documentElement.className += " dialog-polyfill";
    var patch = function (dlg) {
      dlg.open = dlg.hasAttribute("open");
      dlg.showModal = function () {
        if (this.open) return;
        this.open = true; this.setAttribute("open", "");
        var self = this, bd = document.createElement("div");
        bd.className = "dialog-backdrop";
        bd.onclick = function () { self.close(); };
        document.body.appendChild(bd); this.__bd = bd;
        this.__esc = function (e) { if ((e.keyCode || e.which) === 27) self.close(); };
        document.addEventListener ? document.addEventListener("keydown", this.__esc)
                                  : document.attachEvent("onkeydown", this.__esc);
      };
      dlg.close = function () {
        if (!this.open) return;
        this.open = false; this.removeAttribute("open");
        if (this.__bd && this.__bd.parentNode) this.__bd.parentNode.removeChild(this.__bd);
        this.__bd = null;
        if (this.__esc) { document.removeEventListener ? document.removeEventListener("keydown", this.__esc)
                                                        : document.detachEvent("onkeydown", this.__esc); this.__esc = null; }
      };
    };
    var dlgs = document.getElementsByTagName("dialog");
    for (var i = 0; i < dlgs.length; i++) patch(dlgs[i]);
  }
})();
</script>
<script>${elements}</script>
<script>${isotopes}</script>
<script>${locale}</script>
<script>${appES5}</script>
</body>
</html>
`;

// Prepend a UTF-8 BOM so localized Windows browsers can't mis-detect the
// encoding of a file full of Czech text and superscripts (α, β, ⁰¹², ✕, →).
fs.writeFileSync(path.join(ROOT, 'PSChP_Win.html'), '﻿' + html);
const kb = (Buffer.byteLength('﻿' + html) / 1024).toFixed(0);
console.log('wrote PSChP_Win.html (' + kb + ' KB), BOM + polyfills');
console.log('app ES5 contains "=>":', appES5.includes('=>'));
console.log('app ES5 contains "??":', appES5.includes('??'));
console.log('app ES5 contains "const ":', /\bconst /.test(appES5));
