// canonical source: vanilla-web/render.js@8ebd116 — vendored copy, do not edit here
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
// re-render. markRegionStale forgets a host's recorded sig after an out-of-band
// change (lazy body landed, in-place mutate) so the next renderRegion call
// rebuilds — through the guards, unlike force:true.
//
// The hold itself is exported as a predicate — heldInside, below, for the render
// shapes renderRegion can't serve; selectionInside is its narrower selection-only
// face. See docs/adr/0002 for why the hold is a predicate and a held swap has a
// single owner.
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

/** True while a non-collapsed text selection TOUCHES `host` — starts in it, ends
 * in it, lies within it, or merely spans it. Rebuilding (or rewriting textContent
 * of) a node the selection touches destroys the selection mid-copy. Exported for
 * in-place updaters that write text every tick without going through
 * renderRegion; `heldInside` is the fuller predicate.
 *
 * `Range.intersectsNode` rather than an anchor/focus containment test, and it's a
 * strict SUPERSET of one, not a different case (#72): a boundary point inside
 * `host` sits between the points just before and just after it, so every
 * selection the endpoint test caught still holds. What it adds is the range that
 * starts BEFORE `host` and ends AFTER it — ⌘A over a panel — where neither
 * endpoint is inside and the endpoint test reported false. Every range is asked,
 * since a multi-range selection can cross `host` with any of them.
 * @param {Element} host */
export function selectionInside(host) {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
  for (let i = 0; i < sel.rangeCount; i++) {
    if (sel.getRangeAt(i).intersectsNode(host)) return true;
  }
  return false;
}

/** @typedef {{ kind: "focus" } | { kind: "overlay", overlay: Element } | { kind: "selection" }} HoldCause */

/** Why `host` is holding — or null if it isn't. THE definition of the interaction
 * hold: renderRegion switches on the cause to arm the matching flush listener,
 * `heldInside` exposes the boolean face, and neither can drift from the other
 * because there is only one copy. Order matters only for which listener a
 * deferred swap arms; any non-null cause holds.
 * @param {Element} host @returns {HoldCause | null} */
function _holdCause(host) {
  const active = document.activeElement;
  if (active && active !== document.body && host.contains(active) && _isInteractive(active)) return { kind: "focus" };
  const overlay = host.querySelector(":popover-open, dialog[open]");
  if (overlay) return { kind: "overlay", overlay };
  if (selectionInside(host)) return { kind: "selection" };
  return null;
}

/** True while `host` holds a live interaction — a control inside it is focused, a
 * popover/<dialog> inside it is open, or a text selection touches it. The exact
 * decision `renderRegion` makes internally, exported so an app that owns its own
 * retry loop shares ONE definition of "held" instead of reimplementing the
 * predicates (which then drift from canon — the reason #72 was filed).
 *
 * Reach for it for the render shapes `renderRegion` can't serve: a `reconcileList`
 * driven by materialized items (a held render must re-derive from live state, not
 * replay a captured build), an in-place updater that rewrites text every tick (no
 * build closure exists to replay), or a selection straddling a host (no event of
 * its own to listen for).
 *
 * It is a strict superset of `selectionInside`, and costs more: the overlay guard
 * is a `querySelector` over the host's subtree, where `selectionInside` is two
 * property reads that short-circuit on a collapsed selection. On a per-tick guard
 * in front of a big host, ask the narrow question when it's the only one that
 * applies — a text-only in-place updater, with no focusable control and no
 * popover/`<dialog>` inside it, wants `selectionInside`. Use `heldInside` wherever
 * the host can hold focus or an overlay, which is most hosts.
 *
 *   if (heldInside(listHost)) { retryNextTick = true; return; }
 *   reconcileList(listHost, items, keyOf, create, update);
 *
 * @param {Element} host */
export function heldInside(host) {
  return _holdCause(host) !== null;
}

