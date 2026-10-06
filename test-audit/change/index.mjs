// Reading a change. `collect` gives the diff and the touched files from git;
// `extractTests` pulls the test blocks out of a file's text. Judging a test is
// classifier/; this module only reads it.

export { collect } from "./collect.mjs";
export { changeContext, extractTests, isTestFile } from "./extract.mjs";
