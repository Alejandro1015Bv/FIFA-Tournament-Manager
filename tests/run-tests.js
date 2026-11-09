// Pruebas del motor (sin navegador): node tests/run-tests.js
import assert from 'node:assert/strict';
import { shuffle, randomInt } from '../js/randomizer.js';
import { FORMATS, createInitialState, DEFAULT_RULES } from '../js/state.js';
import * as E from '../js/tournament-engine.js';
import { computeStandings, knockoutProgress } from '../js/standings.js';
import { validateTournament, validateState } from '../js/validation.js';
import { parseImport } from '../js/storage.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n    ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const POOL = Array.from({ length: 60 }, (_, i) => `team-${i}`);
const ids = n => Array.from({ length: n }, (_, i) => `p${i}`);
const throwsCode = (fn, code) => assert.throws(fn, e => e instanceof E.EngineError && e.code === code, `se esperaba ${code}`);

function make(n, format, rulesExtra = {}) {
  let t = E.createTournament({ name: 'Test', competitionId: 'c', format, playerIds: ids(n), rules: rulesExtra });
  t = E.assignTeams(t, POOL);
  return t;
}
function started(n, format, rules) { return E.confirmDraw(E.generateDraw(make(n, format, rules))); }
const valid = t => assert.deepEqual(validateTournament(t), []);
// Juega un partido: gana siempre el de menor índice numérico (determinista)
const lowWins = (t, m) => {
  const hi = Number(m.homeId.slice(1)), ai = Number(m.awayId.slice(1));
  return E.recordResult(t, m.id, { status: 'done', homeGoals: hi < ai ? 2 : 0, awayGoals: hi < ai ? 0 : 2 });
};
function playAllKnockout(t) {
  for (;;) {
    const m = t.matches.filter(x => x.stage === 'knockout').sort((a, b) => a.round - b.round)
      .find(x => !x.bye && x.status !== 'done' && x.homeId && x.awayId);
    if (!m) return t;
    t = lowWins(t, m);
  }
}

section('Aleatoriedad');
test('Fisher-Yates no tiene sesgo evidente (3 elementos, 6000 mezclas)', () => {
  const counts = {};
  for (let i = 0; i < 6000; i++) { const k = shuffle([1, 2, 3]).join(); counts[k] = (counts[k] ?? 0) + 1; }
  assert.equal(Object.keys(counts).length, 6);
  for (const c of Object.values(counts)) assert.ok(c > 800 && c < 1200, `conteo fuera de rango: ${c}`);
});
test('randomInt respeta el rango', () => { for (let i = 0; i < 1000; i++) { const x = randomInt(7); assert.ok(x >= 0 && x < 7); } });

