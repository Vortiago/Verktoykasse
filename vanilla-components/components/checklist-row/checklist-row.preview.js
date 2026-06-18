// @ts-check
import { createChecklistRow } from "./checklist-row.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "checklist-row",
  render: (props) => createChecklistRow(props).then((c) => c.el),
  variants: {
    done: { text: "Wire up the type gate", done: true },
    todo: { text: "Render-check design-sync", done: false },
  },
};
