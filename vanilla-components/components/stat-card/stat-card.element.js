// @ts-check
// <vc-stat-card> — declarative face of createStatCard. Display-only: `value` changes
// route to the factory's `update()` (handy for a polled metric). No `onSelect` event —
// the factory turns any onSelect into an always-clickable card (is-clickable + pointer),
// which a declarative metric card shouldn't be; reach for the factory for a clickable one.
//   <vc-stat-card label="Runs" value="1284" unit="total" tone="accent"></vc-stat-card>
import { warmStatCard, createStatCardSync } from "./stat-card.js";
import { defineElement } from "../../lib/element.js";

defineElement("vc-stat-card", { warm: warmStatCard, sync: createStatCardSync }, {
  attrs: ["label", "value", "unit", "hint", "tone"],
  setters: { value: "update" },
});
