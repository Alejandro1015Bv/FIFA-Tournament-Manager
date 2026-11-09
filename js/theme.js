// Tema: 'auto' (sistema) · 'light' · 'dark'. Se guarda aparte de los datos del torneo.
const KEY = 'ftm:theme';
export const MODES = ['auto', 'light', 'dark'];
export const THEME_LABEL = { auto: 'Automático', light: 'Claro', dark: 'Oscuro' };
export function getTheme() { try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : 'auto'; } catch { return 'auto'; } }
export function applyTheme(mode = getTheme()) {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
  const dark = mode === 'dark' || (mode === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches !== false);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b111b' : '#f3f6fb');
  return mode;
}
export function setTheme(mode) { try { localStorage.setItem(KEY, mode); } catch { /* sin almacenamiento */ } return applyTheme(mode); }
export const nextTheme = mode => MODES[(MODES.indexOf(mode) + 1) % MODES.length];
