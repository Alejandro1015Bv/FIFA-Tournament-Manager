import { h, btn, emptyState, banner, rerender } from '../ui.js';
import { getState } from '../state.js';
import { matchCard, noTournamentState } from './shared.js';

let filter = 'all';

export function render(container) {
  const state = getState(), t = state.tournament;
  if (!t) { container.append(noTournamentState()); return; }
  const real = t.matches.filter(m => !m.bye);
  if (!real.length) { container.append(emptyState({ icon: 'clipboard', title: 'Aún no hay partidos', text: 'Sortea los enfrentamientos para registrar resultados.', actions: [btn('Ir a Sorteos', { href: 'sorteos', icon: 'dice' })] })); return; }
  const done = real.filter(m => m.status === 'done').length;
  container.append(h('div', { class: 'card toolbar' },
    h('label', { class: 'field inline' }, h('span', {}, 'Mostrar'), h('select', { onChange: e => { filter = e.target.value; rerender(); } },
      [['all', 'Todos'], ['pending', 'Pendientes'], ['live', 'En juego'], ['done', 'Finalizados']].map(([v, l]) => h('option', { value: v, selected: filter === v }, l)))),
    h('span', { class: 'count', 'aria-live': 'polite' }, `${done} de ${real.length} finalizados`)));
  if (t.status === 'drawn') container.append(banner('warn', 'Confirma el sorteo para registrar resultados.', btn('Confirmar', { href: 'sorteos', size: 'small', variant: 'secondary' })));
  const shown = real.filter(m => filter === 'all' || m.status === filter);
  if (!shown.length) { container.append(emptyState({ icon: 'search', title: 'Ningún partido coincide', actions: [btn('Mostrar todos', { variant: 'secondary', onClick: () => { filter = 'all'; rerender(); } })] })); return; }
  const groups = new Map();
  for (const m of shown) {
    const key = m.stage === 'knockout' ? `Eliminatorias · ${m.roundName}` : t.format === 'round-robin' ? m.roundName : `${t.groups.find(g => g.id === m.groupId)?.name ?? m.groupId} · ${m.roundName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  for (const [title, ms] of groups) container.append(h('section', { class: 'card' }, h('h2', {}, title), h('div', { class: 'match-grid' }, ms.map(m => matchCard(t, state, m)))));
}
