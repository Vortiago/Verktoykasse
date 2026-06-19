// @ts-check
// kv-row — a labeled value line; setValue() mutates in place for polled data.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {{ label: string, value: string | number, tone?: "ok" | "warn" | "bad" | "accent" | null }} KvRowProps */
/** @typedef {{ el: HTMLElement, setValue: (value: string | number) => void }} KvRowHandle */

/** Synchronous build — requires warmKvRow() resolved. For renderRegion rebuilds.
 *   label - the key/name (named `label`, not `key`, since `key` is React-reserved).
 * @param {KvRowProps} props @returns {KvRowHandle} */
function buildKvRow({ label, value, tone = null } = /** @type {any} */ ({})) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-kv-row").firstElementChild);
  pick(el, "label").textContent = label;
  const valueEl = pick(el, "value");
  valueEl.textContent = String(value);
  if (tone) el.classList.add(`tone-${tone}`);
  return { el, setValue: (value) => { valueEl.textContent = String(value); } };
}

export const { warm: warmKvRow, sync: createKvRowSync, create: createKvRow } =
  defineComponent(import.meta.url, "kv-row", buildKvRow);
