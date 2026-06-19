// @ts-check
// Chip — a compact inline pill/badge with an optional tone and leading dot.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {"ok" | "warn" | "bad" | "info" | "accent"} ChipTone */

const NAMED_TONES = new Set(["ok", "warn", "bad", "info", "accent"]);

/** Resolve a chip `tone` into a tone class + an optional inline `--tone` colour.
 * A named tone maps to its `tone-<name>` class; `"neutral"`/`null` is the default
 * (no tone); any other string is treated as a raw CSS colour and drives the chip
 * through the shared `tone-custom` rule via `--tone`. Pure — no DOM.
 * @param {ChipTone | (string & {}) | null} [tone]
 * @returns {{ className: string | null, color: string | null }} */
export function resolveChipTone(tone) {
  if (tone == null || tone === "neutral") return { className: null, color: null };
  if (NAMED_TONES.has(tone)) return { className: `tone-${tone}`, color: null };
  return { className: "tone-custom", color: tone }; // a raw CSS colour
}

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
  const { className, color } = resolveChipTone(tone);
  if (className) el.classList.add(className);
  if (color) el.style.setProperty("--tone", color);
  if (dot) pick(el, "dot").hidden = false;
  return { el, setText: (text) => { textEl.textContent = text; } };
}

export const { warm: warmChip, sync: createChipSync, create: createChip } =
  defineComponent(import.meta.url, "chip", buildChip);