section('Eliminación directa');
for (const n of [3, 4, 5, 6, 8, 12, 16]) {
  test(`${n} jugadores: byes correctos, cuadro sin partidos fantasma y campeón válido`, () => {
    let t = E.generateDraw(make(n, FORMATS.KNOCKOUT));
    const size = E.nextPow2(n);
    assert.equal(t.matches.length, size - 1);
    const byes = t.matches.filter(m => m.bye);
    assert.equal(byes.length, size - n);
    assert.equal(t.matches.filter(m => !m.bye).length, n - 1);
    const r0 = t.matches.filter(m => m.round === 0).flatMap(m => [m.homeId, m.awayId]).filter(Boolean);
    assert.equal(new Set(r0).size, n); assert.equal(r0.length, n);
    for (const m of t.matches) if (m.homeId && m.awayId) assert.notEqual(m.homeId, m.awayId);
    valid(t);
    t = E.confirmDraw(t);
    t = playAllKnockout(t);
    valid(t);
    assert.equal(t.status, 'finished');
    assert.ok(t.playerIds.includes(t.championId));
    assert.equal(t.championId, 'p0', 'el jugador con menor índice gana siempre');
  });
}
test('nombres de ronda según tamaño', () => {
  const t = E.generateDraw(make(16, FORMATS.KNOCKOUT));
  assert.deepEqual([...new Set(t.matches.map(m => m.roundName))], ['Octavos de final', 'Cuartos de final', 'Semifinales', 'Final']);
  const t32 = E.generateDraw(make(20, FORMATS.KNOCKOUT));
  assert.deepEqual([...new Set(t32.matches.map(m => m.roundName))], ['Dieciseisavos de final', 'Octavos de final', 'Cuartos de final', 'Semifinales', 'Final']);
  const t4 = E.generateDraw(make(4, FORMATS.KNOCKOUT));
  assert.deepEqual([...new Set(t4.matches.map(m => m.roundName))], ['Semifinales', 'Final']);
});
test('los byes se reparten aleatoriamente (n=5, 400 sorteos)', () => {
  const base = make(5, FORMATS.KNOCKOUT), got = {};
  for (let i = 0; i < 400; i++) for (const m of E.generateDraw(base).matches.filter(x => x.bye)) got[m.winnerId] = (got[m.winnerId] ?? 0) + 1;
  for (const p of ids(5)) { const f = (got[p] ?? 0) / 400; assert.ok(f > 0.4 && f < 0.8, `${p} recibe bye con frecuencia ${f}`); }
});
test('un bye avanza sin marcador ficticio', () => {
  const t = E.generateDraw(make(5, FORMATS.KNOCKOUT));
  const bye = t.matches.find(m => m.bye);
  assert.equal(bye.homeGoals, null);
  const nx = t.matches.find(m => m.id === `k-1-${Math.floor(bye.index / 2)}`);
  assert.ok([nx.homeId, nx.awayId].includes(bye.winnerId));
});
test('no se puede registrar resultado de un bye ni de un partido sin participantes', () => {
  const t = E.confirmDraw(E.generateDraw(make(6, FORMATS.KNOCKOUT)));
  throwsCode(() => E.recordResult(t, t.matches.find(m => m.bye).id, { status: 'done', homeGoals: 1, awayGoals: 0 }), 'BYE');
  throwsCode(() => E.recordResult(t, 'k-2-0', { status: 'done', homeGoals: 1, awayGoals: 0 }), 'PENDING_PARTICIPANTS');
  throwsCode(() => E.recordResult(t, 'nope', { status: 'done', homeGoals: 1, awayGoals: 0 }), 'NO_MATCH');
});

