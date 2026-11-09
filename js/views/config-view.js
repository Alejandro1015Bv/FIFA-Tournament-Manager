// Asistente de configuración por pasos (no obliga a rellenarlo todo en una pantalla).
import { h, clear, btn, toast, emptyState, goto } from '../ui.js';
import { getState, FORMATS, FORMAT_LABELS, TIEBREAK_PRESETS, KO_TIEBREAK_LABELS, DEFAULT_RULES, STATUS_LABELS } from '../state.js';
import * as E from '../tournament-engine.js';
import { getCompetitions, getCompetition, getTeamsByCompetition, GAME_LABEL } from '../teams.js';
import { commitTournament, deleteTournament } from '../actions.js';

const STEPS = ['Nombre', 'Jugadores', 'Formato', 'Reglas', 'Revisar'];
const FORMAT_INFO = {
  [FORMATS.KNOCKOUT]: 'Quien pierde queda fuera. Sirve con cualquier número de jugadores.',
  [FORMATS.ROUND_ROBIN]: 'Todos juegan contra todos. Gana quien suma más puntos.',
  [FORMATS.GROUPS]: 'Liguillas por grupos; los mejores pasan a eliminatorias.'
};

let wiz = null, step = 0, loadedFor;
const fresh = () => ({ name: '', competitionId: getCompetitions()[0]?.id ?? '', onlyInGame: false, playerIds: [], format: FORMATS.KNOCKOUT, rules: { ...DEFAULT_RULES }, preset: 'standard' });
const fromTournament = t => ({
  name: t.name, competitionId: t.competitionId, onlyInGame: t.onlyInGame === true, playerIds: [...t.playerIds], format: t.format, rules: { ...t.rules },
  preset: Object.entries(TIEBREAK_PRESETS).find(([, p]) => p.order.join() === t.rules.tiebreakers.join())?.[0] ?? 'standard'
});
const cfg = () => ({ ...wiz, rules: { ...wiz.rules, tiebreakers: TIEBREAK_PRESETS[wiz.preset].order } });
const field = (label, control, hint) => h('label', { class: 'field' }, h('span', {}, label), control, hint ? h('small', {}, hint) : null);
const numInput = (key, min = 0) => h('input', { type: 'number', min, step: 1, inputmode: 'numeric', value: wiz.rules[key], onInput: e => { wiz.rules[key] = e.target.value === '' ? NaN : Number(e.target.value); } });

export function render(container) {
  const state = getState(), t = state.tournament;
  if (t && t.status !== 'draft') {
    container.append(h('section', { class: 'card' }, h('h2', {}, t.name),
      h('dl', { class: 'summary' }, h('dt', {}, 'Competición'), h('dd', {}, getCompetition(t.competitionId)?.name ?? t.competitionId), h('dt', {}, 'Formato'), h('dd', {}, FORMAT_LABELS[t.format]),
        h('dt', {}, 'Participantes'), h('dd', {}, String(t.playerIds.length)), h('dt', {}, 'Estado'), h('dd', {}, STATUS_LABELS[t.status])),
      h('p', { class: 'note' }, t.status === 'drawn' ? 'Para cambiar la configuración, descarta el sorteo.' : 'La configuración se bloquea al comenzar el torneo.'),
      h('div', { class: 'actions' }, btn('Ir a Sorteos', { href: 'sorteos', icon: 'dice' }), btn('Eliminar y crear otro', { variant: 'danger-ghost', icon: 'trash', onClick: deleteTournament }))));
    return;
  }
  const key = t ? t.id : 'new';
  if (loadedFor !== key) { wiz = t ? fromTournament(t) : fresh(); step = 0; loadedFor = key; }
  wiz.playerIds = wiz.playerIds.filter(id => state.players.some(p => p.id === id));
  const draw = () => { clear(container); render(container); };

  container.append(h('ol', { class: 'stepper wizard', 'aria-label': 'Pasos de configuración' }, STEPS.map((s, i) =>
    h('li', { class: i < step ? 'done' : i === step ? 'current' : '', 'aria-current': i === step ? 'step' : null },
      h('button', { type: 'button', onClick: () => { step = i; draw(); } }, h('span', { class: 'n', 'aria-hidden': 'true' }, i < step ? '✓' : i + 1), h('span', { class: 'label' }, s))))));
  const panel = h('section', { class: 'card', 'aria-label': STEPS[step] });
  container.append(panel);
  panels[step](panel, state, draw);

  const next = () => {
    if (step === 0 && !wiz.name.trim()) return toast('Escribe un nombre para el torneo.', 'error');
    if (step === 1 && wiz.playerIds.length < 3) return toast('Selecciona al menos 3 jugadores.', 'error');
    step++; draw();
  };
  if (step < STEPS.length - 1) container.append(h('div', { class: 'actions between' },
    btn('Anterior', { variant: 'secondary', disabled: step === 0, onClick: () => { step--; draw(); } }), btn('Siguiente', { onClick: next })));
  else container.append(h('div', { class: 'actions' }, btn('Anterior', { variant: 'secondary', onClick: () => { step--; draw(); } })));
}

