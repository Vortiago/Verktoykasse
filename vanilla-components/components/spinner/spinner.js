// @ts-check
// Spinner — an indeterminate loading ring with an optional label.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/**
 * @param {{ size?: number, label?: string | null }} [props]
 *   size - ring diameter in px (default 16); label - visible + accessible text.
 * @returns {{ el: HTMLElement }}
 */
function buildSpinner({ size = 16, label = null } = {}) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-spinner").firstElementChild);
  pick(el, "ring").style.setProperty("--spinner-size", `${size}px`);
  if (label != null) {
    const labelEl = pick(el, "label");
    labelEl.hidden = false;
    labelEl.textContent = label;
    el.setAttribute("aria-label", label);
  } else {
    el.setAttribute("aria-label", "Loading");
  }
  return { el };
}

export const { warm: warmSpinner, sync: createSpinnerSync, create: createSpinner } =
  defineComponent(import.meta.url, "spinner", buildSpinner);
