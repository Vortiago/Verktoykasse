// Shared shapes for the test-audit modules. The modules are `.mjs` with JSDoc
// types, and the tsc gate checks them under strict (tsconfig.json). A module
// imports a shape with `@typedef {import("../types.d.ts").AuditTest} AuditTest`,
// so each shape is written down once, here, instead of across ten files. The
// Node API the modules use is declared in node.d.ts.

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

/** Where one test's answers landed, and why it escalates. `needsEyes` is the only fail. */
export interface AuditResult {
  test: Pick<AuditTest, "file" | "line" | "name" | "path">;
  answers: Record<string, AuditAnswer>;
  canFail: { values: Array<number | null>; mean: number | null; spread: number | null; state: string; unstable: boolean };
  asserts: { value?: string; a?: string; b?: string; trust: boolean; agrees: boolean };
  /** Whether the test actually runs; undefined when unanswered. */
  runs?: boolean;
  /** Whether the test asserts a positive case; undefined when unanswered. */
  positive?: boolean;
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

/** One labelled case of the calibration corpus (calibration/labels/). */
export interface CalibrationLabel {
  /** The case file, relative to calibration/. */
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
  /** The fragment in labels/ the case comes from, and the sources it cites. */
  group?: string;
  sources?: Array<{ name: string; url?: string }>;
}

/** One labelled case after a run: its result, or why it has none. */
export interface CalibrationRow {
  label: CalibrationLabel;
  /** The test the extractor found in the case file, as the endpoint saw it. */
  test?: AuditTest;
  result?: AuditResult;
  error?: string;
}
