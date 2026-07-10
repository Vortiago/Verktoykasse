// @ts-check
// dialog — a native <dialog> wrapper. Append `el` to the DOM, then call open()
// (showModal → top layer, focus-trapped, Esc-closable) and close().
// Dismissal is declarative, no JS listeners: the ✕ uses the Invoker Commands API
// (command="request-close" + commandfor=el.id) and closeOnBackdrop → native
// closedby="any". Chrome/Edge only — command ≥135, request-close ≥139, closedby ≥134.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @param {HTMLElement} host @param {string | Node | null | undefined} content */
function fill(host, content) {
  if (content == null) return;
  if (typeof content === "string") host.textContent = content;
  else host.replaceChildren(content); // static-render
}

let seq = 0; // unique id per instance, so the ✕ (and consumer buttons) can target it via commandfor

/**
 * @param {{ title?: string | null, body?: string | Node | null, actions?: Node | null,
 *   scroll?: boolean, closeOnBackdrop?: boolean }} [props]
 *   title - header text (omit for a chromeless dialog; set later via setTitle).
 *   body - string or node; actions - a footer node (e.g. buttons).
 *   scroll - cap the dialog height and let a long body scroll within it.
 *   closeOnBackdrop - clicking the backdrop closes (native dialogs don't by default).
 * @param {AbortSignal} [_signal] - unused; dismissal is declarative (no listeners to abort).
 * @returns {{ el: HTMLDialogElement, bodyEl: HTMLElement, actionsEl: HTMLElement,
 *   open: () => void, close: () => void, setTitle: (title: string | null) => void }}
 */
function buildDialog({ title = null, body = null, actions = null, scroll = false, closeOnBackdrop = false } = {}, _signal) {
  const el = /** @type {HTMLDialogElement} */ (tpl("tpl-dialog").firstElementChild);
  el.id = `dialog-${++seq}`;
  if (scroll) el.classList.add("is-scroll");
  // Native light-dismiss (backdrop click + Esc) replaces a JS backdrop listener.
  if (closeOnBackdrop) el.setAttribute("closedby", "any");
  // Point the template's command="request-close" ✕ at this dialog instance.
  pick(el, "close").setAttribute("commandfor", el.id);

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

  return {
    el,
    bodyEl,
    actionsEl,
    open: () => el.showModal(),
    close: () => el.close(),
    setTitle,
  };
}

export const { warm: warmDialog, sync: createDialogSync, create: createDialog } =
  defineComponent(import.meta.url, "dialog", buildDialog);