section('Todos contra todos');
for (const n of [4, 5, 6, 8]) {
  test(`${n} jugadores: cada pareja una vez, N-1 partidos por jugador${n % 2 ? ', un descanso cada uno' : ''}`, () => {
    const t = E.generateDraw(make(n, FORMATS.ROUND_ROBIN));
    assert.equal(t.matches.length, n * (n - 1) / 2);
    const pairs = new Set(t.matches.map(m => [m.homeId, m.awayId].sort().join('|')));
    assert.equal(pairs.size, t.matches.length);
    for (const p of ids(n)) assert.equal(t.matches.filter(m => m.homeId === p || m.awayId === p).length, n - 1);
    const g = t.groups[0];
    assert.equal(g.rounds.length, n % 2 ? n : n - 1);
    if (n % 2) {
      const rests = g.rounds.map(r => r.restId);
      assert.equal(new Set(rests).size, n);
      for (const r of g.rounds) assert.ok(r.restId);
    }
    for (const r of g.rounds) { // nadie juega dos veces en una jornada
      const players = r.matchIds.flatMap(id => { const m = t.matches.find(x => x.id === id); return [m.homeId, m.awayId]; });
      assert.equal(new Set(players).size, players.length);
    }
    valid(t);
  });
}
test('liguilla completa: clasificación, campeón y empates permitidos', () => {
  let t = started(4, FORMATS.ROUND_ROBIN);
  for (const m of t.matches) t = lowWins(t, m);
  const st = computeStandings(t, 'RR');
  assert.deepEqual(st.map(r => r.playerId), ['p0', 'p1', 'p2', 'p3']);
  assert.deepEqual(st.map(r => r.pts), [9, 6, 3, 0]);
  assert.equal(t.status, 'finished'); assert.equal(t.championId, 'p0');
  valid(t);
  let u = started(4, FORMATS.ROUND_ROBIN);
  u = E.recordResult(u, u.matches[0].id, { status: 'done', homeGoals: 1, awayGoals: 1 });
  assert.equal(u.matches[0].winnerId, null);
  const row = computeStandings(u, 'RR').find(r => r.playerId === u.matches[0].homeId);
  assert.equal(row.drawn, 1); assert.equal(row.pts, 1);
});
test('los partidos pendientes no afectan a la clasificación', () => {
  let t = started(4, FORMATS.ROUND_ROBIN);
  t = E.recordResult(t, t.matches[0].id, { status: 'live', homeGoals: 3, awayGoals: 0 });
  assert.ok(computeStandings(t, 'RR').every(r => r.played === 0 && r.pts === 0));
});
test('criterios de desempate: diferencia, goles a favor y enfrentamiento directo', () => {
  const mk = (rules) => {
    let t = started(3, FORMATS.ROUND_ROBIN, rules);
    const get = (a, b) => t.matches.find(m => [m.homeId, m.awayId].sort().join() === [a, b].sort().join());
    // p0 y p1 empatan a puntos, DG y GF; p0 ganó el directo.
    const play = (a, b, ga, gb) => { const m = get(a, b); t = E.recordResult(t, m.id, { status: 'done', homeGoals: m.homeId === a ? ga : gb, awayGoals: m.homeId === a ? gb : ga }); };
    play('p0', 'p1', 1, 0); play('p1', 'p2', 2, 0); play('p2', 'p0', 1, 0);
    return t;
  };
  // Todos 3 pts. DG: p0 = 1-1=0, p1 = 2-1=+1, p2 = 1-2=-1  → p1, p0, p2
  assert.deepEqual(computeStandings(mk({}), 'RR').map(r => r.playerId), ['p1', 'p0', 'p2']);
  // Con enfrentamiento directo primero, en mini-liguilla de 3 empatada a puntos decide DG entre ellos → igual
  assert.equal(computeStandings(mk({ tiebreakers: ['points', 'goalsFor', 'goalDiff', 'headToHead'] }), 'RR')[0].playerId, 'p1');
});
test('enfrentamiento directo decide entre dos empatados', () => {
  let t = started(4, FORMATS.ROUND_ROBIN, { tiebreakers: ['points', 'headToHead', 'goalDiff', 'goalsFor'] });
  const get = (a, b) => t.matches.find(m => [m.homeId, m.awayId].sort().join() === [a, b].sort().join());
  const play = (a, b, ga, gb) => { const m = get(a, b); t = E.recordResult(t, m.id, { status: 'done', homeGoals: m.homeId === a ? ga : gb, awayGoals: m.homeId === a ? gb : ga }); };
  // p0 y p1 acaban con 6 pts; p1 con mejor DG, pero p0 ganó el directo
  play('p0', 'p1', 1, 0); play('p0', 'p2', 1, 0); play('p3', 'p0', 1, 0);
  play('p1', 'p2', 5, 0); play('p1', 'p3', 5, 0); play('p2', 'p3', 0, 0);
  const st = computeStandings(t, 'RR');
  assert.equal(st[0].pts, 6); assert.equal(st[1].pts, 6);
  assert.deepEqual(st.slice(0, 2).map(r => r.playerId), ['p0', 'p1']);
  const std = computeStandings({ ...t, rules: { ...t.rules, tiebreakers: ['points', 'goalDiff', 'goalsFor', 'headToHead'] } }, 'RR');
  assert.deepEqual(std.slice(0, 2).map(r => r.playerId), ['p1', 'p0']);
});

