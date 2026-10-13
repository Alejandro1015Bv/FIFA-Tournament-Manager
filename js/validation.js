// Validación estructural y de integridad. Independiente de la interfaz.
import { SCHEMA_VERSION, FORMATS } from './state.js';

const isInt = n => Number.isInteger(n) && n >= 0;
const isStr = s => typeof s === 'string' && s.length > 0;
const STATUSES = ['draft', 'drawn', 'in-progress', 'finished'];
const MATCH_STATUSES = ['pending', 'live', 'done'];
const KO_METHODS = ['extra-time-pens', 'pens', 'manual'];

export function validateTournament(t) {
  const e = [];
  if (!t || typeof t !== 'object') return ['Torneo con formato inválido'];
  if (!isStr(t.id)) e.push('Torneo sin identificador');
  if (!isStr(t.name)) e.push('Torneo sin nombre');
  if (!Object.values(FORMATS).includes(t.format)) e.push('Formato de torneo desconocido');
  if (!STATUSES.includes(t.status)) e.push('Estado de torneo desconocido');
  if (!isStr(t.competitionId)) e.push('Torneo sin competición');
  if (!Array.isArray(t.playerIds) || !t.playerIds.every(isStr)) return [...e, 'Lista de participantes inválida'];
  if (new Set(t.playerIds).size !== t.playerIds.length) e.push('Participantes duplicados');
  const pset = new Set(t.playerIds);
  const r = t.rules;
  if (!r || ![r.win, r.draw, r.loss].every(isInt)) e.push('Reglas de puntuación inválidas');
  else if (!Array.isArray(r.tiebreakers) || !r.tiebreakers.length) e.push('Criterios de desempate inválidos');
  else if (!KO_METHODS.includes(r.knockoutTiebreak)) e.push('Método de desempate eliminatorio inválido');

  if (!t.assignments || typeof t.assignments !== 'object') e.push('Asignaciones inválidas');
  else {
    const used = new Set();
    for (const [pid, a] of Object.entries(t.assignments)) {
      if (!pset.has(pid)) e.push('Asignación de un jugador que no participa');
      if (!a || !isStr(a.teamId)) { e.push('Asignación sin equipo'); continue; }
      if (used.has(a.teamId)) e.push('Equipo asignado a dos jugadores');
      used.add(a.teamId);
    }
  }
  if (!Array.isArray(t.matches) || !Array.isArray(t.groups)) return [...e, 'Partidos o grupos inválidos'];
  if (['in-progress', 'finished'].includes(t.status)) {
    const miss = t.playerIds.filter(p => !t.assignments?.[p]?.teamId);
    if (miss.length) e.push('Hay participantes sin equipo en un torneo iniciado');
  }

  // Grupos
  const inGroup = new Set();
  for (const g of t.groups) {
    if (!isStr(g.id) || !Array.isArray(g.playerIds)) { e.push('Grupo inválido'); continue; }
    for (const p of g.playerIds) {
      if (!pset.has(p)) e.push('Grupo con jugador desconocido');
      if (inGroup.has(p)) e.push('Jugador en dos grupos');
      inGroup.add(p);
    }
  }
  if (t.groups.length && inGroup.size !== t.playerIds.length) e.push('Hay jugadores sin grupo');

  // Partidos
  const ids = new Set(), byId = new Map(), pairs = new Set();
  for (const m of t.matches) {
    if (!isStr(m.id) || ids.has(m.id)) { e.push('Identificador de partido inválido o duplicado'); continue; }
    ids.add(m.id); byId.set(m.id, m);
    if (!['group', 'knockout'].includes(m.stage)) e.push(`Partido ${m.id}: fase inválida`);
    if (!MATCH_STATUSES.includes(m.status)) e.push(`Partido ${m.id}: estado inválido`);
    for (const side of ['homeId', 'awayId']) if (m[side] !== null && !pset.has(m[side])) e.push(`Partido ${m.id}: participante desconocido`);
    if (m.homeId && m.homeId === m.awayId) e.push(`Partido ${m.id}: un jugador juega contra sí mismo`);
    if (m.stage === 'group') {
      if (!m.homeId || !m.awayId) e.push(`Partido ${m.id}: grupo con participante sin definir`);
      const g = t.groups.find(x => x.id === m.groupId);
      if (!g) e.push(`Partido ${m.id}: grupo inexistente`);
      else if (!g.playerIds.includes(m.homeId) || !g.playerIds.includes(m.awayId)) e.push(`Partido ${m.id}: jugadores ajenos al grupo`);
      const key = `${m.groupId}|${[m.homeId, m.awayId].sort().join('|')}`;
      if (pairs.has(key)) e.push(`Partido ${m.id}: enfrentamiento duplicado en la liguilla`);
      pairs.add(key);
    }
    if (m.bye) {
      if (m.awayId !== null || !m.homeId || m.winnerId !== m.homeId) e.push(`Partido ${m.id}: pase automático inconsistente`);
      continue;
    }
    if (m.status === 'pending') {
      if (m.winnerId !== null || m.homeGoals !== null || m.awayGoals !== null) e.push(`Partido ${m.id}: pendiente con datos de resultado`);
      continue;
    }
    if (!m.homeId || !m.awayId) e.push(`Partido ${m.id}: resultado sin participantes`);
    if (!isInt(m.homeGoals) || !isInt(m.awayGoals)) { e.push(`Partido ${m.id}: goles inválidos`); continue; }
    if (m.status === 'live') { if (m.winnerId !== null) e.push(`Partido ${m.id}: en juego con ganador`); continue; }
    // done
    if (m.homeGoals !== m.awayGoals) {
      const w = m.homeGoals > m.awayGoals ? m.homeId : m.awayId;
      if (m.winnerId !== w) e.push(`Partido ${m.id}: el ganador no corresponde al marcador`);
    } else if (m.stage === 'group') {
      if (m.winnerId !== null) e.push(`Partido ${m.id}: empate de liguilla con ganador`);
    } else {
      const tb = m.tiebreak;
      if (!tb || !KO_METHODS.includes(tb.method)) { e.push(`Partido ${m.id}: empate eliminatorio sin desempate`); continue; }
      if (tb.method === 'manual') { if (![m.homeId, m.awayId].includes(m.winnerId)) e.push(`Partido ${m.id}: ganador manual inválido`); }
      else if (!isInt(tb.homePens) || !isInt(tb.awayPens) || tb.homePens === tb.awayPens ||
        m.winnerId !== (tb.homePens > tb.awayPens ? m.homeId : m.awayId)) e.push(`Partido ${m.id}: penaltis inconsistentes`);
    }
  }

  // Coherencia del cuadro: cada hueco debe ser el ganador de su partido anterior
  const ko = t.matches.filter(m => m.stage === 'knockout');
  if (ko.length) {
    const maxRound = Math.max(...ko.map(m => m.round));
    for (const m of ko) {
      if (m.round === 0) continue;
      const fh = byId.get(`k-${m.round - 1}-${m.index * 2}`), fa = byId.get(`k-${m.round - 1}-${m.index * 2 + 1}`);
      if (!fh || !fa) { e.push(`Partido ${m.id}: faltan partidos previos`); continue; }
      if (m.homeId !== (fh.winnerId ?? null) || m.awayId !== (fa.winnerId ?? null)) e.push(`Partido ${m.id}: participantes incoherentes con rondas anteriores`);
    }
    const final = ko.find(m => m.round === maxRound);
    const expected = final?.status === 'done' ? final.winnerId : null;
    if (t.championId !== expected) e.push('Campeón incoherente con la final');
  } else if (t.championId !== null && t.format === FORMATS.KNOCKOUT) e.push('Campeón sin final');
  if (t.championId && !pset.has(t.championId)) e.push('Campeón desconocido');
  if (t.status === 'finished' && !t.championId) e.push('Torneo finalizado sin campeón');
  return e;
}

export function validateState(s) {
  const e = [];
  if (!s || typeof s !== 'object') return ['Formato de datos inválido'];
  if (s.schemaVersion !== SCHEMA_VERSION) e.push(`Versión de esquema no soportada (${s.schemaVersion})`);
  if (!Array.isArray(s.players)) return [...e, 'La lista de jugadores es inválida'];
  if (!Array.isArray(s.history)) return [...e, 'El historial es inválido'];
  const ids = new Set();
  for (const p of s.players) {
    if (!p || !isStr(p.id) || !isStr(p.name) || ids.has(p.id)) e.push('Jugador inválido o con identificador duplicado');
    else ids.add(p.id);
  }
  if (s.tournament !== null && s.tournament !== undefined) {
    const te = validateTournament(s.tournament);
    e.push(...te);
    if (!te.length && !s.tournament.playerIds.every(id => ids.has(id))) e.push('El torneo usa jugadores inexistentes');
  }
  for (const h of s.history) if (!h || !isStr(h.id) || !isStr(h.name) || !Array.isArray(h.participants)) { e.push('Entrada de historial inválida'); break; }
  return e;
}
