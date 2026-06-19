// @ts-check
import { createDialog } from "./dialog.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "dialog",
  // A dialog is hidden until opened; the preview shows it inline (open, non-modal)
  // so the card isn't blank.
  render: async (props) => {
    const d = await createDialog(props);
    const box = document.createElement("div");
    box.append(d.el);
    d.el.open = true;
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
