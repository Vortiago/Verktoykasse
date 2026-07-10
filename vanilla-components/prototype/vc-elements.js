// @ts-check
// Demo wiring for the <vc-*> custom-element showcase. Each import registers a tag
// (side-effect only); the listeners below prove events/updaters still work through
// the declarative face. This is a demo PAGE, not a component — peer of preview.js.
//
// gate-allow rationale: this module-script runs once per page load and is never
// re-mounted or torn down (no component lifecycle here), and every listener below
// must keep firing for the page's lifetime (click counter, live inputs, dismiss
// event) — none are one-shot, so `{ once: true }` would be wrong, and `{ signal }`
// would tie to an AbortController that's never aborted, i.e. dead weight. See the
// signal-listener findings this file trips for the per-line `// gate-allow` marks.
import "../components/button/button.element.js";
import "../components/chip/chip.element.js";
import "../components/status-dot/status-dot.element.js";
import "../components/avatar/avatar.element.js";
import "../components/progress/progress.element.js";
import "../components/kv-row/kv-row.element.js";
import "../components/empty-state/empty-state.element.js";
import "../components/spinner/spinner.element.js";
import "../components/skeleton/skeleton.element.js";
import "../components/checklist-row/checklist-row.element.js";
import "../components/stat-card/stat-card.element.js";
import "../components/alert/alert.element.js";
import { wireTheme, wireErrorBar } from "../lib/templates.js";

wireErrorBar();
wireTheme();

/** @param {string} id */
const byId = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`demo: missing #${id}`);
  return el;
};

// 1) A native <button> click BUBBLES through the light-DOM host — one delegated
//    listener sees them all, no wiring on the elements.
const count = byId("click-count");
let clicks = 0;
byId("playground").addEventListener("click", (e) => { // gate-allow: signal-listener
  if (/** @type {Element} */ (e.target).closest("vc-button")) count.textContent = String(++clicks);
});

// 2) Changing an attribute routes to the factory's updater (setLabel / setDisabled).
const target = byId("live-target");
byId("rename").addEventListener("input", (e) => { // gate-allow: signal-listener
  target.setAttribute("label", /** @type {HTMLInputElement} */ (e.target).value || " ");
});
byId("toggle-disabled").addEventListener("change", (e) => { // gate-allow: signal-listener
  target.toggleAttribute("disabled", /** @type {HTMLInputElement} */ (e.target).checked);
});

// 3) A numeric attribute drives setValue / update — the "polled metric" shape.
const bar = byId("live-bar");
const stat = byId("live-stat");
byId("scrub").addEventListener("input", (e) => { // gate-allow: signal-listener
  const v = /** @type {HTMLInputElement} */ (e.target).value;
  bar.setAttribute("value", v);
  stat.setAttribute("value", v);
});

// 4) A non-DOM callback (onDismiss) surfaces as a bubbling CustomEvent.
const dismissed = byId("dismissed");
byId("live-alert").addEventListener("dismiss", () => { // gate-allow: signal-listener
  dismissed.textContent = "dismiss event fired ✓";
});
