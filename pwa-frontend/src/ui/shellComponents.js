/**
 * ShellComponents — renderizado mixto (Sprint 2).
 *
 * El Application Shell es estático en `index.html`; el formulario y la lista
 * de reportes se renderizan aquí por CSR.
 */

const FORM_SLOT_ID = 'report-form-slot';
const LIST_ID = 'incident-list';
const COUNTER_ID = 'pending-counter';
const API_STATUS_ID = 'api-status';

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
      <div class="field">
        <label class="field__label" for="report-title-input">Título</label>
        <input
          id="report-title-input"
          name="title"
          type="text"
          maxlength="120"
          autocomplete="off"
          required
          placeholder="Bache en la calle 5 de Mayo"
        />
      </div>

      <div class="field">
        <label class="field__label" for="report-description">Descripción</label>
        <textarea
          id="report-description"
          name="description"
          maxlength="600"
          placeholder="Describe el problema y una referencia del lugar."
        ></textarea>
      </div>

      <div class="field">
        <span class="field__label">Ubicación</span>
        <div class="evidence">
          <button class="button button--ghost" type="button" id="capture-location">
            Obtener ubicación
          </button>
          <span class="field__hint" id="location-status" role="status" aria-live="polite">
            Necesaria para enviar el reporte.
          </span>
        </div>
      </div>

      <button class="button" type="submit" id="submit-report">Enviar reporte</button>
      <p class="status" id="form-status" role="status" aria-live="polite"></p>
    </form>
  `;
}

function statusLabel(incident) {
  if (incident.pendingSync) return 'Pendiente de envío';
  return (
    {
      pending: 'Pendiente',
      synced: 'Recibido',
      resolved: 'Resuelto',
    }[incident.status] ?? 'Recibido'
  );
}

function listItemMarkup(incident) {
  return `
    <li class="list__item">
      <div class="list__head">
        <span class="list__title">${escapeHtml(incident.title)}</span>
        <span class="tag">${statusLabel(incident)}</span>
      </div>
      ${
        incident.description
          ? `<p class="list__meta">${escapeHtml(incident.description)}</p>`
          : ''
      }
      <p class="list__meta">${formatDate(incident.created_at)}</p>
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

export function renderList(incidents = []) {
  const list = document.getElementById(LIST_ID);
  if (!list) return;

  if (incidents.length === 0) {
    list.innerHTML = '<li class="list__empty">Aún no hay reportes en este dispositivo.</li>';
  } else {
    list.innerHTML = incidents.map(listItemMarkup).join('');
  }

  const pending = incidents.filter((incident) => incident.pendingSync).length;
  const counter = document.getElementById(COUNTER_ID);
  if (counter) {
    counter.textContent = `${pending} ${pending === 1 ? 'reporte pendiente' : 'reportes pendientes'} de sincronizar`;
  }
}

function captureLocation(button, coordinatesRef) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este navegador no permite obtener la ubicación.'));
      return;
    }

    button.disabled = true;
    setElementStatus('location-status', 'Obteniendo ubicación…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        coordinatesRef.value = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setElementStatus('location-status', 'Ubicación lista.', 'ok');
        button.disabled = false;
        resolve();
      },
      (error) => {
        const messages = {
          1: 'Permite el acceso a la ubicación para enviar el reporte.',
          2: 'No se pudo determinar la ubicación. Inténtalo de nuevo.',
          3: 'La ubicación tardó demasiado. Inténtalo de nuevo.',
        };
        const message = messages[error.code] ?? 'No se pudo obtener la ubicación.';
        setElementStatus('location-status', message, 'error');
        button.disabled = false;
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

  locationButton.addEventListener('click', () => {
    captureLocation(locationButton, coordinatesRef).catch(() => {});
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const title = form.elements.title.value.trim();
    const description = form.elements.description.value.trim();
    if (title.length < 3) {
      setElementStatus('form-status', 'El título necesita al menos 3 caracteres.', 'error');
      form.elements.title.focus();
      return;
    }

    if (!coordinatesRef.value) {
      setElementStatus('form-status', 'Obtén la ubicación antes de enviar el reporte.', 'error');
      return;
    }

    submitButton.disabled = true;
    setElementStatus('form-status', 'Guardando reporte…');
    try {
      const result = await onSubmit({
        title,
        description,
        ...coordinatesRef.value,
      });

      form.reset();
      coordinatesRef.value = null;
      setElementStatus('location-status', 'Necesaria para enviar el reporte.');

      if (result.synced) {
        setElementStatus('form-status', `«${title}» se envió a la API.`, 'ok');
      } else if (result.error) {
        setElementStatus(
          'form-status',
          `«${title}» quedó guardado en el dispositivo; no se pudo sincronizar: ${result.error.message}`,
          'error',
        );
      } else {
        setElementStatus(
          'form-status',
          `«${title}» quedó guardado en el dispositivo y se enviará al recuperar conexión.`,
          'ok',
        );
      }
    } catch (error) {
      setElementStatus('form-status', error.message, 'error');
    } finally {
      submitButton.disabled = false;
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
  renderList();
}

export default { mountShell, renderForm, renderList, setApiStatus };
