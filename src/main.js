import './mocks/mock-api.js'; // reads ?mock=… before anything else
import { route, setNotFound, startRouter, navigate } from './router.js';
import { getSettings } from './store.js';
import { renderFeed, renderFavorites } from './ui/kid.js';
import { renderWatch } from './ui/watch.js';
import { renderParent } from './ui/parent.js';
import { renderOnboarding } from './ui/onboarding.js';
import { emptyState, closeOverlays } from './ui/components.js';

route('feed', guarded(renderFeed));
route('favorites', guarded(renderFavorites));
route('watch', guarded(renderWatch));
route('parent', guarded(renderParent));
route('onboarding', renderOnboarding);
setNotFound((app) => app.appendChild(emptyState('🗺️', 'Page not found')));

// First run goes to the setup wizard until it completes.
function guarded(render) {
  return (app, params) => {
    if (!getSettings().onboarded) {
      navigate('onboarding');
      return;
    }
    render(app, params);
  };
}

// Stray overlays (PIN pad, sheets) shouldn't survive navigation.
window.addEventListener('hashchange', closeOverlays);

startRouter();

// Service worker: relative path so the scope matches the GitHub Pages subpath.
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
