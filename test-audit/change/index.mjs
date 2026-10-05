// Reading a change. `collect` gives the diff and the touched files from git;
// `extractTests` pulls the test blocks out of a file's text; `findSmells` flags
// the static defects that need no model.

export { collect } from "./collect.mjs";
export { extractTests, isTestFile, splitDiff } from "./extract.mjs";
export { findSmells, findFileFlags, HARD_FLAGS } from "./smells.mjs";
