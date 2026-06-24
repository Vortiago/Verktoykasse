// @ts-check
import { createScrollStack } from "./scroll-stack.js";

/** A demo card with a fixed height so the stack overflows and scrolls. */
function demoCard(/** @type {string} */ label, /** @type {number} */ h) {
  const d = document.createElement("div");
  d.textContent = label;
  d.style.cssText =
    `min-height:${h}px; display:flex; align-items:center; justify-content:center;` +
    `border:1px solid var(--hairline); border-radius:var(--r); background:var(--bg-elev);` +
    `color:var(--text-dim); font:13px var(--sans);`;
  return d;
}

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "scroll-stack",
  // Build fresh children each render (Nodes can't be re-appended), and cap the
  // height here: a stack only scrolls when its parent bounds it, and the preview
  // card is not a flex column — so demonstrate the overflow with maxHeight.
  render: async () => {
    const cards = [1, 2, 3, 4].map((n) => demoCard(`card ${n} — natural height`, 110));
    const { el } = await createScrollStack({ children: cards });
    el.style.maxHeight = "240px";
    return el;
  },
  variants: {
    overflowing: {},
  },
};
