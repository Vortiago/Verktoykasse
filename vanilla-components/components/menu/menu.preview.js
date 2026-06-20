// @ts-check
import { createMenu } from "./menu.js";
import { previewTrigger } from "../../previews/trigger.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "menu",
  // Imperative: anchors to a trigger and opens on click. The card renders the
  // trigger (click to open) — auto popovers can't all stay open at once, so it's
  // not auto-shown like tooltip.
  render: async (props, signal) => {
    const trigger = previewTrigger("Open menu ▾");
    await createMenu(trigger, props, signal);
    return trigger;
  },
  variants: {
    actions: {
      items: [
        { id: "edit", label: "Edit", icon: "✎" },
        { id: "duplicate", label: "Duplicate" },
        "separator",
        { id: "delete", label: "Delete", icon: "🗑", danger: true },
      ],
    },
    withDisabled: {
      items: [
        { id: "open", label: "Open" },
        { id: "archive", label: "Archive", disabled: true },
        { id: "share", label: "Share" },
      ],
    },
  },
};
