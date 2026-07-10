// @ts-check
import { createChecklistRow } from "./checklist-row.js";

let seq = 0; // unique id per rendered instance so an external button can commandfor it

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "checklist-row",
  // The row owns no control of its own — a caller-authored button elsewhere on
  // the page drives the `--toggle` command via `commandfor`, hitting the row's
  // ONE root listener (onToggle is the callback-prop half of the same wiring).
  render: async (props, signal) => {
    const c = await createChecklistRow(props, signal);
    const id = `checklist-row-preview-${++seq}`;
    c.el.id = id;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Toggle";
    btn.setAttribute("command", "--toggle");
    btn.setAttribute("commandfor", id);
    btn.style.cssText = "font:inherit; font-size:12px;";
    const box = document.createElement("div");
    box.style.cssText = "display:flex; align-items:center; gap:var(--space-s);";
    box.append(c.el, btn);
    return box;
  },
  variants: {
    done: { text: "Wire up the type gate", done: true },
    todo: { text: "Render-check design-sync", done: false },
  },
};
