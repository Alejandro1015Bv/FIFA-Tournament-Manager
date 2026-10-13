import { h, emptyCard, linkBtn, rerender } from '../ui.js';
import { getState } from '../state.js';
import { matchCard } from './shared.js';

let filter = 'all';

export function render(container) {
  const state = getState(), t = state.tournament;
  if (!t) { container.append(emptyCard('No hay ningún torneo activo.', linkBtn('Configurar torneo', 'configuracion'))); return; }
  const real = t.matches.filter(m => !m.bye);
  if (!real.length) { container.append(emptyCard('No hay partidos todavía.', linkBtn('Ir a Sorteos', 'sorteos'))); return; }
  container.append(h('div', { class: 'card toolbar' },
    h('label', { class: 'field inline' }, h('span', {}, 'Mostrar'), h('select', { onChange: e => { filter = e.target.value; rerender(); } },
      [['all', 'Todos'], ['pending', 'Pendientes'], ['live', 'En juego'], ['done', 'Finalizados']].map(([v, l]) => h('option', { value: v, selected: filter === v }, l)))),
    h('span', { class: 'muted' }, `${real.filter(m => m.status === 'done').length} de ${real.length} partidos finalizados`)));
  if (t.status === 'drawn') container.append(h('div', { class: 'banner warn' }, 'Confirma el sorteo para poder registrar resultados.'));
  const shown = real.filter(m => filter === 'all' || m.status === filter);
  if (!shown.length) { container.append(emptyCard('Ningún partido coincide con el filtro.')); return; }
  const groups = new Map();
  for (const m of shown) {
    const key = m.stage === 'knockout' ? `Eliminatorias · ${m.roundName}` : t.format === 'round-robin' ? m.roundName : `${t.groups.find(g => g.id === m.groupId)?.name ?? m.groupId} · ${m.roundName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  for (const [title, ms] of groups) container.append(h('section', { class: 'card' }, h('h3', {}, title), h('div', { class: 'match-grid' }, ms.map(m => matchCard(t, state, m)))));
}
