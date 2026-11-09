// Lógica de torneos. Funciones puras: reciben un torneo y devuelven uno nuevo (o lanzan EngineError).
// No depende de la interfaz; las reglas de integridad se validan aquí.
import { shuffle, pickOne, randomInt, newId } from './randomizer.js';
import { DEFAULT_RULES, FORMATS, TIEBREAK_PRESETS } from './state.js';
import { computeStandings, computePlayerStats } from './standings.js';

export class EngineError extends Error {
  constructor(message, code = 'ENGINE', details = {}) { super(message); this.name = 'EngineError'; this.code = code; this.details = details; }
}
const fail = (m, c, d) => { throw new EngineError(m, c, d); };
const clone = x => structuredClone(x);
const isInt = n => Number.isInteger(n) && n >= 0;
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

// ---------------------------------------------------------------- configuración
export function minPlayers(format, rules = DEFAULT_RULES) {
  return format === FORMATS.GROUPS ? Math.max(4, (rules.groupCount ?? 2) * 2) : 3;
}

export function normalizeRules(rules = {}) {
  return { ...DEFAULT_RULES, ...rules, tiebreakers: [...(rules.tiebreakers ?? DEFAULT_RULES.tiebreakers)] };
}

export function validateConfig(cfg) {
  const errors = [];
  const name = String(cfg?.name ?? '').trim();
  if (!name) errors.push('Escribe un nombre para el torneo.');
  if (name.length > 60) errors.push('El nombre del torneo no puede superar 60 caracteres.');
  if (!cfg?.competitionId) errors.push('Selecciona una competición.');
  if (!Object.values(FORMATS).includes(cfg?.format)) errors.push('Selecciona un formato.');
  const ids = cfg?.playerIds ?? [];
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) errors.push('La lista de participantes es inválida.');
  const rules = normalizeRules(cfg?.rules);
  if (![rules.win, rules.draw, rules.loss].every(isInt)) errors.push('Los puntos deben ser enteros no negativos.');
  if (!['extra-time-pens', 'pens', 'manual'].includes(rules.knockoutTiebreak)) errors.push('Método de desempate inválido.');
  if (Object.values(FORMATS).includes(cfg?.format)) {
    const min = minPlayers(cfg.format, rules);
    if (ids.length < min) errors.push(`Este formato necesita al menos ${min} jugadores (hay ${ids.length}).`);
    if (cfg.format === FORMATS.GROUPS) {
      if (!Number.isInteger(rules.groupCount) || rules.groupCount < 2) errors.push('Se necesitan al menos 2 grupos.');
      else {
        const minSize = Math.floor(ids.length / rules.groupCount);
        if (minSize < 2) errors.push(`Con ${ids.length} jugadores no se pueden formar ${rules.groupCount} grupos de al menos 2.`);
        if (!Number.isInteger(rules.qualifiersPerGroup) || rules.qualifiersPerGroup < 1) errors.push('Debe clasificar al menos 1 jugador por grupo.');
        else if (minSize >= 2 && rules.qualifiersPerGroup >= minSize) errors.push(`Clasificados por grupo (${rules.qualifiersPerGroup}) debe ser menor que el tamaño del grupo más pequeño (${minSize}).`);
        else if (rules.qualifiersPerGroup * rules.groupCount < 2) errors.push('Deben clasificar al menos 2 jugadores en total.');
      }
    }
  }
  return errors;
}

export function createTournament(cfg) {
  const errors = validateConfig(cfg);
  if (errors.length) fail(errors[0], 'INVALID_CONFIG', { errors });
  return {
    id: newId('t'), name: cfg.name.trim(), competitionId: cfg.competitionId, format: cfg.format,
    status: 'draft', playerIds: [...cfg.playerIds], assignments: {}, groups: [], matches: [],
    onlyInGame: cfg.onlyInGame !== false, rules: normalizeRules(cfg.rules), lots: {}, koSeeds: null, knockoutProvisional: false,
    championId: null, createdAt: Date.now(), drawnAt: null, startedAt: null, finishedAt: null
  };
}

