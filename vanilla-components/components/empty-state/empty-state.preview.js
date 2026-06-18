// @ts-check
import { createEmptyState } from "./empty-state.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "empty-state",
  render: (props) => createEmptyState(props).then((c) => c.el),
  variants: {
    full: { icon: "🎙", title: "No sessions yet", detail: "Start one to see it here." },
    plain: { title: "No matches" },
  },
};
