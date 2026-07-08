// @ts-check
// <vc-status-dot> — declarative face of createStatusDot.
//   <vc-status-dot tone="ok" pulse label="Online"></vc-status-dot>
import { warmStatusDot, createStatusDotSync } from "./status-dot.js";
import { defineElement } from "../../lib/element.js";

defineElement("vc-status-dot", { warm: warmStatusDot, sync: createStatusDotSync }, {
  attrs: ["tone", "pulse", "label"],
  booleans: ["pulse"],
  setters: { tone: "setTone", pulse: "setPulse" },
});
