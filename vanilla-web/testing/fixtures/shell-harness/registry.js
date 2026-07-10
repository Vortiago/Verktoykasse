// @ts-check
// Fixture registry for shell-harness.html's e2e specs (#53 error containment,
// #60 title+focus, #61 abort semantics, #62 client-error relay). Swapped in for
// the real (empty) views/registry.js via shell-harness.html's import map, so
// the specs exercise the REAL, unmodified canon shell.js against these views.

/** @type {import("../../../views/registry.js").ViewEntry[]} */
export const views = [
  { id: "home", title: "Home", load: () => import("./views/home.js") },
  { id: "broken", title: "Broken", load: () => import("./views/broken.js") },
  { id: "slow", title: "Slow", load: () => import("./views/slow.js") },
];
