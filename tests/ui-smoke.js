// Prueba de humo de la interfaz con jsdom: node tests/ui-smoke.js  (requiere `npm install`)
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const dom = new JSDOM(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/, ''), { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location, CustomEvent: dom.window.CustomEvent, Node: dom.window.Node });
globalThis.localStorage = dom.window.localStorage;
window.scrollTo = () => {};

const { setCatalog, getTeamsByCompetition } = await import('../js/teams.js');
const S = await import('../js/state.js');
const E = await import('../js/tournament-engine.js');
const { validateState } = await import('../js/validation.js');
const comps = JSON.parse(fs.readFileSync(new URL('../data/competitions.json', import.meta.url))).competitions;
const teams = JSON.parse(fs.readFileSync(new URL('../data/teams.json', import.meta.url))).teams;
setCatalog(comps, teams);

const views = {};
for (const n of ['home', 'players-view', 'teams-view', 'config-view', 'draw-view', 'schedule-view', 'standings-view', 'results-view', 'history-view'])
  views[n] = await import(`../js/views/${n}.js`);

let ok = 0;
const renderAll = label => {
  for (const [n, v] of Object.entries(views)) {
    const box = document.createElement('div');
    v.render(box);
    assert.ok(box.children.length > 0, `${label}: ${n} no renderiza nada`);
    assert.ok(!box.textContent.includes('undefined'), `${label}: ${n} contiene "undefined": ${box.textContent.slice(0, 200)}`);
    assert.ok(!box.textContent.includes('NaN'), `${label}: ${n} contiene NaN`);
  }
  ok++; console.log(`  ✓ ${label}`);
};

const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `Jugador ${i}`, createdAt: 1 }));
const base = () => ({ ...S.createInitialState(), players });
const mk = (format, n = 8, comp = 'laliga', rules = {}) => {
  let t = E.createTournament({ name: 'Copa', competitionId: comp, format, playerIds: players.slice(0, n).map(p => p.id), rules });
  return E.assignTeams(t, getTeamsByCompetition(comp).map(x => x.id));
};
const play = (t, pred = () => true) => {
  for (const m of t.matches.filter(x => !x.bye && x.status !== 'done' && x.homeId && x.awayId && pred(x)))
    t = E.recordResult(t, m.id, { status: 'done', homeGoals: 2, awayGoals: Number(m.homeId.slice(1)) % 2 });
  return t;
};

S.setState(base()); renderAll('sin torneo');
S.setState({ ...base(), tournament: mk('knockout') }); renderAll('borrador');
S.setState({ ...base(), tournament: E.generateDraw(mk('knockout', 6)) }); renderAll('KO sorteado (6, con byes)');
let t = E.confirmDraw(E.generateDraw(mk('knockout', 5))); S.setState({ ...base(), tournament: t }); renderAll('KO en curso');
t = play(play(play(t))); S.setState({ ...base(), tournament: t }); renderAll('KO terminado');
assert.equal(t.status, 'finished');
t = E.confirmDraw(E.generateDraw(mk('round-robin', 5))); S.setState({ ...base(), tournament: t }); renderAll('liguilla impar');
t = E.confirmDraw(E.generateDraw(mk('groups-knockout', 7))); S.setState({ ...base(), tournament: t }); renderAll('grupos desiguales');
t = E.generateKnockoutStage(t, { provisional: true }); S.setState({ ...base(), tournament: t }); renderAll('KO provisional');
t = play(t); S.setState({ ...base(), tournament: t }); renderAll('grupos terminados + cuadro');
t = play(play(t)); S.setState({ ...base(), tournament: t }); renderAll('torneo de grupos finalizado');
assert.equal(t.status, 'finished');
const s = { ...base(), tournament: t }; s.history = [E.buildHistoryEntry(t, players, id => 'X')];
S.setState(s); renderAll('con historial');
assert.deepEqual(validateState(S.getState()), []);

// Interacción: registrar un resultado desde el diálogo
{
  S.setState({ ...base(), tournament: E.confirmDraw(E.generateDraw(mk('round-robin', 4))) });
  const box = document.createElement('div'); document.body.append(box);
  views['results-view'].render(box);
  const btn = [...box.querySelectorAll('button')].find(b => b.textContent === 'Registrar resultado');
  assert.ok(btn, 'falta el botón Registrar resultado');
  btn.click();
  const dlg = document.querySelector('dialog'); assert.ok(dlg, 'no se abrió el diálogo');
  const nums = dlg.querySelectorAll('input[type=number]');
  nums[0].value = '3'; nums[1].value = '1';
  dlg.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  const done = S.getState().tournament.matches.filter(m => m.status === 'done');
  assert.equal(done.length, 1); assert.equal(done[0].homeGoals, 3);
  assert.equal(document.querySelector('dialog'), null, 'el diálogo debería cerrarse');
  ok++; console.log('  ✓ registrar resultado desde el diálogo');
}
// XSS: un nombre malicioso se muestra como texto
{
  const evil = '<img src=x onerror=alert(1)>';
  S.setState({ ...base(), players: [{ id: 'e', name: evil, createdAt: 1 }, ...players.slice(1)] });
  const box = document.createElement('div'); views['players-view'].render(box);
  assert.equal(box.querySelectorAll('img[src="x"]').length, 0);
  assert.ok(box.textContent.includes(evil));
  ok++; console.log('  ✓ los nombres se escapan (sin inyección HTML)');
}
console.log(`\n${ok} comprobaciones de interfaz correctas`);
process.exit(0);
