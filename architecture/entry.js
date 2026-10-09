// Read before CSS loads so fallback entry animation does not flash.
try {
  const entry = JSON.parse(sessionStorage.getItem('mat-architecture-entry') || 'null');
  sessionStorage.removeItem('mat-architecture-entry');
  if (entry && entry.path === location.pathname && Date.now() - entry.time < 10000) {
    document.documentElement.classList.add('architecture-arriving');
  }
} catch {}

// A native shared-element transition owns the entrance when available.
window.addEventListener('pagereveal', event => {
  if (event.viewTransition) document.documentElement.classList.remove('architecture-arriving');
});
window.addEventListener('pageshow', event => {
  if (event.persisted) document.documentElement.classList.remove('architecture-arriving');
});
