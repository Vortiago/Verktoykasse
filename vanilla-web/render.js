// @ts-check
// Canonical interaction-safe re-rendering for the vanilla-web conventions (see
// SKILL.md). Copy into <app>/web/lib/render.js; extend, don't fork. Identity:
// live (SSE-driven or polled) DOM updates that never clobber a focused
// control, an open popover/dialog, or a mid-copy text selection.
//
// Polled UIs clobber open dropdowns, focused inputs, and text selections when
// they swap DOM. EVERY region swap on polled data goes through renderRegion;
// raw replaceChildren/innerHTML on polled data is a convention violation
// (enforced by tools/check-conventions.mjs's raw-swap rule). Long keyed lists
// use reconcileList instead — it updates in place around the interaction
// rather than deferring a whole-region swap. withTransition is the opposite
// case: a DISCRETE, user-initiated change that should animate, never a polled
// re-render. selectionInside is exported standalone for in-place updaters
// (outside renderRegion) that write text every tick.
//
// This module imports nothing from templates.js or chrome.js, and nothing
// there imports this — components and defineComponent (lib/component.js)
// import ONLY templates.js, never this file.

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
 * A DETACHED host just drops its pending swap (entry deleted, listeners
 * aborted, no render) — nothing must keep rendering into DOM that left the
 * document, and the entry must not pin its build closure.
 * @param {Element} host */
function _flushRegion(host) {
  const pending = _pendingFlush.get(host);
  if (!pending) return;
  _pendingFlush.delete(host);
  pending.controller.abort();
  if (!host.isConnected) return;
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
        // Removal WITHOUT close/toggle (overlay.remove(), a parent re-render)
        // fires neither event and would strand the pending swap on a quiet
        // stream — watch the subtree, flush (re-running all guards) once the
        // overlay left the DOM. Lives only while this flush is pending: same
        // abort that detaches the listeners disconnects it. Feature-guarded —
        // the node tests' fake documents have no MutationObserver.
        if (typeof MutationObserver !== "undefined") {
          const mo = new MutationObserver(() => { if (!overlay.isConnected) _flushRegion(host); });
          mo.observe(host, { childList: true, subtree: true });
          signal.addEventListener("abort", () => mo.disconnect(), { once: true });
        }
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
