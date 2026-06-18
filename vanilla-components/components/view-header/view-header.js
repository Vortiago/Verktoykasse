// @ts-check
// View-header — a stage/view title block (eyebrow, title, sub) with an actions slot.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./view-header.html", import.meta.url).href),
  loadCSS(import.meta.url, "./view-header.css"),
]));

/**
 * @param {{ eyebrow?: string | null, title: string, sub?: string | null, actions?: Node | null }} props
 *   eyebrow - small label above the title (omit to hide).
 *   title - the heading.
 *   sub - a detail line under the title (omit to hide).
 *   actions - a node placed in the right-side actions slot; append more to `actionsEl` later.
 * @returns {Promise<{ el: HTMLElement, actionsEl: HTMLElement,
 *   setTitle: (title: string) => void, setSub: (sub: string | null) => void }>}
 */
export async function createViewHeader({ eyebrow = null, title, sub = null, actions = null } = /** @type {any} */ ({})) {
  await ensure();
  const el = /** @type {HTMLElement} */ (tpl("tpl-view-header").firstElementChild);

  const titleEl = pick(el, "title");
  const eyebrowEl = pick(el, "eyebrow");
  const subEl = pick(el, "sub");
  const actionsEl = pick(el, "actions");

  const setTitle = (/** @type {string} */ title) => { titleEl.textContent = title; };
  const setSub = (/** @type {string | null} */ sub) => {
    subEl.hidden = sub == null;
    if (sub != null) subEl.textContent = sub;
  };

  setTitle(title);
  if (eyebrow != null) {
    eyebrowEl.hidden = false;
    eyebrowEl.textContent = eyebrow;
  }
  setSub(sub); // hides when null (the template starts hidden), shows when provided
  if (actions != null) actionsEl.append(actions);

  return { el, actionsEl, setTitle, setSub };
}
