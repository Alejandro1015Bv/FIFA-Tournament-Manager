// Estado único de la aplicación. La UI se reconstruye siempre a partir de este estado.
export const SCHEMA_VERSION = 1;

export const FORMATS = { KNOCKOUT: 'knockout', ROUND_ROBIN: 'round-robin', GROUPS: 'groups-knockout' };
export const FORMAT_LABELS = {
  'knockout': 'Eliminación directa',
  'round-robin': 'Todos contra todos',
  'groups-knockout': 'Fase de grupos + eliminatorias'
};
export const TIEBREAK_PRESETS = {
  standard:   { label: 'Puntos › Dif. de goles › Goles a favor › Enfrentamiento directo', order: ['points', 'goalDiff', 'goalsFor', 'headToHead'] },
  h2hFirst:   { label: 'Puntos › Enfrentamiento directo › Dif. de goles › Goles a favor', order: ['points', 'headToHead', 'goalDiff', 'goalsFor'] },
  goalsFirst: { label: 'Puntos › Goles a favor › Dif. de goles › Enfrentamiento directo', order: ['points', 'goalsFor', 'goalDiff', 'headToHead'] }
};
export const KO_TIEBREAK_LABELS = {
  'extra-time-pens': 'Prórroga y penaltis',
  'pens': 'Penaltis directos',
  'manual': 'Ganador manual (decidido fuera de la app)'
};
export const DEFAULT_RULES = {
  win: 3, draw: 1, loss: 0,
  tiebreakers: [...TIEBREAK_PRESETS.standard.order],
  knockoutTiebreak: 'extra-time-pens',
  groupCount: 2,
  qualifiersPerGroup: 2
};
export const STATUS_LABELS = { draft: 'Configuración', drawn: 'Sorteo sin confirmar', 'in-progress': 'En curso', finished: 'Finalizado' };

export function createInitialState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    players: [],     // { id, name, createdAt }
    tournament: null,
    history: []      // torneos archivados
  };
}

let state = createInitialState();
const listeners = new Set();

export const getState = () => state;
export function setState(next) { state = next; listeners.forEach(fn => fn(state)); }
// Aplica un mutador sobre una copia; si lanza, el estado original no cambia.
export function update(mutator) { const draft = structuredClone(state); mutator(draft); setState(draft); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
