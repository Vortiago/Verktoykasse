// @ts-check
import { createCodeInput } from "./code-input.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "code-input",
  render: (props, signal) => createCodeInput(props, signal).then((c) => c.el),
  variants: {
    sixDigit: { length: 6 },
    fourDigit: { length: 4 },
    alphanumeric: { length: 5, type: "text" },
  },
};
