// Asistente de configuración por pasos (no obliga a rellenarlo todo en una pantalla).
import { h, clear, toast, emptyCard, linkBtn, goto, fmtDate } from '../ui.js';
import { getState, FORMATS, FORMAT_LABELS, TIEBREAK_PRESETS, KO_TIEBREAK_LABELS, DEFAULT_RULES, STATUS_LABELS } from '../state.js';
import * as E from '../tournament-engine.js';
import { getCompetitions, getCompetition } from '../teams.js';
import { commitTournament, deleteTournament } from '../actions.js';

const STEPS = ['Nombre y competición', 'Participantes', 'Formato', 'Reglas', 'Revisar'];
const FORMAT_INFO = {
  [FORMATS.KNOCKOUT]: 'Cada partido elimina al perdedor. Admite cualquier número de jugadores (con pases automáticos). Ojo: los jugadores eliminados pronto disputan menos partidos; en eliminación directa NO todos juegan lo mismo.',
  [FORMATS.ROUND_ROBIN]: 'Todos juegan contra todos una vez: con N jugadores, cada uno disputa exactamente N-1 partidos. Con N impar, cada jornada alguien descansa. Gana quien suma más puntos.',
  [FORMATS.GROUPS]: 'Los jugadores se reparten en grupos (liguilla dentro de cada grupo) y los mejores pasan a una fase eliminatoria. Todos juegan varios partidos antes de pelear por el título.'
};

let wiz = null, step = 0, loadedFor;
const fresh = () => ({ name: '', competitionId: getCompetitions()[0]?.id ?? '', playerIds: [], format: FORMATS.KNOCKOUT, rules: { ...DEFAULT_RULES }, preset: 'standard' });
const fromTournament = t => ({
  name: t.name, competitionId: t.competitionId, playerIds: [...t.playerIds], format: t.format, rules: { ...t.rules },
  preset: Object.entries(TIEBREAK_PRESETS).find(([, p]) => p.order.join() === t.rules.tiebreakers.join())?.[0] ?? 'standard'
});
const cfg = () => ({ ...wiz, rules: { ...wiz.rules, tiebreakers: TIEBREAK_PRESETS[wiz.preset].order } });
const field = (label, control, hint) => h('label', { class: 'field' }, h('span', {}, label), control, hint ? h('small', { class: 'muted' }, hint) : null);
const numInput = (key, min = 0) => h('input', { type: 'number', min, step: 1, value: wiz.rules[key], onInput: e => { wiz.rules[key] = e.target.value === '' ? NaN : Number(e.target.value); } });

export function render(container) {
  const state = getState(), t = state.tournament;
  if (t && t.status !== 'draft') {
    container.append(h('div', { class: 'card' }, h('h2', {}, t.name),
      h('p', { class: 'muted' }, `Competición: ${getCompetition(t.competitionId)?.name ?? t.competitionId} · ${FORMAT_LABELS[t.format]} · ${t.playerIds.length} participantes · ${STATUS_LABELS[t.status]}`),
      h('p', {}, t.status === 'drawn' ? 'El sorteo está pendiente de confirmar. Descártalo en «Sorteos» si quieres cambiar la configuración.' : 'La configuración está bloqueada porque el torneo ya comenzó.'),
      h('div', { class: 'actions' }, linkBtn('Ir a Sorteos', 'sorteos'), h('button', { class: 'btn danger', type: 'button', onClick: deleteTournament }, 'Eliminar y crear otro'))));
    return;
  }
  const key = t ? t.id : 'new';
  if (loadedFor !== key) { wiz = t ? fromTournament(t) : fresh(); step = 0; loadedFor = key; }
  wiz.playerIds = wiz.playerIds.filter(id => state.players.some(p => p.id === id));
  const draw = () => { clear(container); render(container); };

  container.append(h('ol', { class: 'stepper wizard' }, STEPS.map((s, i) =>
    h('li', { class: i < step ? 'done' : i === step ? 'current' : '' }, h('button', { type: 'button', class: 'linklike', onClick: () => { step = i; draw(); } }, h('span', { class: 'n' }, i < step ? '✓' : i + 1), s)))));
  const panel = h('div', { class: 'card' });
  container.append(panel);
  panels[step](panel, state, draw);

  const errors = [];
  const next = () => {
    if (step === 0 && !wiz.name.trim()) errors.push('Escribe un nombre para el torneo.');
    if (step === 0 && !wiz.competitionId) errors.push('Selecciona una competición.');
    if (step === 1 && wiz.playerIds.length < 3) errors.push('Selecciona al menos 3 participantes.');
    if (errors.length) return toast(errors[0], 'error');
    step++; draw();
  };
  if (step < STEPS.length - 1) container.append(h('div', { class: 'actions between' },
    h('button', { class: 'btn secondary', type: 'button', disabled: step === 0, onClick: () => { step--; draw(); } }, 'Anterior'),
    h('button', { class: 'btn', type: 'button', onClick: next }, 'Siguiente')));
  else container.append(h('div', { class: 'actions between' }, h('button', { class: 'btn secondary', type: 'button', onClick: () => { step--; draw(); } }, 'Anterior')));
}