export function updateConfig(t, cfg) {
  if (t.status !== 'draft') fail('La configuración solo se puede editar antes del sorteo de enfrentamientos.', 'LOCKED');
  const errors = validateConfig(cfg);
  if (errors.length) fail(errors[0], 'INVALID_CONFIG', { errors });
  const nt = clone(t);
  Object.assign(nt, { name: cfg.name.trim(), format: cfg.format, rules: normalizeRules(cfg.rules), playerIds: [...cfg.playerIds], onlyInGame: cfg.onlyInGame !== false });
  if (nt.competitionId !== cfg.competitionId) { nt.competitionId = cfg.competitionId; nt.assignments = {}; }
  for (const pid of Object.keys(nt.assignments)) if (!nt.playerIds.includes(pid)) delete nt.assignments[pid];
  return nt;
}

// ---------------------------------------------------------------- equipos
const editableTeams = t => { if (!['draft', 'drawn'].includes(t.status)) fail('Los equipos no se pueden cambiar una vez iniciado el torneo.', 'LOCKED'); };

export function assignTeams(t, teamPool, { mode = 'all', playerId = null } = {}) {
  editableTeams(t);
  const pool = [...new Set(teamPool)];
  const nt = clone(t);
  const locked = nt.playerIds.filter(p => nt.assignments[p]?.locked && nt.assignments[p]?.teamId);
  if (mode === 'single') {
    if (!nt.playerIds.includes(playerId)) fail('El jugador no participa en el torneo.', 'NO_PLAYER');
    if (nt.assignments[playerId]?.teamId) fail('Este jugador ya tiene equipo. Usa el sorteo simultáneo para volver a sortear.', 'HAS_TEAM');
    const used = new Set(Object.values(nt.assignments).map(a => a.teamId));
    const avail = pool.filter(id => !used.has(id));
    if (!avail.length) fail('No quedan equipos disponibles en esta competición.', 'NOT_ENOUGH_TEAMS', { missing: 1 });
    nt.assignments[playerId] = { teamId: pickOne(avail), locked: false };
    return nt;
  }
  const lockedTeams = new Set(locked.map(p => nt.assignments[p].teamId));
  const free = pool.filter(id => !lockedTeams.has(id));
  const need = nt.playerIds.filter(p => !locked.includes(p));
  if (free.length < need.length) {
    const missing = need.length - free.length;
    fail(`Faltan ${missing} equipo(s): hay ${free.length} disponibles para ${need.length} jugador(es).`, 'NOT_ENOUGH_TEAMS', { missing });
  }
  const mixed = shuffle(free);                       // Fisher-Yates sobre el catálogo válido
  for (const p of need) delete nt.assignments[p];
  need.forEach((p, i) => { nt.assignments[p] = { teamId: mixed[i], locked: false }; });
  return nt;
}

export function toggleLock(t, playerId) {
  editableTeams(t);
  if (!t.assignments[playerId]?.teamId) fail('Primero hay que asignar un equipo a este jugador.', 'NO_TEAM');
  const nt = clone(t);
  nt.assignments[playerId].locked = !nt.assignments[playerId].locked;
  return nt;
}

export function clearAssignments(t) {
  editableTeams(t);
  const nt = clone(t);
  for (const p of Object.keys(nt.assignments)) if (!nt.assignments[p].locked) delete nt.assignments[p];
  return nt;
}

