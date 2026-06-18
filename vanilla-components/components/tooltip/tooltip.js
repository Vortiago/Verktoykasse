// @ts-check
// Tooltip — a hover/focus card tethered to a trigger element. The tip rides the
// top layer as a manual popover; CSS Anchor Positioning (position-anchor +
// position-area + position-try-fallbacks, in tooltip.css) does the placement and
// the edge-flip. No manual coordinate math. Shows on the trigger's hover/focus.
import { loadTemplates, tpl, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./tooltip.html", import.meta.url).href),
  loadCSS(import.meta.url, "./tooltip.css"),
]));

let seq = 0; // unique anchor-name per instance

/**
 * @param {HTMLElement} trigger - the tip anchors to this element and shows on its hover/focus.
 * @param {{ content?: string | Node | null, className?: string }} [opts] - body + per-use class.
 * @param {AbortSignal} [signal] - aborting disposes the tooltip (removes tip + listeners).
 * @returns {Promise<{ el: HTMLElement, setContent: (content: string | Node) => void, show: () => void, hide: () => void, dispose: () => void }>}
 */
export async function createTooltip(trigger, { content = null, className = "" } = {}, signal) {
  await ensure();
  const el = /** @type {HTMLElement} */ (tpl("tpl-tooltip").firstElementChild);
  if (className) el.className = (el.className + " " + className).trim();

  /** @param {string | Node | null} c */
  const setContent = (c) => {
    if (c == null) return;
    if (typeof c === "string") el.textContent = c;
    else el.replaceChildren(c);
  };
  setContent(content);

  // tether: a unique anchor-name on the trigger, referenced by the tip
  const name = `--tip-${++seq}`;
  trigger.style.setProperty("anchor-name", name);
  el.style.setProperty("position-anchor", name);
  document.body.appendChild(el);

  const show = () => { if (!el.matches(":popover-open")) el.showPopover(); };
  const hide = () => { if (el.matches(":popover-open")) el.hidePopover(); };
  trigger.addEventListener("pointerenter", show, { signal });
  trigger.addEventListener("focus", show, { signal });
  trigger.addEventListener("pointerleave", hide, { signal });
  trigger.addEventListener("blur", hide, { signal });

  const dispose = () => {
    el.remove(); // disconnecting force-hides an open popover, per spec
    trigger.style.removeProperty("anchor-name");
  };
  signal?.addEventListener("abort", dispose, { once: true });

  return { el, setContent, show, hide, dispose };
}
