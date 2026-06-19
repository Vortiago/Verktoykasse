// @ts-check
// checklist-row - a done/undone item: a leading box marker ([x] / [ ]) plus text.
// setDone() toggles the [data-done] attribute (CSS drives the strikethrough/dim)
// and rewrites the box glyph.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
/** Load the template + CSS once. Await before calling createChecklistRowSync -
 * needed to use the component inside a synchronous renderRegion rebuild. */
export const warmChecklistRow = () => (ready ??= Promise.all([
  loadTemplates(new URL("./checklist-row.html", import.meta.url).href),
  loadCSS(import.meta.url, "./checklist-row.css"),
]));

/** @typedef {{ text: string, done?: boolean }} ChecklistRowProps */
/** @typedef {{ el: HTMLElement, setDone: (done: boolean) => void }} ChecklistRowHandle */

/** Synchronous build - requires warmChecklistRow() to have resolved (else tpl() throws).
 * Use inside a renderRegion rebuild after warming once at mount.
 *   text - the item label.
 *   done - whether the item is checked (strikethrough + dim + [x] marker).
 * @param {ChecklistRowProps} props @returns {ChecklistRowHandle} */
export function createChecklistRowSync({ text, done = false } = /** @type {any} */ ({})) {
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

/** Warm + build. The convenience path (and what the design-sync shim uses).
 * @param {ChecklistRowProps} props @returns {Promise<ChecklistRowHandle>} */
export async function createChecklistRow(props = /** @type {any} */ ({})) {
  await warmChecklistRow();
  return createChecklistRowSync(props);
}
