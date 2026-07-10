// canonical source: vanilla-web/previews/naming.mjs@60f9ef5 — vendored copy, do not edit here
// @ts-check
// Shared kebab-title -> create<Name> factory-naming convention. One definition
// so previews/new.mjs (which scaffolds the real import) and preview.js (which
// reconstructs a usage snippet from it) can't silently drift apart FROM EACH
// OTHER. That's the only guarantee this file gives: it doesn't check either
// caller's output against what a component's own module actually exports — a
// hand-renamed factory that no longer follows this convention still produces a
// confidently-wrong snippet, uncaught by tsc or anything else.

/** "stat-card" -> "createStatCard".
 * @param {string} title @returns {string} */
export function factoryNameFor(title) {
  return `create${title.replace(/(^|[-_])([a-z])/g, (_, __, c) => c.toUpperCase())}`;
}
