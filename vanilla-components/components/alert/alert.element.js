// @ts-check
// <vc-alert> — declarative face of createAlert. `onDismiss` surfaces as a bubbling
// `dismiss` event; `message` changes route to the factory's setMessage().
//   <vc-alert tone="warn" title="Heads up" message="Disk almost full" dismissible></vc-alert>
import { warmAlert, createAlertSync } from "./alert.js";
import { defineElement } from "../../lib/element.js";

defineElement("vc-alert", { warm: warmAlert, sync: createAlertSync }, {
  attrs: ["tone", "title", "message", "dismissible"],
  booleans: ["dismissible"],
  setters: { message: "setMessage" },
  events: { onDismiss: "dismiss" },
});
