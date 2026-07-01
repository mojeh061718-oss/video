// Tiny hash router: '#/watch/abc' -> route('watch', ['abc']).
// Hash routing keeps GitHub Pages happy (no server-side 404 handling).

const routes = new Map();
let notFound = null;

export function route(name, render) {
  routes.set(name, render);
}

export function setNotFound(render) {
  notFound = render;
}

export function navigate(path) {
  const target = '#/' + path.replace(/^#?\/?/, '');
  if (location.hash === target) render();
  else location.hash = target;
}

function render() {
  const segments = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const name = segments[0] || 'feed';
  const handler = routes.get(name) || notFound;
  const app = document.getElementById('app');
  app.innerHTML = '';
  window.scrollTo(0, 0);
  if (handler) handler(app, segments.slice(1));
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}

export function rerender() {
  render();
}
