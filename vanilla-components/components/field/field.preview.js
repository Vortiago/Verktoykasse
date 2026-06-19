// @ts-check
import { createField } from "./field.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "field",
  render: (props) => createField(props).then((c) => c.el),
  variants: {
    text: { label: "Session name", value: "morning standup", placeholder: "name this session" },
    select: { label: "Backend", type: "select", value: "whisper", options: [
      { value: "whisper", label: "Whisper" },
      { value: "canary", label: "Canary" },
      { value: "auto", label: "Auto" },
    ] },
    textarea: { label: "Hotwords", type: "textarea", value: "Verktøykasse\nSlipestein", hint: "one per line" },
    toolbar: { label: "Filter", type: "search", placeholder: "filter…", hideLabel: true },
  },
};
