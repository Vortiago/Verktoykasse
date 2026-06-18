// @ts-check
// empty-state — a centered icon + title + detail placeholder.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./empty-state.html", import.meta.url).href),
  loadCSS(import.meta.url, "./empty-state.css"),
]));

/**
 * @param {{ icon?: string | null, title: string, detail?: string | null }} props
 * @returns {Promise<{ el: HTMLElement }>}
 */
export async function createEmptyState({ icon = null, title, detail = null } = /** @type {any} */ ({})) {
  await ensure();
  const el = /** @type {HTMLElement} */ (tpl("tpl-empty-state").firstElementChild);
  if (icon != null) {
    const iconEl = pick(el, "icon");
    iconEl.hidden = false;
    iconEl.textContent = icon;
  }
  pick(el, "title").textContent = title;
  if (detail != null) {
    const detailEl = pick(el, "detail");
    detailEl.hidden = false;
    detailEl.textContent = detail;
  }
  return { el };
}
