// Auditoría automática de accesibilidad y estados de la interfaz (jsdom): node tests/a11y-smoke.js
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const dom = new JSDOM('<!doctype html><html lang="es"><head><meta name="theme-color" content="#000"></head><body><div id="toast-region"></div></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location, CustomEvent: dom.window.CustomEvent, Node: dom.window.Node });
globalThis.localStorage = dom.window.localStorage; window.scrollTo = () => {};

const { setCatalog, getTeamsByCompetition } = await import('../js/teams.js');
const S = await import('../js/state.js'); const E = await import('../js/tournament-engine.js');
const UI = await import('../js/ui.js'); const { skeletonView } = await import('../js/skeleton.js'); const TH = await import('../js/theme.js');
setCatalog(JSON.parse(fs.readFileSync(new URL('../data/competitions.json', import.meta.url))).competitions, JSON.parse(fs.readFileSync(new URL('../data/teams.json', import.meta.url))).teams);
const views = {};
for (const n of ['home', 'players-view', 'teams-view', 'config-view', 'draw-view', 'schedule-view', 'standings-view', 'results-view', 'history-view']) views[n] = await import(`../js/views/${n}.js`);

// ---------- auditoría
const nameOf = el => (el.getAttribute('aria-label') ?? '').trim() || el.textContent.trim() || (el.getAttribute('title') ?? '').trim();
function audit(root, label) {
  const bad = [];
  root.querySelectorAll('img').forEach(i => { if (!i.hasAttribute('alt')) bad.push(`img sin alt (${i.src.slice(0, 40)})`); });
  root.querySelectorAll('button, a[href], [role=button]').forEach(b => { if (!nameOf(b)) bad.push(`${b.tagName.toLowerCase()} sin nombre accesible`); });
  root.querySelectorAll('input, select, textarea').forEach(i => {
    if (i.type === 'hidden') return;
    const labelled = i.closest('label') || i.getAttribute('aria-label') || i.getAttribute('aria-labelledby') || (i.id && root.querySelector(`label[for="${i.id}"]`));
    if (!labelled) bad.push(`${i.tagName.toLowerCase()}[${i.type}] sin etiqueta`);
  });
  const ids = [...root.querySelectorAll('[id]')].map(e => e.id); if (new Set(ids).size !== ids.length) bad.push('ids duplicados');
  root.querySelectorAll('table').forEach(t => { if (!t.querySelector('caption')) bad.push('tabla sin caption'); if (t.querySelector('th:not([scope])')) bad.push('th sin scope'); });
  root.querySelectorAll('.table-wrap, .bracket-scroll').forEach(w => { if (!w.getAttribute('aria-label') || w.getAttribute('tabindex') !== '0') bad.push('región desplazable sin etiqueta/foco'); });
  root.querySelectorAll('svg.icon').forEach(s => { if (!s.hasAttribute('aria-hidden') && !s.hasAttribute('aria-label')) bad.push('icono sin aria-hidden ni etiqueta'); });
  root.querySelectorAll('[role=tab]').forEach(t => { if (!t.hasAttribute('aria-selected')) bad.push('tab sin aria-selected'); });
  assert.deepEqual(bad, [], `${label}: ${bad.join('; ')}`);
}
let ok = 0; const pass = n => { ok++; console.log('  ✓ ' + n); };

const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `Jugador ${i}`, createdAt: 1 }));
const base = (extra = {}) => ({ ...S.createInitialState(), players, ...extra });
const mk = (format, n = 8, comp = 'laliga') => E.assignTeams(E.createTournament({ name: 'Copa', competitionId: comp, format, playerIds: players.slice(0, n).map(p => p.id), onlyInGame: false }), getTeamsByCompetition(comp).map(x => x.id));
const play = (t) => { for (const m of t.matches.filter(x => !x.bye && x.status !== 'done' && x.homeId && x.awayId)) t = E.recordResult(t, m.id, { status: 'done', homeGoals: 2, awayGoals: Number(m.homeId.slice(1)) % 2 }); return t; };
const STATES = {
  'sin datos': base({ players: [] }), 'solo jugadores': base(), 'borrador': base({ tournament: mk('knockout') }),
  'sorteo sin confirmar': base({ tournament: E.generateDraw(mk('groups-knockout')) }),
  'KO en curso': base({ tournament: E.confirmDraw(E.generateDraw(mk('knockout', 6))) }),
  'liguilla': base({ tournament: play(E.confirmDraw(E.generateDraw(mk('round-robin', 5)))) }),
  'grupos + cuadro': base({ tournament: play(play(E.confirmDraw(E.generateDraw(mk('groups-knockout', 7))))) })
};
STATES['KO terminado'] = base({ tournament: play(play(play(STATES['KO en curso'].tournament))) });
STATES['con historial'] = base({ tournament: STATES['KO terminado'].tournament, history: [E.buildHistoryEntry(STATES['KO terminado'].tournament, players, () => 'X')] });

for (const [label, st] of Object.entries(STATES)) {
  S.setState(st);
  for (const [n, v] of Object.entries(views)) {
    const box = document.createElement('div'); v.render(box); document.body.append(box);
    assert.ok(box.children.length, `${label}/${n}: vacío`);   // nunca una pantalla en blanco
    audit(box, `${label}/${n}`); box.remove();
  }
}
pass(`${Object.keys(STATES).length} estados × ${Object.keys(views).length} secciones: alt, nombres accesibles, etiquetas, ids, tablas, regiones`);

