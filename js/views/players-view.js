import { h, btn, emptyState, promptDialog, confirmDialog, toast, shortId, fmtDate, rerender } from '../ui.js';
import { getState } from '../state.js';
import { addPlayer, renamePlayer, removePlayer, hasDuplicateName, validateName } from '../players.js';
import { computePlayerStats } from '../standings.js';
import { playerHistory } from '../tournament-engine.js';
import { teamBadge } from '../teams.js';
import { teamOfPlayer } from './shared.js';

const open = new Set();   // jugadores con el historial desplegado

async function onAdd(input) {
  try {
    const name = validateName(input.value);
    if (hasDuplicateName(name) && !await confirmDialog({ title: 'Nombre repetido', confirmText: 'Añadir igualmente', message: `Ya existe «${name}». ¿Añadir otro con el mismo nombre?` })) return;
    addPlayer(name); toast(`${name} añadido`, 'ok');
  } catch (e) { input.setAttribute('aria-invalid', 'true'); toast(e.message, 'error'); }
}

export function render(container) {
  const state = getState(), t = state.tournament;
  const input = h('input', { type: 'text', maxlength: 30, placeholder: 'Nombre o apodo', autocomplete: 'off', 'aria-label': 'Nombre del jugador', onInput: e => e.target.removeAttribute('aria-invalid') });
  container.append(h('form', { class: 'card inline-form', onSubmit: e => { e.preventDefault(); onAdd(input); } }, input, btn('Añadir jugador', { type: 'submit', icon: 'plus' })));
  if (!state.players.length) {
    container.append(emptyState({ icon: 'users', title: 'Aún no hay jugadores', text: 'Añade al menos 3 para crear un torneo.', actions: [btn('Escribir un nombre', { variant: 'secondary', onClick: () => input.focus() })] }));
    return;
  }
  if (state.players.length < 3) container.append(h('p', { class: 'note' }, `Añade ${3 - state.players.length} más para poder crear un torneo.`));
  container.append(h('div', { class: 'grid players' }, state.players.map(p => {
    const hist = playerHistory(state.history, p.id);
    const titles = hist.filter(x => x.championId === p.id).length + (t?.championId === p.id ? 1 : 0);
    const inT = t?.playerIds.includes(p.id);
    const team = t ? teamOfPlayer(t, p.id) : null;
    const s = inT && t.matches.length ? computePlayerStats(t, p.id) : null;
    return h('article', { class: 'card player', 'aria-label': p.name },
      h('header', {}, h('div', { class: 'avatar', 'aria-hidden': 'true' }, p.name[0].toUpperCase()),
        h('div', {}, h('h3', {}, p.name), h('small', { class: 'muted' }, `#${shortId(p.id)} · ${hist.length + (inT ? 1 : 0)} torneos · ${titles} título${titles === 1 ? '' : 's'}`))),
      inT ? h('div', { class: 'row-center' }, h('span', { class: 'status live' }, 'En el torneo actual'), team ? h('span', { class: 'who' }, teamBadge(team, { size: 24, decorative: true }), h('span', {}, team.name)) : null) : null,
      s ? h('p', { class: 'stats-line' }, `PJ ${s.played} · G ${s.won} · E ${s.drawn} · P ${s.lost} · GF ${s.gf} · GC ${s.ga}`) : null,
      open.has(p.id) ? h('ul', { class: 'hist-list' }, hist.length ? hist.map(x => {
        const me = x.participants.find(q => q.playerId === p.id);
        return h('li', {}, `${x.name} (${fmtDate(x.finishedAt)}) — ${me.teamName}, ${me.stats.won}G ${me.stats.drawn}E ${me.stats.lost}P${x.championId === p.id ? ' · campeón' : ''}`);
      }) : h('li', { class: 'muted' }, 'Sin torneos archivados.')) : null,
      h('footer', { class: 'actions' },
        btn(open.has(p.id) ? 'Ocultar historial' : 'Historial', { variant: 'ghost', size: 'small', icon: 'history', ariaLabel: `${open.has(p.id) ? 'Ocultar' : 'Ver'} historial de ${p.name}`, onClick: () => { open.has(p.id) ? open.delete(p.id) : open.add(p.id); rerender(); } }),
        btn('Editar', { variant: 'ghost', size: 'small', icon: 'edit', ariaLabel: `Editar a ${p.name}`, onClick: async () => {
          const name = await promptDialog({ title: 'Editar jugador', label: 'Nombre', value: p.name });
          if (name === null) return;
          try {
            if (hasDuplicateName(name, p.id) && !await confirmDialog({ title: 'Nombre repetido', message: `Ya existe otro jugador llamado «${name.trim()}». ¿Usar el mismo nombre?`, confirmText: 'Usarlo' })) return;
            renamePlayer(p.id, name); toast('Nombre actualizado', 'ok');
          } catch (e) { toast(e.message, 'error'); }
        } }),
        btn('Eliminar', { variant: 'danger-ghost', size: 'small', icon: 'trash', ariaLabel: `Eliminar a ${p.name}`, onClick: async () => {
          if (!await confirmDialog({ title: 'Eliminar jugador', danger: true, confirmText: 'Eliminar', message: `¿Eliminar a «${p.name}»? Su historial archivado se conserva.` })) return;
          try { removePlayer(p.id); toast('Jugador eliminado', 'ok'); } catch (e) { toast(e.message, 'error'); }
        } })));
  })));
}
