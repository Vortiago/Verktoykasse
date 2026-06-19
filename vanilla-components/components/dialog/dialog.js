// @ts-check
// dialog — a native <dialog> wrapper. Append `el` to the DOM, then call open()
// (showModal → top layer, focus-trapped, Esc-closable) and close().
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @param {HTMLElement} host @param {string | Node | null | undefined} content */
function fill(host, content) {
  if (content == null) return;
  if (typeof content === "string") host.textContent = content;
  else host.replaceChildren(content);
}

/**
 * @param {{ title?: string | null, body?: string | Node | null, actions?: Node | null,
 *   scroll?: boolean, closeOnBackdrop?: boolean }} [props]
 *   title - header text (omit for a chromeless dialog; set later via setTitle).
 *   body - string or node; actions - a footer node (e.g. buttons).
 *   scroll - cap the dialog height and let a long body scroll within it.
 *   closeOnBackdrop - clicking the backdrop closes (native dialogs don't by default).
 * @param {AbortSignal} [signal] - aborting removes the listeners.
 * @returns {{ el: HTMLDialogElement, bodyEl: HTMLElement, actionsEl: HTMLElement,
 *   open: () => void, close: () => void, setTitle: (title: string | null) => void }}
 */
function buildDialog({ title = null, body = null, actions = null, scroll = false, closeOnBackdrop = false } = {}, signal) {
  const el = /** @type {HTMLDialogElement} */ (tpl("tpl-dialog").firstElementChild);
  if (scroll) el.classList.add("is-scroll");

  const headEl = pick(el, "head");
  const titleEl = pick(el, "title");
  /** Set (or clear) the header title; the head shows only when titled. @param {string | null} t */
  const setTitle = (t) => { headEl.hidden = t == null; if (t != null) titleEl.textContent = t; };
  setTitle(title);

  const bodyEl = pick(el, "body");
  fill(bodyEl, body);
  const actionsEl = pick(el, "actions");
  if (actions != null) {
    actionsEl.hidden = false;
    actionsEl.append(actions);
  }
  const close = () => el.close();
  pick(el, "close").addEventListener("click", close, { signal });
  if (closeOnBackdrop) {
    // Close only when both press and release land on the backdrop (the dialog
    // element itself) — so a drag/selection that starts inside and releases on
    // the backdrop doesn't close it.
    let downOnBackdrop = false;
    el.addEventListener("mousedown", (e) => { downOnBackdrop = e.target === el; }, { signal });
    el.addEventListener("click", (e) => { if (downOnBackdrop && e.target === el) close(); }, { signal });
  }

  return {
    el,
    bodyEl,
    actionsEl,
    open: () => el.showModal(),
    close,
    setTitle,
  };
}

export const { warm: warmDialog, sync: createDialogSync, create: createDialog } =
  defineComponent(import.meta.url, "dialog", buildDialog);
