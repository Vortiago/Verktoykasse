// @ts-check
import { createTooltip } from "./tooltip.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "tooltip",
  // The tooltip mounts into a host and follows the pointer, so the preview
  // renders a demo box you can hover rather than a static node.
  render: async (props, signal) => {
    const host = document.createElement("div");
    Object.assign(host.style, {
      position: "relative",
      padding: "28px",
      textAlign: "center",
      border: "1px dashed var(--hairline)",
      borderRadius: "var(--r)",
      color: "var(--text-dim)",
      fontSize: "12px",
      cursor: "crosshair",
    });
    host.textContent = "Hover anywhere in this box";
    const tip = await createTooltip(host, {}, signal);
    host.addEventListener("mousemove", (e) => tip.show(props.content, e.offsetX, e.offsetY), { signal });
    host.addEventListener("mouseleave", () => tip.hide(), { signal });
    return host;
  },
  variants: {
    text: { content: "Builds the landscape from your commit history." },
    short: { content: "Copy" },
  },
};
