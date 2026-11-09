// Calendario de liguilla por jornadas (con descansos en cantidades impares).
import { h, rerender } from './ui.js';
import { matchCard, playerCell, playerName } from './views/shared.js';

const active = {};   // pestaña de grupo seleccionada por torneo

export function renderCalendar(t, state, opts = {}) {
  const groups = t.groups;
  if (!groups.length) return h('p', { class: 'muted' }, 'Todavía no hay calendario.');
  const cur = groups.find(g => g.id === active[t.id]) ?? groups[0];
  const tabs = groups.length > 1 ? h('div', { class: 'tabs', role: 'tablist' }, groups.map(g =>
    h('button', { class: 'tab' + (g.id === cur.id ? ' on' : ''), role: 'tab', 'aria-selected': String(g.id === cur.id), type: 'button',
      onClick: () => { active[t.id] = g.id; rerender(); } }, g.name))) : null;
  const byId = new Map(t.matches.map(m => [m.id, m]));
  return h('div', { class: 'calendar' }, tabs,
    h('div', { class: 'members' }, cur.playerIds.map(id => h('span', { class: 'chip' }, playerCell(t, state, id, { size: 22 })))),
    cur.rounds.map((r, i) => h('section', { class: 'matchday' },
      h('h3', {}, `Jornada ${i + 1}`, r.restId ? h('small', { class: 'muted rest' }, ` · Descansa: ${playerName(state, r.restId)}`) : null),
      h('div', { class: 'match-grid' }, r.matchIds.map(id => matchCard(t, state, byId.get(id), opts))))));
}
