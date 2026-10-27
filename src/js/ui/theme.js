import { getState, setTheme } from '../core/store.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function resolvedTheme() {
  const setting = getState().settings.theme || 'auto';
  if (setting === 'auto') return media.matches ? 'dark' : 'light';
  return setting === 'dark' ? 'dark' : 'light';
}

export function applyTheme() {
  const resolved = resolvedTheme();
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#070807' : '#F4F3EF');
}

export function toggleTheme() {
  setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
}

media.addEventListener?.('change', () => {
  if ((getState().settings.theme || 'auto') === 'auto') applyTheme();
});
