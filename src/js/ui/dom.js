export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function icon(name, className = '') {
  return `<svg class="icon ${className}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
}

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function openDialog(target) {
  const dialog = typeof target === 'string' ? document.getElementById(target) : target;
  if (!dialog || dialog.open) return dialog;
  dialog.showModal();
  return dialog;
}

export function closeDialog(target) {
  const dialog = typeof target === 'string' ? document.getElementById(target) : target;
  if (dialog?.open) dialog.close();
}

export function toast(message, { type = 'success', action = null, duration = 3600 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  const icons = { success: 'check', error: 'info', info: 'info' };
  node.innerHTML = `${icon(icons[type] || 'info')}<span>${esc(message)}</span>`;
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      action.onClick?.();
      node.remove();
    });
    node.append(button);
  }
  root.append(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  if (duration > 0) {
    setTimeout(() => {
      node.classList.remove('is-visible');
      setTimeout(() => node.remove(), 250);
    }, duration);
  }
}

export function debounce(fn, wait = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export const pct = (value, max) => {
  if (!max) return 0;
  return Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100));
};

export function progress(value, max, className = '', label = 'نسبة التقدم') {
  return `<div class="progress ${className}" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="${max}">
    <span style="width:${pct(value, max)}%"></span>
  </div>`;
}

export function emptyState({ iconName = 'bulb', title, text, action = '' }) {
  return `<div class="empty-state">
    <span class="empty-icon">${icon(iconName)}</span>
    <strong>${esc(title)}</strong>
    <p>${esc(text)}</p>
    ${action}
  </div>`;
}

export function ringStyle(value, max, radius = 60) {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, value / (max || 1))));
  return `stroke-dasharray:${circumference.toFixed(2)};stroke-dashoffset:${offset.toFixed(2)}`;
}

export function mealIcon(id) {
  return { breakfast: 'sun', lunch: 'food', dinner: 'moon', snacks: 'star' }[id] || 'food';
}
