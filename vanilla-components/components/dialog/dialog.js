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
 * @param {{ title?: string | null, body?: string | Node | null, actions?: Node | null }} [props]
 *   title - header text (omit for a chromeless dialog); body - string or node;
 *   actions - a node for the footer (e.g. buttons); append more to `actionsEl`.
 * @param {AbortSignal} [signal] - aborting removes the close listener.
 * @returns {{ el: HTMLDialogElement, bodyEl: HTMLElement, actionsEl: HTMLElement, open: () => void, close: () => void }}
 */
function buildDialog({ title = null, body = null, actions = null } = {}, signal) {
  const el = /** @type {HTMLDialogElement} */ (tpl("tpl-dialog").firstElementChild);

  if (title != null) {
    pick(el, "head").hidden = false;
    pick(el, "title").textContent = title;
  }
  const bodyEl = pick(el, "body");
  fill(bodyEl, body);
  const actionsEl = pick(el, "actions");
  if (actions != null) {
    actionsEl.hidden = false;
    actionsEl.append(actions);
  }
  pick(el, "close").addEventListener("click", () => el.close(), { signal });

  return {
    el,
    bodyEl,
    actionsEl,
    open: () => el.showModal(),
    close: () => el.close(),
  };
}

export const { warm: warmDialog, sync: createDialogSync, create: createDialog } =
  defineComponent(import.meta.url, "dialog", buildDialog);
