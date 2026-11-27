/**
 * Navegación de una sola página.
 *
 * Todas las secciones viven en el mismo documento. Los botones con
 * `data-view-target` cambian la sección visible, actualizan el hash y mueven
 * el foco al título para que la navegación sea comprensible con teclado y
 * lector de pantalla. No hay router ni recarga: el Service Worker y los datos
 * locales siguen intactos.
 */

const VIEWS = ['resumen', 'reportar', 'reportes', 'avisos', 'ayuda'];
const DEFAULT_VIEW = 'resumen';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function mountViewNavigation() {
  const views = [...document.querySelectorAll('.view[data-view]')];
  if (views.length === 0) return () => {};

  function setView(name, { updateHash = true, focus = true } = {}) {
    const target = VIEWS.includes(name) ? name : DEFAULT_VIEW;

    for (const view of views) {
      view.hidden = view.dataset.view !== target;
    }

    for (const button of document.querySelectorAll('[data-view-target]')) {
      if (button.dataset.viewTarget === target) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    }

    if (updateHash && location.hash !== `#${target}`) {
      history.replaceState(null, '', `#${target}`);
    }

    const activeView = views.find((view) => view.dataset.view === target);
    if (focus) {
      activeView?.querySelector('[data-view-heading]')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view-target]');
    if (!button) return;
    setView(button.dataset.viewTarget);
  });

  window.addEventListener('hashchange', () => {
    const name = location.hash.replace('#', '');
    if (VIEWS.includes(name)) setView(name, { updateHash: false, focus: false });
  });

  const initial = location.hash.replace('#', '');
  setView(initial, { updateHash: false, focus: false });

  return setView;
}

export default { mountViewNavigation };
