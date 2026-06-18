// @ts-check
// kv-row — a labeled value line; setValue() mutates in place for polled data.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
/** Load template + CSS once; await before createKvRowSync. */
export const warmKvRow = () => (ready ??= Promise.all([
  loadTemplates(new URL("./kv-row.html", import.meta.url).href),
  loadCSS(import.meta.url, "./kv-row.css"),
]));

/** @typedef {{ label: string, value: string | number, tone?: "ok" | "warn" | "bad" | "accent" | null }} KvRowProps */
/** @typedef {{ el: HTMLElement, setValue: (value: string | number) => void }} KvRowHandle */

/** Synchronous build — requires warmKvRow() resolved. For renderRegion rebuilds.
 *   label - the key/name (named `label`, not `key`, since `key` is React-reserved).
 * @param {KvRowProps} props @returns {KvRowHandle} */
export function createKvRowSync({ label, value, tone = null } = /** @type {any} */ ({})) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-kv-row").firstElementChild);
  pick(el, "label").textContent = label;
  const valueEl = pick(el, "value");
  valueEl.textContent = String(value);
  if (tone) el.classList.add(`tone-${tone}`);
  return { el, setValue: (value) => { valueEl.textContent = String(value); } };
}

/** Warm + build (also what the design-sync shim uses).
 * @param {KvRowProps} props @returns {Promise<KvRowHandle>} */
export async function createKvRow(props = /** @type {any} */ ({})) {
  await warmKvRow();
  return createKvRowSync(props);
}
