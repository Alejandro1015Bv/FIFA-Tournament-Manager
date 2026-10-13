import { h, emptyCard, linkBtn, confirmDialog } from '../ui.js';
import { getState, FORMATS } from '../state.js';
import * as E from '../tournament-engine.js';
import { mutateTournament } from '../actions.js';
import { renderBracket } from '../bracket.js';
import { renderCalendar } from '../calendar.js';
import { playerName } from './shared.js';

export function render(container) {
  const state = getState(), t = state.tournament;
  if (!t) { container.append(emptyCard('No hay ningún torneo activo.', linkBtn('Configurar torneo', 'configuracion'))); return; }
  if (!t.matches.length) { container.append(emptyCard('Aún no hay enfrentamientos sorteados.', linkBtn('Ir a Sorteos', 'sorteos'))); return; }
  if (t.status === 'drawn') container.append(h('div', { class: 'banner warn' }, 'El sorteo todavía no está confirmado. ', linkBtn('Confirmar en Sorteos', 'sorteos', 'linklike')));
  if (t.championId) container.append(h('div', { class: 'card champion' }, h('span', { class: 'trophy' }, '🏆'), h('div', {}, h('small', { class: 'muted' }, 'Campeón'), h('h2', {}, playerName(state, t.championId)))));

  if (t.format === FORMATS.KNOCKOUT) { container.append(h('div', { class: 'card' }, h('h2', {}, 'Cuadro de eliminatorias'), renderBracket(t, state))); return; }
  container.append(h('div', { class: 'card' }, h('h2', {}, t.format === FORMATS.ROUND_ROBIN ? 'Calendario de la liguilla' : 'Fase de grupos'), t.groups.length > 1 && E.groupSizeWarning(t) ? h('p', { class: 'warn' }, E.groupSizeWarning(t)) : null, renderCalendar(t, state)));
  if (t.format === FORMATS.GROUPS) container.append(koSection(t, state));
}

function koSection(t, state) {
  const hasKo = t.matches.some(m => m.stage === 'knockout');
  const complete = E.groupsComplete(t);
  const box = h('div', { class: 'card' }, h('h2', {}, 'Fase eliminatoria'));
  if (t.status === 'drawn') { box.append(h('p', { class: 'muted' }, 'Se generará cuando el torneo comience y terminen los grupos.')); return box; }
  if (!hasKo) {
    box.append(h('p', { class: 'muted' }, complete ? 'Los grupos han terminado.' : 'Se genera automáticamente al registrar el último resultado de grupos.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', disabled: !complete, onClick: () => mutateTournament(tt => E.generateKnockoutStage(tt), 'Fase eliminatoria generada') }, 'Generar fase eliminatoria'),
        !complete ? h('button', { class: 'btn secondary', type: 'button', onClick: async () => {
          if (await confirmDialog({ title: 'Cuadro provisional', confirmText: 'Crear provisional', message: 'Todavía hay partidos de grupos pendientes. El cuadro será provisional: se calculará con la clasificación actual, no admitirá resultados y deberás regenerarlo al terminar los grupos.' }))
            mutateTournament(tt => E.generateKnockoutStage(tt, { provisional: true }), 'Cuadro provisional creado');
        } }, 'Crear cuadro provisional') : null));
    return box;
  }
  if (t.knockoutProvisional) {
    box.append(h('div', { class: 'banner warn' }, `Cuadro PROVISIONAL${E.knockoutIsStale(t) ? ': la clasificación ha cambiado desde que se creó' : ''}. No se pueden registrar resultados hasta que terminen los grupos.`),
      h('div', { class: 'actions' }, h('button', { class: 'btn secondary', type: 'button', onClick: () => mutateTournament(tt => E.generateKnockoutStage(tt, { provisional: true }), 'Cuadro regenerado') }, 'Regenerar con la clasificación actual')));
  }
  box.append(renderBracket(t, state));
  return box;
}
