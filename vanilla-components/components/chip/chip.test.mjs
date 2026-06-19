import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveChipTone } from "./chip.js";

test("resolveChipTone: a named tone maps to its tone-<name> class, no inline colour", () => {
  assert.deepEqual(resolveChipTone("ok"), { className: "tone-ok", color: null });
  assert.deepEqual(resolveChipTone("accent"), { className: "tone-accent", color: null });
});

test("resolveChipTone: neutral / null / omitted are the default (no class, no colour)", () => {
  assert.deepEqual(resolveChipTone("neutral"), { className: null, color: null });
  assert.deepEqual(resolveChipTone(null), { className: null, color: null });
  assert.deepEqual(resolveChipTone(undefined), { className: null, color: null });
});

test("resolveChipTone: any other string is a raw colour, driving tone-custom via --tone", () => {
  assert.deepEqual(resolveChipTone("#8b5cf6"), { className: "tone-custom", color: "#8b5cf6" });
  assert.deepEqual(resolveChipTone("rebeccapurple"), { className: "tone-custom", color: "rebeccapurple" });
});