// ---------------------------------------------------------------- generadores de calendario
export const nextPow2 = n => { let p = 1; while (p < n) p *= 2; return p; };
export function roundName(count) {
  return { 1: 'Final', 2: 'Semifinales', 4: 'Cuartos de final', 8: 'Octavos de final', 16: 'Dieciseisavos de final' }[count] ?? `Ronda de ${count * 2}`;
}
// Orden estándar de cabezas de serie en el cuadro: [1,8,4,5,2,7,3,6] para 8.
export function seedOrder(size) {
  let o = [1];
  while (o.length < size) { const n = o.length * 2; o = o.flatMap(s => [s, n + 1 - s]); }
  return o;
}
const blankMatch = extra => ({
  id: '', stage: 'group', groupId: null, round: 0, index: 0, roundName: '', homeId: null, awayId: null,
  homeGoals: null, awayGoals: null, status: 'pending', winnerId: null, tiebreak: null, notes: '', bye: false, updatedAt: null, ...extra
});

// entrants ordenados por cabeza de serie. Los byes (si no es potencia de 2) van a los mejores
// cabezas de serie; en un sorteo aleatorio los "seeds" son una mezcla Fisher-Yates, así que
// los byes caen en participantes aleatorios.
export function buildKnockoutMatches(entrants) {
  const n = entrants.length;
  if (n < 2) fail('Se necesitan al menos 2 participantes para un cuadro.', 'KO_SIZE');
  const size = nextPow2(n), order = seedOrder(size), rounds = Math.log2(size), matches = [];
  for (let r = 0; r < rounds; r++) {
    const count = size / 2 ** (r + 1);
    for (let i = 0; i < count; i++) matches.push(blankMatch({ id: `k-${r}-${i}`, stage: 'knockout', round: r, index: i, roundName: roundName(count) }));
  }
  const byId = new Map(matches.map(m => [m.id, m]));
  for (let i = 0; i < size / 2; i++) {
    const m = byId.get(`k-0-${i}`);
    const a = entrants[order[2 * i] - 1] ?? null, b = entrants[order[2 * i + 1] - 1] ?? null;
    if (a && b) { m.homeId = a; m.awayId = b; }
    else { m.homeId = a ?? b; m.bye = true; m.status = 'done'; m.winnerId = m.homeId; }
  }
  for (const m of matches) if (m.bye) setSlot(byId.get(`k-1-${Math.floor(m.index / 2)}`), m, m.winnerId);
  return matches;
}
function setSlot(next, from, playerId) { if (next) next[from.index % 2 === 0 ? 'homeId' : 'awayId'] = playerId; }
const nextOf = (t, m) => m.stage === 'knockout' ? t.matches.find(x => x.id === `k-${m.round + 1}-${Math.floor(m.index / 2)}`) : undefined;

// Método del círculo. Con N impar se añade un "descanso" por jornada: cada jugador descansa 1 vez.
export function roundRobinSchedule(playerIds) {
  const ids = [...playerIds];
  if (ids.length % 2) ids.push(null);
  const n = ids.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = []; let rest = null;
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i], b = ids[n - 1 - i];
      if (a === null || b === null) { rest = a ?? b; continue; }
      pairs.push((r + i) % 2 ? [b, a] : [a, b]);
    }
    rounds.push({ pairs, rest });
    ids.splice(1, 0, ids.pop());
  }
  return rounds;
}
function buildGroupMatches(group) {
  const matches = [];
  group.rounds = roundRobinSchedule(group.playerIds).map((r, ri) => {
    const matchIds = r.pairs.map(([h, a], i) => {
      const m = blankMatch({ id: `g-${group.id}-${ri}-${i}`, stage: 'group', groupId: group.id, round: ri, index: i, roundName: `Jornada ${ri + 1}`, homeId: h, awayId: a });
      matches.push(m);
      return m.id;
    });
    return { matchIds, restId: r.rest };
  });
  return matches;
}
export function splitIntoGroups(playerIds, count) {
  const groups = Array.from({ length: count }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return { id: letter, name: `Grupo ${letter}`, playerIds: [], rounds: [] };
  });
  shuffle(playerIds).forEach((p, i) => groups[i % count].playerIds.push(p));   // reparto equilibrado
  return groups;
}
export function groupSizeWarning(t) {
  const sizes = t.groups.map(g => g.playerIds.length);
  if (new Set(sizes).size <= 1) return null;
  return `Los grupos tienen tamaños distintos (${sizes.join(', ')}): los jugadores de grupos más pequeños disputan menos partidos, por lo que sus puntos y goles no son directamente comparables entre grupos.`;
}

