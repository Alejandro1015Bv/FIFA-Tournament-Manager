// Esqueletos de carga: reproducen la forma del contenido real mientras se cargan el catálogo o las imágenes.
import { h } from './ui.js';

const line = (w = '') => h('div', { class: `sk sk-line ${w}`.trim() });
const circle = size => h('div', { class: 'sk sk-circle', style: `width:${size}px;height:${size}px` });
const card = (...kids) => h('div', { class: 'card' }, ...kids);
const head = () => h('div', { class: 'stack' }, h('div', { class: 'sk sk-title' }), line('w-50'));
const statGrid = n => h('div', { class: 'grid stats' }, Array.from({ length: n }, () => card(line('w-50'), line('w-90'))));
const rows = n => Array.from({ length: n }, () => h('div', { class: 'row-center' }, circle(32), h('div', { class: 'stack', style: 'flex:1' }, line('w-50'), line('w-30')), line('w-30')));
const matchCard = () => h('div', { class: 'match' }, line('w-30'), h('div', { class: 'row-center' }, circle(28), line('w-50')), h('div', { class: 'row-center' }, circle(28), line('w-70')));

const LAYOUTS = {
  dashboard: () => [statGrid(4), card(line('w-30'), line('w-90'), line('w-70')), h('div', { class: 'grid two' }, card(line('w-50'), matchCard(), matchCard()), card(line('w-50'), matchCard()))],
  grid: () => [head(), h('div', { class: 'grid players' }, Array.from({ length: 6 }, () => card(h('div', { class: 'row-center' }, circle(40), h('div', { class: 'stack', style: 'flex:1' }, line('w-50'), line('w-30'))), line('w-90'))))],
  form: () => [h('div', { class: 'sk sk-block', style: 'height:2.5rem;width:100%' }), card(line('w-30'), h('div', { class: 'sk sk-block', style: 'height:44px' }), line('w-30'), h('div', { class: 'sk sk-block', style: 'height:44px' }), h('div', { class: 'sk sk-btn' }))],
  list: () => [head(), h('div', { class: 'match-grid' }, Array.from({ length: 6 }, matchCard))],
  table: () => [head(), card(...rows(6))]
};
const BY_SECTION = { inicio: 'dashboard', jugadores: 'grid', equipos: 'grid', configuracion: 'form', sorteos: 'grid', eliminatorias: 'list', clasificacion: 'table', resultados: 'list', historial: 'table' };

export function skeletonView(sectionId) {
  const layout = LAYOUTS[BY_SECTION[sectionId] ?? 'list']();
  return h('div', { class: 'skeleton-view stack', role: 'status', 'aria-busy': 'true' }, h('span', { class: 'sr-only' }, 'Cargando contenido…'), ...layout);
}
