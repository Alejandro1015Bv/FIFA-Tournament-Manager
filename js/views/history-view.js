import { h, btn, emptyState, confirmDialog, fmtDate } from '../ui.js';
import { getState, FORMAT_LABELS } from '../state.js';
import { getCompetition } from '../teams.js';
import { act, archiveCurrent } from '../actions.js';

export function render(container) {
  const state = getState(), t = state.tournament;
  if (t?.status === 'finished') container.append(h('section', { class: 'card champion', 'aria-label': 'Torneo finalizado' }, h('span', { class: 'trophy', 'aria-hidden': 'true' }, '🏆'),
    h('div', { class: 'stack' }, h('h2', {}, `«${t.name}» ha terminado`), btn('Archivar en el historial', { icon: 'history', onClick: archiveCurrent }))));
  if (!state.history.length) { container.append(emptyState({ icon: 'history', title: 'Historial vacío', text: 'Los torneos archivados aparecerán aquí.', actions: [btn('Ir al inicio', { href: 'inicio', variant: 'secondary', icon: 'home' })] })); return; }

  const titles = new Map();
  for (const e of state.history) if (e.championId) titles.set(e.championName, (titles.get(e.championName) ?? 0) + 1);
  const ranking = [...titles].sort((a, b) => b[1] - a[1]);
  if (ranking.length) container.append(h('section', { class: 'card' }, h('h2', {}, 'Palmarés'), h('ol', { class: 'ranking' }, ranking.map(([n, c]) => h('li', {}, `${n} — ${c} título${c > 1 ? 's' : ''}`)))));

  state.history.forEach(e => container.append(h('article', { class: 'card', 'aria-label': e.name },
    h('header', { class: 'between' }, h('div', {}, h('h2', {}, e.name), h('small', { class: 'muted' }, `${fmtDate(e.finishedAt)} · ${getCompetition(e.competitionId)?.name ?? e.competitionId} · ${FORMAT_LABELS[e.format] ?? e.format} · ${e.matchesPlayed} partidos`)),
      btn('Eliminar', { variant: 'danger-ghost', size: 'small', icon: 'trash', ariaLabel: `Eliminar «${e.name}» del historial`, onClick: async () => {
        if (await confirmDialog({ title: 'Eliminar del historial', danger: true, confirmText: 'Eliminar', message: `¿Eliminar «${e.name}»? No se puede deshacer.` }))
          act(s => { s.history = s.history.filter(x => x.id !== e.id); }, 'Entrada eliminada');
      } })),
    h('p', {}, e.championName ? `Campeón: ${e.championName} (${e.championTeamName})` : 'Sin campeón registrado'),
    h('div', { class: 'table-wrap', tabindex: 0, role: 'region', 'aria-label': `Participantes de ${e.name}` }, h('table', { class: 'table' }, h('caption', { class: 'sr-only' }, `Participantes de ${e.name}`),
      h('thead', {}, h('tr', {}, ['Jugador', 'Equipo', 'PJ', 'G', 'E', 'P', 'GF', 'GC'].map((c, i) => h('th', { scope: 'col', class: i > 1 ? 'num' : '' }, c)))),
      h('tbody', {}, e.participants.map(p => h('tr', { class: p.playerId === e.championId ? 'champion-row' : '' }, h('td', {}, p.name), h('td', {}, p.teamName),
        ...[p.stats.played, p.stats.won, p.stats.drawn, p.stats.lost, p.stats.gf, p.stats.ga].map(v => h('td', { class: 'num' }, String(v)))))))))));
}