export function generateDraw(t) {
  if (!['draft', 'drawn'].includes(t.status)) fail('El sorteo ya está confirmado y no puede repetirse.', 'LOCKED');
  const min = minPlayers(t.format, t.rules);
  if (t.playerIds.length < min) fail(`Se necesitan al menos ${min} jugadores para este formato.`, 'NOT_ENOUGH_PLAYERS');
  const missing = t.playerIds.filter(p => !t.assignments[p]?.teamId);
  if (missing.length) fail(`Faltan equipos por asignar (${missing.length} jugador(es) sin equipo).`, 'MISSING_TEAMS');
  const nt = clone(t);
  Object.assign(nt, { matches: [], groups: [], koSeeds: null, knockoutProvisional: false, championId: null, finishedAt: null });
  nt.lots = Object.fromEntries(nt.playerIds.map(p => [p, randomInt(1_000_000_000)]));
  if (nt.format === FORMATS.KNOCKOUT) nt.matches = buildKnockoutMatches(shuffle(nt.playerIds));
  else {
    nt.groups = nt.format === FORMATS.ROUND_ROBIN
      ? [{ id: 'RR', name: 'Liguilla', playerIds: shuffle(nt.playerIds), rounds: [] }]
      : splitIntoGroups(nt.playerIds, nt.rules.groupCount);
    nt.matches = nt.groups.flatMap(buildGroupMatches);
  }
  nt.status = 'drawn';
  nt.drawnAt = Date.now();
  return nt;
}

export function discardDraw(t) {
  if (t.status !== 'drawn') fail('No hay un sorteo pendiente de confirmar.', 'NO_DRAW');
  const nt = clone(t);
  Object.assign(nt, { status: 'draft', matches: [], groups: [], koSeeds: null, knockoutProvisional: false, drawnAt: null });
  return nt;
}

export function confirmDraw(t) {
  if (t.status !== 'drawn') fail('Primero hay que sortear los enfrentamientos.', 'NO_DRAW');
  const nt = clone(t);
  nt.status = 'in-progress';
  nt.startedAt = Date.now();
  return finalize(nt);
}

// ---------------------------------------------------------------- fase de grupos → eliminatorias
export const groupsComplete = t => { const g = t.matches.filter(m => m.stage === 'group'); return g.length > 0 && g.every(m => m.status === 'done'); };

export function qualifierSeeds(t) {
  const q = t.rules.qualifiersPerGroup;
  const tables = t.groups.map(g => computeStandings(t, g.id));
  const seeds = [];
  for (let k = 0; k < q; k++) for (const tb of tables) if (tb[k]) seeds.push(tb[k].playerId);   // 1A,1B,..,2A,2B,..
  return seeds;
}
function buildKnockoutInto(nt, provisional) {
  const seeds = qualifierSeeds(nt);
  nt.matches = nt.matches.filter(m => m.stage !== 'knockout').concat(buildKnockoutMatches(seeds));
  nt.koSeeds = seeds;
  nt.knockoutProvisional = provisional;
}
export function knockoutIsStale(t) { return t.knockoutProvisional && !sameList(qualifierSeeds(t), t.koSeeds); }

export function generateKnockoutStage(t, { provisional = false } = {}) {
  if (t.format !== FORMATS.GROUPS) fail('Este formato no tiene fase eliminatoria posterior a grupos.', 'BAD_FORMAT');
  if (t.status !== 'in-progress') fail('El torneo debe estar en curso.', 'NOT_STARTED');
  const hasKo = t.matches.some(m => m.stage === 'knockout');
  if (hasKo && !t.knockoutProvisional) fail('La fase eliminatoria ya está generada.', 'KO_EXISTS');
  const complete = groupsComplete(t);
  if (!complete && !provisional) fail('Aún hay partidos de grupos sin resultado. Termínalos o crea un cuadro provisional.', 'GROUPS_PENDING');
  const nt = clone(t);
  buildKnockoutInto(nt, !complete);
  return finalize(nt);
}

