// @ts-check
// Alert — an inline banner with a tone, optional title, and optional dismiss.
// Dismiss is a custom Invoker Command (`command="--dismiss"`), not a click
// listener: the ✕ commandForElement's straight at `el`, and the root's ONE
// `command` listener runs `dismiss()` for either that internal ✕ or any
// caller-authored button that `commandfor`s this alert's (caller-assigned) id.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";
import { applyTone } from "../../lib/tone.js";

/**
 * @param {{ tone?: import("../../lib/tone.js").ToneName | (string & {}) | null,
 *   title?: string | null, message: string, dismissible?: boolean,
 *   onDismiss?: () => void }} props
 * @param {AbortSignal} [signal] - required only when `dismissible` is set.
 * @returns {{ el: HTMLElement, setMessage: (message: string) => void, dismiss: () => void }}
 */
function buildAlert({ tone = null, title = null, message, dismissible = false, onDismiss } = /** @type {any} */ ({}), signal) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-alert").firstElementChild);
  applyTone(el, tone);
  // bad is assertive (an error the user must see); everything else is polite.
  el.setAttribute("role", tone === "bad" ? "alert" : "status");

  if (title != null) {
    const titleEl = pick(el, "title");
    titleEl.hidden = false;
    titleEl.textContent = title;
  }
  const msgEl = pick(el, "message");
  msgEl.textContent = message;

  const dismiss = () => el.remove();

  // The close button lives in the template for the dismissible case; when not
  // dismissible, remove it entirely so its "×" glyph doesn't leak into the
  // alert's textContent (which would trip a consumer's exact-text assertions).
  const closeBtn = /** @type {HTMLButtonElement & { commandForElement?: Element | null }} */ (pick(el, "close"));
  if (dismissible) {
    closeBtn.hidden = false;
    // Declarative face: a custom Invoker Command instead of a click listener.
    // commandForElement (the IDL reflection) wires the button to `el` with no id
    // needed — alert instances aren't given one. One root `command` listener
    // replaces the old click listener; a caller-authored EXTERNAL button can
    // dismiss this same alert too, via `commandfor` pointing at an id the caller
    // sets on the root. Chrome/Edge ≥135 (see reference/compat.md).
    closeBtn.commandForElement = el;
    closeBtn.setAttribute("command", "--dismiss");
    el.addEventListener("command", (e) => {
      const evt = /** @type {Event & { command: string }} */ (e);
      if (evt.command === "--dismiss") { dismiss(); onDismiss?.(); }
    }, { signal });
  } else {
    closeBtn.remove();
  }

  return { el, setMessage: (m) => { msgEl.textContent = m; }, dismiss };
}

export const { warm: warmAlert, sync: createAlertSync, create: createAlert } =
  defineComponent(import.meta.url, "alert", buildAlert);
