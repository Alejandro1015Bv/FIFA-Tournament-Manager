import { h, emptyCard } from '../ui.js';
import { getState } from '../state.js';
import { getCompetitions, getCompetition, getTeamsByCompetition, teamBadge } from '../teams.js';
import { playerName } from './shared.js';

let compId = null, query = '';
const KIND = { 'national-team': 'Selección', club: 'Club' };

export function render(container) {
  const state = getState(), t = state.tournament;
  const comps = getCompetitions();
  if (!comps.length) { container.append(emptyCard('El catálogo no está disponible.')); return; }
  compId = comps.some(c => c.id === compId) ? compId : (t?.competitionId && getCompetition(t.competitionId) ? t.competitionId : comps[0].id);
  const comp = getCompetition(compId);
  const owner = new Map(t ? Object.entries(t.assignments).map(([pid, a]) => [a.teamId, pid]) : []);
  const teams = getTeamsByCompetition(compId).filter(x => x.name.toLowerCase().includes(query.toLowerCase()));

  const select = h('select', { 'aria-label': 'Competición', onChange: e => { compId = e.target.value; query = ''; render2(); } },
    comps.map(c => h('option', { value: c.id, selected: c.id === compId }, `${c.icon ?? ''} ${c.name} (${c.teamIds.length})`)));
  const search = h('input', { type: 'search', placeholder: 'Buscar equipo…', value: query, 'aria-label': 'Buscar equipo',
    onInput: e => { query = e.target.value; render2(true); } });
  const body = h('div', { class: 'grid teams' });
  const render2 = keepFocus => { container.replaceChildren(); render(container); if (keepFocus) container.querySelector('input[type=search]')?.focus(); };

  const logo = comp.logoUrl ? h('img', { class: 'comp-logo', src: comp.logoUrl, alt: `Logo de ${comp.name}`, width: 48, height: 48, loading: 'lazy',
    onError: e => e.target.remove() }) : null;
  container.append(h('div', { class: 'card toolbar' }, logo, select, search,
    h('span', { class: 'muted' }, `${teams.length} de ${comp.teamIds.length} equipos${comp.season ? ` · temporada ${comp.season}` : ''}`)),
    t?.competitionId === compId ? h('p', { class: 'muted note' }, 'Esta es la competición del torneo actual; los equipos asignados muestran a su jugador.') : null,
    body);
  container.append(h('p', { class: 'muted credit' }, 'Logos: ', h('a', { href: comp.sourceUrl ?? 'https://www.footylogos.com/es', target: '_blank', rel: 'noopener noreferrer' }, 'FootyLogos'),
    '. Las marcas pertenecen a sus titulares.'));
  if (!teams.length) body.append(emptyCard('Ningún equipo coincide con la búsqueda.'));
  teams.forEach(team => body.append(h('article', { class: 'card team-card' },
    teamBadge(team, { size: 48 }),
    h('div', {}, h('strong', {}, team.name), h('small', { class: 'muted' }, ` ${KIND[team.kind] ?? ''}`),
      owner.has(team.id) ? h('div', { class: 'status live' }, `Asignado a ${playerName(state, owner.get(team.id))}`) : null))));
}
