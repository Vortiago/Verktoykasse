// The calibration: the labelled corpus, the rules that score a run, and the live
// runner. `runSelftest` is the interface.

export { runSelftest } from "./runner.mjs";
export { loadLabels } from "./labels.mjs";
export { judge, rowStatus } from "./judge.mjs";
