// @ts-check
// Panel — bordered, elevated surface with an optional header + a body.
// Factory contract: create<Name>(props) → { el, …hosts }. Attaches no
// listeners, so it takes no signal; append more to the returned hosts later.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
/** Load the template + CSS once. Await before calling createPanelSync — needed
 * to use the component inside a synchronous renderRegion rebuild. */
export const warmPanel = () => (ready ??= Promise.all([
  loadTemplates(new URL("./panel.html", import.meta.url).href),
  loadCSS(import.meta.url, "./panel.css"),
]));

/** Put a string (as text) or a Node into a host. `null`/`undefined` leaves it empty.
 * @param {HTMLElement} host @param {string | Node | null | undefined} content */
function fill(host, content) {
  if (content == null) return;
  if (typeof content === "string") host.textContent = content;
  else host.replaceChildren(content);
}

/** @typedef {{ head?: string | Node | null, body?: string | Node | null, fill?: boolean }} PanelProps */
/** @typedef {{ el: HTMLElement, headEl: HTMLElement, bodyEl: HTMLElement }} PanelHandle */

/** Synchronous build — requires warmPanel() to have resolved (else tpl() throws).
 * Use inside a renderRegion rebuild after warming once at mount.
 * @param {PanelProps} [props] @returns {PanelHandle} */
export function createPanelSync({ head = null, body = null, fill: doFill = false } = {}) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-panel").firstElementChild);
  if (doFill) el.classList.add("is-fill");
  const headEl = pick(el, "head");
  const bodyEl = pick(el, "body");
  if (head != null) {
    headEl.hidden = false;
    fill(headEl, head);
  }
  fill(bodyEl, body);
  return { el, headEl, bodyEl };
}

/** Warm + build. The convenience path (and what the design-sync shim uses).
 * @param {PanelProps} [props] @returns {Promise<PanelHandle>} */
export async function createPanel(props = {}) {
  await warmPanel();
  return createPanelSync(props);
}
