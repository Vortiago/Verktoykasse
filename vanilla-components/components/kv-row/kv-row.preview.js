// @ts-check
import { createKvRow } from "./kv-row.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  render: (props) => createKvRow(props).then((c) => c.el),
  title: "kv-row",
  variants: {
    plain: { label: "Decode rate", value: "142 tok/s" },
    ok: { label: "Status", value: "healthy", tone: "ok" },
    bad: { label: "Errors", value: 3, tone: "bad" },
  },
};