const panels = [
  // 0 — nombre y competición
  (p) => {
    const comp = getCompetition(wiz.competitionId);
    p.append(h('h2', {}, 'Nombre y competición'),
      field('Nombre del torneo', h('input', { type: 'text', maxlength: 60, value: wiz.name, placeholder: 'Ej. Copa del viernes', onInput: e => { wiz.name = e.target.value; } })),
      field('Competición', h('select', { onChange: e => { wiz.competitionId = e.target.value; { clear(p); panels[0](p); }; } },
        getCompetitions().map(c => h('option', { value: c.id, selected: c.id === wiz.competitionId }, `${c.icon ?? ''} ${c.name}`))),
        comp ? `${comp.teamIds.length} equipos disponibles en el catálogo` : 'No hay catálogo cargado'));
  },
  // 1 — participantes
  (p, state, draw) => {
    p.append(h('h2', {}, 'Participantes'));
    if (!state.players.length) { p.append(h('p', { class: 'muted' }, 'Primero registra jugadores.'), linkBtn('Ir a Jugadores', 'jugadores')); return; }
    p.append(h('div', { class: 'actions' },
      h('button', { class: 'btn small secondary', type: 'button', onClick: () => { wiz.playerIds = state.players.map(x => x.id); draw(); } }, 'Seleccionar todos'),
      h('button', { class: 'btn small secondary', type: 'button', onClick: () => { wiz.playerIds = []; draw(); } }, 'Ninguno'),
      h('strong', { class: 'count' }, `${wiz.playerIds.length} seleccionados`)),
      h('div', { class: 'checks' }, state.players.map(pl => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: wiz.playerIds.includes(pl.id), onChange: e => {
          wiz.playerIds = e.target.checked ? [...wiz.playerIds, pl.id] : wiz.playerIds.filter(i => i !== pl.id); draw(); } }), pl.name))));
  },
  // 2 — formato
  (p, state, draw) => {
    p.append(h('h2', {}, 'Formato'), h('div', { class: 'format-cards' }, Object.values(FORMATS).map(f =>
      h('label', { class: 'format-card' + (wiz.format === f ? ' on' : '') },
        h('input', { type: 'radio', name: 'format', checked: wiz.format === f, onChange: () => { wiz.format = f; draw(); } }),
        h('strong', {}, FORMAT_LABELS[f]), h('p', { class: 'muted' }, FORMAT_INFO[f])))));
    if (wiz.format === FORMATS.GROUPS) {
      const n = wiz.playerIds.length, g = wiz.rules.groupCount;
      const sizes = Number.isInteger(g) && g > 0 ? Array.from({ length: g }, (_, i) => Math.floor(n / g) + (i < n % g ? 1 : 0)) : [];
      p.append(h('div', { class: 'row' }, field('Número de grupos', numInput('groupCount', 2)), field('Clasificados por grupo', numInput('qualifiersPerGroup', 1))),
        h('p', { class: 'muted' }, sizes.length ? `Con ${n} jugadores: grupos de ${sizes.join(' / ')}.` : ''),
        new Set(sizes).size > 1 ? h('p', { class: 'warn' }, 'Los grupos serán de distinto tamaño: los más pequeños jugarán menos partidos y su clasificación no es directamente comparable.') : null);
      p.querySelectorAll('input[type=number]').forEach(i => i.addEventListener('change', draw));
    }
  },
  // 3 — reglas
  (p) => {
    p.append(h('h2', {}, 'Reglas'),
      h('div', { class: 'row three' }, field('Victoria (pts)', numInput('win')), field('Empate (pts)', numInput('draw')), field('Derrota (pts)', numInput('loss'))),
      field('Criterios de desempate (en orden)', h('select', { onChange: e => { wiz.preset = e.target.value; } },
        Object.entries(TIEBREAK_PRESETS).map(([k, v]) => h('option', { value: k, selected: wiz.preset === k }, v.label)))),
      field('Empate en eliminatorias', h('select', { onChange: e => { wiz.rules.knockoutTiebreak = e.target.value; } },
        Object.entries(KO_TIEBREAK_LABELS).map(([k, v]) => h('option', { value: k, selected: wiz.rules.knockoutTiebreak === k }, v))),
        'En liguilla los empates son válidos. Si todos los criterios empatan, decide un sorteo guardado al crear el calendario.'));
  },
  // 4 — revisar
  (p, state) => {
    const c = cfg(), errors = E.validateConfig(c), comp = getCompetition(c.competitionId);
    const teamsShort = comp && comp.teamIds.length < c.playerIds.length ? `La competición solo tiene ${comp.teamIds.length} equipos para ${c.playerIds.length} jugadores.` : null;
    const t = getState().tournament;
    p.append(h('h2', {}, 'Revisar y confirmar'),
      h('dl', { class: 'summary' },
        h('dt', {}, 'Torneo'), h('dd', {}, c.name || '—'), h('dt', {}, 'Competición'), h('dd', {}, comp?.name ?? '—'),
        h('dt', {}, 'Formato'), h('dd', {}, FORMAT_LABELS[c.format]),
        h('dt', {}, 'Participantes'), h('dd', {}, c.playerIds.map(id => state.players.find(x => x.id === id)?.name).join(', ') || '—'),
        h('dt', {}, 'Puntos'), h('dd', {}, `${c.rules.win} / ${c.rules.draw} / ${c.rules.loss}`),
        c.format === FORMATS.GROUPS ? [h('dt', {}, 'Grupos'), h('dd', {}, `${c.rules.groupCount} grupos, clasifican ${c.rules.qualifiersPerGroup}`)] : null,
        h('dt', {}, 'Desempate'), h('dd', {}, TIEBREAK_PRESETS[wiz.preset].label)),
      FORMAT_INFO[c.format] ? h('p', { class: 'muted' }, FORMAT_INFO[c.format]) : null,
      ...errors.map(e => h('p', { class: 'form-error' }, e)), teamsShort ? h('p', { class: 'form-error' }, teamsShort) : null,
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', disabled: errors.length > 0, onClick: () => {
        if (t) { if (commitTournament(E.updateConfig(t, c), 'Configuración guardada')) goto('sorteos'); }
        else { let nt; try { nt = E.createTournament(c); } catch (e) { return toast(e.message, 'error'); } if (commitTournament(nt, 'Torneo creado')) { goto('sorteos'); } }
      } }, t ? 'Guardar cambios' : 'Crear torneo')));
  }
];
