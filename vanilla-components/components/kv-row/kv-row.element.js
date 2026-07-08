// @ts-check
// <vc-kv-row> — declarative face of createKvRow.
//   <vc-kv-row label="Status" value="Passing" tone="ok"></vc-kv-row>
import { warmKvRow, createKvRowSync } from "./kv-row.js";
import { defineElement } from "../../lib/element.js";

defineElement("vc-kv-row", { warm: warmKvRow, sync: createKvRowSync }, {
  attrs: ["label", "value", "tone"],
  setters: { value: "setValue" },
});
