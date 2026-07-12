// @ts-check
import { createAlert } from "./alert.js";
import { commandButton } from "../../previews/command-button.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "alert",
  // A dismissible alert also gets an external, caller-authored button next to
  // it that dismisses via the SAME `--dismiss` command the internal ✕ uses —
  // proof the declarative face isn't limited to the component's own markup.
  render: async (props, signal) => {
    const c = await createAlert(props, signal);
    if (!props.dismissible) return c.el;
    const extBtn = commandButton(c.el, "--dismiss", "Dismiss (external button)",
      { idPrefix: "alert-preview", style: "display:block; margin-block-start:8px;" });
    const box = document.createElement("div");
    box.append(c.el, extBtn);
    return box;
  },
  variants: {
    neutral: { message: "Draft saved." },
    info: { tone: "info", title: "Heads up", message: "A new version is available." },
    warn: { tone: "warn", message: "Your session expires in 5 minutes." },
    bad: { tone: "bad", title: "Couldn't save", message: "Check your connection and try again.", dismissible: true },
    custom: { tone: "#8b5cf6", message: "A custom-toned notice." },
  },
};
