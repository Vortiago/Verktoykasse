// @ts-check
// Canonical view registry: the routable views the shell switches between. The
// shell (shell.js) reads this list; an app fills it with its own views. It is
// kept empty in the skill so the skill's own `tsc` gate can resolve shell.js's
// `import { views }` without shipping a worked example app — copy it into your
// app and add entries (the scaffolder/docs show the shape).

/** A view module's default export. @typedef {{
 *   id: string,
 *   mount(container: HTMLElement, data: unknown, helpers: { loadCSS: Function, every: Function, signal: AbortSignal }): void | Promise<void>,
 *   unmount(): void,
 * }} View */

/** A registry entry: a view's id + a lazy loader for its module. `title`
 * (optional) feeds shell.js's `document.title = "<title> · <APP_NAME>"` on a
 * real view switch (#60) — omit it and the view just doesn't relabel the tab.
 * @typedef {{ id: string, title?: string, load: () => Promise<{ default: View }> }} ViewEntry */

/** The app's routable views, in nav order. Empty here; an app fills it.
 * @type {ViewEntry[]} */
export const views = [];
