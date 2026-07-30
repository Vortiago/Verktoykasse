// Target for render-hold.spec.js (#72). Drives the REAL canon renderRegion
// against real focus and selection semantics — the thing the node tests can't
// prove, since their doubles are hand-written to model the very rules under test:
// `focusout` fires before the incoming element is focused and parks
// document.activeElement on <body> for its duration, and a Range that spans a
// node intersects it while neither endpoint is inside.
//
// Every render REPLACES the region's children, so the controls live inside the
// built content: a swap that lands while a control is held destroys that control.
// A rebuild is therefore detectable two ways — the build counter, and a stamp the
// spec writes onto a live child node (a stamp that vanished means the node did).
import { renderRegion } from "../../render.js";

const region = /** @type {HTMLElement} */ (document.getElementById("region"));
const w = /** @type {any} */ (window);

w.__builds = 0;
w.__clicks = 0;

/** @param {string} id @param {string} label */
function control(id, label) {
  const el = document.createElement("input");
  el.id = id; // the ids are for asserting document.activeElement, not for selecting
  el.setAttribute("aria-label", label);
  return el;
}

/** One region render: two controls, a button, and a text node, all inside the
 * host. `label` proves WHICH build landed once a deferred swap finally lands. */
function build(/** @type {string} */ label) {
  w.__builds++;
  const wrap = document.createElement("div");
  wrap.dataset.slot = "regionBody";

  const a = control("a", "first control");
  const b = control("b", "second control");

  // The dead-button case: mousedown inside a held region fires focusout, and a
  // flush there removes this node before its `click` can fire.
  const btn = document.createElement("button");
  btn.id = "btn";
  btn.textContent = "act";

  const text = document.createElement("p");
  text.id = "text";
  text.dataset.slot = "regionText"; // structural seam, no role — the data-slot handle
  text.textContent = `build:${label}`;

  wrap.append(a, b, btn, text);
  return wrap;
}

// Delegated on the HOST, which survives a rebuild — so the only way this fails to
// fire is the button node itself being swapped away mid-click, which is exactly
// the bug under test rather than a lost listener.
region.addEventListener("click", (e) => {
  if (/** @type {HTMLElement} */ (e.target).id === "btn") w.__clicks++;
});

/** Render with `label` as both content and sig. Returns renderRegion's verdict
 * (true = held), so the spec asserts the API contract, not just the DOM.
 * @param {string} label @param {{ defer?: boolean }} [opts] */
w.__render = (label, opts = {}) => renderRegion(region, () => build(label), { sig: label, ...opts });

/** Mark the live text node, so a later rebuild is visible as a lost stamp. Writing
 * onto a node the spec can't reach needs page JS; READING it back doesn't — the
 * node carries a data-slot, so the spec asserts on the attribute through the
 * normal locator (and gets auto-retry with it). */
w.__stamp = () => {
  const text = document.getElementById("text");
  if (text) text.dataset.stamp = "kept";
};

/** Select from #lead to #tail — a range SPANNING the region with neither endpoint
 * inside it. Uses setBaseAndExtent over the two text nodes so the selection is a
 * real one the browser reports, not a synthetic object. */
w.__selectSpanningRegion = () => {
  const lead = /** @type {Text} */ (document.getElementById("lead")?.firstChild);
  const tail = /** @type {Text} */ (document.getElementById("tail")?.firstChild);
  const sel = /** @type {Selection} */ (document.getSelection());
  sel.setBaseAndExtent(lead, 0, tail, tail.length);
  return { isCollapsed: sel.isCollapsed, spans: sel.getRangeAt(0).intersectsNode(region) };
};

w.__render("initial"); // prime the region so the controls exist
