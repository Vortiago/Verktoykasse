// @ts-check
// Tooltip — a positioned hover card. The component owns the chrome and the
// edge-clamped placement on the top layer (manual popover); the caller drives
// show/hide and supplies the body. Promoted from GitLandscape's shared tooltip.
import { loadTemplates, tpl, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./tooltip.html", import.meta.url).href),
  loadCSS(import.meta.url, "./tooltip.css"),
]));

/** Pure edge-clamping: prefer below-right of (x, y) by `offset`, flip to the
 * other side at the right/bottom edges (`bottomReserve` keeps clear of a HUD
 * strip), never leave the `pad` margin at top-left.
 * @param {number} x @param {number} y @param {number} tw @param {number} th
 * @param {number} vw @param {number} vh
 * @param {{ offset?: number, pad?: number, bottomReserve?: number }} [opts]
 * @returns {{ left: number, top: number }} */
export function clampTip(x, y, tw, th, vw, vh, { offset = 14, pad = 8, bottomReserve = 0 } = {}) {
  let left = x + offset;
  let top = y + offset;
  if (left + tw > vw - pad) left = x - tw - offset;
  if (top + th > vh - bottomReserve) top = y - th - offset;
  return { left: Math.max(pad, left), top: Math.max(pad, top) };
}

/**
 * @param {HTMLElement} host - placement is host-local; the node is appended here.
 * @param {{ className?: string }} [opts] - extra class(es) for per-use skinning.
 * @param {AbortSignal} [signal] - when it aborts, the tooltip disposes itself.
 * @returns {Promise<{
 *   node: HTMLElement,
 *   show: (content: string | Node | null | undefined, x: number, y: number,
 *     box?: { vw?: number, vh?: number, offset?: number, pad?: number, bottomReserve?: number }) => void,
 *   hide: () => void,
 *   dispose: () => void,
 * }>}
 */
export async function createTooltip(host, { className = "" } = {}, signal) {
  await ensure();
  const node = /** @type {HTMLElement} */ (tpl("tpl-tooltip").firstElementChild);
  if (className) node.className = (node.className + " " + className).trim();
  host.appendChild(node);

  const canPopover = typeof node.showPopover === "function";
  const popped = () => canPopover && node.matches(":popover-open");

  const api = {
    node,
    /** @param {string | Node | null | undefined} content `null` repositions without refilling.
     * @param {number} x @param {number} y
     * @param {{ vw?: number, vh?: number, offset?: number, pad?: number, bottomReserve?: number }} [box] */
    show(content, x, y, { vw, vh, ...clampOpts } = {}) {
      // string → text (safe); Node → adopt; null → reposition only (a
      // hover-move must not rebuild the body per pointer event).
      if (typeof content === "string") node.textContent = content;
      else if (content != null) node.replaceChildren(content);
      // showPopover only on the hidden→shown edge — re-showing an open popover throws.
      if (canPopover && !popped()) node.showPopover();
      node.classList.add("show");
      const tw = node.offsetWidth || 220;
      const th = node.offsetHeight || 90;
      const place = clampTip(
        x, y, tw, th,
        vw ?? globalThis.innerWidth ?? 1200,
        vh ?? globalThis.innerHeight ?? 800,
        clampOpts,
      );
      // x/y (and the clamp) are host-local; in the top layer the containing
      // block is the viewport, so translate by the host's viewport offset.
      const r = popped() ? host.getBoundingClientRect() : { left: 0, top: 0 };
      node.style.left = r.left + place.left + "px";
      node.style.top = r.top + place.top + "px";
    },
    hide() {
      node.classList.remove("show");
      if (popped()) node.hidePopover();
    },
    dispose() {
      node.remove(); // disconnecting force-hides an open popover, per spec
    },
  };

  signal?.addEventListener("abort", () => api.dispose(), { once: true });
  return api;
}
