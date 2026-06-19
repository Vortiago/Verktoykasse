// @ts-check
// empty-state — a centered icon + title + detail placeholder.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/**
 * @param {{ icon?: string | null, title: string, detail?: string | null }} props
 * @returns {{ el: HTMLElement }}
 */
function buildEmptyState({ icon = null, title, detail = null } = /** @type {any} */ ({})) {
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

export const { warm: warmEmptyState, sync: createEmptyStateSync, create: createEmptyState } =
  defineComponent(import.meta.url, "empty-state", buildEmptyState);
