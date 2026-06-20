// @ts-check
import { createSkeleton } from "./skeleton.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "skeleton",
  render: (props) => createSkeleton(props).then((c) => c.el),
  variants: {
    text: { variant: "text", lines: 3, width: 240 },
    block: { variant: "block", width: 240, height: 120 },
    circle: { variant: "circle", width: 48 },
  },
};
