// canonical source: vanilla-web/templates.js@245bd3a — vendored copy, do not edit here
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

/** Fetch component .html files and inline their <template> nodes. Idempotent —
 * a URL already fetched is skipped. Pass an optional trailing options object
 * (`{ signal }`) to make this call's fetches abortable; existing call sites
 * that pass only strings are unaffected. On abort (or any fetch failure) a URL
 * is NOT marked fetched — `fetched.add` only runs after every fetch in the
 * batch has actually succeeded — so a cancelled view's next mount retries the
 * fetch cleanly instead of silently treating it as already loaded (#61).
 * @param {...(string | { signal?: AbortSignal })} args */
export async function loadTemplates(...args) {
  const last = args[args.length - 1];
  const hasOpts = typeof last === "object" && last !== null;
  const { signal } = /** @type {{ signal?: AbortSignal }} */ (hasOpts ? last : {});
  const urls = /** @type {string[]} */ (hasOpts ? args.slice(0, -1) : args);
  const fresh = urls.filter((u) => !fetched.has(u));
  const texts = await Promise.all(
    fresh.map((u) => fetch(u, { signal }).then((r) => {
      if (!r.ok) throw new Error(`template fetch ${u}: ${r.status}`);
      return r.text();
    })),
  );
  fresh.forEach((u) => fetched.add(u)); // only reached once every fetch above resolved ok
  const holder = document.createElement("div");
  holder.hidden = true;
  holder.innerHTML = trustedHtml(texts.join("\n"));
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
 * by default): always logs, fills `<output id="errbar">` when present, and
 * beacons a truncated copy to the server (#62) — the one place an LLM session
 * maintaining the app can actually read it. `AbortError` is filtered at both
 * hooks (#61): a cancelled fetch/mount from routine navigation is a lifecycle
 * event, not a failure, so it's `console.debug`'d instead of painted red — and
 * never beaconed (the relay call sits AFTER the filter, deliberately). The
 * relay is additive only: `sendBeacon` 404s silently when `/api/client-errors`
 * isn't wired up (serve.mjs), so an app that never adds the endpoint pays
 * nothing extra. Payload is capped/truncated — it's an error message, not
 * telemetry: no timing, no interaction events, no fingerprinting. */
export function wireErrorBar() {
  const errbar = document.getElementById("errbar");
  /** @param {unknown} reason */
  const isAbort = (reason) => reason instanceof DOMException && reason.name === "AbortError";
  /** @param {unknown} msg @param {string} src */
  const relay = (msg, src) => navigator.sendBeacon?.("/api/client-errors", JSON.stringify({
    msg: String(msg).slice(0, 2000),
    src,
    url: location.hash,
    ua: navigator.userAgent,
  }));
  /** @param {unknown} msg @param {string} src */
  const show = (msg, src) => {
    console.error(msg);
    relay(msg, src);
    if (errbar) {
      errbar.textContent = String(msg);
      errbar.hidden = false;
    }
  };
  window.addEventListener("error", (e) => {
    if (isAbort(e.error)) { console.debug(e.error); return; }
    show(e.message, "error");
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (isAbort(e.reason)) { console.debug(e.reason); return; }
    show(`unhandled: ${e.reason}`, "unhandledrejection");
  });
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

/** @typedef {{ build: () => Node, sig?: string, controller: AbortController }} PendingSwap */
/** One entry per host with a swap pending flush — WeakMap, latest-wins: a
 * repeat skip on an already-armed host mutates `build`/`sig` in place (an
 * intermediate skipped build is correctly dropped since `build` reflects
 * current state whenever it finally runs) and keeps the SAME controller, so
 * it does NOT arm a second listener — one armed flush per host, never
 * appended. `controller` is aborted (detaching whatever listener(s) armed it)
 * the moment the host flushes or a direct swap supersedes it.
 * @type {WeakMap<Element, PendingSwap>} */
const _pendingFlush = new WeakMap();

/** Re-run renderRegion's normal guards now that whatever deferred the last
 * skip may have cleared — another interaction may have started in the
 * meantime, in which case this just re-defers (arming a fresh listener for
 * the NEW cause). Detaches the listener that triggered this flush first, so a
 * re-arm inside the recursive renderRegion call doesn't see a stale entry.
 * @param {Element} host */
function _flushRegion(host) {
  const pending = _pendingFlush.get(host);
  if (!pending) return;
  _pendingFlush.delete(host);
  pending.controller.abort();
  renderRegion(host, pending.build, { sig: pending.sig });
}

/** Stash the latest skipped build for `host` and, only if nothing is armed for
 * it yet, attach the one-shot listener that will flush it (#42 — "on the first
 * tick after the interaction clears" assumes there IS a next tick; this fires
 * the instant the interaction itself clears, tick or no tick).
 * @param {Element} host @param {() => Node} build @param {string | undefined} sig
 * @param {(signal: AbortSignal) => void} arm - attach whatever listener(s) fire on THIS skip's clear condition */
function _deferSwap(host, build, sig, arm) {
  const existing = _pendingFlush.get(host);
  if (existing) { existing.build = build; existing.sig = sig; return; } // already watching for this host's interaction to clear
  const controller = new AbortController();
  _pendingFlush.set(host, { build, sig, controller });
  arm(controller.signal);
}

/** Render `build()`'s output into `host` WITHOUT clobbering live interaction:
 *   - skip while a control inside `host` is focused (select/input/textarea/
 *     contenteditable) — an open dropdown must not snap shut;
 *   - skip while a popover or <dialog> inside `host` is open — a swap would
 *     destroy it mid-use;
 *   - skip while a text selection starts or ends inside `host`;
 *   - skip when a caller-supplied `sig` is unchanged (perf + flicker) — this
 *     one is a no-op, not a deferral: nothing new to flush later;
 *   - otherwise replaceChildren(build()).
 * `build` only runs when we actually swap, so a skipped tick is cheap. A swap
 * deferred by focus/overlay/selection flushes the INSTANT that condition
 * clears — a one-shot listener armed per host (focusout / toggle+close /
 * selectionchange), not a wait for the next poll tick, so a quiet SSE stream
 * or a one-shot store-triggered render can't strand stale DOM (#42). Never
 * advance `sig` on a skip (handled here: sig is only recorded when swapping).
 * `force:true` swaps unconditionally and clears any pending flush for `host`.
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
    if (active && active !== document.body && host.contains(active) && _isInteractive(active)) {
      _deferSwap(host, build, opts.sig, (signal) =>
        host.addEventListener("focusout", () => _flushRegion(host), { signal, once: true }));
      return;
    }
    const overlay = host.querySelector(":popover-open, dialog[open]");
    if (overlay) {
      _deferSwap(host, build, opts.sig, (signal) => {
        // toggle covers popovers (and dialogs, which also fire it); close is
        // dialog-only — attach both, harmless for whichever doesn't fire.
        overlay.addEventListener("toggle", () => _flushRegion(host), { signal, once: true });
        overlay.addEventListener("close", () => _flushRegion(host), { signal, once: true });
      });
      return;
    }
    if (selectionInside(host)) {
      _deferSwap(host, build, opts.sig, (signal) =>
        // Chatty and document-level, so attach ONLY while a flush is pending
        // (armed here, detached in _flushRegion via the shared AbortController)
        // — never left listening between renders. Re-checks selectionInside
        // itself: most selectionchange events fire while the selection is
        // still inside host (extending it), and must not flush prematurely.
        document.addEventListener("selectionchange", () => {
          if (!selectionInside(host)) _flushRegion(host);
        }, { signal }));
      return;
    }
    if (opts.sig != null && _regionSig.get(host) === opts.sig) return;
  }
  // This swap is happening now — any earlier deferred one is moot.
  _pendingFlush.get(host)?.controller.abort();
  _pendingFlush.delete(host);
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

/** Animate a DISCRETE, user-initiated DOM change with a View Transition instead
 * of letting it pop — switching a tab, opening a detail, expanding a panel,
 * sorting a column: the changes a person triggered and expects to see move.
 * `update` performs the DOM mutation (typically a forced `renderRegion` swap, or
 * a user-driven `reconcileList` reorder whose rows carry a `view-transition-name`);
 * the browser snapshots before and after and crossfades between them. Style the
 * animation entirely in CSS via the `::view-transition-*` pseudo-elements.
 *
 * NOT for polled or SSE re-renders. A view transition is single-flight per
 * document — starting one while another runs SKIPS the first — and animates on
 * every call, so wrapping a fast re-render path yields shimmer and
 * self-cancelling transitions. Let those swap instantly through `renderRegion` /
 * `reconcileList`; the dividing line is the trigger — a human action, not a timer.
 *
 * Returns the `ViewTransition` (a resolved-`finished` shim where the API is
 * missing), so acting once the change settles composes without leaving the
 * helper: `withTransition(update).finished.then(() => closeBtn.focus())`. Note
 * `update` runs ASYNCHRONOUSLY under a real transition (after the browser
 * captures the old state), so don't read the new DOM synchronously after the
 * call. Reduced motion is handled in CSS — `shell.css` neutralises the
 * `::view-transition-*` animations under `prefers-reduced-motion` — so this never
 * checks it. Where the API is missing, `update` runs synchronously: same DOM
 * result, no animation.
 *
 *   btn.addEventListener("click", () => withTransition(() =>
 *     renderRegion(panel, () => detailView(id), { force: true })), { signal });
 *
 * @param {() => void} update - the DOM mutation to animate
 * @returns {{ finished: Promise<unknown> }} the transition — await `.finished` */
export function withTransition(update) {
  const doc = /** @type {Document & { startViewTransition?: (cb: () => void) => { finished: Promise<unknown> } }} */ (document);
  if (typeof doc.startViewTransition === "function") return doc.startViewTransition(update);
  update();
  return { finished: Promise.resolve() };
}