section('Fase de grupos + eliminatorias');
test('8 jugadores, 2 grupos, 2 clasificados: semifinales y final correctas', () => {
  let t = started(8, FORMATS.GROUPS);
  assert.equal(t.groups.length, 2);
  assert.ok(t.groups.every(g => g.playerIds.length === 4));
  assert.equal(t.matches.filter(m => m.stage === 'group').length, 12);
  assert.equal(E.groupSizeWarning(t), null);
  throwsCode(() => E.generateKnockoutStage(t), 'GROUPS_PENDING');
  for (const m of t.matches.filter(m => m.stage === 'group')) t = lowWins(t, m);
  const ko = t.matches.filter(m => m.stage === 'knockout');
  assert.equal(ko.length, 3);
  assert.deepEqual([...new Set(ko.map(m => m.roundName))], ['Semifinales', 'Final']);
  const [a, b] = t.groups.map(g => computeStandings(t, g.id));
  const semi = ko.filter(m => m.round === 0);
  const pairs = semi.map(m => [m.homeId, m.awayId].sort().join());
  assert.ok(pairs.includes([a[0].playerId, b[1].playerId].sort().join()), '1A vs 2B');
  assert.ok(pairs.includes([b[0].playerId, a[1].playerId].sort().join()), '1B vs 2A');
  assert.equal(t.knockoutProvisional, false);
  assert.deepEqual(new Set(semi.flatMap(m => [m.homeId, m.awayId])), new Set([a[0], a[1], b[0], b[1]].map(r => r.playerId)));
  valid(t);
  t = playAllKnockout(t);
  assert.equal(t.status, 'finished'); valid(t);
});
test('grupos desiguales (7 jugadores, 2 grupos) avisan y funcionan', () => {
  let t = started(7, FORMATS.GROUPS);
  assert.deepEqual(t.groups.map(g => g.playerIds.length).sort(), [3, 4]);
  assert.ok(E.groupSizeWarning(t));
  for (const m of t.matches.filter(m => m.stage === 'group')) t = lowWins(t, m);
  assert.equal(t.matches.filter(m => m.stage === 'knockout').length, 3);
  valid(t);
});
test('cuadro provisional: se genera, bloquea resultados y se rehace al terminar los grupos', () => {
  let t = started(8, FORMATS.GROUPS);
  t = E.generateKnockoutStage(t, { provisional: true });
  assert.equal(t.knockoutProvisional, true);
  valid(t);
  const ko = t.matches.find(m => m.stage === 'knockout' && m.round === 0);
  throwsCode(() => E.recordResult(t, ko.id, { status: 'done', homeGoals: 1, awayGoals: 0 }), 'PROVISIONAL');
  for (const m of t.matches.filter(m => m.stage === 'group')) t = lowWins(t, m);
  assert.equal(t.knockoutProvisional, false);
  valid(t);
});
test('editar un resultado de grupos que cambia clasificados exige confirmación', () => {
  let t = started(8, FORMATS.GROUPS);
  for (const m of t.matches.filter(m => m.stage === 'group')) t = lowWins(t, m);
  const semi = t.matches.find(m => m.stage === 'knockout' && m.round === 0);
  t = lowWins(t, semi);
  // Cambia un resultado de grupo para sacar al líder del grupo A
  const gA = t.groups[0], top = computeStandings(t, 'A')[0].playerId;
  const mm = t.matches.find(m => m.groupId === 'A' && (m.homeId === top || m.awayId === top) && m.status === 'done');
  const flip = { status: 'done', homeGoals: mm.homeId === top ? 0 : 9, awayGoals: mm.homeId === top ? 9 : 0 };
  let err; try { E.recordResult(t, mm.id, flip); } catch (e) { err = e; }
  if (err) {
    assert.equal(err.code, 'NEEDS_CONFIRMATION');
    const t2 = E.recordResult(t, mm.id, flip, { confirmInvalidate: true });
    valid(t2);
    assert.equal(t2.matches.filter(m => m.stage === 'knockout' && !m.bye && m.status === 'done').length, 0);
  } else assert.fail('se esperaba exigir confirmación');
  assert.equal(gA.id, 'A');
});
test('validación de configuración de grupos', () => {
  assert.ok(E.validateConfig({ name: 'x', competitionId: 'c', format: FORMATS.GROUPS, playerIds: ids(3) }).length);
  assert.ok(E.validateConfig({ name: 'x', competitionId: 'c', format: FORMATS.GROUPS, playerIds: ids(8), rules: { groupCount: 2, qualifiersPerGroup: 4 } }).length);
  assert.equal(E.validateConfig({ name: 'x', competitionId: 'c', format: FORMATS.GROUPS, playerIds: ids(8), rules: { groupCount: 2, qualifiersPerGroup: 2 } }).length, 0);
});

