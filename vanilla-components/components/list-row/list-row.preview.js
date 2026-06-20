// @ts-check
import { createListRow } from "./list-row.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "list-row",
  render: (props, signal) => createListRow(props, signal).then((c) => c.el),
  variants: {
    basic: { title: "Bergen", meta: "3 races logged" },
    leadingTrailing: { leading: "🏔", title: "Trondheim", meta: "5 races", trailing: "→" },
    link: { title: "Oslo", meta: "12 races", href: "#/oslo", trailing: "→" },
  },
};
