import { getState, setState, subscribe, STATUS_LABELS } from './state.js';
import { load, save, lastLoadError } from './storage.js';
import { loadCatalog, catalogError } from './teams.js';
import { h, clear, toast } from './ui.js';
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
  ['inicio', 'Inicio', '🏠', home], ['jugadores', 'Jugadores', '👥', players], ['equipos', 'Equipos y competiciones', '🛡️', teams],
  ['configuracion', 'Configuración del torneo', '⚙️', config], ['sorteos', 'Sorteos', '🎲', draw],
  ['eliminatorias', 'Eliminatorias / calendario', '🏆', schedule], ['clasificacion', 'Clasificación', '📊', standings],
  ['resultados', 'Resultados', '📝', results], ['historial', 'Historial', '📚', history]
];
const $ = id => document.getElementById(id);

function buildNav() {
  $('nav').replaceChildren(...SECTIONS.map(([id, label, icon]) =>
    h('a', { class: 'nav-link', href: `#${id}`, dataset: { section: id }, onClick: () => $('sidebar').classList.remove('open') }, h('span', { 'aria-hidden': 'true' }, icon), ` ${label}`)));
}

function render() {
  const id = location.hash.slice(1);
  const [sid, label, , view] = SECTIONS.find(s => s[0] === id) ?? SECTIONS[0];
  $('section-title').textContent = label;
  document.title = `${label} · FIFA Tournament Manager`;
  document.querySelectorAll('.nav-link').forEach(a => a.dataset.section === sid ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  const t = getState().tournament;
  $('tournament-pill').textContent = t ? `${t.name} · ${STATUS_LABELS[t.status]}` : 'Sin torneo activo';
  const box = $('view');
  const y = window.scrollY;
  clear(box);
  if (catalogError) box.append(h('div', { class: 'banner error' }, catalogError));
  try { view.render(box); }
  catch (e) { console.error(e); box.append(h('div', { class: 'card' }, h('p', { class: 'form-error' }, `Error al mostrar la sección: ${e.message}`))); }
  window.scrollTo(0, y);
}

async function init() {
  setState(load());
  if (lastLoadError) toast(`Los datos guardados estaban dañados y se han reiniciado (copia de seguridad conservada): ${lastLoadError}`, 'error', 9000);
  subscribe(s => { if (!save(s)) toast('No se pudo guardar en el navegador (¿almacenamiento lleno o bloqueado?). Exporta una copia JSON.', 'error', 8000); });
  subscribe(render);
  buildNav();
  $('menu-toggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  window.addEventListener('hashchange', render);
  window.addEventListener('app:rerender', render);
  await loadCatalog();
  render();
}
init();
