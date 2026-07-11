// @ts-check
// Canonical template + view-lifecycle helpers for the vanilla-web conventions
// (see SKILL.md). Copy into <app>/web/lib/templates.js; extend, don't fork.
// Identity: the .html seam (fetch a component's markup, clone it, fill it) plus
// the small view-lifecycle helpers every mount() reaches for (loadCSS, every,
// withPending). Interaction-safe re-rendering (renderRegion/reconcileList/
// withTransition) lives in render.js; page-chrome wiring (wireTheme/
// wireErrorBar) lives in chrome.js — split out so components and
// defineComponent, which import ONLY this file, don't pull in either.
//
// Components live in `*.html` files as one or more `<template id="tpl-…">`
// blocks with `data-slot="name"` markers. `loadTemplates(…urls)` fetches each
// file and inlines the templates into the document; components then do:
//
//   const node = tpl("tpl-run-row");
//   pick(node, "task").textContent = run.task;
//   host.appendChild(node);

/** In-flight-and-done memo, keyed by url: the value IS the single fetch+inline
 * for that url, so two callers racing for the SAME url in the same tick share
 * one promise instead of each independently fetching and appending (#66) — the
 * old `Set<string>` only recorded "done" and left a check-then-act window
 * between the membership test and the add. @type {Map<string, Promise<void>>} */
const inflight = new Map();

// Trusted Types (#59): loadTemplates is the ONE innerHTML sink in the toolkit
// (slot()/pick() write textContent only). require-trusted-types-for 'script'
// in serve.mjs's CSP would throw on a raw string assignment, so the sink is
// wrapped in a single named, lazily-created policy — the policy IS the audit
// point for every trusted-HTML write in the app. Falls back to the raw string
// where trustedTypes is absent (node tests, or a browser without the API).
/** @typedef {{ createHTML(s: string): string }} TTPolicyLike — the one method
 * this module needs; avoids depending on the (not-yet-in-lib.dom.d.ts) global
 * TrustedTypePolicy/TrustedHTML types so the gate type-checks with no @types. */
/** @type {TTPolicyLike | undefined} */
let ttPolicy;
/** @param {string} html @returns {string} */
function trustedHtml(html) {
  const tt = /** @type {{ trustedTypes?: { createPolicy(name: string, rules: { createHTML(s: string): string }): TTPolicyLike } }} */ (
    /** @type {unknown} */ (globalThis)
  ).trustedTypes;
  if (!tt) return html;
  ttPolicy ??= tt.createPolicy("vanilla-templates", { createHTML: (s) => s });
  return /** @type {string} */ (/** @type {unknown} */ (ttPolicy.createHTML(html)));
}

/** Fetch one url's template file, inline its <template> nodes, and memoize the
 * WHOLE operation (fetch + inline) in `inflight` — not just the fetch — so
 * concurrent callers for the same url share one fetch AND one DOM append,
 * never two (#66). `p` is stored before either async step settles, so a second
 * caller arriving before the first `await` in this tick still finds (and
 * shares) it. Deleted from `inflight` on rejection (abort or a non-ok
 * response) — never on success — so a cancelled/failed load doesn't poison
 * the memo: the next mount's call creates a fresh entry and retries cleanly
 * (#61); a successful load's entry stays forever, same idempotency the old
 * `fetched` Set gave a completed url.
 * @param {string} u @param {AbortSignal} [signal] @returns {Promise<void>} */
function loadOne(u, signal) {
  let p = inflight.get(u);
  if (p) return p;
  p = fetch(u, { signal })
    .then((r) => {
      if (!r.ok) throw new Error(`template fetch ${u}: ${r.status}`);
      return r.text();
    })
    .then((text) => {
      const holder = document.createElement("div");
      holder.hidden = true;
      holder.innerHTML = trustedHtml(text);
      document.body.append(...holder.children);
    });
  p.catch(() => inflight.delete(u)); // separate subscription: cleanup only, never swallows the rejection callers await on
  inflight.set(u, p);
  return p;
}

/** Fetch component .html files and inline their <template> nodes. Idempotent —
 * a url already loaded (or currently loading) is shared, never re-fetched or
 * re-appended: concurrent calls for the SAME url get the SAME in-flight
 * promise (#66) instead of each independently fetching and inlining a
 * duplicate `<template>`. Pass an optional trailing options object
 * (`{ signal }`) to make this call's fetches abortable; existing call sites
 * that pass only strings are unaffected. On abort (or any fetch failure) a
 * url's entry is removed from the memo (see loadOne) so a cancelled view's
 * next mount retries the fetch cleanly instead of silently treating it as
 * already loaded (#61).
 * @param {...(string | { signal?: AbortSignal })} args */
