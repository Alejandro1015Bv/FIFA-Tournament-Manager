import { h, linkBtn, toast, confirmDialog, fmtDate } from '../ui.js';
import { getState, setState, FORMAT_LABELS, STATUS_LABELS } from '../state.js';
import { getCompetition, getTeam } from '../teams.js';
import { exportJSON, importJSON } from '../storage.js';
import { minPlayers } from '../tournament-engine.js';
import { archiveCurrent, deleteTournament } from '../actions.js';
import { matchCard, playerName } from './shared.js';

const STEPS = [
  ['Crear torneo', 'configuracion'], ['Elegir competición', 'configuracion'], ['Seleccionar participantes', 'configuracion'],
  ['Asignar equipos', 'sorteos'], ['Seleccionar formato', 'configuracion'], ['Configurar reglas', 'configuracion'],
  ['Sortear enfrentamientos', 'sorteos'], ['Revisar y confirmar', 'sorteos'], ['Registrar resultados', 'resultados']
];
function stepDone(t) {
  if (!t) return STEPS.map(() => false);
  const n = t.playerIds.length;
  return [true, !!t.competitionId, n >= minPlayers(t.format, t.rules), n > 0 && t.playerIds.every(p => t.assignments[p]?.teamId),
    !!t.format, true, t.matches.length > 0, ['in-progress', 'finished'].includes(t.status), t.matches.some(m => !m.bye && m.status === 'done')];
}

export function stepper(t) {
  const done = stepDone(t), cur = done.indexOf(false);
  return h('ol', { class: 'stepper' }, STEPS.map(([label, hash], i) =>
    h('li', { class: done[i] ? 'done' : i === cur ? 'current' : '' }, h('a', { href: `#${hash}` }, h('span', { class: 'n' }, done[i] ? '✓' : i + 1), label))));
}

export function render(container) {
  const state = getState(), t = state.tournament;
  if (!t) {
    container.append(h('div', { class: 'card hero' },
      h('h2', {}, '¡Organiza tu torneo de EA SPORTS FC!'),
      h('p', { class: 'muted' }, 'Registra a tus amigos, elige una competición, sortea equipos y enfrentamientos, y lleva el cuadro y la clasificación.'),
      h('div', { class: 'actions' }, linkBtn('Crear torneo', 'configuracion'), linkBtn(`Jugadores (${state.players.length})`, 'jugadores', 'btn secondary'))),
      h('div', { class: 'card' }, h('h3', {}, 'Cómo funciona'), stepper(null)));
  } else {
    const comp = getCompetition(t.competitionId);
    const info = (k, v) => h('div', { class: 'card stat' }, h('small', { class: 'muted' }, k), h('strong', {}, v));
    const upcoming = t.matches.filter(m => !m.bye && m.status !== 'done' && m.homeId && m.awayId).slice(0, 4);
    const last = t.matches.filter(m => m.status === 'done' && !m.bye).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 4);
    const champ = t.championId && state.players.find(p => p.id === t.championId);
    container.append(
      champ ? h('div', { class: 'card champion' }, h('span', { class: 'trophy' }, '🏆'),
        h('div', {}, h('small', { class: 'muted' }, 'Campeón'), h('h2', {}, champ.name), h('p', { class: 'muted' }, getTeam(t.assignments[champ.id]?.teamId)?.name ?? ''))) : null,
      h('div', { class: 'grid stats' },
        info('Torneo', t.name), info('Competición', comp?.name ?? t.competitionId), info('Participantes', String(t.playerIds.length)),
        info('Formato', FORMAT_LABELS[t.format]), info('Estado', STATUS_LABELS[t.status])),
      h('div', { class: 'card' }, h('h3', {}, 'Progreso'), stepper(t)),
      h('div', { class: 'card' }, h('h3', {}, 'Accesos rápidos'), h('div', { class: 'actions' },
        linkBtn('Sorteos', 'sorteos', 'btn secondary'), linkBtn(t.format === 'round-robin' ? 'Calendario' : 'Eliminatorias / calendario', 'eliminatorias', 'btn secondary'),
        linkBtn('Clasificación', 'clasificacion', 'btn secondary'), linkBtn('Resultados', 'resultados', 'btn secondary'))),
      h('div', { class: 'grid two' },
        h('div', { class: 'card' }, h('h3', {}, 'Próximos partidos'),
          upcoming.length ? h('div', { class: 'stack' }, upcoming.map(m => matchCard(t, state, m))) : h('p', { class: 'muted' }, 'No hay partidos pendientes con participantes definidos.')),
        h('div', { class: 'card' }, h('h3', {}, 'Últimos resultados'),
          last.length ? h('div', { class: 'stack' }, last.map(m => matchCard(t, state, m, { readOnly: true }))) : h('p', { class: 'muted' }, 'Todavía no hay resultados.'))));
  }
  container.append(dataCard(state, t));
}

function dataCard(state, t) {
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onChange: async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = await importJSON(f);
      if (await confirmDialog({ title: 'Importar datos', danger: true, confirmText: 'Importar', message: 'Esto reemplazará todos los datos actuales (jugadores, torneo e historial) por los del archivo.' })) {
        setState(data); toast('Datos importados correctamente', 'ok');
      }
    } catch (err) { toast(`No se pudo importar: ${err.message}`, 'error', 7000); }
  } });
  return h('div', { class: 'card' }, h('h3', {}, 'Datos'),
    h('p', { class: 'muted' }, 'Todo se guarda automáticamente en este navegador. Exporta una copia para llevarla a otro dispositivo.'),
    h('div', { class: 'actions' },
      h('button', { class: 'btn secondary', type: 'button', onClick: () => exportJSON(getState()) }, 'Exportar JSON'),
      h('button', { class: 'btn secondary', type: 'button', onClick: () => file.click() }, 'Importar JSON'), file,
      t?.status === 'finished' ? h('button', { class: 'btn', type: 'button', onClick: archiveCurrent }, 'Archivar en historial') : null,
      t ? h('button', { class: 'btn danger', type: 'button', onClick: deleteTournament }, 'Eliminar torneo') : null));
}