const panels = [
  // 0 — nombre y competición
  (p) => {
    const comp = getCompetition(wiz.competitionId);
    const nameInput = h('input', { type: 'text', maxlength: 60, value: wiz.name, placeholder: 'Ej. Copa del viernes', autocomplete: 'off', onInput: e => { wiz.name = e.target.value; } });
    p.append(h('h2', {}, 'Nombre y competición'), field('Nombre del torneo', nameInput),
      field('Competición', h('select', { onChange: e => { wiz.competitionId = e.target.value; clear(p); panels[0](p); } },
        getCompetitions().map(c => h('option', { value: c.id, selected: c.id === wiz.competitionId }, c.name))),
        comp ? `${comp.teamIds.length} equipos · ${getTeamsByCompetition(comp.id, { onlyInGame: true }).length} en ${GAME_LABEL}` : 'Catálogo no cargado'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: wiz.onlyInGame, onChange: e => { wiz.onlyInGame = e.target.checked; } }), `Sortear solo equipos de ${GAME_LABEL}`));
  },
  // 1 — participantes
  (p, state, draw) => {
    p.append(h('h2', {}, 'Jugadores'));
    if (!state.players.length) { p.append(emptyState({ icon: 'users', title: 'Aún no hay jugadores', text: 'Añade al menos 3 para continuar.', actions: [btn('Añadir jugadores', { href: 'jugadores', icon: 'plus' })] })); return; }
    p.append(h('div', { class: 'actions' },
      btn('Todos', { variant: 'secondary', size: 'small', onClick: () => { wiz.playerIds = state.players.map(x => x.id); draw(); } }),
      btn('Ninguno', { variant: 'secondary', size: 'small', onClick: () => { wiz.playerIds = []; draw(); } }),
      h('span', { class: 'count', 'aria-live': 'polite' }, `${wiz.playerIds.length} seleccionados`)),
      h('div', { class: 'checks' }, state.players.map(pl => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: wiz.playerIds.includes(pl.id), onChange: e => { wiz.playerIds = e.target.checked ? [...wiz.playerIds, pl.id] : wiz.playerIds.filter(i => i !== pl.id); draw(); } }), pl.name))));
  },
  // 2 — formato
  (p, state, draw) => {
    p.append(h('h2', {}, 'Formato'), h('div', { class: 'format-cards', role: 'radiogroup', 'aria-label': 'Formato' }, Object.values(FORMATS).map(f =>
      h('label', { class: 'format-card' },
        h('input', { type: 'radio', name: 'format', checked: wiz.format === f, onChange: () => { wiz.format = f; draw(); } }),
        h('strong', {}, FORMAT_LABELS[f]), h('p', {}, FORMAT_INFO[f])))));
    if (wiz.format === FORMATS.GROUPS) {
      const n = wiz.playerIds.length, g = wiz.rules.groupCount;
      const sizes = Number.isInteger(g) && g > 0 ? Array.from({ length: g }, (_, i) => Math.floor(n / g) + (i < n % g ? 1 : 0)) : [];
      p.append(h('div', { class: 'row' }, field('Grupos', numInput('groupCount', 2)), field('Clasifican por grupo', numInput('qualifiersPerGroup', 1))),
        sizes.length ? h('p', { class: 'note' }, `${n} jugadores → grupos de ${sizes.join(' / ')}.`) : null,
        new Set(sizes).size > 1 ? h('p', { class: 'warn note' }, 'Grupos desiguales: los pequeños jugarán menos partidos.') : null);
      p.querySelectorAll('input[type=number]').forEach(i => i.addEventListener('change', draw));
    }
  },
  // 3 — reglas
  (p) => {
    p.append(h('h2', {}, 'Reglas'),
      h('div', { class: 'row three' }, field('Victoria', numInput('win')), field('Empate', numInput('draw')), field('Derrota', numInput('loss'))),
      field('Desempate en tabla', h('select', { onChange: e => { wiz.preset = e.target.value; } },
        Object.entries(TIEBREAK_PRESETS).map(([k, v]) => h('option', { value: k, selected: wiz.preset === k }, v.label)))),
      field('Empate en eliminatorias', h('select', { onChange: e => { wiz.rules.knockoutTiebreak = e.target.value; } },
        Object.entries(KO_TIEBREAK_LABELS).map(([k, v]) => h('option', { value: k, selected: wiz.rules.knockoutTiebreak === k }, v)))));
  },
  // 4 — revisar
  (p, state) => {
    const c = cfg(), errors = E.validateConfig(c), comp = getCompetition(c.competitionId);
    const poolSize = comp ? getTeamsByCompetition(comp.id, { onlyInGame: c.onlyInGame }).length : 0;
    const short = comp && poolSize < c.playerIds.length ? `Solo hay ${poolSize} equipos${c.onlyInGame ? ` en ${GAME_LABEL}` : ''} para ${c.playerIds.length} jugadores. Cambia de competición${c.onlyInGame ? ', quita el filtro' : ''} o reduce jugadores.` : null;
    const t = getState().tournament, problems = [...errors, short].filter(Boolean);
    p.append(h('h2', {}, 'Revisar'),
      h('dl', { class: 'summary' },
        h('dt', {}, 'Torneo'), h('dd', {}, c.name || '—'), h('dt', {}, 'Competición'), h('dd', {}, comp?.name ?? '—'),
        h('dt', {}, 'Equipos'), h('dd', {}, c.onlyInGame ? `Solo ${GAME_LABEL}` : 'Todo el catálogo'), h('dt', {}, 'Formato'), h('dd', {}, FORMAT_LABELS[c.format]),
        h('dt', {}, 'Jugadores'), h('dd', {}, c.playerIds.map(id => state.players.find(x => x.id === id)?.name).join(', ') || '—'),
        h('dt', {}, 'Puntos'), h('dd', {}, `${c.rules.win} / ${c.rules.draw} / ${c.rules.loss}`),
        c.format === FORMATS.GROUPS ? [h('dt', {}, 'Grupos'), h('dd', {}, `${c.rules.groupCount}, clasifican ${c.rules.qualifiersPerGroup}`)] : null),
      ...problems.map(e => h('p', { class: 'form-error', role: 'alert' }, e)),
      h('div', { class: 'actions' }, btn(t ? 'Guardar cambios' : 'Crear torneo', { icon: 'check', disabled: problems.length > 0, onClick: () => {
        if (t) { if (commitTournament(E.updateConfig(t, c), 'Configuración guardada')) goto('sorteos'); }
        else { let nt; try { nt = E.createTournament(c); } catch (e) { return toast(e.message, 'error'); } if (commitTournament(nt, 'Torneo creado')) goto('sorteos'); }
      } })));
  }
];