section('Asignación de equipos');
test('todos reciben un equipo distinto de la competición', () => {
  const pool = POOL.slice(0, 12);
  const t = E.assignTeams(E.createTournament({ name: 'x', competitionId: 'c', format: FORMATS.KNOCKOUT, playerIds: ids(8) }), pool);
  const teams = Object.values(t.assignments).map(a => a.teamId);
  assert.equal(teams.length, 8); assert.equal(new Set(teams).size, 8);
  assert.ok(teams.every(x => pool.includes(x)));
});
test('las asignaciones bloqueadas se conservan al volver a sortear', () => {
  let t = make(6, FORMATS.KNOCKOUT);
  t = E.toggleLock(t, 'p2'); t = E.toggleLock(t, 'p4');
  const keep = { p2: t.assignments.p2.teamId, p4: t.assignments.p4.teamId };
  for (let i = 0; i < 30; i++) {
    t = E.assignTeams(t, POOL.slice(0, 8));
    assert.equal(t.assignments.p2.teamId, keep.p2); assert.equal(t.assignments.p4.teamId, keep.p4);
    assert.equal(new Set(Object.values(t.assignments).map(a => a.teamId)).size, 6);
  }
});
test('no se sortea si faltan equipos y se indica cuántos', () => {
  const t = E.createTournament({ name: 'x', competitionId: 'c', format: FORMATS.KNOCKOUT, playerIds: ids(8) });
  assert.throws(() => E.assignTeams(t, POOL.slice(0, 5)), e => e.code === 'NOT_ENOUGH_TEAMS' && e.details.missing === 3 && /Faltan 3/.test(e.message));
});
test('sorteo individual respeta lo existente y no repite equipos', () => {
  let t = E.createTournament({ name: 'x', competitionId: 'c', format: FORMATS.KNOCKOUT, playerIds: ids(4) });
  const pool = POOL.slice(0, 4);
  for (const p of ids(4)) t = E.assignTeams(t, pool, { mode: 'single', playerId: p });
  assert.equal(new Set(Object.values(t.assignments).map(a => a.teamId)).size, 4);
  throwsCode(() => E.assignTeams(t, pool, { mode: 'single', playerId: 'p0' }), 'HAS_TEAM');
  let t2 = E.createTournament({ name: 'x', competitionId: 'c', format: FORMATS.KNOCKOUT, playerIds: ids(3) });
  const small = POOL.slice(0, 2);
  t2 = E.assignTeams(t2, small, { mode: 'single', playerId: 'p0' }); t2 = E.assignTeams(t2, small, { mode: 'single', playerId: 'p1' });
  throwsCode(() => E.assignTeams(t2, small, { mode: 'single', playerId: 'p2' }), 'NOT_ENOUGH_TEAMS');
});
test('no se sortean enfrentamientos sin equipos ni con pocos jugadores', () => {
  const t = E.createTournament({ name: 'x', competitionId: 'c', format: FORMATS.KNOCKOUT, playerIds: ids(4) });
  throwsCode(() => E.generateDraw(t), 'MISSING_TEAMS');
  assert.ok(E.validateConfig({ name: 'x', competitionId: 'c', format: FORMATS.KNOCKOUT, playerIds: ids(2) }).length);
});
test('los equipos no cambian tras iniciar el torneo', () => {
  const t = started(4, FORMATS.KNOCKOUT);
  throwsCode(() => E.assignTeams(t, POOL), 'LOCKED');
  throwsCode(() => E.generateDraw(t), 'LOCKED');
});

