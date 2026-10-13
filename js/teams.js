let catalog = { competitions: [], teams: [] };
export let catalogError = null;

export function setCatalog(competitions, teams) { catalog = { competitions, teams }; catalogError = null; }
export async function loadCatalog() {
  try {
    const [c, t] = await Promise.all([
      fetch('data/competitions.json').then(r => { if (!r.ok) throw new Error('competitions.json'); return r.json(); }),
      fetch('data/teams.json').then(r => { if (!r.ok) throw new Error('teams.json'); return r.json(); })
    ]);
    setCatalog(c.competitions, t.teams);
  } catch (e) {
    catalogError = 'No se pudo cargar el catálogo de equipos. Abre la app con un servidor estático (Live Server o python3 -m http.server), no con file://.';
    console.error(catalogError, e);
  }
  return catalog;
}

export const getCompetitions = () => catalog.competitions;
export const getCompetition = id => catalog.competitions.find(c => c.id === id);
// Resuelve ids actuales y ids antiguos (aliases), para que los torneos guardados sigan mostrando su equipo.
export const getTeam = id => catalog.teams.find(t => t.id === id) ?? catalog.teams.find(t => t.aliases?.includes(id));
export const getTeamsByCompetition = compId =>
  (getCompetition(compId)?.teamIds ?? []).map(getTeam).filter(Boolean);

// ---- imágenes: URL del catálogo → iniciales locales → escudo genérico
export function initialsOf(text) {
  const w = String(text || '?').replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 3)).toUpperCase();
}
export function initialsDataUri(text) {
  const str = String(text || '?');
  let hash = 0;
  for (const ch of str) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  const hue = hash % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 4 8 12v18c0 15 10 26 24 30 14-4 24-15 24-30V12L32 4z" fill="hsl(${hue} 45% 22%)" stroke="hsl(${hue} 70% 60%)" stroke-width="3"/><text x="32" y="38" text-anchor="middle" font-family="system-ui,sans-serif" font-size="17" font-weight="700" fill="#fff">${initialsOf(str).replace(/[<>&]/g, '')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const safeUrl = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };

export function teamBadge(team, { size = 32 } = {}) {
  const img = document.createElement('img');
  img.className = 'team-badge';
  img.width = img.height = size;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = team?.imageAlt ?? 'Sin equipo';
  let stage = 0;
  img.addEventListener('error', () => {
    stage++;
    img.src = stage === 1 && team ? initialsDataUri(team.shortName || team.name) : 'assets/images/fallback-team.svg';
  });
  img.src = !team ? 'assets/images/fallback-team.svg'
    : safeUrl(team.imageUrl) ? team.imageUrl : initialsDataUri(team.shortName || team.name);
  return img;
}
