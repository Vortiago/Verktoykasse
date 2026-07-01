// Deliberately-leaky fixture for memory-detector-selftest.spec.js.
//
// It builds REAL tooltip components but omits the AbortSignal — so the dispose()
// that removes the tip from <body> and detaches the trigger listeners is never
// wired (buildTooltip only schedules it on `signal?.addEventListener`). Each tip
// therefore stays in document.body forever: a real leak of the exact shape the
// recon describes. The selftest spec points the shared mem.js harness at this and
// asserts it TRIPS — proving the green suites aren't passing vacuously.
import { createTooltip } from "../../../components/tooltip/tooltip.js";

const trigger = /** @type {HTMLElement} */ (document.getElementById("trigger"));
const w = /** @type {any} */ (window);
w.__leakRefs = [];

/** Build n signal-less tooltips and drop our only strong refs to them; the tips
 * remain reachable only through document.body (the leak). @param {number} n */
w.__leakCycle = async (n) => {
  for (let i = 0; i < n; i++) {
    const t = await createTooltip(trigger, { content: `leak ${i}` }); // NO signal
    w.__leakRefs.push(new WeakRef(t.el)); // weak: does not itself retain
  }
};
