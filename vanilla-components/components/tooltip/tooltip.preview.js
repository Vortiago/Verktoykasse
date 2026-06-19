// @ts-check
import { createTooltip } from "./tooltip.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "tooltip",
  // The tip tethers to a trigger and shows on hover/focus; the preview renders a
  // trigger and shows the tip immediately so the card isn't blank.
  render: async (props, signal) => {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "hover me";
    Object.assign(trigger.style, {
      font: "inherit",
      fontSize: "12px",
      padding: "4px 10px",
      border: "1px solid var(--hairline)",
      borderRadius: "var(--r)",
      background: "var(--bg-elev)",
      color: "var(--text)",
      cursor: "help",
    });
    const tip = await createTooltip(trigger, { content: props.content }, signal);
    tip.show(); // show immediately for the static preview card
    return trigger;
  },
  variants: {
    text: { content: "Builds the landscape from your commit history." },
    short: { content: "Copy" },
  },
};
