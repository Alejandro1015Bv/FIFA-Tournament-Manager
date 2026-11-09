// Sorteos: equipos (individual / simultáneo / bloqueo) y enfrentamientos (vista previa → confirmar).
import { h, btn, icon, emptyState, confirmDialog, goto, toast } from '../ui.js';
import { getState, FORMATS } from '../state.js';
import * as E from '../tournament-engine.js';
import { getCompetition, getTeam, getTeamsByCompetition, teamBadge, gameStatus, GAME_LABEL } from '../teams.js';
import { commitTournament, mutateTournament } from '../actions.js';
import { renderBracket } from '../bracket.js';
import { renderCalendar } from '../calendar.js';
import { playerName, noTournamentState } from './shared.js';

const fresh = new Set();     // equipos recién sorteados (animación de revelado)
const HOW = {
  [FORMATS.KNOCKOUT]: 'Quien pierde queda fuera: los eliminados pronto jugarán menos partidos que el resto.',
  [FORMATS.ROUND_ROBIN]: 'Cada jugador disputa exactamente los mismos partidos.',
  [FORMATS.GROUPS]: 'Todos juegan la liguilla de su grupo y los mejores pasan al cuadro final.'
};

export function render(container) {
  const state = getState(), t = state.tournament;
  if (!t) { container.append(noTournamentState()); return; }
  container.append(teamsPanel(t, state), matchesPanel(t, state));
  fresh.clear();
}

function teamsPanel(t, state) {
  const editable = ['draft', 'drawn'].includes(t.status);
  const pool = getTeamsByCompetition(t.competitionId, { onlyInGame: t.onlyInGame === true }).map(x => x.id);
  const lockedTeams = new Set(t.playerIds.filter(p => t.assignments[p]?.locked).map(p => t.assignments[p].teamId));
  const need = t.playerIds.filter(p => !t.assignments[p]?.locked).length;
  const missing = Math.max(0, need - pool.filter(id => !lockedTeams.has(id)).length);
  const comp = getCompetition(t.competitionId);
  const assigned = t.playerIds.filter(p => t.assignments[p]?.teamId).length;

  const run = (opts, okMsg) => {
    let next; try { next = E.assignTeams(t, pool, opts); } catch (e) { return toast(e.message, 'error'); }
    for (const p of t.playerIds) if (next.assignments[p]?.teamId !== t.assignments[p]?.teamId) fresh.add(p);
    commitTournament(next, okMsg);
  };
  const simultaneous = async () => {
    const replacing = t.playerIds.filter(p => t.assignments[p] && !t.assignments[p].locked).length;
    if (replacing && !await confirmDialog({ title: 'Volver a sortear', confirmText: 'Sortear', message: `Se sustituirán ${replacing} equipo(s) sin bloquear.` })) return;
    run({ mode: 'all' }, 'Equipos sorteados');
  };
  const clearUnlocked = async () => {
    if (await confirmDialog({ title: 'Quitar equipos', confirmText: 'Quitar', danger: true, message: 'Se quitarán los equipos sin bloquear.' })) mutateTournament(E.clearAssignments, 'Equipos quitados');
  };

  const cards = t.playerIds.map(pid => {
    const a = t.assignments[pid], team = a ? getTeam(a.teamId) : null, name = playerName(state, pid);
    return h('article', { class: 'draw-card' + (a?.locked ? ' locked' : '') + (fresh.has(pid) ? ' reveal' : ''), 'aria-label': `${name}: ${team ? team.name : 'sin equipo'}` },
      teamBadge(team, { size: 64 }), h('strong', {}, name), h('span', { class: 'team-name' }, team ? team.name : 'Sin equipo'),
      team && gameStatus(team) === 'generic' ? h('small', { class: 'warn' }, team.inGameName ? `En el juego: «${team.inGameName}»` : 'Escudo genérico en el juego') : null,
      team && gameStatus(team) === 'no' ? h('small', { class: 'warn' }, `No está en ${GAME_LABEL}`) : null,
      editable ? h('div', { class: 'actions center' },
        !a ? btn('Sortear', { size: 'small', icon: 'dice', ariaLabel: `Sortear equipo para ${name}`, onClick: () => run({ mode: 'single', playerId: pid }, 'Equipo asignado') })
          : h('button', { class: 'btn small secondary', type: 'button', 'aria-pressed': String(!!a.locked), 'aria-label': `${a.locked ? 'Desbloquear' : 'Bloquear'} el equipo de ${name}`,
            onClick: () => mutateTournament(tt => E.toggleLock(tt, pid)) }, icon(a.locked ? 'lock' : 'unlock'), h('span', {}, a.locked ? 'Bloqueado' : 'Bloquear'))) : null);
  });

  return h('section', { class: 'card', 'aria-labelledby': 'h-equipos' },
    h('h2', { id: 'h-equipos' }, 'Equipos'),
    h('p', { class: 'note' }, `${comp?.name ?? t.competitionId} · ${pool.length} equipos${t.onlyInGame === true ? ` en ${GAME_LABEL}` : ''} · ${assigned} de ${t.playerIds.length} asignados`),
    missing ? h('p', { class: 'form-error', role: 'alert' }, `Faltan ${missing} equipo(s) en esta competición. Elige otra o reduce jugadores.`) : null,
    editable ? h('div', { class: 'actions' }, btn('Sortear equipos', { icon: 'dice', disabled: missing > 0, onClick: simultaneous }),
      assigned ? btn('Quitar sin bloquear', { variant: 'ghost', onClick: clearUnlocked }) : null) : h('p', { class: 'note' }, 'Equipos fijados: el torneo ya comenzó.'),
    h('div', { class: 'draw-grid' }, cards));
}

