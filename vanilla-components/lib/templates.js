// canonical source: vanilla-web/templates.js@1d6aa5d — vendored copy, do not edit here
// @ts-check
// Canonical template + render helpers for the vanilla-web conventions
// (see SKILL.md). Copy into <app>/web/lib/templates.js; extend, don't fork.
//
// Components live in `*.html` files as one or more `<template id="tpl-…">`
// blocks with `data-slot="name"` markers. `loadTemplates(…urls)` fetches each
// file and inlines the templates into the document; components then do:
//
//   const node = tpl("tpl-run-row");
//   pick(node, "task").textContent = run.task;
//   host.appendChild(node);

/** @type {Set<string>} */
const fetched = new Set();

/** Fetch component .html files and inline their <template> nodes. Idempotent.
 * @param {...string} urls */
export async function loadTemplates(...urls) {
  const fresh = urls.filter((u) => !fetched.has(u));
  const texts = await Promise.all(
    fresh.map((u) => fetch(u).then((r) => {
      if (!r.ok) throw new Error(`template fetch ${u}: ${r.status}`);
      return r.text();
    })),
  );
  fresh.forEach((u) => fetched.add(u));
  const holder = document.createElement("div");
  holder.hidden = true;
  holder.innerHTML = texts.join("\n");
  document.body.append(...holder.children);
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

// ── Page chrome ────────────────────────────────────────────────────────────
// Wiring shared by every page (the app shell.js and the standalone preview.js),
// so the two can't drift. Both look up well-known ids in the shell markup.

/** Wire the `<button id="theme">` light/dark/auto cycle. light-dark() tokens
 * follow the root's color-scheme, so a manual override is one property; "auto"
 * clears it and defers to the OS. Choice persists per page under `storageKey`.
 * @param {string} [storageKey] */
export function wireTheme(storageKey = "theme") {
  const btn = document.getElementById("theme");
  const themes = ["auto", "light", "dark"];
  let current = localStorage.getItem(storageKey) || "auto";
  const apply = () => {
    document.documentElement.style.colorScheme = current === "auto" ? "" : current;
    if (btn) btn.textContent = current;
  };
  apply();
  btn?.addEventListener("click", () => {
    current = themes[(themes.indexOf(current) + 1) % themes.length];
    localStorage.setItem(storageKey, current);
    apply();
  });
}

/** Surface listener exceptions and unhandled rejections (which vanish silently
 * by default): always logs, and fills `<output id="errbar">` when present. */
export function wireErrorBar() {
  const errbar = document.getElementById("errbar");
  /** @param {unknown} msg */
  const show = (msg) => {
    console.error(msg);
    if (errbar) {
      errbar.textContent = String(msg);
      errbar.hidden = false;
    }
  };
  window.addEventListener("error", (e) => show(e.message));
  window.addEventListener("unhandledrejection", (e) => show(`unhandled: ${e.reason}`));
}

// ── Interaction-safe re-rendering ──────────────────────────────────────────
// Polled UIs clobber open dropdowns, focused inputs, and text selections when
// they swap DOM. EVERY region swap on polled data goes through renderRegion;
// raw replaceChildren/innerHTML on polled data is a convention violation.

/** Per-host last signature, for the sig gate. @type {WeakMap<Element, string>} */
const _regionSig = new WeakMap();

/** @param {Element} el — true for controls that hold live interaction state. */
function _isInteractive(el) {
  const tag = el.tagName;
  return (
    tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA" ||
    /** @type {HTMLElement} */ (el).isContentEditable === true
  );
}

/** True while a non-collapsed text selection starts or ends inside `host`.
 * Rebuilding (or rewriting textContent of) a node the selection touches
 * destroys the selection mid-copy. Exported for in-place updaters that write
 * text every tick without going through renderRegion.
 * @param {Element} host */
export function selectionInside(host) {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
  return (
    (!!sel.anchorNode && host.contains(sel.anchorNode)) ||
    (!!sel.focusNode && host.contains(sel.focusNode))
  );
}

/** Render `build()`'s output into `host` WITHOUT clobbering live interaction:
 *   - skip while a control inside `host` is focused (select/input/textarea/
 *     contenteditable) — an open dropdown must not snap shut;
 *   - skip while a popover or <dialog> inside `host` is open — a swap would
 *     destroy it mid-use;
 *   - skip while a text selection starts or ends inside `host`;
 *   - skip when a caller-supplied `sig` is unchanged (perf + flicker);
 *   - otherwise replaceChildren(build()).
 * `build` only runs when we actually swap, so a skipped tick is cheap. A
 * deferred swap lands on the first tick after the interaction clears — never
 * advance `sig` on a skip (handled here: sig is only recorded when swapping).
 * `force:true` swaps unconditionally.
 *
 * Sig hygiene: `sig` is a cheap string of exactly what this region renders.
 * A fast-ticking value must never share a sig with an O(content) region —
 * give it its own region or mutate it in place.
 *
 * @param {Element} host
 * @param {() => Node} build
 * @param {{ sig?: string, force?: boolean }} [opts] */
export function renderRegion(host, build, opts = {}) {
  if (!opts.force) {
    const active = document.activeElement;
    if (active && active !== document.body && host.contains(active) && _isInteractive(active)) return;
    if (host.querySelector(":popover-open, dialog[open]")) return;
    if (selectionInside(host)) return;
    if (opts.sig != null && _regionSig.get(host) === opts.sig) return;
  }
  if (opts.sig != null) _regionSig.set(host, opts.sig);
  host.replaceChildren(build());
}

/** Per-node reconcile key, set on nodes reconcileList creates. @type {WeakMap<Element, string>} */
const _reconcileKey = new WeakMap();

/** Keyed, in-place list reconciliation that PRESERVES node state. Updates `host`'s
 * element children to match `items` by key, moving surviving nodes with
 * `moveBefore()` — which keeps focus, text selection, scroll position, running CSS
 * animations and playing media intact across the move — instead of rebuilding.
 * This is the native answer to "re-render a live (SSE-driven) list without
 * clobbering interaction": where `renderRegion` DEFERS a swap while a control is
 * focused, `reconcileList` updates around it live. Where `moveBefore` is missing
 * it falls back to `insertBefore` (still correct — just loses the state preservation).
 *
 *   reconcileList(rowsHost, sessions, (s) => s.id,
 *     (s) => buildRow(s),                // create: a fresh row for a new key
 *     (node, s) => fillRow(node, s));    // update: mutate an existing row in place
 *
 * The host's element children must be reconcileList's alone (no stray text nodes).
 * @template T
 * @param {Element} host
 * @param {T[]} items - desired contents, in order
 * @param {(item: T) => string} keyOf - stable identity per item
 * @param {(item: T) => Element} create - build a node for a not-yet-present key
 * @param {(node: Element, item: T) => void} [update] - update an existing node in place */
export function reconcileList(host, items, keyOf, create, update) {
  /** @type {Map<string, Element>} */
  const prev = new Map();
  for (const n of host.children) {
    const k = _reconcileKey.get(n);
    if (k !== undefined) prev.set(k, n);
  }
  // moveBefore (Chromium 133+) repositions a node without resetting its state;
  // cast it on once (lib.dom may not declare it), else fall back to insertBefore.
  const h = /** @type {Element & { moveBefore?(node: Node, ref: Node | null): void }} */ (host);
  let cursor = host.firstElementChild;
  for (const item of items) {
    const k = String(keyOf(item));
    let node = prev.get(k);
    if (node) {
      prev.delete(k);
      if (update) update(node, item);
    } else {
      node = create(item);
      _reconcileKey.set(node, k);
    }
    if (node === cursor) {
      cursor = cursor.nextElementSibling; // already in place
    } else if (node.parentNode === host && h.moveBefore) {
      h.moveBefore(node, cursor); // existing node: state-preserving move
    } else {
      host.insertBefore(node, cursor); // new node, or no moveBefore: plain insert
    }
  }
  for (const n of prev.values()) n.remove(); // drop keys no longer present
}
