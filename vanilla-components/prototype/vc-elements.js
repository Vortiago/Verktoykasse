// @ts-check
// Demo wiring for the <vc-*> custom-element showcase. Each import registers a tag
// (side-effect only); the listeners below prove events/updaters still work through
// the declarative face. This is a demo PAGE, not a component — peer of preview.js.
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
byId("playground").addEventListener("click", (e) => {
  if (/** @type {Element} */ (e.target).closest("vc-button")) count.textContent = String(++clicks);
});

// 2) Changing an attribute routes to the factory's updater (setLabel / setDisabled).
const target = byId("live-target");
byId("rename").addEventListener("input", (e) => {
  target.setAttribute("label", /** @type {HTMLInputElement} */ (e.target).value || " ");
});
byId("toggle-disabled").addEventListener("change", (e) => {
  target.toggleAttribute("disabled", /** @type {HTMLInputElement} */ (e.target).checked);
});

// 3) A numeric attribute drives setValue / update — the "polled metric" shape.
const bar = byId("live-bar");
const stat = byId("live-stat");
byId("scrub").addEventListener("input", (e) => {
  const v = /** @type {HTMLInputElement} */ (e.target).value;
  bar.setAttribute("value", v);
  stat.setAttribute("value", v);
});

// 4) A non-DOM callback (onDismiss) surfaces as a bubbling CustomEvent.
const dismissed = byId("dismissed");
byId("live-alert").addEventListener("dismiss", () => {
  dismissed.textContent = "dismiss event fired ✓";
});
