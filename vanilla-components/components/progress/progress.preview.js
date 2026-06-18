// @ts-check
import { createProgress } from "./progress.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "progress",
  render: (props) => createProgress(props).then((c) => c.el),
  variants: {
    labeled: { value: 64, label: "Transcribing… 64%" },
    ok: { value: 100, tone: "ok" },
    warn: { value: 38, tone: "warn" },
    bad: { value: 12, tone: "bad" },
  },
};
