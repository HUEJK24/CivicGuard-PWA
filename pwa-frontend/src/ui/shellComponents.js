/**
 * ShellComponents — renderizado mixto del frontend de CivicGuard.
 *
 * El Application Shell vive en `index.html`; aquí se renderizan el formulario
 * y la lista. El diseño sigue el sistema Accessible & Ethical de ui-ux-pro-max
 * y los detalles de interacción de Emil Kowalski (feedback al press, sin
 * hover pegajoso en táctil, transiciones interrumpibles).
 */

const FORM_SLOT_ID = 'report-form-slot';
const LIST_ID = 'incident-list';
const COUNTER_ID = 'pending-counter';
const API_STATUS_ID = 'api-status';

/** Iconos SVG consistentes (trazo 2, 24×24). Nunca emojis. */
const ICONS = {
  location: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>`,
  inbox: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
    </svg>`,
};

/** Estado de la vista: el filtro cambia la vista, nunca los datos guardados. */
let activeFilter = 'all';
let allIncidents = [];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formMarkup() {
  return `
    <form class="form" id="report-form" novalidate>
      <div class="error-summary" id="form-error-summary" role="alert" tabindex="-1" hidden>
        <strong>Revisa estos datos:</strong>
        <ul id="form-error-list"></ul>
      </div>

      <div class="field">
        <label class="field__label" for="report-title-input">1. ¿Qué ocurrió?</label>
        <span class="field__hint" id="title-hint">
          Escribe un título corto. Ejemplo: “Bache frente a la clínica”.
        </span>
        <input
          id="report-title-input"
          name="title"
          type="text"
          maxlength="120"
          autocomplete="off"
          placeholder="Ej. Bache en la calle principal"
          aria-describedby="title-hint title-error title-counter"
        />
        <span class="field__error" id="title-error" hidden></span>
        <span class="counter" id="title-counter">0 / 120</span>
      </div>

      <div class="field">
        <label class="field__label" for="report-description">2. Más detalles (opcional)</label>
        <span class="field__hint" id="description-hint">
          Añade una referencia para encontrar el lugar más fácil.
        </span>
        <textarea
          id="report-description"
          name="description"
          maxlength="600"
          placeholder="Ej. Está cerca de la farmacia, del lado norte."
          aria-describedby="description-hint description-counter"
        ></textarea>
        <span class="counter" id="description-counter">0 / 600</span>
      </div>

      <div class="field">
        <span class="field__label" id="location-label">3. ¿Dónde está?</span>
        <span class="field__hint" id="location-hint">
          Necesitamos la ubicación para poder enviar el reporte.
        </span>
        <div class="evidence">
          <button
            class="button button--secondary"
            type="button"
            id="capture-location"
            aria-describedby="location-hint"
          >
            ${ICONS.location}
            Obtener ubicación
          </button>
          <span class="location-status" id="location-status" role="status" aria-live="polite">
            Sin ubicación todavía.
          </span>
        </div>
      </div>

      <button class="button button--primary button--full" type="submit" id="submit-report">
        Guardar y enviar reporte
      </button>
      <p class="status" id="form-status" role="status" aria-live="polite"></p>
    </form>
  `;
}

function statusInfo(incident) {
  if (incident.pendingSync) return { label: 'Pendiente', tone: 'pending' };
  if (incident.status === 'resolved') return { label: 'Resuelto', tone: 'resolved' };
  if (incident.status === 'synced') return { label: 'Enviado', tone: 'synced' };
  return { label: 'Recibido', tone: 'synced' };
}

function listItemMarkup(incident) {
  const status = statusInfo(incident);
  return `
    <li class="list__item">
      <div class="list__head">
        <span class="list__title">${escapeHtml(incident.title)}</span>
        <span class="tag" data-state="${status.tone}">${status.label}</span>
      </div>
      ${
        incident.description
          ? `<span class="list__meta">${escapeHtml(incident.description)}</span>`
          : ''
      }
      <span class="list__meta">Guardado: ${formatDate(incident.created_at)}</span>
    </li>
  `;
}

function setElementStatus(id, message, tone = '') {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  if (tone) element.dataset.tone = tone;
  else delete element.dataset.tone;
}

export function setApiStatus(message, tone = '') {
  setElementStatus(API_STATUS_ID, message, tone);
}

function matchesFilter(incident, filter) {
  if (filter === 'pending') {
    return Boolean(incident.pendingSync) || incident.status === 'pending';
  }
  if (filter === 'synced') {
    return !incident.pendingSync && ['synced', 'resolved'].includes(incident.status);
  }
  return true;
}

function emptyStateMarkup(filter = activeFilter) {
  const copy = {
    pending: ['Sin reportes pendientes', 'Todo lo que tenías guardado ya se envió.'],
    synced: ['Sin reportes enviados', 'Cuando el servidor confirme un reporte, aparecerá aquí.'],
    all: ['Aún no hay reportes', 'Tu primer reporte aparecerá aquí, incluso sin conexión.'],
  }[filter];

  return `
    <li class="list__empty">
      ${ICONS.inbox}
      <strong>${copy[0]}</strong>
      <span>${copy[1]}</span>
    </li>
  `;
}

