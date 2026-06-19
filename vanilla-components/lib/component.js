// @ts-check
// defineComponent — the single home of the warm-load-once + build contract every
// component shares. Given the component's module URL and kebab name, it loads the
// <name>.html template + <name>.css once (warm), then exposes a synchronous build
// (sync) and a warm-then-build convenience (create). The build is called VERBATIM
// with whatever args the component's contract takes — (props, signal), or the
// imperative tooltip's (host, opts, signal) — so every component fits the triple.
//
// Build-less: a plain ES module over templates.js, no bundler. The design-sync
// bridge ships its own edition (bridge/ds-adapter/dist/_bridge-defineComponent.js)
// that warms from a pre-inlined template instead of fetching — same contract.
import { loadTemplates, loadCSS } from "./templates.js";

/**
 * @template {any[]} A
 * @template R
 * @param {string} moduleUrl - the component's `import.meta.url`.
 * @param {string} name - kebab id; matches `./<name>.html`, `./<name>.css`, and the `tpl-<name>` id.
 * @param {(...args: A) => R} build - synchronous build; assumes warm() resolved (tpl() needs the template).
 * @returns {{ warm: () => Promise<unknown>, sync: (...args: A) => R, create: (...args: A) => Promise<R> }}
 */
export function defineComponent(moduleUrl, name, build) {
  /** @type {Promise<unknown> | undefined} */
  let ready;
  const warm = () => (ready ??= Promise.all([
    loadTemplates(new URL(`./${name}.html`, moduleUrl).href),
    loadCSS(moduleUrl, `./${name}.css`),
  ]));
  return {
    warm,
    sync: build,
    create: async (...args) => {
      await warm();
      return build(...args);
    },
  };
}
