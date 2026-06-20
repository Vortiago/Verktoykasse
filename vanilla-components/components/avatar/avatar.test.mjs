import { test } from "node:test";
import assert from "node:assert/strict";
import { initialsFrom } from "./avatar.js";

test("initialsFrom: two words → first letter of first + last, upper-cased", () => {
  assert.equal(initialsFrom("Ada Lovelace"), "AL");
  assert.equal(initialsFrom("kurt friedrich gödel"), "KG");
});

test("initialsFrom: one word → first two letters, upper-cased", () => {
  assert.equal(initialsFrom("ada"), "AD");
  assert.equal(initialsFrom("x"), "X");
});

test("initialsFrom: blank/whitespace → '?'", () => {
  assert.equal(initialsFrom(""), "?");
  assert.equal(initialsFrom("   "), "?");
});
