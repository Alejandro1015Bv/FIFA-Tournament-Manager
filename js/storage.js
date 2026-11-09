import { createInitialState } from './state.js';
import { validateState } from './validation.js';
import { shareFile } from './native.js';

const KEY = 'fifa-tournament-manager:v1';
export let lastLoadError = null;

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch (e) { console.error('No se pudo guardar', e); return false; }
}

export function load() {
  lastLoadError = null;
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    const errors = validateState(parsed);
    if (errors.length) throw new Error(errors[0]);
    return parsed;
  } catch (e) {
    console.error('Datos guardados corruptos', e);
    lastLoadError = e.message;
    try { if (raw) localStorage.setItem(KEY + ':corrupt-backup', raw); } catch { /* sin espacio: se ignora */ }
    return createInitialState();
  }
}

export { validateState as validate };

export async function exportJSON(state) {
  const name = `fifa-tournament-${new Date().toISOString().slice(0, 10)}.json`;
  if (await shareFile(name, JSON.stringify(state, null, 2), 'Copia de seguridad')) return;   // Android: menú Compartir
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: name
  });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('El archivo no es un JSON válido.'); }
  const errors = validateState(data);
  if (errors.length) throw new Error(errors[0]);
  return data;
}
export async function importJSON(file) { return parseImport(await file.text()); }
