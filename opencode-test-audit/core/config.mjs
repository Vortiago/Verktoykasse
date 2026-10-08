// canonical source: test-audit/config.mjs@8df5de3 sha256:a9b98e4d1f68d5850852de69ec837e3466fcf868ac9b5b40753cae841045bd80 - vendored copy, do not edit here
// test-audit configuration. Env-driven, with portable defaults.
//
// The base URL points at any Jev-compatible SystemOne endpoint: a local Ollama
// 0.35 or later, llama-arbiter, Ollaya, or any TypeSafe-compatible server. Every
// one answers POST {base}/v1/systemone.

const env = process.env;

/**
 * Read a number from the environment, or use the fallback. A `0` is kept:
 * `Number(x) || fallback` would silently replace it with the fallback. An
 * empty or blank string is unset, not zero, and a value `valid` rejects falls back.
 * @param {string} name
 * @param {number} fallback
 * @param {(value: number) => boolean} [valid]
 */
function num(name, fallback, valid = () => true) {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && valid(value) ? value : fallback;
}

const config = {
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
  /** Per-call timeout. AbortSignal.timeout takes a whole number of ms up to 2^31 - 1. */
  timeoutMs: num("TEST_AUDIT_TIMEOUT_MS", 120_000, (value) => Number.isInteger(value) && value > 0 && value < 2 ** 31),
  /**
   * Cap on the per-test state, in characters. The limit is the endpoint's
   * prompt, not speed: an Ollama decision model reads 8192 tokens per decision,
   * and 24000 characters (about 6000 tokens) leaves room for the question. Set
   * it lower for an endpoint with a smaller window, such as Ollaya.
   */
  stateCap: num("TEST_AUDIT_STATE_CAP", 24000),
  /** A file to append each selftest reply to, as one JSON line; unset means no log. */
  rawLog: env.TEST_AUDIT_RAW_LOG || "",
  /** Cap on the non-test diff context carried in the state, in characters. */
  changeContextCap: num("TEST_AUDIT_CHANGE_CAP", 3000),
};

export default config;
