// @ts-check
// Fixture registry for shell-harness.html's e2e specs (#53 error containment,
// #60 title+focus, #61 abort semantics, #62 client-error relay). Served in
// place of the real (empty) views/registry.js by serve.mjs's TEST=1 route
// (see serve.mjs, "/views/registry.js"), which serves THIS file's bytes at
// that URL — so the specs exercise the REAL, unmodified canon shell.js against
// these fixture views. The view imports below are ABSOLUTE (not relative to
// this file's own directory) because the browser resolves them against the
// URL this file is SERVED at ("/views/registry.js"), not its location on disk.

/** @type {import("../../../views/registry.js").ViewEntry[]} */
export const views = [
  { id: "home", title: "Home", load: () => import("/testing/fixtures/shell-harness/views/home.js") },
  { id: "broken", title: "Broken", load: () => import("/testing/fixtures/shell-harness/views/broken.js") },
  { id: "slow", title: "Slow", load: () => import("/testing/fixtures/shell-harness/views/slow.js") },
];
