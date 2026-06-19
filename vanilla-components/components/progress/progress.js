// @ts-check
// progress — a fill meter; setValue() mutates the width in place for polled data.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
/** Load template + CSS once; await before createProgressSync. */
export const warmProgress = () => (ready ??= Promise.all([
  loadTemplates(new URL("./progress.html", import.meta.url).href),
  loadCSS(import.meta.url, "./progress.css"),
]));

/**
 * Synchronous build - requires warmProgress() resolved. For renderRegion rebuilds.
 * @param {{ value: number, max?: number, tone?: "ok" | "warn" | "bad" | "accent" | null, label?: string | null }} props
 * @returns {{ el: HTMLElement, setValue: (value: number, max?: number) => void }}
 */
export function createProgressSync({ value, max = 100, tone = null, label = null } = /** @type {any} */ ({})) {
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

/** Warm + build (also what the design-sync shim uses).
 * @param {{ value: number, max?: number, tone?: "ok" | "warn" | "bad" | "accent" | null, label?: string | null }} props
 * @returns {Promise<{ el: HTMLElement, setValue: (value: number, max?: number) => void }>}
 */
export async function createProgress(props = /** @type {any} */ ({})) {
  await warmProgress();
  return createProgressSync(props);
}
