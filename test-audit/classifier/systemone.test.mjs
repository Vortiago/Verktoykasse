// Unit tests for the client helpers: the question constructors, the trust rule
// (which must accept an endpoint that reports no `mass`, such as Ollama 0.35),
// and the usage sum.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { ask, noul, trusted, tokensOf, usageMeter } from "./systemone.mjs";

test("the constructors emit the contract's question shapes", () => {
  assert.deepEqual(noul("is it?", "yes means this", "no means that"), {
    type: "noul",
    instructions: "is it?",
    criteria: { true: "yes means this", false: "no means that" },
  });
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

test("usageMeter counts the calls and sums the tokens", () => {
  const meter = usageMeter();
  meter.onResponse({ usage: { input_tokens: 10, output_tokens: 2 } });
  meter.onResponse({ usage: { total_tokens: 5 } });
  assert.deepEqual(meter.usage, { calls: 2, tokens: 17 });
});

/**
 * A local endpoint that answers each POST after `delayMs` with `reply`, and
 * records the body it got.
 * @param {number} delayMs @param {number} status @param {object} reply
 */
async function endpoint(delayMs, status, reply) {
  /** @type {string[]} */
  const bodies = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      bodies.push(body);
      setTimeout(() => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(reply)), delayMs);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());
  return { url: `http://127.0.0.1:${port}/`, bodies, close: () => server.close() };
}

test("ask posts the state and the questions, and returns the answers", async () => {
  const server = await endpoint(0, 200, { answers: { a: { noul: 0.9 } } });
  try {
    const answers = await ask("the state", { a: noul("is it?", "yes", "no") }, { url: server.url, model: "m", timeoutMs: 5000 });
    assert.deepEqual(answers, { a: { noul: 0.9 } });
    assert.deepEqual(JSON.parse(server.bodies[0]), { model: "m", state: "the state", questions: { a: noul("is it?", "yes", "no") } });
  } finally {
    server.close();
  }
});

test("ask names the status of a failed call, and a slow call ends at the timeout", async () => {
  const failing = await endpoint(0, 503, { error: "busy" });
  const slow = await endpoint(1000, 200, { answers: {} });
  try {
    await assert.rejects(ask("s", {}, { url: failing.url, timeoutMs: 5000 }), /systemone 503: .*busy/);
    await assert.rejects(ask("s", {}, { url: slow.url, timeoutMs: 50 }), /abort|timeout/i);
  } finally {
    failing.close();
    slow.close();
  }
});
