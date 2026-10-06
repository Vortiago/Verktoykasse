// Shared shapes for the test-audit modules. The modules are `.mjs` with JSDoc
// types, and the tsc gate checks them under strict (tsconfig.json). A module
// imports a shape with `@typedef {import("../types.d.ts").AuditTest} AuditTest`,
// so each shape is written down once, here, instead of across ten files. The
// Node API the modules use is declared in node.d.ts.

import type { Question } from "./classifier/systemone.mjs";

/** A source that grounds a check or a calibration case. */
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
  /** The question keys whose yes and no are swapped. The verdict rules flip their value. */
  negated?: string[];
  /** The definition this check adds to the shared rubric, if any. */
  rubric?: string;
  /** What grounds the check. The header comment of the check file names the same sources. */
  sources: Source[];
}

/**
 * One judgement the tool asks the model about a test: one question, or a set of
 * phrasings of one judgement. `role` says what the verdict rules do with the
 * answers:
 * - `can-fail`: a paraphrase set. Its mean is the can-fail value.
 * - `asserts`: a choice pair. Only the first kind is a real guard.
 * - `gate`: a yes/no twin pair. A "no" escalates with `reason`.
 * - `type`: a choice that the report shows and that never escalates.
 * - `descriptive`: a yes/no question. A "no" raises `flag`.
 * - `verdict`: the score, on `levels`, lowest first.
 */
export type Check =
  | (CheckBase & { role: "can-fail" })
  | (CheckBase & { role: "asserts"; kinds: Record<string, string> })
  | (CheckBase & { role: "gate"; reason: string })
  | (CheckBase & { role: "type" })
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

/** Several phrasings of one judgement, normalised to one polarity. */
export interface Paraphrase {
  values: Array<number | null>;
  mean: number | null;
  spread: number | null;
  /** unanswered, single, stable, borderline, or unstable. */
  state: string;
  /** borderline or unstable: the phrasings disagree beyond the band. */
  unstable: boolean;
}

/** Where one test's answers landed, and why it escalates. `needsEyes` is the only fail. */
export interface AuditResult {
  test: Pick<AuditTest, "file" | "line" | "name" | "path">;
  answers: Record<string, AuditAnswer>;
  canFail: Paraphrase;
  asserts: { value?: string; a?: string; b?: string; trust: boolean; agrees: boolean };
  /** Whether the test actually runs; undefined unless both twins answered and agree. */
  runs?: boolean;
  /** Whether the test asserts a positive case; undefined unless both twins answered and agree. */
  positive?: boolean;
  /** The twin pair behind each verdict-carrying yes/no gate, keyed by gate name. */
  pairs: Record<string, Paraphrase>;
  type?: string;
  /** One boolean per descriptive gate (observable, conditional, isolated, …); undefined when unanswered. */
  descriptive: Record<string, boolean | undefined>;
  score: { value?: number; label?: string };
  flags: string[];
  needsEyes: boolean;
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
 * checks/<check>/cases/<case>/. The loader adds `check`, `file` and `code` from
 * the folder, so a label.json does not hold them.
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
  /** The expected answer to the `deterministic` question. */
  deterministic?: boolean;
  /** What the case shows, in prose. */
  note?: string;
  /** The file beside the case that holds the code under test, relative to
   * test-audit/. The runner sends it as the change context, the way a real
   * audit sends the non-test diff. */
  code?: string;
  /** The sources the case cites. */
  sources?: Source[];
}

/** One labelled case after a run: its result, or why it has none. */
export interface CalibrationRow {
  label: CalibrationLabel;
  /** The test the extractor found in the case file, as the endpoint saw it. */
  test?: AuditTest;
  /** The code under test the endpoint saw as the change context, if the case has one. */
  code?: string;
  result?: AuditResult;
  error?: string;
}
