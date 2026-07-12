// @ts-check
// Runtime coverage for format.js's duration() (#69) — the one formatter whose
// implementation depends on a real platform API (Intl.DurationFormat), so it
// was the one formatter never actually CALLED by any test: tsc-verified only.
//
// Local Node <23 can't construct Intl.DurationFormat unflagged at all (Node
// 22 needs --harmony-intl-duration-format); CI's Node >=24 ships it by
// default. Every case below guards with t.skip (never t.fail) so the gate
// stays green on an older local node and only actually exercises the contract
// where the platform supports it — check.mjs picks this file up like any
// other via its `**/*.test.mjs` glob, no wiring needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { duration } from "./format.js";

const HAS_DURATION_FORMAT = typeof Intl.DurationFormat === "function";
const SKIP_MSG = "Intl.DurationFormat requires Node >= 23 (unflagged from Node 24) — skipping duration() runtime coverage on this runtime";

test("duration: null/undefined/negative/NaN/Infinity all render the '—' sentinel", (t) => {
  if (!HAS_DURATION_FORMAT) return t.skip(SKIP_MSG);
  assert.equal(duration(null), "—");
  assert.equal(duration(undefined), "—");
  assert.equal(duration(-1), "—");
  assert.equal(duration(NaN), "—");
  assert.equal(duration(Infinity), "—");
  assert.equal(duration(-Infinity), "—");
});

test("duration: 0ms formats as '0s'", (t) => {
  if (!HAS_DURATION_FORMAT) return t.skip(SKIP_MSG);
  assert.equal(duration(0), "0s");
});

test("duration: sub-minute durations are seconds-only", (t) => {
  if (!HAS_DURATION_FORMAT) return t.skip(SKIP_MSG);
  assert.equal(duration(45_000), "45s");
});

test("duration: exactly 60s rolls over to the minute tier ('1m 0s')", (t) => {
  if (!HAS_DURATION_FORMAT) return t.skip(SKIP_MSG);
  assert.equal(duration(60_000), "1m 0s");
});

test("duration: exactly 3600s rolls over to the hour tier ('1h 0m')", (t) => {
  if (!HAS_DURATION_FORMAT) return t.skip(SKIP_MSG);
  assert.equal(duration(3_600_000), "1h 0m");
});

test("duration: >= 1h never shows seconds, even when the underlying duration has some", (t) => {
  if (!HAS_DURATION_FORMAT) return t.skip(SKIP_MSG);
  assert.equal(duration(3_665_000), "1h 1m"); // 1h 1m 5s — the 5s is dropped at the hour tier
});

test("duration: 59.5s rounds UP into the minute tier, not truncated to 59s", (t) => {
  if (!HAS_DURATION_FORMAT) return t.skip(SKIP_MSG);
  assert.equal(duration(59_500), "1m 0s");
});

test("duration: a non-en locale override renders a locale-shaped string, distinct from the en shape", (t) => {
  if (!HAS_DURATION_FORMAT) return t.skip(SKIP_MSG);
  const en = duration(3_900_000); // 1h 5m
  const de = duration(3_900_000, "de-DE");
  assert.notEqual(de, en, "the locale override must actually change the rendered shape");
});