export async function loadTemplates(...args) {
  const last = args[args.length - 1];
  const hasOpts = typeof last === "object" && last !== null;
  const { signal } = /** @type {{ signal?: AbortSignal }} */ (hasOpts ? last : {});
  const urls = /** @type {string[]} */ (hasOpts ? args.slice(0, -1) : args);
  await Promise.all(urls.map((u) => loadOne(u, signal)));
}

/** Clone a `<template id>` and return its DocumentFragment.
 * @param {string} id
 * @returns {DocumentFragment} */
export const tpl = (id) => {
  const t = /** @type {HTMLTemplateElement | null} */ (document.getElementById(id));
  if (!t) throw new Error(`template not loaded: ${id}`);
  return /** @type {DocumentFragment} */ (t.content.cloneNode(true));
};

/** Fill text slots: `{ slot: value }` sets textContent on `[data-slot=slot]`.
 * `null`/`undefined` values are skipped. Returns the frag for chaining.
 * @template {ParentNode & Node} T
 * @param {T} frag
 * @param {Record<string, unknown>} slots
 * @returns {T} */
export function slot(frag, slots) {
  for (const [k, v] of Object.entries(slots)) {
    if (v == null) continue;
    for (const el of frag.querySelectorAll(`[data-slot="${k}"]`)) {
      el.textContent = String(v);
    }
  }
  return frag;
}

/** First `[data-slot=name]` element. Throws on a missing slot: template
 * markers and pick() calls are kept in sync by the author, so a miss is a
 * programmer bug surfaced at the call site, not a runtime condition.
 * @param {ParentNode} frag
 * @param {string} name
 * @returns {HTMLElement} */
export const pick = (frag, name) => {
  const el = /** @type {HTMLElement | null} */ (frag.querySelector(`[data-slot="${name}"]`));
  if (!el) throw new Error(`template slot not found: data-slot="${name}"`);
  return el;
};

/** Replace `host`'s children with the rendered fragment in one swap.
 * For static/one-shot renders only — polled regions use renderRegion.
 * @param {Element} host
 * @param {Node} frag */
export function mount(host, frag) {
  host.replaceChildren(frag);
}

/** Inject a view's own stylesheet, resolved relative to its module. Pass the
 * mount `signal` and the <link> auto-removes on abort, so a re-mounting view
 * can't accumulate orphaned stylesheets in <head>:
 *   In mount():   loadCSS(import.meta.url, "./style.css", signal);
 * Without a signal you OWN the returned <link> and must remove() it yourself:
 *   In mount():   cssLink = loadCSS(import.meta.url, "./style.css");
 *   In unmount(): cssLink.remove();
 * @param {string} moduleUrl
 * @param {string} relativePath
 * @param {AbortSignal} [signal] - aborting removes the injected <link>
 * @returns {HTMLLinkElement} */
export function loadCSS(moduleUrl, relativePath, signal) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL(relativePath, moduleUrl).href;
  document.head.appendChild(link);
  signal?.addEventListener("abort", () => link.remove(), { once: true });
  return link;
}

/** setInterval tied to the view's lifecycle: cleared automatically when the
 * mount's AbortSignal fires, so a view can never leave a timer behind.
 *   every(() => refresh(), 5000, helpers.signal);
 * @param {() => void} fn
 * @param {number} ms
 * @param {AbortSignal} signal */
export function every(fn, ms, signal) {
  const id = setInterval(fn, ms);
  signal.addEventListener("abort", () => clearInterval(id), { once: true });
}

/** @type {WeakMap<Element, number>} in-flight `withPending` count per host */
const pendingCount = new WeakMap();

/** Mark `host` busy for the life of `work`: sets `aria-busy="true"` (render the
 * busy look in CSS off `[aria-busy="true"]` — dim, spinner, skeleton), cleared in
 * a `finally` so a rejection can't strand it. `aria-busy` also tells assistive
 * tech to hold partial-update announcements until the region settles. Overlapping
 * calls on the same host are ref-counted, so the busy state clears only once the
 * last one settles. Returns `work`'s result (or rethrows). For an initial or
 * user-triggered load — background SSE/poll updates re-render silently instead.
 *   await withPending(listHost, get("/rows", { signal }));
 * @template T
 * @param {Element} host
 * @param {Promise<T>} work
 * @returns {Promise<T>} */
export async function withPending(host, work) {
  pendingCount.set(host, (pendingCount.get(host) ?? 0) + 1);
  host.setAttribute("aria-busy", "true");
  try {
    return await work;
  } finally {
    const n = (pendingCount.get(host) ?? 1) - 1;
    if (n > 0) pendingCount.set(host, n);
    else { pendingCount.delete(host); host.removeAttribute("aria-busy"); }
  }
}