// ---------- estados vacíos con acción
S.setState(base({ players: [] }));
for (const n of ['players-view', 'home']) { const b = document.createElement('div'); views[n].render(b); assert.ok(b.querySelector('.empty-state h2'), `${n}: falta estado vacío`); }
S.setState(base());
for (const n of ['draw-view', 'schedule-view', 'standings-view', 'results-view']) {
  const b = document.createElement('div'); views[n].render(b);
  const es = b.querySelector('.empty-state'); assert.ok(es && es.querySelector('h2') && es.querySelector('a.btn, button.btn'), `${n}: estado vacío sin título o sin acción`);
}
pass('sin torneo: cada sección explica qué falta y ofrece la acción para resolverlo');

// ---------- esqueletos
for (const id of ['inicio', 'jugadores', 'equipos', 'configuracion', 'sorteos', 'eliminatorias', 'clasificacion', 'resultados', 'historial']) {
  const sk = skeletonView(id);
  assert.equal(sk.getAttribute('aria-busy'), 'true'); assert.equal(sk.getAttribute('role'), 'status');
  assert.ok(sk.querySelector('.sk, .card'), `${id}: esqueleto vacío`); assert.match(sk.textContent, /Cargando/);
  assert.equal(sk.querySelectorAll('img').length, 0);
}
pass('9 esqueletos de carga con role=status, aria-busy y texto para lectores de pantalla');

// ---------- insignia: esqueleto mientras carga y alt
{
  const { teamBadge, getTeam } = await import('../js/teams.js');
  const team = getTeam('real-madrid'); const img = teamBadge(team);
  assert.ok(img.classList.contains('is-loading')); assert.equal(img.alt, team.imageAlt);
  img.dispatchEvent(new window.Event('load')); assert.ok(!img.classList.contains('is-loading'));
  assert.equal(teamBadge(team, { decorative: true }).alt, '');
  const failing = teamBadge(team); failing.dispatchEvent(new window.Event('error')); assert.ok(failing.src.startsWith('data:image/svg+xml'), 'si falla, iniciales locales');
  assert.equal(teamBadge(null).getAttribute('alt'), 'Escudo genérico');
}
pass('insignias: esqueleto mientras carga, alt informativo/decorativo y reserva local');

// ---------- componentes y diálogos
{
  const dlgP = UI.confirmDialog({ title: 'Prueba', message: 'msg', confirmText: 'Sí', danger: true });
  const dlg = document.querySelector('dialog'); assert.equal(dlg.getAttribute('aria-labelledby'), dlg.querySelector('h2').id);
  assert.ok(dlg.querySelector('.btn.danger')); dlg.querySelector('.btn.danger').click(); assert.equal(await dlgP, true); assert.equal(document.querySelector('dialog'), null);
  const b = UI.btn('Hola', { variant: 'secondary', size: 'small', icon: 'plus', disabled: true }); assert.ok(b.disabled && b.classList.contains('secondary') && b.querySelector('svg[aria-hidden=true]'));
  UI.toast('Hecho', 'ok'); UI.toast('Falló', 'error');
  const ts = [...document.querySelectorAll('.toast')]; assert.equal(ts[0].getAttribute('role'), 'status'); assert.equal(ts[1].getAttribute('role'), 'alert'); assert.ok(ts.every(t => t.querySelector('svg')), 'avisos con icono, no solo color');
}
pass('diálogo etiquetado, botones con variantes y avisos con rol e icono');

// ---------- tema
{
  assert.equal(TH.getTheme(), 'auto'); TH.setTheme('light'); assert.equal(document.documentElement.getAttribute('data-theme'), 'light'); assert.equal(TH.getTheme(), 'light');
  TH.setTheme('dark'); assert.equal(document.documentElement.getAttribute('data-theme'), 'dark'); TH.setTheme('auto'); assert.equal(document.documentElement.hasAttribute('data-theme'), false);
  assert.deepEqual(['auto', 'light', 'dark'].map(TH.nextTheme), ['light', 'dark', 'auto']);
}
pass('tema automático / claro / oscuro persistente');

// ---------- CSS: solo tokens (sin colores sueltos) y estados de interacción definidos
{
  const css = fs.readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
  const loose = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)].map(m => m[0]);
  assert.deepEqual(loose, [], 'styles.css no debe tener colores literales; usa tokens');
  for (const sel of ['.btn:active', '.btn:disabled', ':focus-visible', 'a:hover', '.nav-link[aria-current', '.btn.secondary:hover', 'input:disabled', '.tab.on', '@media (hover: hover)', '@media (min-width: 768px)', '@media (min-width: 1280px)', '@media (prefers-reduced-motion: reduce)'])
    assert.ok(css.includes(sel), `falta ${sel}`);
}
pass('CSS sin colores sueltos; hover/focus/active/disabled, 3 breakpoints y movimiento reducido definidos');
console.log(`\n${ok} comprobaciones de accesibilidad y estados correctas`);
process.exit(0);
