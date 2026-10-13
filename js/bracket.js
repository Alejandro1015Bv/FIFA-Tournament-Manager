// Cuadro visual de eliminatorias (izquierda → derecha, con conectores y scroll horizontal en móvil).
import { h } from './ui.js';
import { matchCard } from './views/shared.js';

export function renderBracket(t, state, opts = {}) {
  const ko = t.matches.filter(m => m.stage === 'knockout');
  const rounds = [...new Set(ko.map(m => m.round))].sort((a, b) => a - b);
  const cols = rounds.map(r => {
    const ms = ko.filter(m => m.round === r).sort((a, b) => a.index - b.index);
    return h('section', { class: 'round' },
      h('h3', {}, ms[0].roundName),
      h('div', { class: 'ties' }, ms.map(m => h('div', { class: 'tie' }, matchCard(t, state, m, { ...opts, compact: true })))));
  });
  return h('div', { class: 'bracket-scroll', tabindex: 0, 'aria-label': 'Cuadro de eliminatorias' }, h('div', { class: 'bracket' }, cols));
}