/** @typedef {{ build: () => Node, sig?: string, controller: AbortController }} PendingSwap */
/** One entry per host with a swap pending flush — WeakMap, latest-wins: a
 * repeat skip on an already-armed host mutates `build`/`sig` in place (an
 * intermediate skipped build is correctly dropped since `build` reflects
 * current state whenever it finally runs) and keeps the SAME controller, so
 * it does NOT arm a second listener — one armed flush per host, never
 * appended. `controller` is aborted (detaching whatever listener(s) armed it)
 * the moment the host flushes, a direct swap supersedes it, or a `defer:false`
 * call takes the retry over.
 * @type {WeakMap<Element, PendingSwap>} */
const _pendingFlush = new WeakMap();

/** Forget any pending self-flush for `host` — abort its listener(s)/observer and
 * drop the entry. Called when this module stops owning the swap: a direct swap
 * supersedes it, or `defer:false` hands the retry to the caller.
 * @param {Element} host */
function _dropPending(host) {
  _pendingFlush.get(host)?.controller.abort();
  _pendingFlush.delete(host);
}

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
  _dropPending(host); // read the entry first: this detaches and forgets it
  if (!host.isConnected) return;
  renderRegion(host, pending.build, { sig: pending.sig });
}

/** Stash the latest skipped build for `host` and, only if nothing is armed for
 * it yet, attach the listener(s) that will flush it (#42 — "on the first tick
 * after the interaction clears" assumes there IS a next tick; this fires the
 * instant the interaction itself clears, tick or no tick). Whether a listener is
 * `once` is the caller's call, not this function's: the overlay branch's
 * toggle/close are, while focusout and selectionchange must stay armed across
 * events that don't actually clear the hold (focus moving between controls inside
 * the host; a selection being extended). All of them detach together via the
 * shared controller.
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
 *   - skip while a text selection TOUCHES `host` — starting or ending inside it,
 *     lying within it, or merely spanning it (see selectionInside);
 *   - skip when a caller-supplied `sig` is unchanged (perf + flicker) — this
 *     one is a no-op, not a deferral: nothing new to flush later;
 *   - otherwise replaceChildren(build()).
 * `build` only runs when we actually swap, so a skipped tick is cheap. A swap
 * deferred by focus/overlay/selection flushes the INSTANT that condition
 * clears — one listener set armed per host (focusout / toggle+close+removal
 * observer / selectionchange), not a wait for the next poll tick, so a quiet
 * SSE stream or a one-shot store-triggered render can't strand stale DOM (#42).
 * Never advance `sig` on a skip (handled here: sig is only recorded when
 * swapping). `force:true` swaps unconditionally and clears any pending flush
 * for `host`.
 *
 * Sig hygiene: `sig` is a cheap string of exactly what this region renders.
 * A fast-ticking value must never share a sig with an O(content) region —
 * give it its own region or mutate it in place.
 *
 * `defer:false` picks the other deferral strategy: report the hold and let the
 * CALLER retry, arming nothing and recording nothing. For an app that already
 * lands held renders through its own tick-retry flag — because its keyed lists
 * and in-place updaters must re-derive from live state rather than replay a
 * captured build — this is how it shares canon's definition of "held" instead of
 * reimplementing the predicates (#72, docs/adr/0002). Pick one strategy per host;
 * a `defer:false` call drops any self-flush an earlier `defer:true` call left
 * armed. Note that disowning happens HERE, on the call — so a host this module
 * has ever deferred must keep coming through `renderRegion` (with `defer:false`)
 * rather than being skipped by a bare `heldInside` early return, which cannot
 * reach the pending entry.
 *
 * @param {Element} host
 * @param {() => Node} build
 * @param {{ sig?: string, force?: boolean, defer?: boolean }} [opts]
 * @returns {boolean} true when the region was HELD — deferred (defer:true, the
 * default) or merely reported (defer:false). false when it swapped, AND false for
 * a sig-unchanged skip, which is a no-op with nothing to retry: that's why the
 * value is "held" rather than "swapped", so a `while (held) retry` loop
 * terminates. `true` does not promise a swap is owed — the guards run before the
 * sig gate, so a held call may sig-skip once the hold clears. Only actionable
 * under `defer:false`; informational otherwise (acting on it while canon is also
 * self-flushing gives you the two registries this option exists to avoid). */
