// Utilidades de interfaz y componentes base. Todo el texto de usuario se inserta como nodo de texto (sin innerHTML).
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['value', 'checked', 'disabled', 'selected'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const clear = el => el.replaceChildren();
export const shortId = id => String(id).slice(-4).toUpperCase();
export const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const rerender = () => window.dispatchEvent(new CustomEvent('app:rerender'));
export const goto = hash => { location.hash = hash; };

// ---------------------------------------------------------------- iconos (SVG en línea, 24×24, trazo)
const ICONS = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  clipboard: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 3h6v4H9zM9 12h6M9 16h4',
  history: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  monitor: 'M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 21h8M12 17v4',
  plus: 'M12 5v14M5 12h14', check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', unlock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.5-2',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  play: 'M6 3l14 9-14 9z', ball: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7l4 3-1.5 5h-5L8 10z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15'
};
export function icon(name, { label } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'icon');
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', ICONS[name] ?? ICONS.info);
  svg.append(p); return svg;
}

// ---------------------------------------------------------------- botón con variantes consistentes
export function btn(label, { variant = 'primary', size, icon: ic, onClick, href, type = 'button', ariaLabel, disabled, block, title } = {}) {
  const cls = ['btn', variant !== 'primary' ? variant : '', size ?? '', block ? 'block' : ''].filter(Boolean).join(' ');
  const kids = [ic ? icon(ic) : null, label ? h('span', {}, label) : null];
  if (href) return h('a', { class: cls, href: href.startsWith('#') ? href : `#${href}`, 'aria-label': ariaLabel, title }, ...kids);
  return h('button', { class: cls, type, onClick, 'aria-label': ariaLabel, disabled, title }, ...kids);
}
export const linkBtn = (label, hash, cls = 'btn') => h('a', { class: cls, href: `#${hash}` }, label);

// ---------------------------------------------------------------- avisos temporales (con icono; no solo color)
export function toast(message, type = 'info', ms = 4500) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const el = h('div', { class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status' },
    icon({ ok: 'check', error: 'alert', info: 'info' }[type] ?? 'info'), h('span', {}, message));
  region.append(el);
  setTimeout(() => el.remove(), ms);
}

// ---------------------------------------------------------------- diálogos (hoja inferior en móvil, centrados en tablet+)
let dialogSeq = 0;
export function openDialog(title, build, { wide = false } = {}) {
  return new Promise(resolve => {
    const opener = document.activeElement;
    const id = `dlg-${++dialogSeq}`;
    const dlg = h('dialog', { class: 'dialog' + (wide ? ' wide' : ''), 'aria-labelledby': id });
    const close = v => { try { dlg.close?.(); } catch { /* ya cerrado */ } dlg.remove(); try { opener?.focus?.(); } catch { /* sin foco */ } resolve(v); };
    dlg.append(h('h2', { id }, title), build(close));
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(undefined); });
    dlg.addEventListener('click', e => { if (e.target === dlg) close(undefined); });   // clic en el fondo
    document.body.append(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  });
}
export function confirmDialog({ title = 'Confirmar', message, details = [], confirmText = 'Aceptar', danger = false }) {
  return openDialog(title, close => h('div', {},
    h('p', {}, message),
    details.length ? h('ul', { class: 'dialog-list' }, details.map(d => h('li', {}, d))) : null,
    h('div', { class: 'dialog-actions' },
      btn('Cancelar', { variant: 'secondary', onClick: () => close(false) }),
      btn(confirmText, { variant: danger ? 'danger' : 'primary', onClick: () => close(true) })))
  ).then(v => v === true);
}
export function promptDialog({ title, label, value = '', confirmText = 'Guardar', maxLength = 30 }) {
  return openDialog(title, close => {
    const input = h('input', { type: 'text', value, maxlength: maxLength, required: true, autocomplete: 'off' });
    const form = h('form', { onSubmit: e => { e.preventDefault(); close(input.value); } },
      h('label', { class: 'field' }, h('span', {}, label), input),
      h('div', { class: 'dialog-actions' }, btn('Cancelar', { variant: 'secondary', onClick: () => close(null) }), btn(confirmText, { type: 'submit' })));
    setTimeout(() => input.focus(), 0);
    return form;
  }).then(v => v ?? null);
}

// ---------------------------------------------------------------- estados: vacío, error, aviso
export function emptyState({ icon: ic = 'info', title, text, actions = [], variant } = {}) {
  return h('section', { class: 'empty-state' + (variant ? ` ${variant}` : '') },
    h('div', { class: 'empty-icon' }, icon(ic)), h('h2', {}, title), text ? h('p', {}, text) : null,
    actions.length ? h('div', { class: 'actions center' }, actions) : null);
}
// Compatibilidad con vistas anteriores
export const emptyCard = (text, ...extra) => emptyState({ title: text, actions: extra });
export function banner(type, text, ...actions) {
  return h('div', { class: `banner ${type}`, role: type === 'error' ? 'alert' : 'status' }, icon({ warn: 'alert', error: 'alert', info: 'info' }[type] ?? 'info'),
    h('div', { class: 'stack' }, h('span', {}, text), actions.length ? h('div', { class: 'actions' }, actions) : null));
}
export const pageHead = (title, sub, ...actions) => h('header', { class: 'page-head' },
  h('div', {}, title ? h('h2', {}, title) : null, sub ? h('p', {}, sub) : null), actions.length ? h('div', { class: 'actions' }, actions) : null);
