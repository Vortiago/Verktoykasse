// @ts-check
// checklist-row - a done/undone item: a leading box marker ([x] / [ ]) plus text.
// setDone() toggles the [data-done] attribute (CSS drives the strikethrough/dim)
// and rewrites the box glyph.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {{ text: string, done?: boolean }} ChecklistRowProps */
/** @typedef {{ el: HTMLElement, setDone: (done: boolean) => void }} ChecklistRowHandle */

/** Synchronous build - requires warmChecklistRow() to have resolved (else tpl() throws).
 * Use inside a renderRegion rebuild after warming once at mount.
 *   text - the item label.
 *   done - whether the item is checked (strikethrough + dim + [x] marker).
 * @param {ChecklistRowProps} props @returns {ChecklistRowHandle} */
function buildChecklistRow({ text, done = false } = /** @type {any} */ ({})) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-checklist-row").firstElementChild);
  pick(el, "text").textContent = text;
  const boxEl = pick(el, "box");
  const setDone = (/** @type {boolean} */ done) => {
    el.dataset.done = done ? "true" : "false";
    boxEl.textContent = done ? "[x]" : "[ ]";
  };
  setDone(done);
  return { el, setDone };
}

export const { warm: warmChecklistRow, sync: createChecklistRowSync, create: createChecklistRow } =
  defineComponent(import.meta.url, "checklist-row", buildChecklistRow);
