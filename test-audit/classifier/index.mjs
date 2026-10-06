// The classifier: ask the battery about one test and reduce the answers to a
// verdict. This is the module's interface. `classify` takes an injectable `ask`,
// so the whole decision path (batching, polarity, spread, escalation) is tested
// without a model. Trust is `mass` plus the paraphrase spread: an untrusted or
// unstable verdict-carrying answer escalates the test, and never a tie-break.

import { ask as systemoneAsk } from "./systemone.mjs";
import { BATTERY, RUBRIC } from "./battery.mjs";
import { verdictFrom } from "./verdict.mjs";
import config from "../config.mjs";

export { trusted, usageMeter } from "./systemone.mjs";
export { ASSERT_PASS, BATTERY, CAN_FAIL_KEYS, ESCALATE_ON_FALSE, FLAG_BY_GATE, NEGATED } from "./battery.mjs";

/** @typedef {import("../types.d.ts").AuditTest} AuditTest */
/** @typedef {import("../types.d.ts").AuditAnswer} AuditAnswer */
/** @typedef {import("./systemone.mjs").Question} Question */
/**
 * The transport `classify` calls: `systemone.ask` unless a test injects its own.
 * @typedef {(state: string, questions: Record<string, Question>, opts: { url?: string, model?: string, timeoutMs?: number, onResponse?: (json: object) => void }) => Promise<Record<string, AuditAnswer>>} Ask
 */

/** The least change context worth sending; a shorter slice is only a hunk header. */
const MIN_CONTEXT = 200;

/**
 * The per-test state. The shared rubric comes first, so a truncation never drops
 * the definitions; then the test record, then the change context. The test is
 * the subject, so it takes the room first and the context gets what is left: a
 * long test squeezes the context, not its own tail, where the assertions sit.
 * The source sits early in the record, so a test longer than the cap still
 * shows its head.
 * @param {AuditTest} test
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
      // A describe's skip or only and the extractor's notes are what `runs` needs
      // beyond the test's own source; sent only when present.
      ...(test.scope?.length ? { scope: test.scope } : {}),
      ...(test.flags?.length ? { flags: test.flags } : {}),
      source: test.source,
      fixtures: test.fixtures,
      imports: test.imports,
    },
    null,
    2,
  );
  const room = Math.max(400, cap - RUBRIC.length - 32);
  const testText = record.length > room ? `${record.slice(0, room)}\n… [test truncated]` : record;
  const state = `${RUBRIC}\n\nTest:\n${testText}`;
  const contextRoom = cap - state.length - 32;
  if (!changeContext || contextRoom < MIN_CONTEXT) return state;
  const context = changeContext.length > contextRoom ? `${changeContext.slice(0, contextRoom)}\n… [context truncated]` : changeContext;
  return `${state}\n\nChange context:\n${context}`;
}

/**
 * Ask the battery once and reduce the answers to a verdict.
 * @param {AuditTest} test
 * @param {{ ask?: Ask, url?: string, model?: string, changeContext?: string, onResponse?: (json: object) => void }} [opts]
 */
export async function classify(test, opts = {}) {
  const ask = opts.ask ?? systemoneAsk;
  const state = buildState(test, opts.changeContext ?? "");
  /** @type {Record<string, AuditAnswer>} */
  let answers = {};
  let error;
  try {
    answers = await ask(state, BATTERY, {
      url: opts.url,
      model: opts.model,
      timeoutMs: config.timeoutMs,
      onResponse: opts.onResponse,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return verdictFrom(test, answers, { error });
}
