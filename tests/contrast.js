// Comprueba el contraste WCAG de los tokens (texto ≥ 4.5:1, controles/bordes ≥ 3:1) en oscuro y claro.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
const block = sel => {
  const i = css.indexOf(sel + ' {'); assert.ok(i >= 0, `no encuentro ${sel}`);
  return css.slice(i, css.indexOf('}', i));
};
const vars = text => Object.fromEntries([...text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)].map(m => [m[1], m[2]]));
const dark = vars(block(':root, :root[data-theme="dark"]'));
const light = vars(block(':root[data-theme="light"]'));
const auto = vars(css.slice(css.indexOf('@media (prefers-color-scheme: light)')));

const lum = hex => {
  const h = hex.replace('#', ''); const n = h.length === 3 ? [...h].map(c => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

// [primer plano, fondo, mínimo, descripción]
const PAIRS = [
  ['text', 'bg', 4.5, 'texto sobre fondo'], ['text', 'surface', 4.5, 'texto sobre tarjeta'], ['text', 'surface-2', 4.5, 'texto sobre superficie 2'],
  ['text', 'surface-3', 4.5, 'texto sobre superficie 3'],
  ['text-muted', 'bg', 4.5, 'texto atenuado sobre fondo'], ['text-muted', 'surface', 4.5, 'texto atenuado sobre tarjeta'], ['text-muted', 'surface-2', 4.5, 'texto atenuado sobre superficie 2'],
  ['text-on-primary', 'primary', 4.5, 'texto del botón primario'], ['text-on-primary', 'primary-hover', 4.5, 'botón primario (hover)'], ['text-on-primary', 'primary-active', 4.5, 'botón primario (active)'],
  ['primary-text', 'surface', 4.5, 'enlaces sobre tarjeta'], ['primary-text', 'bg', 4.5, 'enlaces sobre fondo'],
  ['info', 'surface', 4.5, 'info'], ['success', 'surface', 4.5, 'éxito'], ['warning', 'surface', 4.5, 'aviso'], ['danger', 'surface', 4.5, 'error (texto)'],
  ['text-on-danger', 'danger-solid', 4.5, 'botón de peligro'],
  ['border-strong', 'surface', 3, 'borde de controles sobre tarjeta'], ['border-strong', 'surface-2', 3, 'borde de controles sobre superficie 2'],
  ['focus', 'bg', 3, 'anillo de foco sobre fondo'], ['focus', 'surface', 3, 'anillo de foco sobre tarjeta']
];
let bad = 0, n = 0;
for (const [name, t] of [['oscuro', dark], ['claro', light], ['auto-claro', auto]]) {
  if (name === 'auto-claro') { // el bloque auto debe replicar el claro
    for (const k of Object.keys(light)) if (auto[k] && auto[k].toLowerCase() !== light[k].toLowerCase()) { bad++; console.log(`  ✗ auto-claro difiere del claro en --${k}`); }
    n++; continue;
  }
  for (const [fg, bg, min, d] of PAIRS) {
    const r = ratio(t[fg], t[bg]); n++;
    if (r < min) { bad++; console.log(`  ✗ [${name}] ${d}: ${r.toFixed(2)}:1 (mín. ${min}) --${fg} ${t[fg]} sobre --${bg} ${t[bg]}`); }
  }
  // la superficie 'primary-soft' (rgba) no se mide: el texto sobre ella usa primary-text/surface, ya comprobado
}
console.log(bad ? `\n${bad} combinaciones no cumplen` : `\n${n} comprobaciones de contraste correctas (oscuro y claro)`);
process.exit(bad ? 1 : 0);
