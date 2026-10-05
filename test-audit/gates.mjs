// The battery: the typed SystemOne questions asked about one test, and the
// verdict rules over their answers. Every caller funnels through `classify`,
// which takes an injectable `ask`, so the decision logic (batching, polarity,
// spread, escalation) is unit-tested without the model.
//
// Trust is `mass` (was the model answering at all) plus the paraphrase spread
// (does the judgment survive rewording). An untrusted or unstable
// verdict-carrying answer escalates the test; it is never tie-broken.

import { ask as systemoneAsk, noul, choice, score, trusted } from "./systemone.mjs";
import config from "./config.mjs";
import { HARD_FLAGS } from "./smells.mjs";

/** The answer kinds for the `asserts` gate, best first. */
export const ASSERT_KINDS = ["behaviour", "hardcoded-data", "shape-only", "interaction-only", "nothing"];
/** The `verdict` score levels, lowest first. `.score` is their array index. */
export const VERDICTS = ["slop", "weak", "good", "strong"];
/** The three logically equivalent phrasings of "can this test fail". */
export const CAN_FAIL_KEYS = ["can_fail_a", "can_fail_b", "can_fail_c"];
/** Verdicts at or below this level escalate. */
const WEAK = VERDICTS.indexOf("weak");

const ASSERTS_MEANING = {
  behaviour: "it checks the output value or observable behaviour the code produces, against a literal expected result",
  "hardcoded-data": "it repeats the same data the code under test is built from, so it agrees by construction",
  "shape-only": "it checks only the type, length, or keys of a result, not its content",
  "interaction-only": "it checks only that a mock or spy was called, not the behaviour it stands in for",
  nothing: "it asserts nothing, or only a tautology such as true === true",
};

const TYPE_MEANING = {
  unit: "one small unit in isolation, with its collaborators mocked or absent",
  integration: "several units together, such as code with a real database, filesystem, or module",
  regression: "reproduces a specific past bug so it cannot return",
  e2e: "drives the whole system through its public interface",
  smoke: "only checks that something runs or exists, at a coarse level",
  characterization: "pins current behaviour as a baseline before a change",
};

/**
 * The whole battery for one test. All questions travel in one call, so the state
 * is read once and each question costs one token.
 * @returns {Record<string, { type: string, instructions: string, criteria?: unknown }>}
 */
export function batteryQuestions() {
  return {
    // The best single phrasing is the concrete, operational one, so it leads.
    can_fail_a: noul(
      "Could you make this test fail by changing only the code under test?",
      "a change to the code under test can make it fail",
      "no change to the code under test can make it fail",
    ),
    // The negated twin. After polarity normalisation it must agree with `a`.
    can_fail_b: noul(
      "Does this test pass regardless of whether the code under test is correct?",
      "it passes even when the behaviour is broken",
      "broken behaviour makes it fail",
    ),
    can_fail_c: noul(
      "If the behaviour this test exercises regresses, will the test fail?",
      "the assertion can catch a regression in the behaviour",
      "the assertion misses the regression and still passes",
    ),
    asserts_a: choice("What does this test actually assert about the code under test?", { ...ASSERTS_MEANING }),
    // The same question with the answer order reversed: a position-swap control.
    asserts_b: choice(
      "What does the test's assertion actually check?",
      Object.fromEntries([...ASSERT_KINDS].reverse().map((kind) => [kind, ASSERTS_MEANING[kind]])),
    ),
    type: choice("What type of test is this?", { ...TYPE_MEANING }),
    deterministic: noul(
      "Does this test give the same result on every run, with no reliance on time, order, the network, or a sleep?",
      "it is deterministic and independent of other tests",
      "it can pass or fail for reasons outside the code under test",
    ),
    one_thing: noul(
      "Does this test check one behaviour, rather than several unrelated behaviours at once?",
      "it checks one behaviour",
      "it is an eager test that checks several unrelated things",
    ),
    name_matches: noul(
      "Does the test body assert the behaviour its name states?",
      "the body asserts the behaviour the name promises",
      "the name promises one behaviour and the body asserts something else or something trivial",
    ),
    verdict: score(
      "Overall, is this test a real guard against the behaviour it names? It is a real guard only if it can fail when that behaviour breaks.",
      VERDICTS,
    ),
  };
}

/**
 * The per-test state. A readable JSON record, capped so one huge test cannot
 * crowd the read. The source comes first so a truncation drops context, not
 * the test under audit.
 * @param {{ file: string, line: number, name: string, path: string[], source: string, fixtures: string[], imports: string[] }} test
 * @param {string} [changeContext]
 * @param {number} [cap]
 */
export function buildState(test, changeContext = "", cap = config.stateCap) {
  const text = JSON.stringify(
    {
      file: test.file,
      line: test.line,
      name: test.name,
      path: test.path,
      source: test.source,
      fixtures: test.fixtures,
      imports: test.imports,
      changeContext,
    },
    null,
    2,
  );
  return text.length > cap ? `${text.slice(0, cap)}\n… [state truncated]` : text;
}

/**
 * Ask the battery once and reduce the answers to a verdict.
 * @param {object} test
 * @param {{ ask?: Function, config?: object, changeContext?: string, smellFlags?: string[], onResponse?: (json: object) => void, signal?: AbortSignal }} [opts]
 */
