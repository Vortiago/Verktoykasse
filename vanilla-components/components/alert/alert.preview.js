// @ts-check
import { createAlert } from "./alert.js";

let seq = 0; // unique id per rendered instance so an external button can commandfor it

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "alert",
  // A dismissible alert also gets an external, caller-authored button next to
  // it that dismisses via the SAME `--dismiss` command the internal ✕ uses —
  // proof the declarative face isn't limited to the component's own markup.
  render: async (props, signal) => {
    const c = await createAlert(props, signal);
    if (!props.dismissible) return c.el;
    const id = `alert-preview-${++seq}`;
    c.el.id = id;
    const extBtn = document.createElement("button");
    extBtn.type = "button";
    extBtn.textContent = "Dismiss (external button)";
    extBtn.setAttribute("command", "--dismiss");
    extBtn.setAttribute("commandfor", id);
    extBtn.style.cssText = "display:block; font:inherit; font-size:12px; margin-block-start:8px;";
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
