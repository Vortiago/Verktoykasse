// @ts-check
import { createSegmentedControl } from "./segmented-control.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "segmented-control",
  render: (props) => createSegmentedControl(props).then((c) => c.el),
  variants: {
    source: {
      options: [
        { id: "original", label: "Original" },
        { id: "stripped", label: "Stripped" },
      ],
      current: "original",
    },
    summary: {
      options: [
        { id: "merged", label: "Merged" },
        { id: "speaker", label: "Per-speaker" },
        { id: "raw", label: "Raw" },
      ],
      current: "speaker",
    },
    perOptionTone: {
      options: [
        { id: "all", label: "All" },
        { id: "ok", label: "Passing", tone: "ok" },
        { id: "bad", label: "Failing", tone: "bad" },
      ],
      current: "ok",
    },
  },
};
