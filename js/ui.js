// Utilidades de interfaz. Todo el texto de usuario se inserta como nodo de texto (sin innerHTML).
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

export function toast(message, type = 'info', ms = 4000) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const el = h('div', { class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  region.append(el);
  setTimeout(() => el.remove(), ms);
}

export function openDialog(title, build, { wide = false } = {}) {
  return new Promise(resolve => {
    const dlg = h('dialog', { class: 'dialog' + (wide ? ' wide' : '') });
    const close = v => { try { dlg.close?.(); } catch { /* ya cerrado */ } dlg.remove(); resolve(v); };
    dlg.append(h('h2', {}, title), build(close));
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(undefined); });
    document.body.append(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  });
}

export function confirmDialog({ title = 'Confirmar', message, details = [], confirmText = 'Aceptar', danger = false }) {
  return openDialog(title, close => h('div', {},
    h('p', {}, message),
    details.length ? h('ul', { class: 'dialog-list' }, details.map(d => h('li', {}, d))) : null,
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn secondary', type: 'button', onClick: () => close(false) }, 'Cancelar'),
      h('button', { class: 'btn' + (danger ? ' danger' : ''), type: 'button', onClick: () => close(true) }, confirmText)))
  ).then(v => v === true);
}

export function promptDialog({ title, label, value = '', confirmText = 'Guardar', maxLength = 30 }) {
  return openDialog(title, close => {
    const input = h('input', { type: 'text', value, maxlength: maxLength, required: true, 'aria-label': label });
    const form = h('form', { onSubmit: e => { e.preventDefault(); close(input.value); } },
      h('label', { class: 'field' }, h('span', {}, label), input),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn secondary', type: 'button', onClick: () => close(null) }, 'Cancelar'),
        h('button', { class: 'btn', type: 'submit' }, confirmText)));
    setTimeout(() => input.focus(), 0);
    return form;
  }).then(v => v ?? null);
}

export const emptyCard = (text, ...extra) => h('div', { class: 'card empty' }, h('p', { class: 'muted' }, text), ...extra);
export const linkBtn = (label, hash, cls = 'btn') => h('a', { class: cls, href: `#${hash}` }, label);
