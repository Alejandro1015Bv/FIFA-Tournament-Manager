import { h, emptyCard, confirmDialog, fmtDate, linkBtn } from '../ui.js';
import { getState, FORMAT_LABELS } from '../state.js';
import { getCompetition } from '../teams.js';
import { act, archiveCurrent } from '../actions.js';

export function render(container) {
  const state = getState(), t = state.tournament;
  if (t?.status === 'finished') container.append(h('div', { class: 'card champion' }, h('span', { class: 'trophy' }, '🏆'),
    h('div', {}, h('strong', {}, `«${t.name}» ha terminado.`), h('p', { class: 'muted' }, 'Archívalo para guardarlo en el historial y empezar otro torneo.')),
    h('button', { class: 'btn', type: 'button', onClick: archiveCurrent }, 'Archivar torneo')));
  if (!state.history.length) { container.append(emptyCard('Todavía no hay campeonatos archivados.', linkBtn('Ir al inicio', 'inicio', 'btn secondary'))); return; }

  const titles = new Map();
  for (const e of state.history) if (e.championId) titles.set(e.championName, (titles.get(e.championName) ?? 0) + 1);
  const ranking = [...titles].sort((a, b) => b[1] - a[1]);
  if (ranking.length) container.append(h('div', { class: 'card' }, h('h3', {}, 'Palmarés'), h('ol', { class: 'ranking' }, ranking.map(([n, c]) => h('li', {}, `${n} — ${c} título${c > 1 ? 's' : ''}`)))));

  state.history.forEach(e => container.append(h('article', { class: 'card' },
    h('header', { class: 'between' }, h('div', {}, h('h3', {}, e.name), h('small', { class: 'muted' }, `${fmtDate(e.finishedAt)} · ${getCompetition(e.competitionId)?.name ?? e.competitionId} · ${FORMAT_LABELS[e.format] ?? e.format} · ${e.matchesPlayed} partidos`)),
      h('button', { class: 'btn small danger', type: 'button', onClick: async () => {
        if (await confirmDialog({ title: 'Eliminar del historial', danger: true, confirmText: 'Eliminar', message: `¿Eliminar «${e.name}» del historial? No se puede deshacer.` }))
          act(s => { s.history = s.history.filter(x => x.id !== e.id); }, 'Entrada eliminada');
      } }, 'Eliminar')),
    h('p', {}, e.championName ? `🏆 Campeón: ${e.championName} (${e.championTeamName})` : 'Sin campeón registrado'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Jugador', 'Equipo', 'PJ', 'G', 'E', 'P', 'GF', 'GC'].map((c, i) => h('th', { scope: 'col', class: i > 1 ? 'num' : '' }, c)))),
      h('tbody', {}, e.participants.map(p => h('tr', { class: p.playerId === e.championId ? 'champion-row' : '' }, h('td', {}, p.name), h('td', {}, p.teamName),
        ...[p.stats.played, p.stats.won, p.stats.drawn, p.stats.lost, p.stats.gf, p.stats.ga].map(v => h('td', { class: 'num' }, String(v)))))))))));
}
