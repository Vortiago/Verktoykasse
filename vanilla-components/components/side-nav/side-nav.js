// @ts-check
// Side-nav — grouped vertical nav (the left pane). Item badges compose the chip
// component. The `journey` group variant numbers its items and joins them with a
// connecting line. Routing convention: items render <a href="#/<id>">; the app
// owns hashchange and calls setCurrent(id) to mark the active item.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";
import { warmChip, createChipSync } from "../chip/chip.js";

/** @typedef {{ text: string, tone?: "ok" | "warn" | "bad" | "info" | "accent" }} NavChip */
/** @typedef {{ id: string, label: string, icon?: string, chip?: NavChip, done?: boolean }} NavItem */
/** @typedef {{ label?: string, variant?: "list" | "journey", items: NavItem[] }} NavGroup */
/** @typedef {{ groups: NavGroup[], current?: string | null, onSelect?: (id: string) => void }} SideNavProps */
/** @typedef {{ el: HTMLElement, setCurrent: (id: string) => void }} SideNavHandle */

/** Synchronous build — requires warmSideNav() (side-nav + chip templates) resolved.
 *   groups - sections; a `journey` group numbers items + draws the pipeline line.
 *   current - id of the active item.
 *   onSelect - optional click callback (routing is native via the anchors).
 * @param {SideNavProps} [props]
 * @param {AbortSignal} [signal] - required only when `onSelect` is given.
 * @returns {SideNavHandle} */
function buildSideNav({ groups, current = null, onSelect } = /** @type {any} */ ({}), signal) {
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

    for (const [i, item] of group.items.entries()) {
      const node = tpl("tpl-side-nav-item");
      const a = /** @type {HTMLAnchorElement} */ (pick(node, "link"));
      a.href = `#/${item.id}`;
      if (item.done) a.classList.add("is-done");

      const lead = pick(node, "lead");
      if (journey) {
        lead.classList.add("is-num");
        lead.textContent = item.done ? "✓" : String(i + 1);
      } else if (item.icon != null) {
        lead.textContent = item.icon;
      } else {
        lead.hidden = true;
      }

      pick(node, "label").textContent = item.label;

      const chipHost = pick(node, "chip");
      if (item.chip) {
        const chip = createChipSync({ text: item.chip.text, tone: item.chip.tone ?? null });
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

  // aria-current="page" marks the active item (matches app-bar). A real token,
  // not the empty "" toggleAttribute would set; [aria-current] CSS still matches.
  const setCurrent = (/** @type {string} */ id) => {
    for (const [lid, a] of links) {
      if (lid === id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  };
  if (current != null) setCurrent(current);

  return { el, setCurrent };
}

// composes chip: warmSideNav() readies the chip template too, so createSideNavSync
// (used for item badges via createChipSync) can build without an extra await.
export const { warm: warmSideNav, sync: createSideNavSync, create: createSideNav } =
  defineComponent(import.meta.url, "side-nav", buildSideNav, [warmChip]);
