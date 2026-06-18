// @ts-check
import { createChip } from "./chip.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "chip",
  render: (props) => createChip(props).then((c) => c.el),
  variants: {
    neutral: { text: "draft" },
    ready: { text: "ready", tone: "ok", dot: true },
    degraded: { text: "degraded", tone: "warn", dot: true },
    failed: { text: "failed", tone: "bad", dot: true },
    live: { text: "12 live", tone: "info" },
  },
};
