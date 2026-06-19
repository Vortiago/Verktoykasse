// @ts-check
// App-bar — top bar with brand, a hash-routed nav, and an actions slot.
// Routing convention (not coupling): nav items render <a href="#/<id>">; the app
// keeps its own hashchange loop and calls setCurrent(id) to mark the active tab.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";
import { warmChip, createChipSync } from "../chip/chip.js";

/** @typedef {{ text: string, tone?: import("../chip/chip.js").ChipTone | (string & {}) }} NavChip */
/** @typedef {{ id: string, label: string, accent?: string, chip?: NavChip }} NavItem */

/**
 * @param {{ brand: { logo?: string, title: string, tagline?: string },
 *   items: NavItem[], current?: string | null, onSelect?: (id: string) => void }} props
 *   brand - logo (emoji/char), title, optional tagline.
 *   items - nav tabs; each renders `<a href="#/<id>">`, optional per-tab `accent`
 *     and a trailing `chip` badge (composes the chip component).
 *   current - id of the active tab.
 *   onSelect - optional click callback (routing is native via the anchors).
 * @param {AbortSignal} [signal] - required only when `onSelect` is given.
 * @returns {{ el: HTMLElement, actionsEl: HTMLElement, setCurrent: (id: string) => void }}
 */
function buildAppBar({ brand, items, current = null, onSelect } = /** @type {any} */ ({}), signal) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-app-bar").firstElementChild);

  if (brand.logo != null) {
    const logoEl = pick(el, "logo");
    logoEl.hidden = false;
    logoEl.textContent = brand.logo;
  }
  pick(el, "title").textContent = brand.title;
  if (brand.tagline != null) {
    const tagEl = pick(el, "tagline");
    tagEl.hidden = false;
    tagEl.textContent = brand.tagline;
  }

  const nav = pick(el, "nav");
  /** @type {Map<string, HTMLAnchorElement>} */
  const tabs = new Map();
  for (const item of items) {
    const node = tpl("tpl-app-bar-item");
    const a = /** @type {HTMLAnchorElement} */ (pick(node, "link"));
    a.textContent = item.label;
    a.href = `#/${item.id}`;
    if (item.accent) a.style.setProperty("--tab-accent", item.accent);
    if (item.chip) a.append(createChipSync({ text: item.chip.text, tone: item.chip.tone ?? null }).el);
    if (onSelect) a.addEventListener("click", () => onSelect(item.id), { signal });
    tabs.set(item.id, a);
    nav.append(node);
  }

  const setCurrent = (/** @type {string} */ id) => {
    // aria-current="page" (a meaningful token; the empty "" from toggleAttribute
    // is treated as absent/false by assistive tech). [aria-current] CSS still matches.
    for (const [tid, a] of tabs) {
      if (tid === id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  };
  if (current != null) setCurrent(current);

  return { el, actionsEl: pick(el, "actions"), setCurrent };
}

const base = defineComponent(import.meta.url, "app-bar", buildAppBar);

/** Warm app-bar + its composed chip template (item badges use createChipSync). */
export const warmAppBar = () => Promise.all([base.warm(), warmChip()]);
/** Synchronous build — requires warmAppBar() resolved. @type {typeof buildAppBar} */
export const createAppBarSync = base.sync;
/** Warm (app-bar + chip) then build.
 * @type {(props?: Parameters<typeof buildAppBar>[0], signal?: AbortSignal) => Promise<ReturnType<typeof buildAppBar>>} */
export async function createAppBar(props, signal) {
  await warmAppBar();
  return base.sync(props, signal);
}
