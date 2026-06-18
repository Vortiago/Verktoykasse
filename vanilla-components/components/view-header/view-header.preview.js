// @ts-check
import { createViewHeader } from "./view-header.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "view-header",
  render: (props) => createViewHeader(props).then((c) => c.el),
  variants: {
    full: { eyebrow: "Stages", title: "Capture", sub: "live transcription from active taps" },
    plain: { title: "Overview" },
  },
};
