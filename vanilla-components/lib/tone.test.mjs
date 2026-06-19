import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTone, NAMED_TONES } from "./tone.js";

test("resolveTone: a named tone maps to its tone-<name> class, no inline colour", () => {
  assert.deepEqual(resolveTone("ok"), { className: "tone-ok", color: null });
  assert.deepEqual(resolveTone("accent"), { className: "tone-accent", color: null });
});

test("resolveTone: every name in the base set resolves to a class with no colour", () => {
  for (const t of NAMED_TONES) {
    assert.deepEqual(resolveTone(t), { className: `tone-${t}`, color: null });
  }
});

test("resolveTone: neutral / null / omitted / empty are the default (no class, no colour)", () => {
  assert.deepEqual(resolveTone("neutral"), { className: null, color: null });
  assert.deepEqual(resolveTone(null), { className: null, color: null });
  assert.deepEqual(resolveTone(undefined), { className: null, color: null });
  assert.deepEqual(resolveTone(""), { className: null, color: null });
});

test("resolveTone: any other string is a raw colour, driving tone-custom via --tone", () => {
  assert.deepEqual(resolveTone("#8b5cf6"), { className: "tone-custom", color: "#8b5cf6" });
  assert.deepEqual(resolveTone("rebeccapurple"), { className: "tone-custom", color: "rebeccapurple" });
});
