// @ts-check
// Status-dot — a small colored dot with an optional pulse and trailing label.
// setTone/setPulse mutate in place so a polled status flips without a DOM swap.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {"neutral" | "ok" | "warn" | "bad" | "info" | "accent"} DotTone */

/**
 * @param {{ tone?: DotTone | null, pulse?: boolean, label?: string | null }} [props]
 *   tone - a named tone; null is treated as "neutral", the quiet default —
 *     so chip's null and status-dot's neutral mean the same. (Raw colours,
 *     which chip accepts, aren't supported here.)
 * @returns {{ el: HTMLElement,
 *   setTone: (tone: DotTone | null) => void, setPulse: (on: boolean) => void }}
 */
function buildStatusDot({ tone = "neutral", pulse = false, label = null } = {}) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-status-dot").firstElementChild);

  /** @param {DotTone | null} t */
  const setTone = (t) => {
    for (const cls of [...el.classList]) if (cls.startsWith("tone-")) el.classList.remove(cls);
    if (t && t !== "neutral") el.classList.add(`tone-${t}`);
  };
  setTone(tone);

  /** @param {boolean} on */
  const setPulse = (on) => { el.classList.toggle("is-pulse", on); };
  setPulse(pulse);

  if (label != null) {
    const labelEl = pick(el, "label");
    labelEl.hidden = false;
    labelEl.textContent = label;
  }

  return { el, setTone, setPulse };
}

export const { warm: warmStatusDot, sync: createStatusDotSync, create: createStatusDot } =
  defineComponent(import.meta.url, "status-dot", buildStatusDot);
