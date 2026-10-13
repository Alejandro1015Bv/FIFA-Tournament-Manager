// Sorteos: equipos (individual / simultáneo / bloqueo) y enfrentamientos (vista previa → confirmar).
import { h, emptyCard, linkBtn, confirmDialog, goto, toast } from '../ui.js';
import { getState, FORMATS, FORMAT_LABELS } from '../state.js';
import * as E from '../tournament-engine.js';
import { getCompetition, getTeam, getTeamsByCompetition, teamBadge } from '../teams.js';
import { commitTournament, mutateTournament } from '../actions.js';
import { renderBracket } from '../bracket.js';
import { renderCalendar } from '../calendar.js';
import { playerName } from './shared.js';

const fresh = new Set();     // equipos recién sorteados (animación de revelado)
const DIFF = {
  [FORMATS.KNOCKOUT]: 'Eliminación directa: quien pierde queda fuera, así que los jugadores eliminados en rondas distintas no juegan la misma cantidad de partidos. Si queréis que todos jueguen varios, usad grupos + eliminatorias o liguilla.',
  [FORMATS.ROUND_ROBIN]: 'Todos contra todos: cada jugador disputa exactamente los mismos partidos (N-1).',
  [FORMATS.GROUPS]: 'Grupos + eliminatorias: todos juegan la liguilla de su grupo y los mejores pasan al cuadro final.'
};

export function render(container) {
  const state = getState(), t = state.tournament;
  if (!t) { container.append(emptyCard('No hay ningún torneo. Crea uno primero.', linkBtn('Configurar torneo', 'configuracion'))); return; }
  container.append(teamsPanel(t, state), matchesPanel(t, state));
  fresh.clear();
}

function teamsPanel(t, state) {
  const editable = ['draft', 'drawn'].includes(t.status);
  const pool = getTeamsByCompetition(t.competitionId).map(x => x.id);
  const lockedTeams = new Set(t.playerIds.filter(p => t.assignments[p]?.locked).map(p => t.assignments[p].teamId));
  const need = t.playerIds.filter(p => !t.assignments[p]?.locked).length;
  const available = pool.filter(id => !lockedTeams.has(id)).length;
  const missing = Math.max(0, need - available);
  const comp = getCompetition(t.competitionId);
  const assigned = t.playerIds.filter(p => t.assignments[p]?.teamId).length;

  const run = (opts, okMsg) => {
    let next; try { next = E.assignTeams(t, pool, opts); } catch (e) { return toast(e.message, 'error'); }
    for (const p of t.playerIds) if (next.assignments[p]?.teamId !== t.assignments[p]?.teamId) fresh.add(p);
    commitTournament(next, okMsg);
  };
  const simultaneous = async () => {
    const replacing = t.playerIds.filter(p => t.assignments[p] && !t.assignments[p].locked).length;
    if (replacing && !await confirmDialog({ title: 'Volver a sortear equipos', confirmText: 'Sortear',
      message: `Se sustituirán ${replacing} asignación(es) no bloqueadas. Las bloqueadas (🔒) se conservan.` })) return;
    run({ mode: 'all' }, 'Equipos sorteados');
  };
  const clearUnlocked = async () => {
    if (await confirmDialog({ title: 'Quitar equipos', confirmText: 'Quitar', danger: true, message: 'Se quitarán los equipos no bloqueados.' }))
      mutateTournament(E.clearAssignments, 'Asignaciones eliminadas');
  };

  const cards = t.playerIds.map(pid => {
    const a = t.assignments[pid], team = a ? getTeam(a.teamId) : null;
    return h('article', { class: 'draw-card' + (a?.locked ? ' locked' : '') + (fresh.has(pid) ? ' reveal' : '') },
      h('div', { class: 'draw-badge' }, teamBadge(team, { size: 64 })),
      h('strong', {}, playerName(state, pid)),
      h('span', { class: 'team-name' }, team ? team.name : 'Sin equipo'),
      editable ? h('div', { class: 'actions center' },
        !a ? h('button', { class: 'btn small', type: 'button', onClick: () => run({ mode: 'single', playerId: pid }, 'Equipo asignado') }, 'Sortear')
          : h('button', { class: 'btn small secondary', type: 'button', 'aria-pressed': !!a.locked, title: a.locked ? 'Desbloquear' : 'Bloquear',
            onClick: () => mutateTournament(tt => E.toggleLock(tt, pid)) }, a.locked ? '🔒 Bloqueado' : '🔓 Bloquear')) : null);
  });

  return h('section', { class: 'card gaming' },
    h('h2', {}, '1 · Sorteo de equipos'),
    h('p', { class: 'muted' }, `${comp?.name ?? t.competitionId} · ${pool.length} equipos · ${t.playerIds.length} jugadores · ${assigned} con equipo`),
    missing ? h('p', { class: 'form-error' }, `Faltan ${missing} equipo(s) en esta competición para sortear a todos. Elige otra competición o reduce los participantes.`) : null,
    editable ? h('div', { class: 'actions' },
      h('button', { class: 'btn', type: 'button', disabled: missing > 0, onClick: simultaneous }, '🎲 Sorteo simultáneo'),
      h('button', { class: 'btn secondary', type: 'button', onClick: clearUnlocked }, 'Quitar no bloqueados')) : h('p', { class: 'muted' }, 'Los equipos están fijados porque el torneo ya comenzó.'),
    h('div', { class: 'draw-grid' }, cards));
}

function matchesPanel(t, state) {
  const allAssigned = t.playerIds.length > 0 && t.playerIds.every(p => t.assignments[p]?.teamId);
  const warn = t.groups.length > 1 ? E.groupSizeWarning(t) : null;
  const head = [h('h2', {}, '2 · Sorteo de enfrentamientos'), h('p', { class: 'muted' }, DIFF[t.format])];
  if (t.status === 'draft') {
    return h('section', { class: 'card gaming' }, ...head,
      !allAssigned ? h('p', { class: 'form-error' }, 'Asigna equipos a todos los jugadores antes de sortear los enfrentamientos.') : null,
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', disabled: !allAssigned, onClick: () => mutateTournament(E.generateDraw, 'Enfrentamientos sorteados') }, '🎲 Sortear enfrentamientos')));
  }
  const preview = t.format === FORMATS.KNOCKOUT ? renderBracket(t, state, { readOnly: true }) : renderCalendar(t, state, { readOnly: true });
  if (t.status === 'drawn') {
    return h('section', { class: 'card gaming' }, ...head, h('p', {}, 'Vista previa del sorteo. Puedes repetirlo o descartarlo hasta que lo confirmes.'), warn ? h('p', { class: 'warn' }, warn) : null,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onClick: async () => { if (await confirmDialog({ title: 'Confirmar sorteo', message: 'Una vez confirmado no se podrán cambiar equipos ni enfrentamientos. ¿Comenzar el torneo?', confirmText: 'Comenzar' })) { if (mutateTournament(E.confirmDraw, '¡Torneo en marcha!')) goto('eliminatorias'); } } }, '✅ Confirmar y comenzar'),
        h('button', { class: 'btn secondary', type: 'button', onClick: () => mutateTournament(E.generateDraw, 'Sorteo repetido') }, 'Repetir sorteo'),
        h('button', { class: 'btn secondary', type: 'button', onClick: () => mutateTournament(E.discardDraw, 'Sorteo descartado') }, 'Descartar sorteo')),
      preview);
  }
  return h('section', { class: 'card' }, ...head, h('p', {}, 'El sorteo está confirmado.'), linkBtn('Ver cuadro / calendario', 'eliminatorias'));
}
