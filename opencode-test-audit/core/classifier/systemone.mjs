// canonical source: test-audit/classifier/systemone.mjs@8a4813d sha256:1e72065098e1018a15ab8a441533394f764c367cfedbcf105f5e339841df1a2a - vendored copy, do not edit here
// SystemOne client for test-audit. One Jev-compatible typed-question endpoint:
// a local Ollama 0.35 or later, llama-arbiter, Ollaya, or any TypeSafe server.
//
//   POST {base}/v1/systemone
//   { "model", "state", "questions": { name: {type, instructions, criteria} } }
//
// The router reads `state` into a slot once, then answers every question in one
// token and maps the letter back to the answer's name. Some endpoints add `mass`
// to each answer. `mass` is the share of the model's probability that the allowed
// answers held before the grammar, so near 0 means the model was going to write
// something else and the grammar forced a letter. An endpoint that reports no
// `mass` (Ollama) is read as trusted, and the paraphrase spread carries that
// trust instead. `confidence` is a margin against the runner-up, and is NOT
// calibrated.
//
// The whole battery for one test travels in one call, so the state is read once.
//
// Sources:
// - The SystemOne endpoint, the Jev-compatible typed-question protocol, and the
//   reading of `mass` and `confidence` are in-house. No public primary source
//   exists for them.
// - Katherine Tian et al., Just Ask for Calibration (EMNLP 2023)
//   https://arxiv.org/abs/2305.14975
//   The confidence of an RLHF model is not calibrated by default, so the tool
//   reads `confidence` as a margin, never as a probability.
// A small, fast model as a one-token classifier for each question is an
// engineering choice, not a published finding.

import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import config from "../config.mjs";

/** @typedef {{ type: "noul", instructions: string, criteria: { true: string, false: string } }} Question */
/** @typedef {import("../types.d.ts").AuditAnswer} AuditAnswer */
/** @typedef {{ answers?: Record<string, AuditAnswer>, usage?: Record<string, unknown> }} SystemOneResponse */

/**
 * Ask one or more typed questions about `state`.
 * @param {string} state
 * @param {Record<string, Question>} questions
 * @param {{ url?: string, model?: string, timeoutMs?: number, onResponse?: (json: object) => void }} [opts]
 * @returns {Promise<Record<string, AuditAnswer>>}
 */
export async function ask(state, questions, opts = {}) {
  const { url = config.baseUrl, model = config.model, timeoutMs = config.timeoutMs, onResponse } = opts;
  const body = { model, state, questions };

  const res = await post(`${url.replace(/\/+$/, "")}/v1/systemone`, JSON.stringify(body), timeoutMs);
  if (res.status < 200 || res.status > 299) throw new Error(`systemone ${res.status}: ${res.text.slice(0, 300)}`);
  const json = /** @type {SystemOneResponse} */ (JSON.parse(res.text));
  onResponse?.(json);
  return json.answers ?? {};
}

/**
 * POST a JSON body and read the whole reply. Not fetch: Node's fetch gives up
 * when the response headers take more than 300 s, whatever the signal says, and
 * a busy endpoint answers a full battery slower than that. Here only `timeoutMs`
 * ends the call.
 * @param {string} url @param {string} body @param {number} timeoutMs
 * @returns {Promise<{ status: number, text: string }>}
 */
function post(url, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const send = target.protocol === "https:" ? httpsRequest : httpRequest;
    const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) };
    const req = send(target, { method: "POST", headers, signal: AbortSignal.timeout(timeoutMs) }, (res) => {
      /** @type {Buffer[]} */
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(body);
  });
}

/**
 * A yes/no gate. `criteria` says what yes and no MEAN, not the answer names.
 * @param {string} instructions @param {string} yes @param {string} no
 */
export const noul = (instructions, yes, no) => ({
  type: /** @type {const} */ ("noul"),
  instructions,
  criteria: { true: yes, false: no },
});

/**
 * Is the answer trustworthy? Where an endpoint reports `mass`, it is the share of
 * the model's probability that the allowed answers held before the grammar: near
 * 1 means the model was answering, near 0 means the grammar did the choosing, and
 * below `minMass` the answer is unanswered and the caller escalates. An endpoint
 * that reports no `mass` is trusted, so the paraphrase spread is then the guard.
 * @param {AuditAnswer | undefined} answer
 * @param {number} [minMass]
 */
export function trusted(answer, minMass = config.minMass) {
  if (!answer) return false;
  return typeof answer.mass === "number" ? answer.mass >= minMass : true;
}

/**
 * The token count of one response's `usage`, whatever shape it carries.
 * @param {Record<string, unknown> | undefined} usage
 */
export function tokensOf(usage) {
  if (!usage || typeof usage !== "object") return 0;
  if (typeof usage.total_tokens === "number") return usage.total_tokens;
  return Object.values(usage).filter((value) => typeof value === "number").reduce((sum, value) => sum + value, 0);
}

/**
 * A running count of the calls a run made and the tokens they cost. Pass
 * `onResponse` to every `ask` of the run, and read `usage` when it ends.
 */
export function usageMeter() {
  const usage = { calls: 0, tokens: 0 };
  return {
    usage,
    /** @param {SystemOneResponse} json */
    onResponse: (json) => {
      usage.calls += 1;
      usage.tokens += tokensOf(json.usage);
    },
  };
}
