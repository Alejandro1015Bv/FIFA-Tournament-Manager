import { h, emptyCard, linkBtn } from '../ui.js';
import { getState, FORMATS, TIEBREAK_PRESETS } from '../state.js';
import { computeStandings, knockoutProgress } from '../standings.js';
import { playerCell } from './shared.js';

function table(t, state, groupId, qualifiers = 0) {
  const rows = computeStandings(t, groupId);
  const head = ['#', 'Jugador', 'PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG', 'Pts'];
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, head.map((c, i) => h('th', { scope: 'col', class: i > 1 ? 'num' : '' }, c)))),
    h('tbody', {}, rows.map(r => h('tr', { class: r.position <= qualifiers ? 'qualified' : '' },
      h('td', {}, String(r.position)), h('td', {}, playerCell(t, state, r.playerId, { size: 24 }), r.byLot ? h('small', { class: 'muted', title: 'Empate total: decidido por sorteo' }, ' 🎲') : null),
      ...[r.played, r.won, r.drawn, r.lost, r.gf, r.ga, r.gd > 0 ? `+${r.gd}` : r.gd, r.pts].map((v, i) => h('td', { class: 'num' + (i === 7 ? ' pts' : '') }, String(v))))))));
}

function progressTable(t, state) {
  const rows = knockoutProgress(t);
  const LABEL = { champion: '🏆 Campeón', active: 'En competición', eliminated: 'Eliminado' };
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, ['Jugador', 'Estado', 'Ronda', 'PJ', 'G', 'P', 'GF', 'GC'].map((c, i) => h('th', { scope: 'col', class: i > 2 ? 'num' : '' }, c)))),
    h('tbody', {}, rows.map(r => h('tr', { class: r.stage }, h('td', {}, playerCell(t, state, r.playerId, { size: 24 })), h('td', {}, LABEL[r.stage]),
      h('td', {}, r.stage === 'eliminated' ? r.eliminatedIn : r.roundName),
      ...[r.stats.played, r.stats.won, r.stats.lost, r.stats.gf, r.stats.ga].map(v => h('td', { class: 'num' }, String(v))))))));
}

export function render(container) {
  const state = getState(), t = state.tournament;
  if (!t) { container.append(emptyCard('No hay ningún torneo activo.', linkBtn('Configurar torneo', 'configuracion'))); return; }
  if (!t.matches.length) { container.append(emptyCard('La clasificación aparecerá cuando se sortee el calendario.', linkBtn('Ir a Sorteos', 'sorteos'))); return; }
  const order = TIEBREAK_PRESETS && Object.values(TIEBREAK_PRESETS).find(p => p.order.join() === t.rules.tiebreakers.join())?.label;
  const rulesNote = h('p', { class: 'muted' }, `Puntos: victoria ${t.rules.win}, empate ${t.rules.draw}, derrota ${t.rules.loss}. Desempate: ${order ?? t.rules.tiebreakers.join(' › ')}. Solo cuentan los partidos finalizados.`);
  if (t.format === FORMATS.KNOCKOUT) { container.append(h('div', { class: 'card' }, h('h2', {}, 'Progreso en el cuadro'), progressTable(t, state))); return; }
  const q = t.format === FORMATS.GROUPS ? t.rules.qualifiersPerGroup : 0;
  container.append(rulesNote, ...t.groups.map(g => h('div', { class: 'card' }, h('h2', {}, g.name), table(t, state, g.id, q))));
  if (q) container.append(h('p', { class: 'muted' }, `Las filas resaltadas clasifican a la fase eliminatoria (${q} por grupo).`));
  if (t.matches.some(m => m.stage === 'knockout')) container.append(h('div', { class: 'card' }, h('h2', {}, 'Progreso en eliminatorias'), progressTable(t, state)));
}