export function renderRegion(host, build, opts = {}) {
  // `defer:false` hands the retry to the caller, so this module must not also own
  // one for `host`: drop any self-flush an earlier defer:true call left armed.
  // Two hold registries on one host diverge — this module's entry freezes at its
  // tick's build while the caller's absorbs newer ones, then this one flushes the
  // stale build in behind it, stranding the caller's fresher one. That is #72
  // item 2, enforced here rather than left to a convention.
  if (opts.defer === false) _dropPending(host);
  if (!opts.force) {
    const cause = _holdCause(host);
    if (cause && opts.defer === false) return true; // report it; arm nothing, record nothing
    if (cause?.kind === "focus") {
      _deferSwap(host, build, opts.sig, (signal) =>
        // `focusout` fires BEFORE the incoming element is focused, and for its
        // whole duration document.activeElement is <body> — so a flush that
        // re-read the guards would see an idle host and swap on top of whatever
        // was about to receive focus (#72). `relatedTarget` names that element;
        // it is the question this flush actually has to ask.
        //
        // Plain CONTAINMENT, deliberately not the _holdCause predicate: the
        // entry guard holds only for controls, but a swap must not land on ANY
        // incoming focus inside the host. That asymmetry is what keeps a button
        // inside a held region clickable — mousedown fires focusout, and
        // flushing there removes the button before its `click` ever fires. The
        // cost is bounded: focus parked on a non-interactive element inside the
        // host leaves the region stale until focus moves again (self-healing on
        // the next focusout, superseded by the next direct call on a polled app).
        //
        // NOT once: focus moving between controls inside the host must keep the
        // listener armed. Teardown is still structural — the pending entry's
        // shared controller detaches it on flush, on supersession by a direct
        // swap, and on host detachment.
        //
        // Two edges, both consistent: a window blur fires focusout with a null
        // relatedTarget while activeElement stays on the control, so the
        // re-entrant renderRegion call simply re-defers and re-arms (which is why
        // the flush re-runs the guards instead of swapping directly). And if the
        // incoming element is removed before focus lands, focus falls to <body>
        // with no further focusout — the swap strands on a quiet stream until the
        // next direct call.
        host.addEventListener("focusout", (e) => {
          const next = /** @type {Element | null} */ (/** @type {FocusEvent} */ (e).relatedTarget);
          if (next && host.contains(next)) return; // focus stayed inside — still held
          _flushRegion(host);
        }, { signal }));
      return true;
    }
    if (cause?.kind === "overlay") {
      const { overlay } = cause;
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
      return true;
    }
    if (cause?.kind === "selection") {
      _deferSwap(host, build, opts.sig, (signal) =>
        // Chatty and document-level, so attach ONLY while a flush is pending
        // (armed here, detached in _flushRegion via the shared AbortController)
        // — never left listening between renders. Re-checks selectionInside
        // itself: most selectionchange events fire while the selection is
        // still inside host (extending it), and must not flush prematurely.
        document.addEventListener("selectionchange", () => {
          if (!selectionInside(host)) _flushRegion(host);
        }, { signal }));
      return true;
    }
    if (opts.sig != null && _regionSig.get(host) === opts.sig) return false; // a no-op, not a hold
  }
  _dropPending(host); // this swap is happening now — any earlier deferred one is moot
  if (opts.sig != null) _regionSig.set(host, opts.sig);
  host.replaceChildren(build());
  return false;
}

/** Forget `host`'s recorded sig so the NEXT renderRegion call rebuilds it.
 * For out-of-band changes the sig can't see: a lazy-loaded body landed, a
 * mutation just changed what `build()` would produce. Unlike `force:true`
 * this doesn't swap anything itself — the rebuild still arrives through
 * renderRegion's interaction guards, so it can't clobber a focused control,
 * an open overlay, or a mid-copy selection.
 * @param {Element} host */
export function markRegionStale(host) {
  _regionSig.delete(host);
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
