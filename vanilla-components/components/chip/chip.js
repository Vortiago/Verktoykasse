// @ts-check
// Chip — a compact inline pill/badge with an optional tone and leading dot.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";
import { applyTone } from "../../lib/tone.js";

/** @typedef {import("../../lib/tone.js").ToneName} ChipTone */

/**
 * @param {{ text: string, tone?: ChipTone | (string & {}) | null, dot?: boolean }} props
 *   text - the label.
 *   tone - a named semantic tone, a raw CSS colour, or "neutral"/omit for the default.
 *   dot - show a small leading dot tinted to the tone.
 * @returns {{ el: HTMLElement, setText: (text: string) => void }}
 */
function buildChip({ text, tone = null, dot = false } = /** @type {any} */ ({})) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-chip").firstElementChild);
  const textEl = pick(el, "text");
  textEl.textContent = text;
  applyTone(el, tone); // named tone → tone-<name>; raw colour → tone-custom + inline --tone
  if (dot) pick(el, "dot").hidden = false;
  return { el, setText: (text) => { textEl.textContent = text; } };
}

export const { warm: warmChip, sync: createChipSync, create: createChip } =
  defineComponent(import.meta.url, "chip", buildChip);
