// @ts-check
import { createPanel } from "./panel.js";

let seq = 0; // unique id per rendered instance so the toggle button can commandfor it

/** @type {import("../../preview.js").PreviewModule} */
export default {
  title: "panel",
  // The `collapsed` variant also demonstrates the caller-facing side of --toggle:
  // a button living in the head content, commandfor-ing an id the caller (this
  // preview) sets on the panel's own root — no panel-side JS beyond its one
  // always-on root listener.
  render: async (props, signal) => {
    const p = await createPanel(props, signal);
    if ("collapsed" in props) {
      const id = `panel-preview-${++seq}`;
      p.el.id = id;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = "Toggle";
      toggle.setAttribute("command", "--toggle");
      toggle.setAttribute("commandfor", id);
      toggle.style.cssText = "float:inline-end; font:inherit; font-size:12px;";
      p.headEl.append(toggle);
    }
    return p.el;
  },
  variants: {
    titled: { head: "Sessions", body: "12 active · 3 recording" },
    headless: { body: "A bare panel — just a body, no header." },
    fill: { head: "Console", body: "fill:true stretches in a flex column and scrolls its body" },
    collapsible: {
      head: "Notes",
      body: "A caller-authored button in the head drives --toggle via commandfor.",
      collapsed: false,
    },
  },
};
