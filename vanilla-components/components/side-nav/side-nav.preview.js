// @ts-check
import { createSideNav } from "./side-nav.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "side-nav",
  // A side-nav fills its column; the preview frames it at a realistic width.
  render: (props) => createSideNav(props).then((c) => {
    const box = document.createElement("div");
    box.style.width = "232px";
    box.append(c.el);
    return box;
  }),
  variants: {
    grouped: {
      groups: [
        {
          label: "Global",
          items: [
            { id: "taps", label: "Taps", icon: "🎙", chip: { text: "3 live", tone: "ok" } },
            { id: "people", label: "People", icon: "👥" },
            { id: "sessions", label: "Sessions", icon: "🗂", chip: { text: "12" } },
            { id: "settings", label: "Settings", icon: "⚙" },
          ],
        },
      ],
      current: "taps",
    },
    journey: {
      groups: [
        {
          label: "This session",
          variant: "journey",
          items: [
            { id: "capture", label: "Capture", done: true },
            { id: "recordings", label: "Recordings", done: true, chip: { text: "8 WAV" } },
            { id: "transcript", label: "Transcript", chip: { text: "tx", tone: "warn" } },
            { id: "summary", label: "Summary" },
          ],
        },
      ],
      current: "transcript",
    },
  },
};
