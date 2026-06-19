// @ts-check
import { createTooltip } from "./tooltip.js";
import { previewTrigger } from "../../previews/trigger.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "tooltip",
  // The tip tethers to a trigger and shows on hover/focus; the preview renders the
  // trigger and lets the tip appear on hover (real behaviour). Showing it on mount
  // leaves every card's tip pinned open until you hover it to dismiss.
  render: async (props, signal) => {
    const trigger = previewTrigger("hover me", { cursor: "help" });
    await createTooltip(trigger, { content: props.content }, signal);
    return trigger; // hover the trigger to see the tip
  },
  variants: {
    text: { content: "Builds the landscape from your commit history." },
    short: { content: "Copy" },
  },
};
