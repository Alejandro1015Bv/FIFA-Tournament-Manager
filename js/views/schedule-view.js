import { h, btn, emptyState, banner, confirmDialog } from '../ui.js';
import { getState, FORMATS } from '../state.js';
import * as E from '../tournament-engine.js';
import { mutateTournament } from '../actions.js';
import { renderBracket } from '../bracket.js';
import { renderCalendar } from '../calendar.js';
import { playerName, noTournamentState } from './shared.js';

export function render(container) {
  const state = getState(), t = state.tournament;
  if (!t) { container.append(noTournamentState()); return; }
  if (!t.matches.length) { container.append(emptyState({ icon: 'dice', title: 'Aún no hay enfrentamientos', text: 'Sortéalos para ver el cuadro o el calendario.', actions: [btn('Ir a Sorteos', { href: 'sorteos', icon: 'dice' })] })); return; }
  if (t.status === 'drawn') container.append(banner('warn', 'El sorteo aún no está confirmado.', btn('Confirmar', { href: 'sorteos', size: 'small', variant: 'secondary' })));
  if (t.championId) container.append(h('section', { class: 'card champion', 'aria-label': 'Campeón' }, h('span', { class: 'trophy', 'aria-hidden': 'true' }, '🏆'), h('div', {}, h('small', { class: 'muted' }, 'Campeón'), h('h2', {}, playerName(state, t.championId)))));

  if (t.format === FORMATS.KNOCKOUT) { container.append(h('section', { class: 'card' }, h('h2', {}, 'Cuadro'), renderBracket(t, state))); return; }
  container.append(h('section', { class: 'card' }, h('h2', {}, t.format === FORMATS.ROUND_ROBIN ? 'Calendario' : 'Fase de grupos'),
    t.groups.length > 1 && E.groupSizeWarning(t) ? h('p', { class: 'warn note' }, E.groupSizeWarning(t)) : null, renderCalendar(t, state)));
  if (t.format === FORMATS.GROUPS) container.append(koSection(t, state));
}

function koSection(t, state) {
  const hasKo = t.matches.some(m => m.stage === 'knockout');
  const complete = E.groupsComplete(t);
  const box = h('section', { class: 'card' }, h('h2', {}, 'Fase eliminatoria'));
  if (t.status === 'drawn') { box.append(h('p', { class: 'note' }, 'Se genera al terminar los grupos.')); return box; }
  if (!hasKo) {
    box.append(h('p', { class: 'note' }, complete ? 'Los grupos han terminado.' : 'Se genera sola al registrar el último resultado de grupos.'),
      h('div', { class: 'actions' },
        btn('Generar fase eliminatoria', { disabled: !complete, onClick: () => mutateTournament(tt => E.generateKnockoutStage(tt), 'Fase eliminatoria generada') }),
        !complete ? btn('Cuadro provisional', { variant: 'secondary', onClick: async () => {
          if (await confirmDialog({ title: 'Cuadro provisional', confirmText: 'Crear', message: 'Se calcula con la clasificación actual, no admite resultados y debes regenerarlo al terminar los grupos.' }))
            mutateTournament(tt => E.generateKnockoutStage(tt, { provisional: true }), 'Cuadro provisional creado');
        } }) : null));
    return box;
  }
  if (t.knockoutProvisional) {
    box.append(banner('warn', `Cuadro provisional${E.knockoutIsStale(t) ? ': la clasificación cambió' : ''}. No admite resultados hasta terminar los grupos.`,
      btn('Regenerar', { size: 'small', variant: 'secondary', icon: 'refresh', onClick: () => mutateTournament(tt => E.generateKnockoutStage(tt, { provisional: true }), 'Cuadro regenerado') })));
  }
  box.append(renderBracket(t, state));
  return box;
}
