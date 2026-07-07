// @ts-check
// Shared kebab-title -> create<Name> factory-naming convention. One definition
// so previews/new.mjs (which scaffolds the real import) and preview.js (which
// reconstructs a usage snippet from it) can't silently drift apart — a mismatch
// would make the harness confidently print a "copy this" call to a factory that
// doesn't actually exist.

/** "stat-card" -> "createStatCard".
 * @param {string} title @returns {string} */
export function factoryNameFor(title) {
  return `create${title.replace(/(^|[-_])([a-z])/g, (_, __, c) => c.toUpperCase())}`;
}
