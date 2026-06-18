// @ts-check
// Side-nav — grouped vertical nav (the left pane). Item badges compose the chip
// component. The `journey` group variant numbers its items and joins them with a
// connecting line. Routing convention: items render <a href="#/<id>">; the app
// owns hashchange and calls setCurrent(id) to mark the active item.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";
import { createChip } from "../chip/chip.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./side-nav.html", import.meta.url).href),
  loadCSS(import.meta.url, "./side-nav.css"),
]));

/** @typedef {{ text: string, tone?: "ok" | "warn" | "bad" | "info" | "accent" }} NavChip */
/** @typedef {{ id: string, label: string, icon?: string, chip?: NavChip, done?: boolean }} NavItem */
/** @typedef {{ label?: string, variant?: "list" | "journey", items: NavItem[] }} NavGroup */

/**
 * @param {{ groups: NavGroup[], current?: string | null, onSelect?: (id: string) => void }} props
 *   groups - sections; a `journey` group numbers items + draws the pipeline line.
 *   current - id of the active item.
 *   onSelect - optional click callback (routing is native via the anchors).
 * @param {AbortSignal} [signal] - required only when `onSelect` is given.
 * @returns {Promise<{ el: HTMLElement, setCurrent: (id: string) => void }>}
 */
export async function createSideNav({ groups, current = null, onSelect } = /** @type {any} */ ({}), signal) {
  await ensure();
  const el = /** @type {HTMLElement} */ (tpl("tpl-side-nav").firstElementChild);

  /** @type {Map<string, HTMLAnchorElement>} */
  const links = new Map();

  for (const group of groups) {
    const g = tpl("tpl-side-nav-group");
    const journey = group.variant === "journey";
    const itemsHost = pick(g, "items");
    if (journey) itemsHost.classList.add("is-journey");
    if (group.label != null) {
      const labelEl = pick(g, "label");
      labelEl.hidden = false;
      labelEl.textContent = group.label;
    }

    let n = 0;
    for (const item of group.items) {
      n += 1;
      const node = tpl("tpl-side-nav-item");
      const a = /** @type {HTMLAnchorElement} */ (pick(node, "link"));
      a.href = `#/${item.id}`;
      if (item.done) a.classList.add("is-done");

      const lead = pick(node, "lead");
      if (journey) {
        lead.classList.add("is-num");
        lead.textContent = item.done ? "✓" : String(n);
      } else if (item.icon != null) {
        lead.textContent = item.icon;
      } else {
        lead.hidden = true;
      }

      pick(node, "label").textContent = item.label;

      const chipHost = pick(node, "chip");
      if (item.chip) {
        const chip = await createChip({ text: item.chip.text, tone: item.chip.tone ?? null });
        chipHost.append(chip.el);
      } else {
        chipHost.hidden = true;
      }

      if (onSelect) a.addEventListener("click", () => onSelect(item.id), { signal });
      links.set(item.id, a);
      itemsHost.append(node);
    }
    el.append(g);
  }

  const setCurrent = (/** @type {string} */ id) => {
    for (const [lid, a] of links) a.classList.toggle("is-active", lid === id);
  };
  if (current != null) setCurrent(current);

  return { el, setCurrent };
}
