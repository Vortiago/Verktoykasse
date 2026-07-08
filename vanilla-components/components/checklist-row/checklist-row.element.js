// @ts-check
// <vc-checklist-row> — declarative face of createChecklistRow.
//   <vc-checklist-row text="Wire the API" done></vc-checklist-row>
import { warmChecklistRow, createChecklistRowSync } from "./checklist-row.js";
import { defineElement } from "../../lib/element.js";

defineElement("vc-checklist-row", { warm: warmChecklistRow, sync: createChecklistRowSync }, {
  attrs: ["text", "done"],
  booleans: ["done"],
  setters: { done: "setDone" },
});
