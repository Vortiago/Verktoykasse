// @ts-check
// progress — a fill meter; setValue() mutates the width in place for polled data.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/**
 * @param {{ value: number, max?: number, tone?: "ok" | "warn" | "bad" | "accent" | null, label?: string | null }} props
 * @returns {{ el: HTMLElement, setValue: (value: number, max?: number) => void }}
 */
function buildProgress({ value, max = 100, tone = null, label = null } = /** @type {any} */ ({})) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-progress").firstElementChild);
  if (tone) el.classList.add(`tone-${tone}`);
  const fill = pick(el, "fill");
  let curMax = max;
  /** @param {number} v @param {number} [m] */
  const apply = (v, m) => {
    if (m != null) curMax = m;
    const pct = curMax > 0 ? (v / curMax) * 100 : 0;
    fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  };
  apply(value, max);
  if (label != null) {
    const labelEl = pick(el, "label");
    labelEl.hidden = false;
    labelEl.textContent = label;
  }
  return { el, setValue: (value, max) => apply(value, max) };
}

export const { warm: warmProgress, sync: createProgressSync, create: createProgress } =
  defineComponent(import.meta.url, "progress", buildProgress);
