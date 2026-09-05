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
const region2 = /** @type {HTMLElement} */ (document.getElementById("region2"));
const w = /** @type {any} */ (window);

w.__builds = 0;
w.__clicks = 0;
w.__selectionReads = 0;

// Count what a browser pays a forced style and layout update for (#83). Patched on
// the prototype, once, so the count covers the REAL getters canon reads — the thing
// no hand-written double can vouch for. getRangeAt is a method, so wrap its value;
// the other two are accessors, so wrap their get.
for (const name of ["isCollapsed", "rangeCount", "getRangeAt"]) {
  const d = /** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(Selection.prototype, name));
  const patched = d.get
    ? { ...d, get() { w.__selectionReads++; return d.get?.call(this); } }
    : { ...d, value(/** @type {any[]} */ ...args) { w.__selectionReads++; return d.value.apply(this, args); } };
  Object.defineProperty(Selection.prototype, name, patched);
}

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

/** #region2's content: no ids and no data-slot, so it cannot collide with the ids
 * `build` writes or with the `regionText` locator the other specs use.
 * @param {string} label */
function buildPlain(label) {
  w.__builds++;
  const p = document.createElement("p");
  p.textContent = `build:${label}`;
  return p;
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

/** One synchronous pass over BOTH regions, returning the reads that pass cost.
 * #region2 sits outside the lead-to-tail span, so it swaps while #region is held:
 * the seam mutates the DOM between the two asks, which re-dirties layout, so a
 * per-host read buys a second forced flush. Zeroes the counter on entry, because the
 * priming render at load and __selectSpanningRegion both hit the patched getters
 * before any measured pass. @param {string} label */
w.__renderPass = (label) => {
  w.__selectionReads = 0;
  const held2 = renderRegion(region2, () => buildPlain(`${label}-2`), { sig: `${label}-2` });
  const held1 = renderRegion(region, () => build(label), { sig: label });
  return { held: [held2, held1], reads: w.__selectionReads };
};

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
