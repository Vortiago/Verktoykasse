// test-audit configuration. Env-driven, with portable defaults. `.mjs` so the
// vanilla-web tsc gate (include **/*.js) leaves it alone.
//
// The base URL points at any Jev-compatible SystemOne endpoint: a local Ollama
// 0.35 or later, llama-arbiter, Ollaya, or any TypeSafe-compatible server. Every
// one answers POST {base}/v1/systemone.

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
  /** SystemOne base URL. Defaults to a local Ollama server. */
  baseUrl: env.TEST_AUDIT_SYSTEMONE_URL || "http://127.0.0.1:11434",
  /** The decision model the base serves. */
  model: env.TEST_AUDIT_MODEL || "nimble",
  /** An answer whose `mass` is below this is not trusted, and the test escalates. */
  minMass: num("TEST_AUDIT_MIN_MASS", 0.5),
  /** Paraphrase spread above this is instability, not a tie to break. */
  stableBand: num("TEST_AUDIT_STABLE_BAND", 0.25),
  /** Calls in flight. A busy endpoint may queue, so keep it modest. */
  concurrency: num("TEST_AUDIT_CONCURRENCY", 3),
  /** Per-call timeout. */
  timeoutMs: num("TEST_AUDIT_TIMEOUT_MS", 120_000),
  /** Cap on the per-test state, in characters. */
  stateCap: num("TEST_AUDIT_STATE_CAP", 8000),
  /** Cap on the non-test diff context carried in the state, in characters. */
  changeContextCap: num("TEST_AUDIT_CHANGE_CAP", 3000),
};

export default config;
