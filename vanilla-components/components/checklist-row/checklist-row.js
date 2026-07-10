// @ts-check
// checklist-row - a done/undone item: a leading box marker ([x] / [ ]) plus text.
// setDone() toggles the [data-done] attribute (CSS drives the strikethrough/dim)
// and rewrites the box glyph — that stays the imperative face. The row also
// wires ONE root `command` listener for a custom `--toggle` Invoker Command: the
// row itself owns no button, so a caller-authored one elsewhere on the page
// drives it via `commandfor` pointing at an id the caller sets on `el`. Chrome/Edge
// ≥135 (see reference/compat.md); `onToggle` is the callback-prop half for
// component-internal wiring, unaffected either way.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {{ text: string, done?: boolean, onToggle?: (done: boolean) => void }} ChecklistRowProps */
/** @typedef {{ el: HTMLElement, setDone: (done: boolean) => void }} ChecklistRowHandle */

/** Synchronous build - requires warmChecklistRow() to have resolved (else tpl() throws).
 * Use inside a renderRegion rebuild after warming once at mount.
 *   text - the item label.
 *   done - whether the item is checked (strikethrough + dim + [x] marker).
 *   onToggle - fires with the new done state when a `--toggle` command lands.
 * @param {ChecklistRowProps} props
 * @param {AbortSignal} [signal] - required only if a caller wires a `--toggle` command button.
 * @returns {ChecklistRowHandle} */
function buildChecklistRow({ text, done = false, onToggle } = /** @type {any} */ ({}), signal) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-checklist-row").firstElementChild);
  pick(el, "text").textContent = text;
  const boxEl = pick(el, "box");
  const setDone = (/** @type {boolean} */ done) => {
    el.dataset.done = done ? "true" : "false";
    boxEl.textContent = done ? "[x]" : "[ ]";
  };
  setDone(done);

  el.addEventListener("command", (e) => {
    const evt = /** @type {Event & { command: string }} */ (e);
    if (evt.command === "--toggle") { const next = el.dataset.done !== "true"; setDone(next); onToggle?.(next); }
  }, { signal });

  return { el, setDone };
}

export const { warm: warmChecklistRow, sync: createChecklistRowSync, create: createChecklistRow } =
  defineComponent(import.meta.url, "checklist-row", buildChecklistRow);
