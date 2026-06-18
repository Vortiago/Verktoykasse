// @ts-check
// kv-row — a labeled value line; setValue() mutates in place for polled data.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./kv-row.html", import.meta.url).href),
  loadCSS(import.meta.url, "./kv-row.css"),
]));

/**
 * @param {{ label: string, value: string | number, tone?: "ok" | "warn" | "bad" | "accent" | null }} props
 *   label - the key/name (named `label`, not `key`, since `key` is React-reserved).
 * @returns {Promise<{ el: HTMLElement, setValue: (value: string | number) => void }>}
 */
export async function createKvRow({ label, value, tone = null } = /** @type {any} */ ({})) {
  await ensure();
  const el = /** @type {HTMLElement} */ (tpl("tpl-kv-row").firstElementChild);
  pick(el, "label").textContent = label;
  const valueEl = pick(el, "value");
  valueEl.textContent = String(value);
  if (tone) el.classList.add(`tone-${tone}`);
  return { el, setValue: (value) => { valueEl.textContent = String(value); } };
}
