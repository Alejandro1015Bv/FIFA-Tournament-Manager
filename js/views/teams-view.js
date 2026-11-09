import { h, btn, emptyState, icon, rerender } from '../ui.js';
import { getState } from '../state.js';
import { APP_CONFIG } from '../app-config.js';
import { getCompetitions, getCompetition, getTeamsByCompetition, teamBadge, gameStatus, GAME_LABEL, catalogError } from '../teams.js';
import { playerName } from './shared.js';

let compId = null, query = '', onlyGame = false;
const KIND = { 'national-team': 'Selección', club: 'Club' };

export function render(container) {
  const state = getState(), t = state.tournament;
  const comps = getCompetitions();
  if (!comps.length) {
    container.append(emptyState({ icon: 'alert', variant: 'error', title: 'El catálogo no está disponible', text: catalogError ?? 'No se encontraron competiciones.',
      actions: [btn('Reintentar', { icon: 'refresh', onClick: () => window.dispatchEvent(new CustomEvent('app:retry-catalog')) })] }));
    return;
  }
  compId = comps.some(c => c.id === compId) ? compId : (t?.competitionId && getCompetition(t.competitionId) ? t.competitionId : comps[0].id);
  const comp = getCompetition(compId);
  const owner = new Map(t ? Object.entries(t.assignments).map(([pid, a]) => [a.teamId, pid]) : []);
  const teams = getTeamsByCompetition(compId, { onlyInGame: onlyGame }).filter(x => x.name.toLowerCase().includes(query.toLowerCase()));
  const avail = getTeamsByCompetition(compId, { onlyInGame: true }).length;
  const again = keep => { container.replaceChildren(); render(container); if (keep) container.querySelector('input[type=search]')?.focus(); };

  const logo = comp.logoUrl && APP_CONFIG.officialLogos ? h('img', { class: 'comp-logo is-loading', src: comp.logoUrl, alt: `Logo de ${comp.name}`, width: 48, height: 48, loading: 'lazy',
    onLoad: e => e.target.classList.remove('is-loading'), onError: e => e.target.remove() }) : null;
  container.append(h('div', { class: 'card toolbar' }, logo,
    h('select', { 'aria-label': 'Competición', onChange: e => { compId = e.target.value; query = ''; again(); } },
      comps.map(c => h('option', { value: c.id, selected: c.id === compId }, `${c.name} (${c.teamIds.length})`))),
    h('input', { type: 'search', placeholder: 'Buscar equipo', value: query, 'aria-label': 'Buscar equipo', onInput: e => { query = e.target.value; again(true); } }),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: onlyGame, onChange: e => { onlyGame = e.target.checked; again(); } }), `Solo en ${GAME_LABEL}`)),
    h('p', { class: 'note', 'aria-live': 'polite' }, `${teams.length} equipos mostrados · ${avail} de ${comp.teamIds.length} disponibles en ${GAME_LABEL}`));
  if (!teams.length) {
    container.append(emptyState({ icon: 'search', title: 'Ningún equipo coincide', text: query ? `No hay resultados para «${query}».` : `Esta competición no tiene equipos en ${GAME_LABEL}.`,
      actions: [query ? btn('Limpiar búsqueda', { variant: 'secondary', onClick: () => { query = ''; again(); } }) : btn('Mostrar todos', { variant: 'secondary', onClick: () => { onlyGame = false; again(); } })] }));
  } else {
    container.append(h('div', { class: 'grid teams' }, teams.map(team => h('article', { class: 'card team-card' }, teamBadge(team, { size: 48 }),
      h('div', {}, h('h3', {}, team.name), h('small', { class: 'muted' }, KIND[team.kind] ?? ''),
        gameStatus(team) === 'generic' ? h('div', { class: 'warn small-note' }, team.inGameName ? `En el juego: «${team.inGameName}»` : 'Escudo genérico en el juego') : null,
        gameStatus(team) === 'no' ? h('div', { class: 'warn small-note' }, `No está en ${GAME_LABEL}`) : null,
        owner.has(team.id) ? h('div', { class: 'status live' }, `Asignado a ${playerName(state, owner.get(team.id))}`) : null)))));
  }
  if (APP_CONFIG.officialLogos) container.append(h('p', { class: 'credit' }, 'Logos de ', h('a', { href: comp.sourceUrl ?? 'https://www.footylogos.com/es', target: '_blank', rel: 'noopener noreferrer' }, 'FootyLogos'), '; las marcas pertenecen a sus titulares.'));
}
