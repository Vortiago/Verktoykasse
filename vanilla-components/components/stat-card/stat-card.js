// @ts-check
// Stat-card — a labeled hero number with optional unit + hint, plus an in-place
// update() so polled values mutate without a DOM swap (the canonical example).
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
/** Load template + CSS once; await before createStatCardSync. */
export const warmStatCard = () => (ready ??= Promise.all([
  loadTemplates(new URL("./stat-card.html", import.meta.url).href),
  loadCSS(import.meta.url, "./stat-card.css"),
]));

/** @typedef {"ok" | "warn" | "bad" | "accent"} StatTone */

/**
 * Synchronous build - requires warmStatCard() resolved. For renderRegion rebuilds.
 * @param {{ label: string, value: string | number, unit?: string | null,
 *   hint?: string | null, tone?: StatTone | null, onSelect?: () => void }} props
 * @param {AbortSignal} [signal] - required only when `onSelect` is given.
 * @returns {{ el: HTMLElement,
 *   update: (value: string | number, hint?: string | null) => void }}
 */
export function createStatCardSync(
  { label, value, unit = null, hint = null, tone = null, onSelect } = /** @type {any} */ ({}),
  signal,
) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-stat-card").firstElementChild);
  pick(el, "label").textContent = label;

  const numEl = pick(el, "value");
  numEl.textContent = String(value);

  if (unit != null) {
    const unitEl = pick(el, "unit");
    unitEl.hidden = false;
    unitEl.textContent = unit;
  }

  const hintEl = pick(el, "hint");
  if (hint != null) {
    hintEl.hidden = false;
    hintEl.textContent = hint;
  }

  if (tone) el.classList.add(`tone-${tone}`);

  if (onSelect) {
    el.classList.add("is-clickable");
    el.addEventListener("click", onSelect, { signal });
  }

  return {
    el,
    update(value, hint = null) {
      numEl.textContent = String(value);
      if (hint != null) {
        hintEl.hidden = false;
        hintEl.textContent = hint;
      }
    },
  };
}

/** Warm + build (also what the design-sync shim uses).
 * @param {{ label: string, value: string | number, unit?: string | null,
 *   hint?: string | null, tone?: StatTone | null, onSelect?: () => void }} props
 * @param {AbortSignal} [signal] - required only when `onSelect` is given.
 * @returns {Promise<{ el: HTMLElement,
 *   update: (value: string | number, hint?: string | null) => void }>}
 */
export async function createStatCard(props = /** @type {any} */ ({}), signal) {
  await warmStatCard();
  return createStatCardSync(props, signal);
}
