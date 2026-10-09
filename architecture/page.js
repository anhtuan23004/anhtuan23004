const button = document.querySelector('.theme-toggle');
const preference = matchMedia('(prefers-color-scheme: dark)');
let chosen = false;
try { chosen = ['light', 'dark'].includes(localStorage.getItem('mat-theme')); } catch {}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = theme;
  button.setAttribute('aria-pressed', String(dark));
  button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  button.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#171a1b' : '#eeece5';
}
applyTheme(document.documentElement.dataset.theme || 'light');
button.hidden = false;
button.addEventListener('click', () => {
  chosen = true;
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('mat-theme', next); } catch {}
  applyTheme(next);
});
preference.addEventListener('change', event => {
  if (!chosen) applyTheme(event.matches ? 'dark' : 'light');
});

const art = document.querySelector('.discipline-art');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
art.addEventListener('pointermove', event => {
  if (reduced.matches || event.pointerType === 'touch') return;
  const bounds = art.getBoundingClientRect();
  art.style.setProperty('--glow-x', `${(event.clientX - bounds.left) / bounds.width * 100}%`);
  art.style.setProperty('--glow-y', `${(event.clientY - bounds.top) / bounds.height * 100}%`);
});
art.addEventListener('pointerleave', () => {
  art.style.removeProperty('--glow-x'); art.style.removeProperty('--glow-y');
});
