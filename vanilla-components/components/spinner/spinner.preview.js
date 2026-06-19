// @ts-check
import { createSpinner } from "./spinner.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "spinner",
  render: (props) => createSpinner(props).then((c) => c.el),
  variants: {
    small: { size: 14 },
    labeled: { size: 18, label: "Loading…" },
    large: { size: 32 },
  },
};
