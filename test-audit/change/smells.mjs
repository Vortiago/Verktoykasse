// Static test smells: the checks that need no model, run before any call.
// Each flag names the catalogue pattern it stands for. The verdict rules in
// classifier/verdict.mjs judge what only semantics can; these judge what a scan can.

import { codeOnly } from "./code.mjs";

/** An assertion call, in any of the shapes the common runners use. */
const ASSERTION = /\b(?:expect|assert)\s*\(|\.should\s*\(|assert\.[a-z]/;
/** A matcher that rejects or throws still counts as an assertion. */
const THROWS = /\b(?:rejects|throws|toThrow)\b|\bthrow\b/;
const SKIPPED = /\.(?:skip|todo)\s*\(|\b(?:xit|xtest|xdescribe)\s*\(/;
const FOCUSED = /\.only\s*\(|\b(?:fit|fdescribe)\s*\(/;
/** A comment that mentions an assertion: a comment-borne deleted check. */
const COMMENTED_ASSERTION = /\/\/[^\n]*\b(?:expect|assert|should)\s*[.(]|\/\*[\s\S]*?\b(?:expect|assert|should)\s*[.(][\s\S]*?\*\//;

/** Flags that make a test not a guard on their own, before any model call. */
export const HARD_FLAGS = new Set(["skipped", "focused", "empty", "unknown", "commented-assert"]);

/**
 * The smells of one test's own body and call head.
 * @param {{ source: string, body: string }} test
 * @returns {string[]}
 */
export function findSmells(test) {
  const source = codeOnly(test.source);
  const body = codeOnly(test.body);
  const flags = [];
  if (SKIPPED.test(source)) flags.push("skipped");
  if (COMMENTED_ASSERTION.test(test.source)) flags.push("commented-assert");
  if (FOCUSED.test(source)) flags.push("focused");
  if (body.trim() === "") flags.push("empty");
  else if (!ASSERTION.test(body) && !THROWS.test(body)) flags.push("unknown");
  else if (countAssertions(body) > 1 && !hasMessage(test.body)) flags.push("roulette");
  return flags;
}

/**
 * File-level smells: any focused test narrows the whole run, so every test in
 * the file inherits the flag.
 * @param {string} text
 * @returns {string[]}
 */
export function findFileFlags(text) {
  return FOCUSED.test(codeOnly(text)) ? ["focused"] : [];
}

/** @param {string} body */
function countAssertions(body) {
  return (body.match(/\b(?:expect|assert)\s*\(/g) ?? []).length;
}

/** A second argument to `expect(x, "message")` is a message, not data. */
function hasMessage(body) {
  return /\b(?:expect|assert)\s*\([^)]*,\s*["'`]/.test(body);
}