export async function classify(test, opts = {}) {
  const cfg = opts.config ?? config;
  const ask = opts.ask ?? systemoneAsk;
  const state = buildState(test, opts.changeContext ?? "", cfg.stateCap);
  let answers = {};
  let error;
  try {
    answers = await ask(state, batteryQuestions(), {
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

/**
 * Reduce one test's answers to a verdict. Pure, so the rules are tested on
 * hand-written answer objects.
 * @param {object} test
 * @param {Record<string, any>} answers
 * @param {{ config?: object, smellFlags?: string[], error?: string }} [opts]
 */
export function verdictFrom(test, answers, opts = {}) {
  const cfg = opts.config ?? config;
  const values = CAN_FAIL_KEYS.map((key) => canFailValue(key, answers[key], cfg));
  const present = values.filter((value) => value !== null);
  const spread = present.length >= 2 ? Math.max(...present) - Math.min(...present) : null;
  const mean = present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
  const canFailState = canFailStateOf(present.length, spread, cfg.stableBand);

  const assertsA = choiceOf(answers.asserts_a, cfg);
  const assertsB = choiceOf(answers.asserts_b, cfg);
  const assertsTrusted = assertsA !== undefined && assertsB !== undefined;
  const asserts = assertsTrusted ? assertsA : undefined;

  const type = choiceOf(answers.type, cfg);
  const deterministic = boolOf(answers.deterministic, cfg);
  const oneThing = boolOf(answers.one_thing, cfg);
  const nameMatches = boolOf(answers.name_matches, cfg);
  const scoreValue = scoreOf(answers.verdict, cfg);
  const verdictIndex = verdictIndexOf(scoreValue);
  const verdict = verdictIndex === undefined ? undefined : VERDICTS[verdictIndex];

  // Descriptive gates report as flags; only the hard static smells and the
  // verdict-carrying gates escalate.
  const flags = [
    ...new Set([
      ...opts.smellFlags ?? [],
      ...(asserts && asserts !== "behaviour" ? [asserts] : []),
      ...(deterministic === false ? ["non-deterministic"] : []),
      ...(oneThing === false ? ["eager"] : []),
      ...(nameMatches === false ? ["name-mismatch"] : []),
    ]),
  ];
  const reasons = escalate({
    error: opts.error,
    answered: present.length === CAN_FAIL_KEYS.length,
    canFailState,
    canFailMean: mean,
    spread,
    assertsTrusted,
    assertsA,
    assertsB,
    asserts,
    verdict,
    flags,
  });

  return {
    test: { file: test.file, line: test.line, name: test.name, path: test.path },
    answers,
    canFail: { values, mean, spread, state: canFailState },
    asserts: { value: asserts, a: assertsA, b: assertsB, trust: assertsTrusted, agrees: assertsTrusted && assertsA === assertsB },
    type,
    deterministic,
    oneThing,
    nameMatches,
    score: { value: scoreValue, label: verdict },
    flags,
    needsEyes: reasons.length > 0,
    reasons,
    error: opts.error,
  };
}

/** P(can fail) from one phrasing, or null when the answer is not trusted. */
function canFailValue(key, answer, cfg) {
  if (!answer || typeof answer.noul !== "number" || !trusted(answer, cfg.minMass)) return null;
  return key === "can_fail_b" ? 1 - answer.noul : answer.noul;
}

/** @param {number} present @param {number | null} spread @param {number} band */
function canFailStateOf(present, spread, band) {
  if (present === 0) return "unanswered";
  if (spread === null) return "single";
  if (spread <= band) return "stable";
  return spread <= band * 2 ? "borderline" : "unstable";
}

/**
 * The reasons a test escalates to a human. An empty list is the only pass.
 * @returns {string[]}
 */
function escalate({ error, answered, canFailState, canFailMean, spread, assertsTrusted, assertsA, assertsB, asserts, verdict, flags }) {
  const reasons = [];
  if (error) reasons.push(`no answers (${error})`);
  if (!answered) reasons.push("can_fail not fully answered");
  if (canFailState === "borderline" || canFailState === "unstable") {
    reasons.push(`can_fail ${canFailState} (spread ${spread === null ? "-" : spread.toFixed(2)})`);
  }
  // A confident "cannot fail" beside a good verdict is a contradiction: a guard
  // that never goes red cannot be good. The spread cannot see this, because the
  // three phrasings agree; only a cross-question rule catches it.
  if (canFailMean !== null && canFailMean < 0.5 && (verdict === "good" || verdict === "strong")) {
    reasons.push("can_fail contradicts the verdict");
  }
  if (!assertsTrusted) reasons.push("asserts unclassified");
  else if (assertsA !== assertsB) reasons.push(`asserts unstable (${assertsA} vs ${assertsB})`);
  else if (asserts === "nothing") reasons.push("asserts nothing");
  if (verdict === undefined) reasons.push("verdict unclassified");
  else if (VERDICTS.indexOf(verdict) <= WEAK) reasons.push(`verdict ${verdict}`);
  for (const flag of flags) if (HARD_FLAGS.has(flag)) reasons.push(flag);
  return reasons;
}

/** @param {any} answer @param {object} cfg */
function choiceOf(answer, cfg) {
  return answer && trusted(answer, cfg.minMass) && typeof answer.choice === "string" ? answer.choice : undefined;
}

/** @param {any} answer @param {object} cfg @returns {number | undefined} */
function scoreOf(answer, cfg) {
  if (!answer || !trusted(answer, cfg.minMass) || typeof answer.score !== "number" || !Number.isFinite(answer.score)) return undefined;
  return answer.score;
}

/**
 * The score answer is a continuous expected level, so it lands between two
 * levels. Round to the nearest level for the label; a value off the scale is
 * not a verdict.
 * @param {number | undefined} score
 * @returns {number | undefined}
 */
function verdictIndexOf(score) {
  if (score === undefined || score < -0.5 || score > VERDICTS.length - 0.5) return undefined;
  return Math.round(score);
}

/** @param {any} answer @param {object} cfg @returns {boolean | undefined} */
function boolOf(answer, cfg) {
  if (!answer || typeof answer.noul !== "number" || !trusted(answer, cfg.minMass)) return undefined;
  return answer.noul >= 0.5;
}

