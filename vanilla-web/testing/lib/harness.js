// Shared fixture path for the shell-harness Playwright specs (shell-abort,
// shell-title-focus, shell-error-containment, client-error-relay) — they all
// drive the SAME fixture (testing/fixtures/shell-harness.html, the real canon
// shell.js against test views served by serve.mjs's TEST-only
// /views/registry.js route), so the path lived on as an identical
// `const FIXTURE = …` copy in each file. One shared home, same precedent as
// lib/mem.js.
export const FIXTURE = "/testing/fixtures/shell-harness.html";
