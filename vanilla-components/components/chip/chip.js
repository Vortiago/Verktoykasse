// @ts-check
// Chip — a compact inline pill/badge with an optional tone and leading dot.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
/** Load template + CSS once; await before createChipSync. */
export const warmChip = () => (ready ??= Promise.all([
  loadTemplates(new URL("./chip.html", import.meta.url).href),
  loadCSS(import.meta.url, "./chip.css"),
]));

/** @typedef {"ok" | "warn" | "bad" | "info" | "accent"} ChipTone */

/**
 * Synchronous build - requires warmChip() resolved. For renderRegion rebuilds.
 * @param {{ text: string, tone?: ChipTone | null, dot?: boolean }} props
 *   text - the label.
 *   tone - semantic color (omit for neutral).
 *   dot - show a small leading dot tinted to the tone.
 * @returns {{ el: HTMLElement, setText: (text: string) => void }}
 */
export function createChipSync({ text, tone = null, dot = false } = /** @type {any} */ ({})) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-chip").firstElementChild);
  const textEl = pick(el, "text");
  textEl.textContent = text;
  if (tone) el.classList.add(`tone-${tone}`);
  if (dot) pick(el, "dot").hidden = false;
  return { el, setText: (text) => { textEl.textContent = text; } };
}

/** Warm + build (also what the design-sync shim uses).
 * @param {{ text: string, tone?: ChipTone | null, dot?: boolean }} props
 * @returns {Promise<{ el: HTMLElement, setText: (text: string) => void }>}
 */
export async function createChip(props = /** @type {any} */ ({})) {
  await warmChip();
  return createChipSync(props);
}
