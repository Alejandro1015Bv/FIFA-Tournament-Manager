import { getState, setState, subscribe, STATUS_LABELS } from './state.js';
import { load, save, lastLoadError } from './storage.js';
import { loadCatalog, catalogError } from './teams.js';
import { h, clear, toast, icon, banner, btn, openDialog } from './ui.js';
import { skeletonView } from './skeleton.js';
import { applyTheme, getTheme, setTheme, nextTheme, THEME_LABEL } from './theme.js';
import { APP_CONFIG } from './app-config.js';
import { initNative } from './native.js';
import { initAds, updateAdsForSection } from './ads.js';
import * as home from './views/home.js';
import * as players from './views/players-view.js';
import * as teams from './views/teams-view.js';
import * as config from './views/config-view.js';
import * as draw from './views/draw-view.js';
import * as schedule from './views/schedule-view.js';
import * as standings from './views/standings-view.js';
import * as results from './views/results-view.js';
import * as history from './views/history-view.js';

const SECTIONS = [
  ['inicio', 'Inicio', 'home', home], ['jugadores', 'Jugadores', 'users', players], ['equipos', 'Equipos', 'shield', teams],
  ['configuracion', 'Configuración', 'settings', config], ['sorteos', 'Sorteos', 'dice', draw],
  ['eliminatorias', 'Cuadro y calendario', 'trophy', schedule], ['clasificacion', 'Clasificación', 'chart', standings],
  ['resultados', 'Resultados', 'clipboard', results], ['historial', 'Historial', 'history', history]
];
const BOTTOM = ['inicio', 'jugadores', 'sorteos', 'eliminatorias'];
const $ = id => document.getElementById(id);
const current = () => SECTIONS.find(s => s[0] === location.hash.slice(1)) ?? SECTIONS[0];
let loading = true, lastSection = null;

function buildNav() {
  $('nav').replaceChildren(...SECTIONS.map(([id, label, ic]) => h('a', { class: 'nav-link', href: `#${id}`, dataset: { section: id } }, icon(ic), h('span', {}, label))));
  const more = h('button', { type: 'button', 'aria-haspopup': 'dialog', onClick: openMore }, icon('more'), h('span', {}, 'Más'));
  $('bottom-nav').replaceChildren(
    ...BOTTOM.map(id => { const [, label, ic] = SECTIONS.find(s => s[0] === id); return h('a', { href: `#${id}`, dataset: { section: id } }, icon(ic), h('span', {}, label)); }), more);
}
function openMore() {
  openDialog('Más secciones', close => h('nav', { 'aria-label': 'Más secciones', class: 'sheet-links' },
    SECTIONS.filter(s => !BOTTOM.includes(s[0])).map(([id, label, ic]) =>
      h('a', { class: 'nav-link', href: `#${id}`, 'aria-current': current()[0] === id ? 'page' : null, onClick: () => close(true) }, icon(ic), h('span', {}, label)))));
}
function updateThemeButton() {
  const mode = getTheme(), nxt = nextTheme(mode), b = $('theme-toggle');
  b.replaceChildren(icon({ auto: 'monitor', light: 'sun', dark: 'moon' }[mode]));
  b.setAttribute('aria-label', `Tema: ${THEME_LABEL[mode]}. Cambiar a ${THEME_LABEL[nxt].toLowerCase()}`);
  b.title = `Tema: ${THEME_LABEL[mode]}`;
}

function render() {
  const [sid, label, , view] = current();
  const changed = lastSection !== null && lastSection !== sid;
  $('section-title').textContent = label;
  document.title = `${label} · ${APP_CONFIG.appName}`;
  document.querySelectorAll('#nav a, #bottom-nav a').forEach(a => a.dataset.section === sid ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  const more = $('bottom-nav').querySelector('button'); if (more) BOTTOM.includes(sid) ? more.removeAttribute('aria-current') : more.setAttribute('aria-current', 'page');
  const t = getState().tournament;
  $('tournament-pill').textContent = t ? `${t.name} · ${STATUS_LABELS[t.status]}` : 'Sin torneo activo';
  const box = $('view'), y = window.scrollY;
  clear(box);
  if (loading) { box.setAttribute('aria-busy', 'true'); box.append(skeletonView(sid)); return; }
  box.removeAttribute('aria-busy');
  updateAdsForSection(sid);
  if (catalogError) box.append(banner('error', catalogError, btn('Reintentar', { size: 'small', variant: 'secondary', icon: 'refresh', onClick: retryCatalog })));
  try { view.render(box); }
  catch (e) { console.error(e); box.append(banner('error', `No se pudo mostrar esta sección (${e.message}). Prueba a recargar la app.`)); }
  if (changed) { window.scrollTo(0, 0); box.focus({ preventScroll: true }); } else window.scrollTo(0, y);
  lastSection = sid;
}
async function retryCatalog() { loading = true; render(); await loadCatalog(); loading = false; render(); }

async function init() {
  applyTheme(); updateThemeButton();
  $('theme-toggle').addEventListener('click', () => { setTheme(nextTheme(getTheme())); updateThemeButton(); });
  buildNav();
  setState(load());
  if (lastLoadError) toast(`Los datos guardados estaban dañados y se han reiniciado (se conserva una copia): ${lastLoadError}`, 'error', 9000);
  subscribe(s => { if (!save(s)) toast('No se pudo guardar en el navegador (¿almacenamiento lleno o bloqueado?). Exporta una copia JSON.', 'error', 8000); });
  subscribe(render);
  window.addEventListener('hashchange', render);
  window.addEventListener('app:rerender', render);
  window.addEventListener('app:retry-catalog', retryCatalog);
  render();                                   // primero el esqueleto…
  await loadCatalog();                        // …mientras se carga el catálogo
  loading = false; render();
  initNative();
  initAds().then(ok => ok && updateAdsForSection(current()[0]));
}
init();
