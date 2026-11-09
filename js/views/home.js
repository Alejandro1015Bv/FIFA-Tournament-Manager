import { h, btn, emptyState, toast, confirmDialog } from '../ui.js';
import { getState, setState, FORMAT_LABELS, STATUS_LABELS } from '../state.js';
import { getCompetition, getTeam } from '../teams.js';
import { exportJSON, importJSON } from '../storage.js';
import { minPlayers } from '../tournament-engine.js';
import { archiveCurrent, deleteTournament } from '../actions.js';
import { copySummary } from '../share.js';
import { matchCard } from './shared.js';

const STEPS = [
  ['Crear torneo', 'configuracion'], ['Competición', 'configuracion'], ['Participantes', 'configuracion'], ['Equipos', 'sorteos'],
  ['Formato', 'configuracion'], ['Reglas', 'configuracion'], ['Enfrentamientos', 'sorteos'], ['Confirmar sorteo', 'sorteos'], ['Resultados', 'resultados']
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
    h('li', { class: done[i] ? 'done' : i === cur ? 'current' : '', 'aria-current': i === cur ? 'step' : null },
      h('a', { href: `#${hash}` }, h('span', { class: 'n', 'aria-hidden': 'true' }, done[i] ? '✓' : i + 1), h('span', { class: 'label' }, label), done[i] ? h('span', { class: 'sr-only' }, '(completado)') : null))));
}

// Un único "siguiente paso" destacado según el estado del torneo.
function nextStep(t) {
  const assigned = t.playerIds.length > 0 && t.playerIds.every(p => t.assignments[p]?.teamId);
  if (t.status === 'draft') return assigned
    ? { title: 'Sortea los enfrentamientos', action: btn('Sortear enfrentamientos', { href: 'sorteos', icon: 'dice' }) }
    : { title: 'Sortea los equipos', action: btn('Sortear equipos', { href: 'sorteos', icon: 'dice' }) };
  if (t.status === 'drawn') return { title: 'Confirma el sorteo para empezar', action: btn('Revisar y confirmar', { href: 'sorteos', icon: 'check' }) };
  if (t.status === 'finished') return { title: 'Torneo terminado', action: btn('Archivar en el historial', { icon: 'history', onClick: archiveCurrent }) };
  const pending = t.matches.filter(m => !m.bye && m.status !== 'done' && m.homeId && m.awayId).length;
  return pending
    ? { title: `${pending} partido${pending > 1 ? 's' : ''} por jugar`, action: btn('Registrar resultados', { href: 'resultados', icon: 'clipboard' }) }
    : { title: 'Esperando la siguiente ronda', action: btn('Ver cuadro', { href: 'eliminatorias', icon: 'trophy', variant: 'secondary' }) };
}

export function render(container) {
  const state = getState(), t = state.tournament;
  if (!t) {
    const none = !state.players.length;
    container.append(emptyState({ icon: 'trophy', title: 'Organiza tu primer torneo',
      text: none ? 'Empieza añadiendo a tus amigos.' : `${state.players.length} jugador${state.players.length > 1 ? 'es' : ''} listo${state.players.length > 1 ? 's' : ''}.`,
      actions: none ? [btn('Añadir jugadores', { href: 'jugadores', icon: 'plus' })]
        : [btn('Crear torneo', { href: 'configuracion', icon: 'plus' }), btn('Jugadores', { href: 'jugadores', variant: 'secondary' })] }),
      dataCard(state, t));
    return;
  }
  const comp = getCompetition(t.competitionId), step = nextStep(t);
  const champ = t.championId && state.players.find(p => p.id === t.championId);
  const stat = (k, v) => h('div', { class: 'card stat' }, h('small', {}, k), h('strong', {}, v));
  const upcoming = t.matches.filter(m => !m.bye && m.status !== 'done' && m.homeId && m.awayId).slice(0, 3);
  const last = t.matches.filter(m => m.status === 'done' && !m.bye).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 3);
  container.append(
    champ ? h('section', { class: 'card champion', 'aria-label': 'Campeón' }, h('span', { class: 'trophy', 'aria-hidden': 'true' }, '🏆'),
      h('div', {}, h('small', { class: 'muted' }, 'Campeón'), h('h2', {}, champ.name), h('p', { class: 'muted' }, getTeam(t.assignments[champ.id]?.teamId)?.name ?? ''))) : null,
    h('section', { class: 'card hero', 'aria-label': 'Siguiente paso' }, h('small', { class: 'muted' }, t.name), h('h2', {}, step.title), h('div', { class: 'actions' }, step.action,
      t.matches.length ? btn('Compartir resumen', { variant: 'ghost', icon: 'share', onClick: () => copySummary(t, state) }) : null)),
    h('div', { class: 'grid stats' }, stat('Competición', comp?.name ?? t.competitionId), stat('Formato', FORMAT_LABELS[t.format]), stat('Participantes', String(t.playerIds.length)), stat('Estado', STATUS_LABELS[t.status])),
    h('div', { class: 'grid two' },
      h('section', { class: 'card' }, h('h2', {}, 'Próximos partidos'), upcoming.length ? h('div', { class: 'stack' }, upcoming.map(m => matchCard(t, state, m))) : h('p', { class: 'muted' }, 'Sin partidos pendientes.')),
      h('section', { class: 'card' }, h('h2', {}, 'Últimos resultados'), last.length ? h('div', { class: 'stack' }, last.map(m => matchCard(t, state, m, { readOnly: true }))) : h('p', { class: 'muted' }, 'Aún no hay resultados.'))),
    h('details', { class: 'card' }, h('summary', {}, 'Progreso del torneo'), stepper(t)),
    dataCard(state, t));
}

function dataCard(state, t) {
  const importBtn = btn('Importar', { variant: 'secondary', size: 'small', icon: 'upload', onClick: () => file.click() });
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, 'aria-label': 'Archivo JSON a importar', onChange: async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    importBtn.setAttribute('aria-busy', 'true'); importBtn.disabled = true;
    try {
      const data = await importJSON(f);
      if (await confirmDialog({ title: 'Importar datos', danger: true, confirmText: 'Importar', message: 'Se reemplazarán todos los datos actuales (jugadores, torneo e historial).' })) {
        setState(data); toast('Datos importados', 'ok');
      }
    } catch (err) { toast(`No se pudo importar: ${err.message}`, 'error', 7000); }
    importBtn.removeAttribute('aria-busy'); importBtn.disabled = false;
  } });
  return h('details', { class: 'card' }, h('summary', {}, 'Copia de seguridad y datos'),
    h('p', { class: 'note' }, 'Se guarda todo automáticamente en este dispositivo.'),
    h('div', { class: 'actions' }, btn('Exportar', { variant: 'secondary', size: 'small', icon: 'download', onClick: () => exportJSON(getState()) }), importBtn, file,
      t ? btn('Eliminar torneo', { variant: 'danger-ghost', size: 'small', icon: 'trash', onClick: deleteTournament }) : null));
}
