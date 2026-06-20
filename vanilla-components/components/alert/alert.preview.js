// @ts-check
import { createAlert } from "./alert.js";

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "alert",
  render: (props, signal) => createAlert(props, signal).then((c) => c.el),
  variants: {
    neutral: { message: "Draft saved." },
    info: { tone: "info", title: "Heads up", message: "A new version is available." },
    warn: { tone: "warn", message: "Your session expires in 5 minutes." },
    bad: { tone: "bad", title: "Couldn't save", message: "Check your connection and try again.", dismissible: true },
    custom: { tone: "#8b5cf6", message: "A custom-toned notice." },
  },
};
