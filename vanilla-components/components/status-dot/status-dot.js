// @ts-check
// Status-dot — a small colored dot with an optional pulse and trailing label.
// setTone/setPulse mutate in place so a polled status flips without a DOM swap.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";
import { applyTone } from "../../lib/tone.js";

/** @typedef {import("../../lib/tone.js").ToneName} DotTone */

/**
 * @param {{ tone?: DotTone | (string & {}) | null, pulse?: boolean, label?: string | null }} [props]
 *   tone - a named tone, a raw CSS colour, or "neutral"/null for the quiet default.
 * @returns {{ el: HTMLElement,
 *   setTone: (tone: DotTone | (string & {}) | null) => void, setPulse: (on: boolean) => void }}
 */
function buildStatusDot({ tone = "neutral", pulse = false, label = null } = {}) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-status-dot").firstElementChild);

  /** @param {DotTone | (string & {}) | null} t */
  const setTone = (t) => applyTone(el, t);
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