export function renderList(incidents = []) {
  const list = document.getElementById(LIST_ID);
  if (!list) return;

  allIncidents = incidents;
  const visible = incidents.filter((incident) => matchesFilter(incident, activeFilter));
  list.innerHTML = visible.length
    ? visible.map(listItemMarkup).join('')
    : emptyStateMarkup(activeFilter);

  const pending = incidents.filter((incident) => incident.pendingSync).length;
  const setStat = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  };
  setStat('stat-total', incidents.length);
  setStat('stat-pending', pending);

  const counter = document.getElementById(COUNTER_ID);
  if (counter) {
    counter.textContent = `${pending} ${pending === 1 ? 'reporte pendiente' : 'reportes pendientes'} de sincronizar`;
  }
}

/** Filtros táctiles con aria-pressed; no reenvían ni borran información. */
export function mountFilters() {
  const container = document.getElementById('report-filters');
  if (!container || container.dataset.ready === 'true') return;
  container.dataset.ready = 'true';

  container.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;

    activeFilter = chip.dataset.filter;
    for (const button of container.querySelectorAll('[data-filter]')) {
      button.setAttribute('aria-pressed', String(button === chip));
    }
    renderList(allIncidents);
  });
}

function renderErrorSummary(messages) {
  const summary = document.getElementById('form-error-summary');
  const list = document.getElementById('form-error-list');
  if (!summary || !list) return;

  if (messages.length === 0) {
    summary.hidden = true;
    list.innerHTML = '';
    return;
  }

  list.innerHTML = messages.map((message) => `<li>${escapeHtml(message)}</li>`).join('');
  summary.hidden = false;
  summary.focus();
}

function setFieldError(input, errorId, message) {
  const error = document.getElementById(errorId);
  if (error) {
    error.textContent = message;
    error.hidden = !message;
  }
  input.setAttribute('aria-invalid', String(Boolean(message)));
}

function bindCounters(form) {
  const bindings = [
    ['title', 'title-counter', 120],
    ['description', 'description-counter', 600],
  ];

  const updaters = bindings.map(([name, id, max]) => {
    const input = form.elements[name];
    const counter = document.getElementById(id);
    const update = () => {
      if (counter) counter.textContent = `${input.value.length} / ${max}`;
    };
    input.addEventListener('input', update);
    update();
    return update;
  });

  return () => updaters.forEach((update) => update());
}

function captureLocation(button, coordinatesRef) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este navegador no puede obtener la ubicación.'));
      return;
    }

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setElementStatus('location-status', 'Buscando tu ubicación…');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        coordinatesRef.value = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setElementStatus('location-status', 'Ubicación lista.', 'ok');
        button.disabled = false;
        button.removeAttribute('aria-busy');
        resolve();
      },
      (error) => {
        const messages = {
          1: 'Permite el acceso a la ubicación para continuar.',
          2: 'No pudimos encontrar tu ubicación. Inténtalo de nuevo.',
          3: 'La ubicación tardó demasiado. Inténtalo de nuevo.',
        };
        const message = messages[error.code] ?? 'No se pudo obtener la ubicación.';
        setElementStatus('location-status', message, 'error');
        button.disabled = false;
        button.removeAttribute('aria-busy');
        reject(new Error(message));
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 },
    );
  });
}

function bindForm(form, onSubmit) {
  const locationButton = form.querySelector('#capture-location');
  const submitButton = form.querySelector('#submit-report');
  const coordinatesRef = { value: null };
  const updateCounters = bindCounters(form);
  const submitLabel = submitButton.textContent.trim();

  locationButton.addEventListener('click', () => {
    captureLocation(locationButton, coordinatesRef).catch(() => {});
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const titleInput = form.elements.title;
    const title = titleInput.value.trim();
    const description = form.elements.description.value.trim();
    const errors = [];

    if (title.length < 3) {
      const message = 'Escribe un título de al menos 3 caracteres.';
      setFieldError(titleInput, 'title-error', message);
      errors.push(message);
    } else {
      setFieldError(titleInput, 'title-error', '');
    }

    if (!coordinatesRef.value) {
      const message = 'Obtén la ubicación antes de guardar el reporte.';
      setElementStatus('location-status', message, 'error');
      errors.push(message);
    }

    if (errors.length > 0) {
      renderErrorSummary(errors);
      return;
    }

    renderErrorSummary([]);
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.textContent = 'Guardando…';
    setElementStatus('form-status', 'Guardando tu reporte…');

    try {
      const result = await onSubmit({ title, description, ...coordinatesRef.value });

      form.reset();
      coordinatesRef.value = null;
      updateCounters();
      setElementStatus('location-status', 'Sin ubicación todavía.');

      if (result.synced) {
        setElementStatus('form-status', `Listo. «${title}» se envió correctamente.`, 'ok');
      } else if (result.error) {
        setElementStatus(
          'form-status',
          `«${title}» quedó guardado en este dispositivo. No se pudo enviar: ${result.error.message}`,
          'error',
        );
      } else {
        setElementStatus(
          'form-status',
          `Listo. «${title}» quedó guardado y se enviará cuando haya conexión.`,
          'ok',
        );
      }
    } catch (error) {
      setElementStatus('form-status', `No se pudo guardar el reporte: ${error.message}`, 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitButton.textContent = submitLabel;
    }
  });
}

export function renderForm(onSubmit) {
  const slot = document.getElementById(FORM_SLOT_ID);
  if (!slot) return;

  slot.innerHTML = formMarkup();
  const form = slot.querySelector('form');
  if (form) bindForm(form, onSubmit);
}

export function mountShell(onSubmit) {
  renderForm(onSubmit);
  mountFilters();
  renderList();
}

export default { mountShell, mountFilters, renderForm, renderList, setApiStatus };
