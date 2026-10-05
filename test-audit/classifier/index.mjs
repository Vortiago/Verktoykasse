// The classifier: ask the battery about one test and reduce the answers to a
// verdict. This is the module's interface. `classify` takes an injectable `ask`,
// so the whole decision path (batching, polarity, spread, escalation) is tested
// without a model. Trust is `mass` plus the paraphrase spread: an untrusted or
// unstable verdict-carrying answer escalates the test, and never a tie-break.

import { ask as systemoneAsk } from "./systemone.mjs";
import { batteryQuestions, RUBRIC } from "./battery.mjs";
import { verdictFrom } from "./verdict.mjs";
import config from "../config.mjs";

export { ask, tokensOf } from "./systemone.mjs";

/**
 * The per-test state. The shared rubric comes first, so a truncation never drops
 * the definitions; then the test record, then the change context. The test JSON
 * is capped to leave room, and the source sits early in it so a hard test still
 * shows the assertion.
 * @param {{ file: string, line: number, name: string, path: string[], source: string, fixtures: string[], imports: string[] }} test
 * @param {string} [changeContext]
 * @param {number} [cap]
 */
export function buildState(test, changeContext = "", cap = config.stateCap) {
  const record = JSON.stringify(
    {
      file: test.file,
      line: test.line,
      name: test.name,
      path: test.path,
      source: test.source,
      fixtures: test.fixtures,
      imports: test.imports,
    },
    null,
    2,
  );
  const context = changeContext ? `\n\nChange context:\n${changeContext}` : "";
  const room = Math.max(400, cap - RUBRIC.length - context.length - 32);
  const testText = record.length > room ? `${record.slice(0, room)}\n… [test truncated]` : record;
  return `${RUBRIC}\n\nTest:\n${testText}${context}`;
}

/**
 * Ask the battery once and reduce the answers to a verdict.
 * @param {object} test
 * @param {{ ask?: Function, config?: object, url?: string, model?: string, changeContext?: string, smellFlags?: string[], onResponse?: (json: object) => void, signal?: AbortSignal }} [opts]
 */
export async function classify(test, opts = {}) {
  const cfg = opts.config ?? config;
  const ask = opts.ask ?? systemoneAsk;
  const state = buildState(test, opts.changeContext ?? "", cfg.stateCap);
  let answers = {};
  let error;
  try {
    answers = await ask(state, batteryQuestions(), {
      url: opts.url,
      model: opts.model,
      timeoutMs: cfg.timeoutMs,
      signal: opts.signal,
      onResponse: opts.onResponse,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    error = err instanceof Error ? err.message : String(err);
  }
  return verdictFrom(test, answers, { config: cfg, smellFlags: opts.smellFlags ?? [], error });
}
