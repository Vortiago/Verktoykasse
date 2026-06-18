// @ts-check
import { createPanel } from "./panel.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "panel",
  render: (props) => createPanel(props).then((c) => c.el),
  variants: {
    titled: { head: "Sessions", body: "12 active · 3 recording" },
    headless: { body: "A bare panel — just a body, no header." },
    fill: { head: "Console", body: "fill:true stretches in a flex column and scrolls its body" },
  },
};
