// canonical source: test-audit/change/index.mjs@4ba9d42 sha256:4683da026c0bfb934e45e349236eb5750c157dc4451c33ae3dffe79105432443 - vendored copy, do not edit here
// Reading a change. `collect` gives the diff and the touched files from git;
// `extractTests` pulls the test blocks out of a file's text. Judging a test is
// classifier/; this module only reads it.

export { collect } from "./collect.mjs";
export { changeContext, changedTests, extractTests, isTestFile } from "./extract.mjs";
