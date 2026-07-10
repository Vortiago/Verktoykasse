// @ts-check
// Tooltip — a hover/focus card tethered to a trigger element. The tip rides the
// top layer as a "hint" popover (falling back to "manual" where unsupported);
// CSS Anchor Positioning (position-anchor + position-area + position-try-fallbacks,
// in tooltip.css) does the placement and the edge-flip. No manual coordinate math.
// Shows on the trigger's hover/focus — hand-wired listeners, not yet Interest
// Invokers (`interestfor`): that would delete these triggers declaratively too,
// but it's still experimental (watch, don't adopt yet).
import { tpl } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

let seq = 0; // unique anchor-name per instance

/**
 * @param {HTMLElement} trigger - the tip anchors to this element and shows on its hover/focus.
 * @param {{ content?: string | Node | null, className?: string }} [opts] - body + per-use class.
 * @param {AbortSignal} [signal] - aborting disposes the tooltip (removes tip + listeners).
 * @returns {{ el: HTMLElement, setContent: (content: string | Node) => void, show: () => void, hide: () => void, dispose: () => void }}
 */
function buildTooltip(trigger, { content = null, className = "" } = {}, signal) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-tooltip").firstElementChild);
  // "hint" gets correct top-layer stacking against an open `auto` popover (e.g. a
  // menu) without light-dismissing it — plain "manual" already avoids closing
  // others, but hint is the mode built for tooltips specifically. The `popover`
  // IDL is limited-to-known-values: an unsupported value doesn't stick, so
  // reading it back is the feature-detect. Chromium 133+.
  el.popover = "hint";
  if (el.popover !== "hint") el.popover = "manual";
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

export const { warm: warmTooltip, sync: createTooltipSync, create: createTooltip } =
  defineComponent(import.meta.url, "tooltip", buildTooltip);