section('Resultados, desempates y propagación');
test('validación de goles', () => {
  const t = started(4, FORMATS.ROUND_ROBIN), id = t.matches[0].id;
  for (const bad of [-1, 1.5, 'a', null, undefined]) throwsCode(() => E.recordResult(t, id, { status: 'done', homeGoals: bad, awayGoals: 0 }), 'BAD_GOALS');
  assert.doesNotThrow(() => E.recordResult(t, id, { status: 'done', homeGoals: '2', awayGoals: '1' }));
});
test('no se registran resultados antes de confirmar el sorteo', () => {
  const t = E.generateDraw(make(4, FORMATS.KNOCKOUT));
  throwsCode(() => E.recordResult(t, t.matches[0].id, { status: 'done', homeGoals: 1, awayGoals: 0 }), 'NOT_STARTED');
});
test('empate en eliminación directa exige desempate; penaltis y manual', () => {
  let t = started(4, FORMATS.KNOCKOUT);
  const m = t.matches.find(x => x.round === 0);
  throwsCode(() => E.recordResult(t, m.id, { status: 'done', homeGoals: 1, awayGoals: 1 }), 'NEEDS_TIEBREAK');
  throwsCode(() => E.recordResult(t, m.id, { status: 'done', homeGoals: 1, awayGoals: 1, tiebreak: { method: 'pens', homePens: 3, awayPens: 3 } }), 'BAD_TIEBREAK');
  const t1 = E.recordResult(t, m.id, { status: 'done', homeGoals: 1, awayGoals: 1, tiebreak: { method: 'pens', homePens: 3, awayPens: 4 } });
  assert.equal(t1.matches.find(x => x.id === m.id).winnerId, m.awayId);
  assert.equal(t1.matches.find(x => x.id === m.id).tiebreak.method, 'pens');
  valid(t1);
  const t2 = E.recordResult(t, m.id, { status: 'done', homeGoals: 0, awayGoals: 0, tiebreak: { method: 'manual', winnerId: m.homeId } });
  assert.equal(t2.matches.find(x => x.id === m.id).winnerId, m.homeId); valid(t2);
  throwsCode(() => E.recordResult(t, m.id, { status: 'done', homeGoals: 0, awayGoals: 0, tiebreak: { method: 'manual', winnerId: 'p99' } }), 'BAD_TIEBREAK');
  const t3 = E.recordResult(t, m.id, { status: 'done', homeGoals: 2, awayGoals: 2, tiebreak: { method: 'extra-time-pens', homePens: 5, awayPens: 4 } });
  assert.equal(t3.matches.find(x => x.id === m.id).winnerId, m.homeId);
});
test('cambiar el ganador de un partido con resultados posteriores exige confirmación y los invalida', () => {
  let t = started(8, FORMATS.KNOCKOUT);
  t = playAllKnockout(t);
  assert.equal(t.championId, 'p0');
  const q = t.matches.find(m => m.round === 0 && [m.homeId, m.awayId].includes('p0'));
  const flip = { status: 'done', homeGoals: q.homeId === 'p0' ? 0 : 3, awayGoals: q.homeId === 'p0' ? 3 : 0 };
  let err; try { E.recordResult(t, q.id, flip); } catch (e) { err = e; }
  assert.equal(err.code, 'NEEDS_CONFIRMATION');
  assert.ok(err.details.matchIds.length >= 2);
  const t2 = E.recordResult(t, q.id, flip, { confirmInvalidate: true });
  valid(t2);
  assert.equal(t2.championId, null); assert.equal(t2.status, 'in-progress');
  assert.ok(!t2.matches.some(m => m.round > 0 && m.status === 'done' && m.homeId === 'p0' && m.awayId === null));
  const p0Next = t2.matches.find(m => m.round === 1 && (m.homeId === q.homeId || m.awayId === q.homeId || m.homeId === q.awayId || m.awayId === q.awayId));
  assert.equal(p0Next.status, 'pending');
  const t3 = playAllKnockout(t2); valid(t3);
  assert.notEqual(t3.championId, 'p0');
  assert.equal(t3.status, 'finished');
});
test('cambiar solo el marcador (mismo ganador) no invalida nada', () => {
  let t = started(4, FORMATS.KNOCKOUT);
  t = playAllKnockout(t);
  const q = t.matches.find(m => m.round === 0 && !m.bye);
  const homeWon = q.winnerId === q.homeId;
  const t2 = E.recordResult(t, q.id, { status: 'done', homeGoals: q.homeGoals + (homeWon ? 5 : 0), awayGoals: q.awayGoals + (homeWon ? 0 : 5) });
  assert.equal(t2.championId, t.championId); valid(t2);
});
test('devolver un partido a pendiente propaga y limpia el cuadro', () => {
  let t = started(4, FORMATS.KNOCKOUT);
  const a = t.matches.find(m => m.id === 'k-0-0');
  t = lowWins(t, a);
  assert.ok(t.matches.find(m => m.id === 'k-1-0').homeId);
  t = E.recordResult(t, a.id, { status: 'pending' });
  assert.equal(t.matches.find(m => m.id === 'k-1-0').homeId, null);
  valid(t);
});
test('un partido en juego guarda marcador sin declarar ganador', () => {
  let t = started(4, FORMATS.KNOCKOUT);
  const a = t.matches.find(m => m.id === 'k-0-0');
  t = E.recordResult(t, a.id, { status: 'live', homeGoals: 1, awayGoals: 0 });
  assert.equal(t.matches.find(m => m.id === a.id).winnerId, null);
  assert.equal(t.matches.find(m => m.id === 'k-1-0').homeId, null);
  valid(t);
});
test('progreso del cuadro: campeón y eliminados', () => {
  let t = playAllKnockout(started(4, FORMATS.KNOCKOUT));
  const pr = knockoutProgress(t);
  assert.equal(pr[0].stage, 'champion'); assert.equal(pr[0].playerId, 'p0');
  assert.equal(pr.filter(r => r.stage === 'eliminated').length, 3);
});

