// canonical source: test-audit/types.d.ts@2863149 sha256:ab6b545386ee342caa06625bae11bd2e923d71e9344bb1b649b9df65d6ffe072 - vendored copy, do not edit here
// Shared shapes for the test-audit modules. The modules are `.mjs` with JSDoc
// types, and the tsc gate checks them under strict (tsconfig.json). A module
// imports a shape with `@typedef {import("../types.d.ts").AuditTest} AuditTest`,
// so each shape is written down once, here, instead of across ten files. The
// Node API the modules use is declared in node.d.ts.

import type { Question } from "./classifier/systemone.mjs";

/** A source that grounds a calibration case, as its header comment names it. */
export interface Source {
  name: string;
  url?: string;
}

/** The fields every check has. */
interface CheckBase {
  /** The stem of the question keys, such as `can_fail` or `one_thing`. The folder name is its kebab-case form. */
  name: string;
  /** The questions the check asks, keyed by the name the endpoint answers under, in battery order. */
  questions: Record<string, Question>;
  /** The question keys whose yes is the finding, so a clean test answers no. A twin phrasing listed here is flipped before the spread. */
  negated?: string[];
}

/**
 * One judgement the tool asks the model about a test: one question, or a set of
 * phrasings of one judgement. `role` says what the verdict rules do with the
 * answers:
 * - `can-fail`: a paraphrase set. Its mean is the can-fail value.
 * - `asserts`: yes/no questions, one per property. Code picks the kind; only
 *   the first kind is a real guard.
 * - `gate`: a yes/no twin pair. A "no" escalates with `reason`.
 * - `runs`: no questions. The extractor's skipped and focus-in-file flags
 *   escalate with `reason`.
 * - `descriptive`: a yes/no question. A "no" raises `flag`.
 * - `verdict`: no questions. The rules compute its level, on `levels`, lowest
 *   first, from the answers of the other checks.
 */
export type Check =
  | (CheckBase & { role: "can-fail" })
  | (CheckBase & { role: "asserts"; kinds: Record<string, { level: string; reason?: string }> })
  | (CheckBase & { role: "gate"; reason: string })
  | (CheckBase & { role: "runs"; reason: string })
  | (CheckBase & { role: "descriptive"; flag: string })
  | (CheckBase & { role: "verdict"; levels: string[] });

/** One test extracted from a test file. The unit of an audit. */
export interface AuditTest {
  file: string;
  line: number;
  name: string;
  path: string[];
  /** The heads of the enclosing describe calls, outermost first, such as `describe.skip("parser", () => {`. */
  scope: string[];
  source: string;
  fixtures: string[];
  /** The code of each scope around the test that is not a test, describe or
   * hook call, outermost first: the values the test file declares. Absent when
   * there is none. */
  setup?: string[];
  imports: string[];
  /** Extractor notes, such as `each`, `dynamic-name` or `focus-in-file`; they join the result's flags. */
  flags: string[];
}

/** One answer from the SystemOne endpoint. `score` is an expected level; `noul` is P(yes). */
export interface AuditAnswer {
  /** Absent on an endpoint that sends only the field the question needs, such as Ollama 0.35. */
  type?: "choice" | "score" | "noul";
  probabilities?: Record<string, number>;
  confidence?: number;
  /** Absent on an endpoint that reports no mass, such as Ollama 0.35. */
  mass?: number;
  choice?: string;
  score?: number;
  noul?: number;
}

/**
 * Several phrasings of one judgement, aligned to one polarity: the answer to a
 * negated yes/no phrasing is flipped. Each phrasing gives P(yes).
 */
export interface Paraphrase {
  /** One value per phrasing, in question order; null when unanswered or untrusted. */
  values: Array<number | null>;
  /** The mean of the values; null when none answered. */
  mean: number | null;
  /** The highest value minus the lowest; null with fewer than two. */
  spread: number | null;
  /** unanswered, single, stable, borderline, or unstable. */
  state: string;
  /** borderline or unstable: the phrasings disagree. */
  unstable: boolean;
}

/** What the verdict rules make of one check's answers. */
export interface CheckResult {
  /**
   * The value the check commits to: yes or no, an assert kind, or
   * a verdict level. Undefined when a phrasing is unanswered, or when the
   * phrasings disagree.
   */
  value?: boolean | string;
  /** The phrasings behind the value, for a check asked in more than one. */
  group?: Paraphrase;
  /** The value sits far enough from 0.5, or comes from the code, to act on. */
  sure: boolean;
  /** Why the check escalates the test. Empty when it does not. */
  reasons: string[];
  /** The flags the check raises. They report, and do not escalate. */
  flags: string[];
}

/** Where one test's answers landed, and why it escalates. `needsEyes` is the only fail. */
export interface AuditResult {
  test: Pick<AuditTest, "file" | "line" | "name" | "path">;
  answers: Record<string, AuditAnswer>;
  /** One result for each check, keyed by the check's name, in battery order. */
  checks: Record<string, CheckResult>;
  /** The can-fail phrasings: the group of the can-fail check. The reports show its mean. */
  canFail?: Paraphrase;
  /** The assert kind both phrasings agree on: the value of the asserts check. */
  asserts?: string;
  /** The verdict level the rules compute from the answers. */
  score: { label?: string };
  /** The extractor's notes, then the flags of the checks, each once. */
  flags: string[];
  needsEyes: boolean;
  /** The transport error, then the reasons of the checks: can-fail, the gates, asserts, and the verdict. */
  reasons: string[];
  error?: string;
}

/** The calls one run made and the tokens they cost. */
export interface AuditUsage {
  calls: number;
  tokens: number;
}

/**
 * One labelled case of the calibration corpus: a `label.json` in
 * checks/<check>/cases/<case>/. The loader adds `check`, `file`, `code` and
 * `sources` from the folder, so a label.json does not hold them.
 */
export interface CalibrationLabel {
  /** The check folder the case belongs to: the check meant to catch its defect. */
  check: string;
  /** The case file, relative to test-audit/. */
  file: string;
  /** The name of the test in that file. */
  test: string;
  defect?: string;
  /** The expected answer to the falsifiable question. */
  canFail?: boolean;
  /** true: the audit must never pass this test silently. false: a good test, so an escalation is a false positive. */
  mustEscalate?: boolean;
  /** A test whose expected outcome is escalation. */
  mixed?: boolean;
  /** What the case shows, in prose. */
  note?: string;
  /** The file beside the case that holds the code under test, relative to
   * test-audit/. The runner sends it as the change context, the way a real
   * audit sends the non-test diff. */
  code?: string;
  /** The sources the header comment of the case file names. */
  sources?: Source[];
  /* A label may also hold a field named after a check, such as `deterministic`
   * or `asserts`: the value that check must give. labelChecks in
   * calibration/labels.mjs reads them; LABEL_CHECKS lists the names. */
}

/** One labelled case after a run: its result, or why it has none. */
export interface CalibrationRow {
  label: CalibrationLabel;
  /** The test the extractor found in the case file, as the endpoint saw it. */
  test?: AuditTest;
  /** The code under test, if the case has one. */
  code?: string;
  /** The change context the endpoint saw: the code under test as a capped diff, or empty. */
  context?: string;
  result?: AuditResult;
  error?: string;
}
