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
/** The descriptive gates: asked once each, reported as flags, never escalating alone. */
export const DESCRIPTIVE_KEYS = ["observable", "conditional", "isolated", "controlled", "specific", "named", "deterministic", "one_thing", "name_matches"];
/** Verdicts at or below this level escalate. */
const WEAK = VERDICTS.indexOf("weak");

/** The flag a false answer to each descriptive gate raises. */
const FLAG_BY_GATE = {
  observable: "implementation-coupled",
  conditional: "conditional",
  isolated: "order-dependent",
  controlled: "uncontrolled-resource",
  specific: "weak-assert",
  named: "vague-name",
  deterministic: "non-deterministic",
  one_thing: "eager",
  name_matches: "name-mismatch",
};

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
 * The shared rubric sent with every test. It is the knowledge the questions
 * assume: the definition of each concept a reviewer looks for. Grounded in the
 * sources in references.md. Kept short so it fits the state cap beside the test.
 */
export const RUBRIC = `Rubric for judging a test. Use these definitions for every question.

Falsifiable: a change to the code under test makes the test fail.
  Not falsifiable: a tautology (true === true, or both sides call the same code);
  a check that the result is merely defined, non-null, or the right shape;
  an assertion on data the code copies straight from its input.
Observable behaviour: output or effects a caller can observe. Private internals,
  call order, and that a mock was called are not observable behaviour.
Conditional test logic: a branch, loop, or catch that can leave the assertion
  unrun, so the test may assert nothing on some inputs.
Isolated: passes on its own and in any order, with no shared mutable state and no
  dependence on another test.
Controlled resources: the test fixes the time, network, filesystem, and
  environment it needs; it does not assume they are present.
Specific assertion: the strongest assertion that would catch the failure. Weaker
  forms (toBeDefined, toBeTruthy, typeof, Array.isArray, a length) pass on wrong output.
Name: states the behaviour and the expected result, not a vague label.
Deterministic: same result every run, with no sleep, clock, network, randomness, or
  order dependence.
One behaviour: the body checks one thing, not several unrelated behaviours.
Type: unit, integration, regression, e2e, smoke, or characterization, by what it
  actually exercises.
Verdict: slop, weak, good, or strong. Slop is no real guard; weak is a guard with
  a serious smell; good is a real guard; strong is a real guard with a specific
  expected value that would fail loudly.`;

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
    // The descriptive gates below report a smell as a flag; the verdict score
    // is what escalates.
    observable: noul(
      "Does this test assert observable behaviour of the code under test, rather than private internals, call order, or the exact interactions with a collaborator?",
      "it checks behaviour a caller could observe",
      "it checks internals, call order, or collaborator interactions instead of the behaviour",
    ),
    conditional: noul(
      "Does this test assert unconditionally, with no branch, loop, or catch that can leave the assertion unrun?",
      "the assertion always runs",
      "a branch, loop, or catch can leave the assertion unrun",
    ),
    isolated: noul(
      "Does this test pass on its own and in any order, with no reliance on shared mutable state or another test?",
      "it is independent of other tests and of run order",
      "it shares state with, or depends on the order of, other tests",
    ),
    controlled: noul(
      "Does the test control the external resources it needs, such as time, the network, the filesystem, or the environment, rather than assume they are present?",
      "its inputs and resources are controlled",
      "it assumes an external resource is present",
    ),
    specific: noul(
      "Does the test use the most specific assertion that would catch the failure, rather than a weaker one that would also pass on wrong output?",
      "the assertion is specific to the expected value",
      "a weaker assertion would also pass on wrong output",
    ),
    named: noul(
      "Does the test's name state the behaviour and its expected result, rather than a vague label such as works, test1, or should be fine?",
      "the name states the behaviour and the expected result",
      "the name is vague",
    ),
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
      "Overall, is this test a real guard against the behaviour it names? Weigh whether it can fail, what it asserts, and every smell the earlier questions name. It is a real guard only if it can fail when that behaviour breaks.",
      VERDICTS,
    ),
  };
}

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
  const descriptive = {};
  for (const gate of DESCRIPTIVE_KEYS) descriptive[gate] = boolOf(answers[gate], cfg);
  const scoreValue = scoreOf(answers.verdict, cfg);
  const verdictIndex = verdictIndexOf(scoreValue);
  const verdict = verdictIndex === undefined ? undefined : VERDICTS[verdictIndex];

  // Descriptive gates report as flags; only the hard static smells and the
  // verdict-carrying gates escalate.
  /** @type {string[]} */
  const flagList = [...(opts.smellFlags ?? [])];
  if (asserts && asserts !== "behaviour") flagList.push(asserts);
  for (const gate of DESCRIPTIVE_KEYS) {
    if (descriptive[gate] === false) flagList.push(FLAG_BY_GATE[gate]);
  }
  const flags = [...new Set(flagList)];
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
    descriptive,
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

