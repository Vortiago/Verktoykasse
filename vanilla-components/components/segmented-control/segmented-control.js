// @ts-check
// segmented-control — a bordered radio/toggle group; setCurrent() marks the active option.
import { loadTemplates, tpl, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./segmented-control.html", import.meta.url).href),
  loadCSS(import.meta.url, "./segmented-control.css"),
]));

/**
 * @param {{ options: { id: string, label: string }[], current?: string | null, onSelect?: (id: string) => void }} props
 * @param {AbortSignal} [signal] - required only when `onSelect` is given.
 * @returns {Promise<{ el: HTMLElement, setCurrent: (id: string) => void }>}
 */
export async function createSegmentedControl({ options, current = null, onSelect } = /** @type {any} */ ({}), signal) {
  await ensure();
  const el = /** @type {HTMLElement} */ (tpl("tpl-segmented-control").firstElementChild);

  /** @type {Map<string, HTMLButtonElement>} */
  const opts = new Map();
  for (const o of options) {
    const node = tpl("tpl-segmented-control-opt");
    const btn = /** @type {HTMLButtonElement} */ (node.firstElementChild);
    btn.textContent = o.label;
    if (onSelect) btn.addEventListener("click", () => onSelect(o.id), { signal });
    opts.set(o.id, btn);
    el.append(node);
  }

  const setCurrent = (/** @type {string} */ id) => {
    for (const [oid, btn] of opts) {
      const on = oid === id;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    }
  };
  if (current != null) setCurrent(current);

  return { el, setCurrent };
}
