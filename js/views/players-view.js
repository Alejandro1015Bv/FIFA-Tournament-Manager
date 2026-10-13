import { h, promptDialog, confirmDialog, toast, shortId, fmtDate } from '../ui.js';
import { getState } from '../state.js';
import { addPlayer, renamePlayer, removePlayer, hasDuplicateName, validateName } from '../players.js';
import { computePlayerStats } from '../standings.js';
import { playerHistory } from '../tournament-engine.js';
import { teamBadge } from '../teams.js';
import { teamOfPlayer } from './shared.js';
import { rerender } from '../ui.js';

const open = new Set();   // jugadores con el historial desplegado

async function onAdd(input) {
  try {
    const name = validateName(input.value);
    if (hasDuplicateName(name) && !await confirmDialog({ title: 'Nombre repetido', confirmText: 'Añadir igualmente',
      message: `Ya existe un jugador llamado «${name}». Se creará otro con un identificador distinto. ¿Continuar?` })) return;
    addPlayer(name); input.value = '';
  } catch (e) { toast(e.message, 'error'); }
}

export function render(container) {
  const state = getState(), t = state.tournament;
  const input = h('input', { type: 'text', maxlength: 30, placeholder: 'Nombre o apodo', 'aria-label': 'Nombre del jugador' });
  container.append(h('form', { class: 'card inline-form', onSubmit: e => { e.preventDefault(); onAdd(input); } },
    input, h('button', { class: 'btn', type: 'submit' }, 'Añadir jugador')));
  if (!state.players.length) { container.append(h('div', { class: 'card empty' }, h('p', { class: 'muted' }, 'Aún no hay jugadores. Añade al menos 3 para crear un torneo.'))); return; }

  container.append(h('div', { class: 'grid players' }, state.players.map(p => {
    const hist = playerHistory(state.history, p.id);
    const titles = hist.filter(x => x.championId === p.id).length + (t?.championId === p.id ? 1 : 0);
    const inT = t?.playerIds.includes(p.id);
    const team = t ? teamOfPlayer(t, p.id) : null;
    const s = inT && t.matches.length ? computePlayerStats(t, p.id) : null;
    return h('article', { class: 'card player' },
      h('header', {}, h('div', { class: 'avatar' }, p.name[0].toUpperCase()),
        h('div', {}, h('strong', {}, p.name), h('small', { class: 'muted' }, ` #${shortId(p.id)}`))),
      h('p', { class: 'muted' }, `Torneos: ${hist.length + (inT ? 1 : 0)} · Títulos: ${titles}`),
      inT ? h('div', { class: 'row-center' }, h('span', { class: 'status live' }, 'Participa en el torneo actual'),
        team ? h('span', { class: 'who' }, teamBadge(team, { size: 24 }), h('span', {}, team.name)) : null) : null,
      s ? h('p', { class: 'stats-line' }, `PJ ${s.played} · G ${s.won} · E ${s.drawn} · P ${s.lost} · GF ${s.gf} · GC ${s.ga}`) : null,
      open.has(p.id) ? h('ul', { class: 'hist-list' }, hist.length ? hist.map(x => {
        const me = x.participants.find(q => q.playerId === p.id);
        return h('li', {}, `${x.name} (${fmtDate(x.finishedAt)}) — ${me.teamName}, ${me.stats.won}G ${me.stats.drawn}E ${me.stats.lost}P${x.championId === p.id ? ' 🏆' : ''}`);
      }) : h('li', { class: 'muted' }, 'Sin torneos archivados.')) : null,
      h('footer', { class: 'actions' },
        h('button', { class: 'btn small secondary', type: 'button', onClick: () => { open.has(p.id) ? open.delete(p.id) : open.add(p.id); rerender(); } }, open.has(p.id) ? 'Ocultar historial' : 'Historial'),
        h('button', { class: 'btn small secondary', type: 'button', onClick: async () => {
          const name = await promptDialog({ title: 'Editar jugador', label: 'Nombre', value: p.name });
          if (name === null) return;
          try {
            if (hasDuplicateName(name, p.id) && !await confirmDialog({ title: 'Nombre repetido', message: `Ya existe otro jugador llamado «${name.trim()}». ¿Usar el mismo nombre?`, confirmText: 'Usarlo' })) return;
            renamePlayer(p.id, name);
          } catch (e) { toast(e.message, 'error'); }
        } }, 'Editar'),
        h('button', { class: 'btn small danger', type: 'button', onClick: async () => {
          if (!await confirmDialog({ title: 'Eliminar jugador', danger: true, confirmText: 'Eliminar', message: `¿Eliminar a «${p.name}»? Su historial archivado se conserva.` })) return;
          try { removePlayer(p.id); toast('Jugador eliminado', 'ok'); } catch (e) { toast(e.message, 'error'); }
        } }, 'Eliminar')));
  })));
}
