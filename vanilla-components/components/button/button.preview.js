// @ts-check
import { createButton } from "./button.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "button",
  render: (props) => createButton(props).then((c) => c.el),
  variants: {
    default: { label: "Cancel" },
    primary: { label: "Generate", variant: "primary" },
    danger: { label: "Delete", variant: "danger" },
    ghost: { label: "Dismiss", variant: "ghost" },
    small: { label: "Open", size: "sm" },
  },
};
