// Unit tests for the client helpers: the question constructors, the trust rule
// (which must accept an endpoint that reports no `mass`, such as Ollama 0.35),
// and the usage sum.

import { test } from "node:test";
import assert from "node:assert/strict";
import { noul, choice, score, trusted, tokensOf } from "./systemone.mjs";

test("the constructors emit the contract's question shapes", () => {
  assert.deepEqual(noul("is it?", "yes means this", "no means that"), {
    type: "noul",
    instructions: "is it?",
    criteria: { true: "yes means this", false: "no means that" },
  });
  assert.deepEqual(choice("pick", { a: "one", b: "two" }), { type: "choice", instructions: "pick", criteria: { a: "one", b: "two" } });
  assert.deepEqual(score("rate", ["low", "high"]), { type: "score", instructions: "rate", criteria: ["low", "high"] });
});

test("trusted applies the mass floor when the endpoint reports one", () => {
  assert.equal(trusted({ mass: 0.9 }), true);
  assert.equal(trusted({ mass: 0.5 }), true);
  assert.equal(trusted({ mass: 0.49 }), false);
  assert.equal(trusted({ mass: 0.49 }, 0.4), true);
});

test("an answer without mass is trusted, for an endpoint that reports none", () => {
  assert.equal(trusted({ noul: 0.99 }), true);
  assert.equal(trusted({ choice: "behaviour" }), true);
  assert.equal(trusted(undefined), false);
});

test("tokensOf sums whichever usage shape the endpoint returns", () => {
  assert.equal(tokensOf({ total_tokens: 42 }), 42);
  assert.equal(tokensOf({ input_tokens: 120, output_tokens: 1 }), 121);
  assert.equal(tokensOf(undefined), 0);
});
