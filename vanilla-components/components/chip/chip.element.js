// @ts-check
// <vc-chip> — the declarative face of createChip. Pure display: a scalar `text`,
// a `tone` (named or raw CSS colour), and a boolean `dot`. The whole component
// reads straight off the markup:
//
//   <vc-chip text="Passing" tone="ok" dot></vc-chip>
import { warmChip, createChipSync } from "./chip.js";
import { defineElement } from "../../lib/element.js";

defineElement("vc-chip", { warm: warmChip, sync: createChipSync }, {
  attrs: ["text", "tone", "dot"],
  booleans: ["dot"],
  setters: { text: "setText" },
});
