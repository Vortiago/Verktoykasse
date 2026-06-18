// @ts-check
// Status-dot — a small colored dot with an optional pulse and trailing label.
// setTone/setPulse mutate in place so a polled status flips without a DOM swap.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
/** Load template + CSS once; await before createStatusDotSync. */
export const warmStatusDot = () => (ready ??= Promise.all([
  loadTemplates(new URL("./status-dot.html", import.meta.url).href),
  loadCSS(import.meta.url, "./status-dot.css"),
]));

/** @typedef {"neutral" | "ok" | "warn" | "bad" | "info" | "accent"} DotTone */

/**
 * Synchronous build - requires warmStatusDot() resolved. For renderRegion rebuilds.
 * @param {{ tone?: DotTone, pulse?: boolean, label?: string | null }} [props]
 * @returns {{ el: HTMLElement,
 *   setTone: (tone: DotTone) => void, setPulse: (on: boolean) => void }}
 */
export function createStatusDotSync({ tone = "neutral", pulse = false, label = null } = {}) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-status-dot").firstElementChild);

  /** @param {DotTone} t */
  const setTone = (t) => {
    for (const cls of [...el.classList]) if (cls.startsWith("tone-")) el.classList.remove(cls);
    if (t !== "neutral") el.classList.add(`tone-${t}`);
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

/** Warm + build (also what the design-sync shim uses).
 * @param {{ tone?: DotTone, pulse?: boolean, label?: string | null }} [props]
 * @returns {Promise<{ el: HTMLElement,
 *   setTone: (tone: DotTone) => void, setPulse: (on: boolean) => void }>}
 */
export async function createStatusDot(props = {}) {
  await warmStatusDot();
  return createStatusDotSync(props);
}
