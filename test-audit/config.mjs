// test-audit configuration. Env-driven, with defaults for this machine, in the
// shape searx-researcher uses for the same endpoint. `.mjs` so the vanilla-web
// tsc gate (include **/*.js) leaves it alone, as it does the server there.
//
// The base URL points at any Jev-compatible SystemOne endpoint: the llama-arbiter
// on Koishi, or a local Ollama 0.35 or later. Both answer POST {base}/v1/systemone.

const env = process.env;

/**
 * Read a number from the environment, or use the fallback. A `0` is kept:
 * `Number(x) || fallback` would silently replace it with the fallback.
 * @param {string} name
 * @param {number} fallback
 */
function num(name, fallback) {
  const value = Number(env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  /** SystemOne base URL: llama-arbiter, or Ollama 0.35's /v1/systemone. */
  baseUrl: env.TEST_AUDIT_SYSTEMONE_URL || env.TEST_AUDIT_ARBITER_URL || "http://koishi.tail6defbc.ts.net:8090",
  /** The decision model the base serves. */
  model: env.TEST_AUDIT_MODEL || "qwen3.8-flash-next-mtp",
  /** An answer whose `mass` is below this is not trusted, and the test escalates. */
  minMass: num("TEST_AUDIT_MIN_MASS", 0.5),
  /** Paraphrase spread above this is instability, not a tie to break. */
  stableBand: num("TEST_AUDIT_STABLE_BAND", 0.25),
  /** Calls in flight. The endpoint queues behind a prefill, so stay modest. */
  concurrency: num("TEST_AUDIT_CONCURRENCY", 3),
  /** Per-call timeout. A queued turn can wait minutes. */
  timeoutMs: num("TEST_AUDIT_TIMEOUT_MS", 120_000),
  /** Cap on the per-test state, in characters. */
  stateCap: num("TEST_AUDIT_STATE_CAP", 8000),
  /** Cap on the non-test diff context carried in the state, in characters. */
  changeContextCap: num("TEST_AUDIT_CHANGE_CAP", 3000),
};

export default config;
