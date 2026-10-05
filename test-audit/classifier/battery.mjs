// The battery: the typed SystemOne questions asked about one test, and the
// shared rubric that defines each concept. The questions are data; the verdict
// rules over their answers live in verdict.mjs.

import { noul, choice, score } from "./systemone.mjs";

/** The answer kinds for the `asserts` question, best first. */
const ASSERT_KINDS = ["behaviour", "hardcoded-data", "shape-only", "interaction-only", "nothing"];
/** The `verdict` score levels, lowest first. `.score` is their array index. */
export const VERDICTS = ["slop", "weak", "good", "strong"];
/** The three logically equivalent phrasings of "can this test fail". */
export const CAN_FAIL_KEYS = ["can_fail_a", "can_fail_b", "can_fail_c"];
/** The descriptive questions: asked once each, reported as flags, never escalating alone. */
export const DESCRIPTIVE_KEYS = ["observable", "conditional", "isolated", "controlled", "specific", "named", "deterministic", "one_thing", "name_matches", "resilient", "diagnostic", "fixture", "fast", "readable", "magic_number", "reads_output", "automated", "restores"];

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
Positive assertion: the test asserts the behaviour that must exist, not only
  that something is absent, empty, or does not throw.
Runs: the test is not skipped, ignored, or narrowed to only or focus.
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
Structure-insensitive: a refactor of the code under test that keeps the behaviour
  does not break the test.
Diagnostic: a failure names the assertion that failed and the expected value.
Local fixture: the test builds only the data it needs, not a large shared fixture
  or values unrelated to the behaviour.
Fast: the test runs in milliseconds, with no sleep, heavy I/O, or large computation.
Readable: a reader can tell what the test does and why without opening the code
  under test.
Magic number: the assertion names its values, rather than a bare number or string
  the reader must decode.
Asserts the output: the assertion reads the value the code under test produced,
  not its own input, its setup, or merely that no error was thrown.
Automated: the test reaches pass or fail with no person doing or reading anything.
Restores state: the test clears or restores every global, environment variable,
  timer, and spy it changes, so it leaves nothing for the next test.
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
    positive: noul(
      "Does this test include at least one positive assertion on the output the code under test produces, rather than only asserting that something is absent or does not throw?",
      "it asserts the positive case",
      "it asserts only an absence, an empty result, or a non-throw",
    ),
    runs: noul(
      "Does this test actually run in the suite, rather than being skipped, ignored, or narrowed by an only or focus marker?",
      "it runs",
      "it is skipped, ignored, or focused",
    ),
    type: choice("What type of test is this?", { ...TYPE_MEANING }),
    // The descriptive questions below report a smell as a flag; the verdict score
    // is what escalates.
    observable: noul(
      "Does this test assert observable behaviour of the code under test, rather than private internals or internal call order?",
      "it checks behaviour a caller could observe",
      "it checks private internals or internal call order",
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
      "it gives the same result every run",
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
    resilient: noul(
      "Would a refactor of the code under test that keeps the same behaviour break this test?",
      "the test checks behaviour, so a behaviour-preserving refactor keeps it green",
      "the test depends on the current structure, so a refactor breaks it",
    ),
    diagnostic: noul(
      "When this test fails, does it say which assertion failed and what was expected?",
      "the failure names the assertion and the expected value",
      "a failure gives no clue which assertion failed or why",
    ),
    fixture: noul(
      "Does the test build only the data it needs, rather than a large shared fixture or values unrelated to the behaviour?",
      "it builds only the data it needs",
      "it leans on a large or unrelated fixture",
    ),
    fast: noul(
      "Does the test run fast, with no sleep, no heavy I/O, and no large computation?",
      "it runs fast",
      "it sleeps, waits, or does heavy work",
    ),
    readable: noul(
      "Can a reader tell what this test does and why, without opening the code under test?",
      "the test reads clearly on its own",
      "the reader must open the code under test to understand it",
    ),
    magic_number: noul(
      "Does the assertion name its values, rather than use a bare number or string the reader must decode?",
      "the values are named or self-explanatory",
      "a bare number or string must be decoded from the code under test",
    ),
    reads_output: noul(
      "Does the assertion read the value the code under test produced, rather than its own input, its setup, or only that no error was thrown?",
      "it asserts the returned or observed output",
      "it asserts its own input, its setup, or merely that the call did not throw",
    ),
    automated: noul(
      "Does this test reach a pass or fail with no person doing or reading anything?",
      "it is self-checking and unattended",
      "it needs a manual step, or a person to read the output",
    ),
    restores: noul(
      "Does the test restore every global, environment variable, timer, and spy that it changes, so it leaves nothing for the next test?",
      "it clears or restores what it changes",
      "it leaves process or module state changed for the next test",
    ),
    verdict: score(
      "Overall, is this test a real guard against the behaviour it names? Weigh whether it can fail, what it asserts, and every smell the earlier questions name. It is a real guard only if it can fail when that behaviour breaks.",
      VERDICTS,
    ),
  };
}
