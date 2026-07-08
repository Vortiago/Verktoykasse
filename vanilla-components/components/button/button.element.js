// @ts-check
// <vc-button> — the declarative face of createButton. Importing this module
// registers the tag; the factory (button.js) still owns all build logic.
//
//   <vc-button variant="primary" label="Generate"></vc-button>
//
// No `onClick` mapping: a real <button>'s native click already bubbles up through
// the light-DOM host, so a page listens for `click` on <vc-button> for free.
import { warmButton, createButtonSync } from "./button.js";
import { defineElement } from "../../lib/element.js";

defineElement("vc-button", { warm: warmButton, sync: createButtonSync }, {
  attrs: ["label", "variant", "size", "icon", "href", "target", "disabled", "pressed"],
  booleans: ["disabled", "pressed"],
  setters: { label: "setLabel", disabled: "setDisabled", pressed: "setPressed" },
});
