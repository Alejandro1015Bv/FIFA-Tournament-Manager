// Resumen del torneo en texto plano para pegar en WhatsApp/Telegram.
import { FORMAT_LABELS, STATUS_LABELS } from './state.js';
import { computeStandings, knockoutProgress } from './standings.js';
import { getTeam } from './teams.js';
import { toast } from './ui.js';
import { shareText } from './native.js';

export function summaryText(t, state) {
  const name = id => state.players.find(p => p.id === id)?.name ?? '—';
  const team = id => getTeam(t.assignments[id]?.teamId)?.name ?? 'Sin equipo';
  const who = id => `${name(id)} (${team(id)})`;
  const out = [`🏆 ${t.name}`, `${FORMAT_LABELS[t.format]} · ${STATUS_LABELS[t.status]}`];
  if (t.championId) out.push(`👑 Campeón: ${who(t.championId)}`);
  for (const g of t.groups) {
    const rows = computeStandings(t, g.id);
    if (!rows.some(r => r.played)) continue;
    out.push('', `📊 ${g.name}`);
    rows.forEach(r => out.push(`${r.position}. ${who(r.playerId)} — ${r.pts} pts (${r.won}G ${r.drawn}E ${r.lost}P, DG ${r.gd > 0 ? '+' : ''}${r.gd})`));
  }
  const ko = t.matches.filter(m => m.stage === 'knockout' && !m.bye);
  if (ko.length) {
    const rounds = [...new Set(ko.map(m => m.round))].sort((a, b) => a - b);
    for (const r of rounds) {
      const ms = ko.filter(m => m.round === r && m.homeId && m.awayId);
      if (!ms.length) continue;
      out.push('', `⚔️ ${ms[0].roundName}`);
      for (const m of ms) {
        const pens = m.tiebreak?.homePens !== undefined ? ` (pen. ${m.tiebreak.homePens}-${m.tiebreak.awayPens})` : '';
        out.push(m.status === 'done' ? `${name(m.homeId)} ${m.homeGoals}-${m.awayGoals} ${name(m.awayId)}${pens}` : `${name(m.homeId)} vs ${name(m.awayId)}`);
      }
    }
    if (!t.championId) { const alive = knockoutProgress(t).filter(r => r.stage === 'active'); if (alive.length) out.push('', `En carrera: ${alive.map(r => name(r.playerId)).join(', ')}`); }
  }
  return out.join('\n');
}

export async function copySummary(t, state) {
  const text = summaryText(t, state);
  if (await shareText(text, t.name)) return;
  try { await navigator.clipboard.writeText(text); toast('Resumen copiado al portapapeles', 'ok'); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select();
    const ok = document.execCommand?.('copy'); ta.remove();
    toast(ok ? 'Resumen copiado al portapapeles' : 'No se pudo copiar. Selecciona y copia el texto manualmente.', ok ? 'ok' : 'error');
  }
}