// ---------------------------------------------------------------- resultados
const hasProgress = m => m.status !== 'pending' || m.homeGoals !== null;
function resetMatch(m) { Object.assign(m, { status: 'pending', homeGoals: null, awayGoals: null, winnerId: null, tiebreak: null, notes: '', updatedAt: null }); }
function dependentChain(t, m) {
  const out = []; let cur = m;
  for (;;) { const nx = nextOf(t, cur); if (!nx || !hasProgress(nx)) break; out.push(nx); cur = nx; }
  return out;
}

export function parseResult(m, t, input) {
  const status = input?.status;
  if (!['pending', 'live', 'done'].includes(status)) fail('Estado de partido inválido.', 'BAD_STATUS');
  const notes = String(input?.notes ?? '').slice(0, 500);
  const empty = { status, homeGoals: null, awayGoals: null, tiebreak: null, winnerId: null, notes };
  if (status === 'pending') return { ...empty, notes: '' };
  const toNum = v => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);
  const hg = toNum(input.homeGoals), ag = toNum(input.awayGoals);
  if (!isInt(hg) || !isInt(ag)) fail('Los goles deben ser números enteros no negativos.', 'BAD_GOALS');
  const base = { ...empty, homeGoals: hg, awayGoals: ag };
  if (status === 'live') return base;
  if (hg !== ag) return { ...base, winnerId: hg > ag ? m.homeId : m.awayId };
  if (m.stage === 'group') return base;                   // empate válido en liguilla
  const tb = input.tiebreak;
  if (!tb) fail('En eliminación directa un empate necesita desempate (penaltis o ganador manual).', 'NEEDS_TIEBREAK');
  if (!['extra-time-pens', 'pens', 'manual'].includes(tb.method)) fail('Método de desempate inválido.', 'BAD_TIEBREAK');
  if (tb.method === 'manual') {
    if (![m.homeId, m.awayId].includes(tb.winnerId)) fail('Selecciona el ganador del desempate.', 'BAD_TIEBREAK');
    return { ...base, winnerId: tb.winnerId, tiebreak: { method: 'manual', winnerId: tb.winnerId } };
  }
  const hp = toNum(tb.homePens), ap = toNum(tb.awayPens);
  if (!isInt(hp) || !isInt(ap)) fail('Los penaltis deben ser números enteros no negativos.', 'BAD_TIEBREAK');
  if (hp === ap) fail('La tanda de penaltis no puede terminar empatada.', 'BAD_TIEBREAK');
  return { ...base, winnerId: hp > ap ? m.homeId : m.awayId, tiebreak: { method: tb.method, homePens: hp, awayPens: ap, winnerId: hp > ap ? m.homeId : m.awayId } };
}

