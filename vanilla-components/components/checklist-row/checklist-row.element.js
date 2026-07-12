// @ts-check
// <vc-checklist-row> — declarative face of createChecklistRow. `onToggle` (fired
// by the factory's own `--toggle` command listener, e.g. from a caller button
// elsewhere on the page that `commandfor`s the BUILT inner element's id — not
// this host tag's — since that's what the listener is bound to) surfaces as a
// bubbling `vc-toggle` event — namespaced, because a bare "toggle" collides
// with the native popover/dialog toggle event (renderRegion's overlay flush
// listens for exactly that).
//   <vc-checklist-row text="Wire the API" done></vc-checklist-row>
import { warmChecklistRow, createChecklistRowSync } from "./checklist-row.js";
import { defineElement } from "../../lib/element.js";

defineElement("vc-checklist-row", { warm: warmChecklistRow, sync: createChecklistRowSync }, {
  attrs: ["text", "done"],
  booleans: ["done"],
  setters: { done: "setDone" },
  events: { onToggle: "vc-toggle" },
});
