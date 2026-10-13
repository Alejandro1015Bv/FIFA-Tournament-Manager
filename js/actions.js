// Puente entre la interfaz y el motor: aplica operaciones al estado, muestra errores y confirmaciones.
import { update, getState } from './state.js';
import * as E from './tournament-engine.js';
import { toast, confirmDialog } from './ui.js';
import { getTeam } from './teams.js';

export function act(mutator, okMsg) {
  try { update(mutator); if (okMsg) toast(okMsg, 'ok'); return true; }
  catch (e) {
    toast(e.message || String(e), 'error');
    if (!(e instanceof E.EngineError)) console.error(e);
    return false;
  }
}
export const mutateTournament = (fn, okMsg) => act(s => { s.tournament = fn(s.tournament, s); }, okMsg);
export const commitTournament = (next, okMsg) => act(s => { s.tournament = next; }, okMsg);

const IMPACT = {
  'knockout-chain': 'Se restablecerán los siguientes partidos, que dependían del ganador anterior:',
  'knockout-reset': 'Se descartará el cuadro eliminatorio actual y estos resultados:'
};
export async function recordWithConfirm(matchId, result) {
  const run = confirm => update(s => { s.tournament = E.recordResult(s.tournament, matchId, result, { confirmInvalidate: confirm }); });
  try { run(false); return true; }
  catch (e) {
    if (e.code !== 'NEEDS_CONFIRMATION') { toast(e.message || String(e), 'error'); if (!(e instanceof E.EngineError)) console.error(e); return false; }
    const t = getState().tournament;
    const label = id => { const m = t.matches.find(x => x.id === id); return m ? `${m.roundName}${m.stage === 'group' ? ` (${m.groupId})` : ''}` : id; };
    const ok = await confirmDialog({
      title: 'Resultados dependientes', danger: true, confirmText: 'Continuar y invalidar',
      message: `${e.message} ${IMPACT[e.details.reason] ?? ''}`.trim(),
      details: e.details.matchIds.map(label)
    });
    if (!ok) return false;
    try { run(true); toast('Resultado actualizado', 'ok'); return true; }
    catch (e2) { toast(e2.message, 'error'); return false; }
  }
}

export function archiveCurrent() {
  return act(s => {
    const t = s.tournament;
    if (!t || t.status !== 'finished') throw new E.EngineError('Solo se pueden archivar torneos finalizados.', 'NOT_FINISHED');
    s.history.unshift(E.buildHistoryEntry(t, s.players, id => getTeam(id)?.name ?? '—'));
    s.tournament = null;
  }, 'Torneo archivado en el historial');
}

export async function deleteTournament() {
  const t = getState().tournament;
  if (!t) return false;
  const ok = await confirmDialog({
    title: 'Eliminar torneo', danger: true, confirmText: 'Eliminar',
    message: `¿Eliminar «${t.name}»? Se perderán equipos, sorteos y resultados. Esta acción no se puede deshacer.${t.status === 'finished' ? ' Si quieres conservarlo, archívalo en el historial primero.' : ''}`
  });
  return ok ? act(s => { s.tournament = null; }, 'Torneo eliminado') : false;
}