export function recordResult(t, matchId, input, { confirmInvalidate = false } = {}) {
  if (!['in-progress', 'finished'].includes(t.status)) fail('El torneo todavía no ha comenzado: confirma el sorteo primero.', 'NOT_STARTED');
  const base = t.matches.find(m => m.id === matchId);
  if (!base) fail('El partido no existe.', 'NO_MATCH');
  if (base.bye) fail('Un pase automático no admite resultado.', 'BYE');
  if (!base.homeId || !base.awayId) fail('Los participantes de este partido aún no están definidos.', 'PENDING_PARTICIPANTS');
  if (base.stage === 'knockout' && t.knockoutProvisional) fail('El cuadro es provisional: regéneralo cuando terminen los grupos antes de registrar resultados.', 'PROVISIONAL');
  const parsed = parseResult(base, t, input);
  const nt = clone(t);
  const m = nt.matches.find(x => x.id === matchId);
  const prevWinner = m.winnerId;
  Object.assign(m, parsed, { updatedAt: Date.now() });

  if (m.stage === 'knockout') {
    if (prevWinner !== m.winnerId) {
      const chain = dependentChain(nt, m);
      if (chain.length && !confirmInvalidate) {
        fail(`Este cambio invalidará ${chain.length} resultado(s) posterior(es) que dependían del ganador anterior.`, 'NEEDS_CONFIRMATION',
          { matchIds: chain.map(x => x.id), reason: 'knockout-chain' });
      }
      for (const d of chain) { resetMatch(d); setSlot(nextOf(nt, d), d, null); }
      setSlot(nextOf(nt, m), m, m.winnerId);
    }
  } else if (nt.format === FORMATS.GROUPS) {
    const ko = nt.matches.filter(x => x.stage === 'knockout');
    if (ko.length && !nt.knockoutProvisional) {
      const seeds = groupsComplete(nt) ? qualifierSeeds(nt) : null;
      if (!sameList(seeds, nt.koSeeds)) {
        const progressed = ko.filter(x => !x.bye && hasProgress(x));
        if (progressed.length && !confirmInvalidate) {
          fail('Este cambio modifica los clasificados de la fase de grupos y obliga a regenerar el cuadro eliminatorio, descartando sus resultados.', 'NEEDS_CONFIRMATION',
            { matchIds: progressed.map(x => x.id), reason: 'knockout-reset' });
        }
        nt.matches = nt.matches.filter(x => x.stage !== 'knockout');
        nt.koSeeds = null; nt.championId = null;
      }
    }
  }
  return finalize(nt);
}

// Recalcula el estado derivado (cuadro automático, campeón, estado del torneo).
function finalize(nt) {
  if (nt.format === FORMATS.GROUPS) {
    const hasKo = nt.matches.some(m => m.stage === 'knockout');
    if (groupsComplete(nt) && (!hasKo || nt.knockoutProvisional)) buildKnockoutInto(nt, false);
  }
  let champion = null;
  const ko = nt.matches.filter(m => m.stage === 'knockout');
  if (ko.length) {
    const final = ko.find(m => m.round === Math.max(...ko.map(x => x.round)));
    champion = final?.status === 'done' ? final.winnerId : null;
  } else if (nt.format === FORMATS.ROUND_ROBIN && groupsComplete(nt)) {
    champion = computeStandings(nt, 'RR')[0]?.playerId ?? null;
  }
  nt.championId = champion;
  if (['in-progress', 'finished'].includes(nt.status)) {
    nt.status = champion ? 'finished' : 'in-progress';
    nt.finishedAt = champion ? (nt.finishedAt ?? Date.now()) : null;
  }
  return nt;
}

// ---------------------------------------------------------------- historial
export function buildHistoryEntry(t, players, teamNameOf = () => '—') {
  const byId = new Map(players.map(p => [p.id, p]));
  const participants = t.playerIds.map(id => ({
    playerId: id, name: byId.get(id)?.name ?? '(eliminado)',
    teamId: t.assignments[id]?.teamId ?? null, teamName: teamNameOf(t.assignments[id]?.teamId),
    stats: computePlayerStats(t, id)
  }));
  const champ = participants.find(p => p.playerId === t.championId);
  return {
    id: newId('h'), tournamentId: t.id, name: t.name, competitionId: t.competitionId, format: t.format,
    finishedAt: t.finishedAt ?? Date.now(), championId: t.championId ?? null,
    championName: champ?.name ?? null, championTeamName: champ?.teamName ?? null,
    matchesPlayed: t.matches.filter(m => m.status === 'done' && !m.bye).length, participants
  };
}
export const playerHistory = (history, playerId) => history.filter(h => h.participants.some(p => p.playerId === playerId));
export { TIEBREAK_PRESETS };
