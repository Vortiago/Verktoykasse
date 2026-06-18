// @ts-check
import { createStatusDot } from "./status-dot.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "status-dot",
  render: (props) => createStatusDot(props).then((c) => c.el),
  variants: {
    live: { tone: "ok", pulse: true, label: "live" },
    recording: { tone: "bad", pulse: true, label: "recording" },
    lagging: { tone: "warn", label: "lagging" },
    idle: { label: "idle" },
  },
};
