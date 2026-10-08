// canonical source: test-audit/change/index.mjs@2863149 sha256:1071466622bc3effb2cc321c4abdfd2ed1c2333fb801f56d9dbcf97b6e254a1d - vendored copy, do not edit here
// Reading a change. `collect` gives the diff and the touched files from git;
// `extractTests` pulls the test blocks out of a file's text. Judging a test is
// classifier/; this module only reads it.

export { collect } from "./collect.mjs";
export { changeContext, changedTests, extractTests, isNamedTestFile, isTestFile } from "./extract.mjs";
