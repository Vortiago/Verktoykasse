// @ts-check
// App-bar — top bar with brand, a hash-routed nav, and an actions slot.
// Routing convention (not coupling): nav items render <a href="#/<id>">; the app
// keeps its own hashchange loop and calls setCurrent(id) to mark the active tab.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./app-bar.html", import.meta.url).href),
  loadCSS(import.meta.url, "./app-bar.css"),
]));

/** @typedef {{ id: string, label: string, accent?: string }} NavItem */

/**
 * @param {{ brand: { logo?: string, title: string, tagline?: string },
 *   items: NavItem[], current?: string | null, onSelect?: (id: string) => void }} props
 *   brand - logo (emoji/char), title, optional tagline.
 *   items - nav tabs; each renders `<a href="#/<id>">`, optional per-tab `accent`.
 *   current - id of the active tab.
 *   onSelect - optional click callback (routing is native via the anchors).
 * @param {AbortSignal} [signal] - required only when `onSelect` is given.
 * @returns {Promise<{ el: HTMLElement, actionsEl: HTMLElement, setCurrent: (id: string) => void }>}
 */
export async function createAppBar({ brand, items, current = null, onSelect } = /** @type {any} */ ({}), signal) {
  await ensure();
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
    if (onSelect) a.addEventListener("click", () => onSelect(item.id), { signal });
    tabs.set(item.id, a);
    nav.append(node);
  }

  const setCurrent = (/** @type {string} */ id) => {
    for (const [tid, a] of tabs) a.toggleAttribute("aria-current", tid === id);
  };
  if (current != null) setCurrent(current);

  return { el, actionsEl: pick(el, "actions"), setCurrent };
}
