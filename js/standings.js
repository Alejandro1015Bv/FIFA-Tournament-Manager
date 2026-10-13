// Clasificación derivada exclusivamente de partidos finalizados y válidos.
const blank = id => ({ playerId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 });

export function tally(ids, matches, rules) {
  const rows = new Map(ids.map(id => [id, blank(id)]));
  for (const m of matches) {
    if (m.bye || m.status !== 'done') continue;
    const h = rows.get(m.homeId), a = rows.get(m.awayId);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.homeGoals; h.ga += m.awayGoals;
    a.gf += m.awayGoals; a.ga += m.homeGoals;
    if (m.winnerId === m.homeId) { h.won++; a.lost++; h.pts += rules.win; a.pts += rules.loss; }
    else if (m.winnerId === m.awayId) { a.won++; h.lost++; a.pts += rules.win; h.pts += rules.loss; }
    else { h.drawn++; a.drawn++; h.pts += rules.draw; a.pts += rules.draw; }
  }
  rows.forEach(r => { r.gd = r.gf - r.ga; });
  return [...rows.values()];
}

const KEYS = { points: r => r.pts, goalDiff: r => r.gd, goalsFor: r => r.gf };

function splitTies(sorted, keyFn) {
  const groups = [];
  for (const r of sorted) {
    const last = groups[groups.length - 1];
    if (last && keyFn(last[0]) === keyFn(r)) last.push(r); else groups.push([r]);
  }
  return groups;
}

// Aplica los criterios en orden; los empatados pasan al siguiente criterio.
// El enfrentamiento directo se calcula solo entre los jugadores empatados.
// Si todo empata, decide un sorteo guardado al crear el calendario (determinista tras recargar).
function rank(rows, criteria, ctx) {
  if (rows.length < 2) return rows;
  if (!criteria.length) {
    return [...rows]
      .sort((a, b) => (ctx.lots[b.playerId] ?? 0) - (ctx.lots[a.playerId] ?? 0) || (a.playerId < b.playerId ? -1 : 1))
      .map(r => ({ ...r, byLot: true }));
  }
  const [c, ...rest] = criteria;
  if (c === 'headToHead') {
    const ids = rows.map(r => r.playerId);
    const set = new Set(ids);
    const sub = new Map(tally(ids, ctx.matches.filter(m => set.has(m.homeId) && set.has(m.awayId)), ctx.rules).map(r => [r.playerId, r]));
    const key = r => { const s = sub.get(r.playerId); return `${s.pts}|${s.gd}|${s.gf}`; };
    const sorted = [...rows].sort((a, b) => {
      const x = sub.get(a.playerId), y = sub.get(b.playerId);
      return y.pts - x.pts || y.gd - x.gd || y.gf - x.gf;
    });
    return splitTies(sorted, key).flatMap(g => g.length === rows.length ? rank(g, rest, ctx) : rank(g, criteria, ctx));
  }
  const fn = KEYS[c];
  if (!fn) return rank(rows, rest, ctx);
  const sorted = [...rows].sort((a, b) => fn(b) - fn(a));
  return splitTies(sorted, fn).flatMap(g => rank(g, rest, ctx));
}

export function computeStandings(t, groupId = null) {
  const g = groupId ? t.groups.find(x => x.id === groupId) : null;
  const ids = g ? g.playerIds : t.playerIds;
  const matches = t.matches.filter(m => m.stage === 'group' && (!g || m.groupId === g.id) && m.status === 'done' && !m.bye);
  const rows = tally(ids, matches, t.rules);
  return rank(rows, t.rules.tiebreakers, { matches, rules: t.rules, lots: t.lots ?? {} })
    .map((r, i) => ({ ...r, position: i + 1 }));
}

// Estadísticas de un jugador en todos los partidos finalizados (grupos y eliminatorias).
export function computePlayerStats(t, playerId) {
  const mine = t.matches.filter(m => m.homeId === playerId || m.awayId === playerId);
  return tally(t.playerIds, mine, t.rules).find(r => r.playerId === playerId) ?? blank(playerId);
}

// Progreso en el cuadro eliminatorio.
export function knockoutProgress(t) {
  const ko = t.matches.filter(m => m.stage === 'knockout');
  if (!ko.length) return [];
  const ids = [...new Set(ko.flatMap(m => [m.homeId, m.awayId]).filter(Boolean))];
  const rows = ids.map(id => {
    const mine = ko.filter(m => m.homeId === id || m.awayId === id);
    const reached = Math.max(...mine.map(m => m.round));
    const lost = mine.find(m => !m.bye && m.status === 'done' && m.winnerId && m.winnerId !== id);
    const stage = t.championId === id ? 'champion' : lost ? 'eliminated' : 'active';
    const roundName = mine.find(m => m.round === reached)?.roundName ?? '';
    return { playerId: id, reached, roundName, stage, eliminatedIn: lost?.roundName ?? null, stats: computePlayerStats(t, id) };
  });
  const order = { champion: 0, active: 1, eliminated: 2 };
  return rows.sort((a, b) =>
    order[a.stage] - order[b.stage] || b.reached - a.reached || b.stats.gd - a.stats.gd || b.stats.gf - a.stats.gf);
}
