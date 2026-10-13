import { update, getState } from './state.js';
import { newId } from './randomizer.js';

const clean = name => String(name ?? '').trim().replace(/\s+/g, ' ');

export function validateName(name) {
  const n = clean(name);
  if (!n) throw new Error('El nombre no puede estar vacío.');
  if (n.length > 30) throw new Error('El nombre no puede superar 30 caracteres.');
  return n;
}
export function hasDuplicateName(name, exceptId = null) {
  const n = clean(name).toLowerCase();
  return getState().players.some(p => p.id !== exceptId && p.name.toLowerCase() === n);
}
export function addPlayer(name) {
  const n = validateName(name);
  update(s => { s.players.push({ id: newId('p'), name: n, createdAt: Date.now() }); });
}
export function renamePlayer(id, name) {
  const n = validateName(name);
  update(s => { const p = s.players.find(p => p.id === id); if (p) p.name = n; });
}
export function removePlayer(id) {
  const t = getState().tournament;
  if (t && t.playerIds.includes(id) && t.status !== 'draft') throw new Error('Este jugador participa en un torneo ya sorteado. Elimina o finaliza el torneo antes.');
  update(s => {
    s.players = s.players.filter(p => p.id !== id);
    if (s.tournament) {
      s.tournament.playerIds = s.tournament.playerIds.filter(p => p !== id);
      delete s.tournament.assignments[id];
    }
  });
}
