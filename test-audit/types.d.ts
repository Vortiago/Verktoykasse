// Shared shapes for the test-audit modules. Those modules are `.mjs`, so they
// sit outside the tsc gate exactly as searx-researcher/server does: they import
// `node:*`, and this gate carries no @types/node. This file is the gate's type
// input and the one place the shapes are written down, so a reader finds them
// in one place instead of across ten files.

/** One test extracted from a test file. The unit of an audit. */
export interface AuditTest {
  file: string;
  line: number;
  name: string;
  path: string[];
  source: string;
  body: string;
  fixtures: string[];
  imports: string[];
  flags: string[];
}

/** One answer from the SystemOne endpoint. `score` is an expected level; `noul` is P(yes). */
export interface AuditAnswer {
  type: "choice" | "score" | "noul";
  probabilities: Record<string, number>;
  confidence: number;
  mass: number;
  choice?: string;
  score?: number;
  noul?: number;
}

/** Where one test's answers landed, and why it escalates. `needsEyes` is the only fail. */
export interface AuditResult {
  test: Pick<AuditTest, "file" | "line" | "name" | "path">;
  canFail: { values: Array<number | null>; mean: number | null; spread: number | null; state: string };
  asserts: { value?: string; a?: string; b?: string; trust: boolean; agrees: boolean };
  type?: string;
  deterministic?: boolean;
  oneThing?: boolean;
  nameMatches?: boolean;
  score: { value?: number; label?: string };
  flags: string[];
  needsEyes: boolean;
  reasons: string[];
  error?: string;
}
