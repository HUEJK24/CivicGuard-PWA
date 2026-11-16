import { eventBus, EVENTS } from '../core/eventBus.js';

/**
 * ShellComponents — renderizado mixto (Sprint 2).
 *
 * El Application Shell (cabecera, banner de conexión, tarjetas y footer) es
 * estático en `index.html`, así que se pinta desde el primer byte y queda
 * precargado en la Cache API. Lo que cambia según el estado de la app (el
 * formulario y la lista de reportes) se renderiza aquí por CSR.
 *
 * NOTA DE ALCANCE: los borradores viven en memoria. El guardado real en la
 * outbox de IndexedDB llega en el Sprint 3 (OutboxRepository); este módulo
 * solo se encarga del renderizado y de emitir el evento del formulario.
 */

const FORM_SLOT_ID = 'report-form-slot';
const LIST_ID = 'incident-list';
const COUNTER_ID = 'pending-counter';

/** Borradores de esta sesión (memoria). El Sprint 3 los persiste. */
let drafts = [];

/** Escapa texto antes de insertarlo con innerHTML. */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Formato local corto, sin dependencias. */
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

      <button class="button" type="submit" id="submit-report">Guardar reporte</button>
      <p class="status" id="form-status" role="status" aria-live="polite"></p>
    </form>
  `;
}

/** @param {HTMLLIElement | string} item */
function listItemMarkup(draft) {
  return `
    <li class="list__item">
      <div class="list__head">
        <span class="list__title">${escapeHtml(draft.title)}</span>
        <span class="tag">Borrador local</span>
      </div>
      ${
        draft.description
          ? `<p class="list__meta">${escapeHtml(draft.description)}</p>`
          : ''
      }
      <p class="list__meta">${formatDate(draft.createdAt)}</p>
    </li>
  `;
}

/** @param {string | null} tone */
function setStatus(message, tone = null) {
  const element = document.getElementById('form-status');
  if (!element) return;
  element.textContent = message;
  if (tone) element.dataset.tone = tone;
  else delete element.dataset.tone;
}

function updateCounter() {
  const counter = document.getElementById(COUNTER_ID);
  if (!counter) return;
  const total = drafts.length;
  counter.textContent = `${total} ${total === 1 ? 'reporte' : 'reportes'} en el dispositivo`;
}

/** Vuelve a pintar la lista completa. */
export function renderList() {
  const list = document.getElementById(LIST_ID);
  if (!list) return;

  if (drafts.length === 0) {
    list.innerHTML = '<li class="list__empty">Aún no hay reportes en este dispositivo.</li>';
  } else {
    list.innerHTML = drafts.map(listItemMarkup).join('');
  }

  updateCounter();
}

/** Añade un borrador y refresca la lista. */
export function addDraft({ title, description }) {
  const draft = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: description.trim(),
    createdAt: new Date().toISOString(),
  };

  drafts = [draft, ...drafts];
  eventBus.emit(EVENTS.DRAFT_CHANGED, { draft, total: drafts.length });
  renderList();
  return draft;
}

/** Devuelve una copia de los borradores actuales (solo lectura). */
export function getDrafts() {
  return [...drafts];
}

/** @param {HTMLFormElement} form */
function bindForm(form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const title = form.elements.title.value;
    const description = form.elements.description.value;

    if (title.trim().length < 3) {
      setStatus('El título necesita al menos 3 caracteres.', 'error');
      form.elements.title.focus();
      return;
    }

    const draft = addDraft({ title, description });
    form.reset();
    setStatus(`«${draft.title}» quedó en el dispositivo.`, 'ok');
  });
}

/** Renderiza el formulario dentro del slot estático del shell. */
export function renderForm() {
  const slot = document.getElementById(FORM_SLOT_ID);
  if (!slot) return;

  slot.innerHTML = formMarkup();
  const form = slot.querySelector('form');
  if (form) bindForm(form);
}

/** Punto de entrada: monta formulario y lista sobre el shell estático. */
export function mountShell() {
  renderForm();
  renderList();
}

export default { mountShell, renderForm, renderList, addDraft, getDrafts };
