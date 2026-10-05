// SystemOne client for test-audit. One typed-question endpoint on llama-arbiter:
//
//   POST {arbiter}/v1/systemone
//   { "model", "state", "questions": { name: {type, instructions, criteria} } }
//
// The router reads `state` into a slot once, then answers every question in one
// token and maps the letter back to the answer's name. Each answer carries
// `probabilities`, `confidence`, and `mass`: the share of the softmax the
// allowed answers held BEFORE the grammar. `mass` is the trust signal: near 0
// means the model was going to write something else and the grammar forced a
// letter. `confidence` is a margin against the runner-up, and is NOT calibrated.
//
// The whole battery for one test travels in one call, so the state is read once.

import config from "./config.mjs";

/** @typedef {"choice" | "score" | "noul"} QuestionType */
/** @typedef {{ type: QuestionType, instructions: string, criteria?: unknown }} Question */
/** @typedef {{ type: QuestionType, probabilities: Record<string, number>, confidence: number, mass: number, choice?: string, score?: number, noul?: number }} Answer */

/**
 * Ask one or more typed questions about `state`.
 * @param {string | unknown} state
 * @param {Record<string, Question>} questions
 * @param {{ signal?: AbortSignal, timeoutMs?: number, onResponse?: (json: object) => void }} [opts]
 * @returns {Promise<Record<string, Answer>>}
 */
export async function ask(state, questions, opts = {}) {
  const { signal, timeoutMs = config.timeoutMs, onResponse } = opts;
  const body = { model: config.model, state, questions };

  const timeout = AbortSignal.timeout(timeoutMs);
  const res = await fetch(`${config.arbiter}/v1/systemone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`systemone ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  onResponse?.(json);
  return json.answers ?? {};
}

/** A yes/no gate. `criteria` says what yes and no MEAN, not the answer names. */
export const noul = (instructions, yes, no) => ({
  type: /** @type {QuestionType} */ ("noul"),
  instructions,
  criteria: { true: yes, false: no },
});

/** Pick one named answer. */
export const choice = (instructions, criteria) => ({
  type: /** @type {QuestionType} */ ("choice"),
  instructions,
  criteria,
});

/** An ordinal level: `levels` lowest first; the answer index names the level. */
export const score = (instructions, levels) => ({
  type: /** @type {QuestionType} */ ("score"),
  instructions,
  criteria: levels,
});

/**
 * Is the answer trustworthy? `mass` near 1 means the model was answering;
 * near 0 means the grammar did the choosing. Below `minMass` the gate is
 * treated as unanswered, and the caller escalates.
 * @param {Answer | undefined} answer
 * @param {number} [minMass]
 */
export function trusted(answer, minMass = config.minMass) {
  return !!answer && typeof answer.mass === "number" && answer.mass >= minMass;
}

/** The token count of one response's `usage`, whatever shape it carries. */
export function tokensOf(usage) {
  if (!usage || typeof usage !== "object") return 0;
  if (typeof usage.total_tokens === "number") return usage.total_tokens;
  return Object.values(usage).filter((value) => typeof value === "number").reduce((sum, value) => sum + value, 0);
}

