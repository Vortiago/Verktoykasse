// @ts-check
// Chip — a compact inline pill/badge with an optional tone and leading dot.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {"ok" | "warn" | "bad" | "info" | "accent"} ChipTone */

/**
 * @param {{ text: string, tone?: ChipTone | null, dot?: boolean }} props
 *   text - the label.
 *   tone - semantic color (omit for neutral).
 *   dot - show a small leading dot tinted to the tone.
 * @returns {{ el: HTMLElement, setText: (text: string) => void }}
 */
function buildChip({ text, tone = null, dot = false } = /** @type {any} */ ({})) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-chip").firstElementChild);
  const textEl = pick(el, "text");
  textEl.textContent = text;
  if (tone) el.classList.add(`tone-${tone}`);
  if (dot) pick(el, "dot").hidden = false;
  return { el, setText: (text) => { textEl.textContent = text; } };
}

export const { warm: warmChip, sync: createChipSync, create: createChip } =
  defineComponent(import.meta.url, "chip", buildChip);
