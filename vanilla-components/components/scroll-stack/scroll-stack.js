// @ts-check
// scroll-stack — a container that OWNS its overflow and lays its children out at
// their NATURAL height. The third member of the "own your scroll" set:
// panel.is-fill and table-shell own the scroll for ONE box; this owns it for a
// STACK of several cards. Use it when you stack panels (or other overflow:clip
// surfaces) taller than the viewport — as flex children of a column they'd
// shrink under negative free space and clip with NO scrollbar. Children stay in
// block flow (not flex items), so they keep full height and the stack scrolls.
// Attaches no listeners, so it takes no signal; append more to `el` later.
import { tpl } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {{ children?: (string | Node)[] }} ScrollStackProps */
/** @typedef {{ el: HTMLElement, append: (child: string | Node) => void }} ScrollStackHandle */

/** Synchronous build — requires warmScrollStack() to have resolved (else tpl() throws).
 * Use inside a renderRegion rebuild after warming once at mount.
 *   children — the cards to stack (strings as text, or Nodes), laid out at
 *   natural height; the stack scrolls when they exceed its (flex-allotted) box.
 * @param {ScrollStackProps} [props] @returns {ScrollStackHandle} */
function buildScrollStack({ children = [] } = {}) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-scroll-stack").firstElementChild);
  const append = (/** @type {string | Node} */ child) => el.append(child);
  for (const child of children) append(child);
  return { el, append };
}

export const { warm: warmScrollStack, sync: createScrollStackSync, create: createScrollStack } =
  defineComponent(import.meta.url, "scroll-stack", buildScrollStack);