section('Persistencia, exportación e importación');
test('el estado se reconstruye tras serializar (recarga) sin repetir sorteos', () => {
  let t = started(8, FORMATS.GROUPS);
  t = lowWins(t, t.matches[0]);
  const state = { ...createInitialState(), players: ids(8).map(id => ({ id, name: id, createdAt: 1 })), tournament: t };
  assert.deepEqual(validateState(state), []);
  const back = parseImport(JSON.stringify(state));
  assert.deepEqual(back.tournament.matches, t.matches);
  assert.deepEqual(back.tournament.groups, t.groups);
  assert.deepEqual(back.tournament.assignments, t.assignments);
});
test('JSON inválido y datos corruptos se rechazan', () => {
  assert.throws(() => parseImport('{no json'), /JSON/);
  assert.throws(() => parseImport('[]'));
  assert.throws(() => parseImport(JSON.stringify({ schemaVersion: 99, players: [], history: [] })), /esquema/);
  assert.throws(() => parseImport(JSON.stringify({ schemaVersion: 1, players: 'x', history: [] })));
});
test('la importación no permite estados imposibles', () => {
  const t = playAllKnockout(started(4, FORMATS.KNOCKOUT));
  const players = ids(4).map(id => ({ id, name: id, createdAt: 1 }));
  const base = () => ({ ...createInitialState(), players, tournament: structuredClone(t) });
  const bad = [
    s => { s.tournament.matches.find(m => !m.bye).winnerId = 'p3'; },                       // ganador ≠ marcador
    s => { const m = s.tournament.matches.find(m => !m.bye); m.awayId = m.homeId; },        // contra sí mismo
    s => { s.tournament.assignments.p0.teamId = s.tournament.assignments.p1.teamId; },      // equipo repetido
    s => { s.tournament.matches.push({ ...s.tournament.matches[0] }); },                    // id de partido duplicado
    s => { s.tournament.championId = 'p3'; },                                               // campeón falso
    s => { s.tournament.matches.find(m => m.round === 1).homeId = 'p3'; },                  // eliminado reaparece
    s => { s.tournament.matches[0].homeGoals = -2; },                                       // goles inválidos
    s => { s.tournament.playerIds.push('ghost'); }                                          // jugador inexistente
  ];
  assert.deepEqual(validateState(base()), []);
  bad.forEach((mut, i) => { const s = base(); mut(s); assert.ok(validateState(s).length > 0, `caso ${i} no fue detectado`); });
});
test('localStorage: guardar, recuperar y tolerar datos corruptos', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const { save, load, lastLoadError } = await import('../js/storage.js');
  const state = { ...createInitialState(), players: [{ id: 'a', name: 'Ana', createdAt: 1 }] };
  assert.ok(save(state));
  assert.deepEqual(load(), state);
  store.set('fifa-tournament-manager:v1', '{corrupto');
  assert.deepEqual(load(), createInitialState());
  assert.ok(store.has('fifa-tournament-manager:v1:corrupt-backup'));
  const mod = await import('../js/storage.js');
  assert.ok(mod.lastLoadError);
  delete globalThis.localStorage;
});
test('actualizar la configuración antes del sorteo y bloquearla después', () => {
  let t = E.createTournament({ name: 'a', competitionId: 'c', format: FORMATS.KNOCKOUT, playerIds: ids(4) });
  t = E.assignTeams(t, POOL);
  t = E.updateConfig(t, { name: 'b', competitionId: 'c', format: FORMATS.ROUND_ROBIN, playerIds: ids(3) });
  assert.equal(Object.keys(t.assignments).length, 3);
  const t2 = E.updateConfig(t, { name: 'b', competitionId: 'otra', format: FORMATS.ROUND_ROBIN, playerIds: ids(3) });
  assert.equal(Object.keys(t2.assignments).length, 0);
  const d = E.generateDraw(t);
  throwsCode(() => E.updateConfig(d, { name: 'c', competitionId: 'c', format: FORMATS.KNOCKOUT, playerIds: ids(4) }), 'LOCKED');
  const back = E.discardDraw(d);
  assert.equal(back.status, 'draft'); assert.equal(back.matches.length, 0);
});
test('historial: entrada con campeón y estadísticas', () => {
  const t = playAllKnockout(started(4, FORMATS.KNOCKOUT));
  const h = E.buildHistoryEntry(t, ids(4).map(id => ({ id, name: 'N' + id })), id => 'Equipo ' + id);
  assert.equal(h.championName, 'Np0'); assert.equal(h.participants.length, 4);
  assert.equal(E.playerHistory([h], 'p0').length, 1);
  const s = { ...createInitialState(), history: [h] };
  assert.deepEqual(validateState(s), []);
});


