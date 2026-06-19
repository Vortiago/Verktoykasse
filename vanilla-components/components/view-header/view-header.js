// @ts-check
// View-header — a stage/view title block (eyebrow, title, sub) with an actions slot.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/**
 * @param {{ eyebrow?: string | null, title: string, sub?: string | null,
 *   actions?: Node | null, dense?: boolean }} props
 *   eyebrow - small label above the title (omit to hide).
 *   title - the heading.
 *   sub - a detail line under the title (omit to hide).
 *   actions - a node placed in the right-side actions slot; append more to `actionsEl` later.
 *   dense - a compact one-line bar (smaller title, inline eyebrow/sub, no rule) —
 *     the section/toolbar header that sits between a page title and a plain row.
 * @returns {{ el: HTMLElement, actionsEl: HTMLElement,
 *   setTitle: (title: string) => void, setSub: (sub: string | null) => void }}
 */
function buildViewHeader({ eyebrow = null, title, sub = null, actions = null, dense = false } = /** @type {any} */ ({})) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-view-header").firstElementChild);
  if (dense) el.classList.add("is-dense");

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

export const { warm: warmViewHeader, sync: createViewHeaderSync, create: createViewHeader } =
  defineComponent(import.meta.url, "view-header", buildViewHeader);