function matchesPanel(t, state) {
  const allAssigned = t.playerIds.length > 0 && t.playerIds.every(p => t.assignments[p]?.teamId);
  const warn = t.groups.length > 1 ? E.groupSizeWarning(t) : null;
  const head = [h('h2', { id: 'h-enf' }, 'Enfrentamientos'), h('p', { class: 'note' }, HOW[t.format])];
  const wrap = (...kids) => h('section', { class: 'card', 'aria-labelledby': 'h-enf' }, ...head, ...kids);
  if (t.status === 'draft') {
    return wrap(!allAssigned ? h('p', { class: 'note' }, 'Asigna un equipo a cada jugador para poder sortear.') : null,
      h('div', { class: 'actions' }, btn('Sortear enfrentamientos', { icon: 'dice', disabled: !allAssigned, onClick: () => mutateTournament(E.generateDraw, 'Enfrentamientos sorteados') })));
  }
  const preview = t.format === FORMATS.KNOCKOUT ? renderBracket(t, state, { readOnly: true }) : renderCalendar(t, state, { readOnly: true });
  if (t.status === 'drawn') {
    return wrap(h('p', {}, 'Revisa el sorteo. Puedes repetirlo o descartarlo hasta confirmarlo.'), warn ? h('p', { class: 'warn note' }, warn) : null,
      h('div', { class: 'actions' },
        btn('Confirmar y comenzar', { icon: 'check', onClick: async () => { if (await confirmDialog({ title: 'Confirmar sorteo', message: 'Después no se podrán cambiar equipos ni enfrentamientos.', confirmText: 'Comenzar' })) { if (mutateTournament(E.confirmDraw, '¡Torneo en marcha!')) goto('eliminatorias'); } } }),
        btn('Repetir', { variant: 'secondary', icon: 'refresh', onClick: () => mutateTournament(E.generateDraw, 'Sorteo repetido') }),
        btn('Descartar', { variant: 'ghost', onClick: () => mutateTournament(E.discardDraw, 'Sorteo descartado') })),
      preview);
  }
  return wrap(h('p', {}, 'Sorteo confirmado.'), btn('Ver cuadro y calendario', { href: 'eliminatorias', icon: 'trophy', variant: 'secondary' }));
}