section('Catálogo (FootyLogos)');
import fs from 'node:fs';
import { setCatalog, getTeam, getTeamsByCompetition, getCompetitions } from '../js/teams.js';
const COMPS = JSON.parse(fs.readFileSync(new URL('../data/competitions.json', import.meta.url))).competitions;
const TEAMS = JSON.parse(fs.readFileSync(new URL('../data/teams.json', import.meta.url))).teams;
setCatalog(COMPS, TEAMS);
test('las 10 competiciones pedidas con el número de equipos esperado', () => {
  const n = Object.fromEntries(getCompetitions().map(c => [c.id, getTeamsByCompetition(c.id).length]));
  assert.deepEqual(n, { 'world-cup': 48, 'national-teams': 51, ucl: 36, uel: 36, libertadores: 32, laliga: 20, 'premier-league': 20, bundesliga: 18, 'serie-a': 20, 'ligue-1': 18, mls: 30 });
});
test('todos los equipos usan un logo https de FootyLogos (o bandera de flagcdn)', () => {
  for (const c of getCompetitions()) for (const t of getTeamsByCompetition(c.id)) {
    if (t.id.startsWith('flag-')) { assert.match(t.imageUrl, /^https:\/\/flagcdn\.com\/w320\/[a-z-]+\.png$/, t.id); continue; }
    assert.match(t.imageUrl, /^https:\/\/assets\.footylogos\.com\/previews\/([a-z0-9-]+)\/\1-logo-footylogos-320\.webp$/, t.id); }
});
test('un equipo en varias competiciones es el mismo (Real Madrid: LaLiga y Champions)', () => {
  const rm = getTeam('real-madrid');
  assert.deepEqual(rm.competitionIds.sort(), ['laliga', 'ucl']);
});
test('los ids antiguos de torneos guardados siguen resolviéndose', () => {
  assert.equal(getTeam('nt-argentina').id, 'argentina-national-team');
  assert.equal(getTeam('club-real-madrid').id, 'real-madrid');
  assert.equal(getTeam('nt-italia').id, 'flag-it');
  assert.equal(getTeam('nt-chile').id, 'flag-cl');
  assert.equal(getTeam('nt-costa-rica').legacy, true);
});
test('disponibilidad en EA FC 27 por competición', () => {
  const avail = c => getTeamsByCompetition(c, { onlyInGame: true }).length;
  assert.deepEqual(Object.fromEntries(getCompetitions().map(c => [c.id, avail(c.id)])),
    { 'world-cup': 32, 'national-teams': 51, ucl: 34, uel: 30, libertadores: 6, laliga: 20, 'premier-league': 20, bundesliga: 18, 'serie-a': 20, 'ligue-1': 18, mls: 30 });
});
test('equipos concretos: no disponibles y con nombre genérico', () => {
  assert.equal(getTeam('canada-national-team').games.fc27, 'no');
  assert.equal(getTeam('ecuador-national-team').games.fc27, 'no');
  assert.equal(getTeam('brazil-national-team').games.fc27, 'yes');
  assert.equal(getTeam('flamengo').games.fc27, 'no');
  assert.equal(getTeam('boca-juniors').games.fc27, 'yes');
  assert.equal(getTeam('inter-milan').inGameName, 'Lombardia FC');
  assert.equal(getTeam('juventus').games.fc27, 'yes');
});
test('torneo con filtro de juego: solo se sortean equipos disponibles', () => {
  const pool = getTeamsByCompetition('ucl', { onlyInGame: true }).map(t => t.id);
  assert.ok(!pool.includes('sabah-fk') && !pool.includes('sk-slovan-bratislava'));
  let t = E.createTournament({ name: 'x', competitionId: 'ucl', format: FORMATS.KNOCKOUT, playerIds: ids(8) });
  assert.equal(t.onlyInGame, true);
  t = E.assignTeams(t, pool);
  assert.ok(Object.values(t.assignments).every(a => pool.includes(a.teamId)));
  const t2 = E.createTournament({ name: 'x', competitionId: 'ucl', format: FORMATS.KNOCKOUT, playerIds: ids(8), onlyInGame: false });
  assert.equal(t2.onlyInGame, false);
});
test('resumen de texto del torneo', async () => {
  const { summaryText } = await import('../js/share.js');
  let t = started(4, FORMATS.ROUND_ROBIN);
  t = lowWins(t, t.matches[0]);
  const txt = summaryText(t, { players: ids(4).map(id => ({ id, name: 'Jug ' + id })) });
  assert.match(txt, /Liguilla|Todos contra todos/); assert.match(txt, /pts/);
  const k = playAllKnockout(started(4, FORMATS.KNOCKOUT));
  assert.match(summaryText(k, { players: ids(4).map(id => ({ id, name: 'Jug ' + id })) }), /Campeón: Jug p0/);
});

console.log(`\n${passed} pruebas correctas, ${failed} con fallos`);
process.exit(failed ? 1 : 0);
