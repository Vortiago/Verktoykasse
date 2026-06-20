// @ts-check
import { createDialog } from "./dialog.js";
import { previewTrigger } from "../../previews/trigger.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "dialog",
  // A dialog is hidden until opened; the preview renders a trigger and opens it
  // (modal) on click — rather than pinning it open, which leaves every card's
  // dialog showing on load.
  render: async (props, signal) => {
    const box = document.createElement("div");
    const trigger = previewTrigger("Open dialog");
    const d = await createDialog(props, signal);
    box.append(trigger, d.el);
    trigger.addEventListener("click", () => d.open(), { signal });
    return box;
  },
  variants: {
    confirm: {
      title: "Reset the world?",
      body: "This clears all parcels and re-bootstraps from the chronicle. It cannot be undone.",
    },
    scrolling: {
      title: "Release notes",
      body: "Line one.\n".repeat(60),
      scroll: true,
      closeOnBackdrop: true,
    },
  },
};
