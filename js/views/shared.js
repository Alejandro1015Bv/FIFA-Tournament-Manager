import { h, openDialog, shortId } from '../ui.js';
import { getTeam, teamBadge } from '../teams.js';
import { recordWithConfirm } from '../actions.js';
import { KO_TIEBREAK_LABELS } from '../state.js';

export const STATUS_LABEL = { pending: 'Pendiente', live: 'En juego', done: 'Finalizado' };
export const playerName = (state, id) => state.players.find(p => p.id === id)?.name ?? '—';
export const teamOfPlayer = (t, id) => (t?.assignments?.[id] ? getTeam(t.assignments[id].teamId) : null);
export const canRecord = (t, m) =>
  ['in-progress', 'finished'].includes(t.status) && m.homeId && m.awayId && !m.bye && !(m.stage === 'knockout' && t.knockoutProvisional);

export function playerCell(t, state, id, { size = 28 } = {}) {
  const team = teamOfPlayer(t, id);
  return h('span', { class: 'who' },
    teamBadge(team, { size }),
    h('span', { class: 'who-text' }, h('strong', {}, playerName(state, id)), h('small', { class: 'muted' }, team?.name ?? 'Sin equipo')));
}

export function matchLabel(t, m) {
  if (m.stage === 'knockout') return `${m.roundName} · Partido ${m.index + 1}`;
  const g = t.groups.find(x => x.id === m.groupId);
  return t.format === 'round-robin' ? m.roundName : `${g?.name ?? m.groupId} · ${m.roundName}`;
}

function side(t, state, m, which) {
  const pid = m[which + 'Id'];
  const goals = which === 'home' ? m.homeGoals : m.awayGoals;
  if (!pid) return h('div', { class: 'side tbd' }, h('span', { class: 'muted' }, m.bye ? 'Pase automático' : 'Por definir'));
  const done = m.status === 'done';
  const cls = ['side', done && m.winnerId === pid ? 'winner' : '', done && m.stage === 'knockout' && m.winnerId && m.winnerId !== pid ? 'loser' : ''].join(' ').trim();
  const pens = m.tiebreak && m.tiebreak.homePens !== undefined ? (which === 'home' ? m.tiebreak.homePens : m.tiebreak.awayPens) : null;
  return h('div', { class: cls }, playerCell(t, state, pid),
    h('span', { class: 'goals' }, goals ?? '–', pens !== null ? h('small', { class: 'pens' }, ` (${pens})`) : null));
}

function tiebreakText(m, state) {
  const tb = m.tiebreak;
  if (!tb) return null;
  const w = state.players.find(p => p.id === tb.winnerId)?.name ?? '';
  return tb.method === 'manual' ? `Desempate manual: gana ${w}` : `${KO_TIEBREAK_LABELS[tb.method]}: ${tb.homePens}–${tb.awayPens}`;
}

export function matchCard(t, state, m, opts = {}) {
  const status = m.bye ? 'bye' : m.status;
  const editable = !opts.readOnly && canRecord(t, m);
  return h('article', { class: `match ${status}`, dataset: { matchId: m.id } },
    h('header', { class: 'match-head' },
      h('span', { class: 'match-id', title: m.id }, opts.compact ? `#${m.index + 1}` : matchLabel(t, m)),
      h('span', { class: `status ${status}` }, m.bye ? 'Pase automático' : STATUS_LABEL[m.status])),
    side(t, state, m, 'home'), side(t, state, m, 'away'),
    m.tiebreak ? h('div', { class: 'match-note' }, tiebreakText(m, state)) : null,
    m.notes ? h('div', { class: 'match-note muted' }, m.notes) : null,
    editable ? h('button', { class: 'btn small secondary', type: 'button', onClick: () => openResultDialog(t, state, m) },
      m.status === 'pending' ? 'Registrar resultado' : 'Editar resultado') : null);
}

export function openResultDialog(t, state, m) {
  const isKo = m.stage === 'knockout';
  return openDialog('Resultado del partido', close => {
    const num = v => h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric', value: v ?? '' });
    const hg = num(m.homeGoals), ag = num(m.awayGoals);
    const status = h('select', { 'aria-label': 'Estado' },
      ...['pending', 'live', 'done'].map(s => h('option', { value: s, selected: m.status === s }, STATUS_LABEL[s])));
    if (m.status === 'pending') status.value = 'done';
    const method = h('select', { 'aria-label': 'Método de desempate' },
      ...Object.entries(KO_TIEBREAK_LABELS).map(([k, l]) => h('option', { value: k, selected: (m.tiebreak?.method ?? t.rules.knockoutTiebreak) === k }, l)));
    const hp = num(m.tiebreak?.homePens), ap = num(m.tiebreak?.awayPens);
    const win = h('select', { 'aria-label': 'Ganador manual' },
      h('option', { value: m.homeId, selected: m.tiebreak?.winnerId === m.homeId }, playerName(state, m.homeId)),
      h('option', { value: m.awayId, selected: m.tiebreak?.winnerId === m.awayId }, playerName(state, m.awayId)));
    const notes = h('textarea', { rows: 2, maxlength: 500, placeholder: 'Observaciones (opcional)' }); notes.value = m.notes ?? '';
    const penBox = h('div', { class: 'row' }, h('label', { class: 'field' }, h('span', {}, `Penaltis ${playerName(state, m.homeId)}`), hp), h('label', { class: 'field' }, h('span', {}, `Penaltis ${playerName(state, m.awayId)}`), ap));
    const manualBox = h('label', { class: 'field' }, h('span', {}, 'Ganador'), win);
    const tieBox = h('fieldset', { class: 'tie-box' }, h('legend', {}, 'Desempate (eliminación directa)'),
      h('label', { class: 'field' }, h('span', {}, 'Método'), method), penBox, manualBox);
    const err = h('p', { class: 'form-error', role: 'alert' });

    const refresh = () => {
      const live = status.value !== 'pending';
      hg.disabled = ag.disabled = !live;
      const tie = isKo && status.value === 'done' && hg.value !== '' && hg.value === ag.value;
      tieBox.hidden = !tie;
      penBox.hidden = method.value === 'manual'; manualBox.hidden = method.value !== 'manual';
    };
    [status, hg, ag, method].forEach(el => { el.addEventListener('input', refresh); el.addEventListener('change', refresh); });
    refresh();

    const submit = async e => {
      e.preventDefault(); err.textContent = '';
      const result = { status: status.value, homeGoals: hg.value, awayGoals: ag.value, notes: notes.value };
      if (!tieBox.hidden) result.tiebreak = method.value === 'manual'
        ? { method: 'manual', winnerId: win.value } : { method: method.value, homePens: hp.value, awayPens: ap.value };
      if (await recordWithConfirm(m.id, result)) close(true);
      else err.textContent = 'No se pudo guardar el resultado. Revisa los datos.';
    };
    return h('form', { onSubmit: submit },
      h('p', { class: 'muted' }, `${playerName(state, m.homeId)} vs ${playerName(state, m.awayId)}`),
      h('label', { class: 'field' }, h('span', {}, 'Estado del partido'), status),
      h('div', { class: 'row' },
        h('label', { class: 'field' }, h('span', {}, `Goles ${playerName(state, m.homeId)}`), hg),
        h('label', { class: 'field' }, h('span', {}, `Goles ${playerName(state, m.awayId)}`), ag)),
      tieBox, h('label', { class: 'field' }, h('span', {}, 'Observaciones'), notes), err,
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn secondary', type: 'button', onClick: () => close(false) }, 'Cancelar'),
        h('button', { class: 'btn', type: 'submit' }, 'Guardar')));
  });
}
