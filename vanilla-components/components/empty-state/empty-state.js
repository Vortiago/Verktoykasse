// @ts-check
// empty-state — a centered icon + title + detail placeholder.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
/** Load template + CSS once; await before createEmptyStateSync. */
export const warmEmptyState = () => (ready ??= Promise.all([
  loadTemplates(new URL("./empty-state.html", import.meta.url).href),
  loadCSS(import.meta.url, "./empty-state.css"),
]));

/**
 * Synchronous build - requires warmEmptyState() resolved. For renderRegion rebuilds.
 * @param {{ icon?: string | null, title: string, detail?: string | null }} props
 * @returns {{ el: HTMLElement }}
 */
export function createEmptyStateSync({ icon = null, title, detail = null } = /** @type {any} */ ({})) {
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

/** Warm + build (also what the design-sync shim uses).
 * @param {{ icon?: string | null, title: string, detail?: string | null }} props
 * @returns {Promise<{ el: HTMLElement }>}
 */
export async function createEmptyState(props = /** @type {any} */ ({})) {
  await warmEmptyState();
  return createEmptyStateSync(props);
}
