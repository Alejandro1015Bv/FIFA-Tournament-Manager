import { h, btn, emptyState } from '../ui.js';
import { getState, FORMATS, TIEBREAK_PRESETS } from '../state.js';
import { computeStandings, knockoutProgress } from '../standings.js';
import { playerCell, noTournamentState } from './shared.js';
import { copySummary } from '../share.js';

const wrap = (label, table) => h('div', { class: 'table-wrap', tabindex: 0, role: 'region', 'aria-label': label }, table);

function table(t, state, g, qualifiers = 0) {
  const rows = computeStandings(t, g.id);
  const head = [['#', 'Posición'], ['Jugador', 'Jugador'], ['PJ', 'Partidos jugados'], ['G', 'Ganados'], ['E', 'Empatados'], ['P', 'Perdidos'], ['GF', 'Goles a favor'], ['GC', 'Goles en contra'], ['DG', 'Diferencia de goles'], ['Pts', 'Puntos']];
  return wrap(`Clasificación ${g.name}`, h('table', { class: 'table' }, h('caption', { class: 'sr-only' }, `Clasificación de ${g.name}`),
    h('thead', {}, h('tr', {}, head.map(([c, full], i) => h('th', { scope: 'col', class: i > 1 ? 'num' : '' }, h('abbr', { title: full }, c))))),
    h('tbody', {}, rows.map(r => h('tr', { class: r.position <= qualifiers ? 'qualified' : '' },
      h('td', {}, String(r.position), r.position <= qualifiers ? h('span', { class: 'sr-only' }, ' (clasifica)') : null),
      h('td', {}, playerCell(t, state, r.playerId, { size: 24 }), r.byLot ? h('small', { class: 'muted' }, ' · sorteo') : null),
      ...[r.played, r.won, r.drawn, r.lost, r.gf, r.ga, r.gd > 0 ? `+${r.gd}` : r.gd, r.pts].map((v, i) => h('td', { class: 'num' + (i === 7 ? ' pts' : '') }, String(v))))))));
}
function progressTable(t, state) {
  const rows = knockoutProgress(t);
  const LABEL = { champion: 'Campeón', active: 'En competición', eliminated: 'Eliminado' };
  return wrap('Progreso en el cuadro', h('table', { class: 'table' }, h('caption', { class: 'sr-only' }, 'Progreso de cada jugador en el cuadro'),
    h('thead', {}, h('tr', {}, ['Jugador', 'Estado', 'Ronda', 'PJ', 'G', 'P', 'GF', 'GC'].map((c, i) => h('th', { scope: 'col', class: i > 2 ? 'num' : '' }, c)))),
    h('tbody', {}, rows.map(r => h('tr', { class: r.stage }, h('td', {}, playerCell(t, state, r.playerId, { size: 24 })), h('td', {}, LABEL[r.stage]),
      h('td', {}, r.stage === 'eliminated' ? r.eliminatedIn : r.roundName),
      ...[r.stats.played, r.stats.won, r.stats.lost, r.stats.gf, r.stats.ga].map(v => h('td', { class: 'num' }, String(v))))))));
}

export function render(container) {
  const state = getState(), t = state.tournament;
  if (!t) { container.append(noTournamentState()); return; }
  if (!t.matches.length) { container.append(emptyState({ icon: 'chart', title: 'Sin clasificación todavía', text: 'Aparecerá cuando se sortee el calendario.', actions: [btn('Ir a Sorteos', { href: 'sorteos', icon: 'dice' })] })); return; }
  const share = btn('Compartir resumen', { variant: 'ghost', icon: 'share', onClick: () => copySummary(t, state) });
  if (t.format === FORMATS.KNOCKOUT) { container.append(h('div', { class: 'actions' }, share), h('section', { class: 'card' }, h('h2', {}, 'Progreso en el cuadro'), progressTable(t, state))); return; }
  const order = Object.values(TIEBREAK_PRESETS).find(p => p.order.join() === t.rules.tiebreakers.join())?.label ?? t.rules.tiebreakers.join(' › ');
  const q = t.format === FORMATS.GROUPS ? t.rules.qualifiersPerGroup : 0;
  container.append(h('div', { class: 'actions between' },
    h('details', {}, h('summary', {}, 'Reglas de puntos y desempate'), h('p', { class: 'note' }, `Victoria ${t.rules.win}, empate ${t.rules.draw}, derrota ${t.rules.loss}. ${order}. Solo cuentan partidos finalizados.`)), share),
    ...t.groups.map(g => h('section', { class: 'card' }, h('h2', {}, g.name), table(t, state, g, q))));
  if (q) container.append(h('p', { class: 'note' }, `Las filas resaltadas clasifican (${q} por grupo).`));
  if (t.matches.some(m => m.stage === 'knockout')) container.append(h('section', { class: 'card' }, h('h2', {}, 'Eliminatorias'), progressTable(t, state)));
}
