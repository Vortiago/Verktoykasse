// @ts-check
// Panel — bordered, elevated surface with an optional header + a body.
// Factory contract: create<Name>(props) → { el, …hosts }. Attaches no
// listeners, so it takes no signal; append more to the returned hosts later.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
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

/**
 * @param {{ head?: string | Node | null, body?: string | Node | null, fill?: boolean }} [props]
 *   head - header content (string or node); omit for a headless panel.
 *   body - initial body content; append more to the returned `bodyEl` later.
 *   fill - stretch to fill the container and let the body scroll.
 * @returns {Promise<{ el: HTMLElement, headEl: HTMLElement, bodyEl: HTMLElement }>}
 */
export async function createPanel({ head = null, body = null, fill: doFill = false } = {}) {
  await ensure();
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
