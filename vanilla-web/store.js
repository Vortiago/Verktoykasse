// @ts-check
// Canonical shared-state singleton for the vanilla-web conventions (see SKILL.md).
// Copy into <app>/lib/store.js. The sanctioned replacement for "what you'd reach
// for a framework context for": module-level state that outlives view re-mounts,
// fetched once, with a subscribe() so the shell re-renders the chrome on change.
//
//   // lib/auth.js
//   export const auth = createStore(() => get("/auth/me"));
//   await auth.load();                 // boot once before the router
//   auth.get();  auth.subscribe(renderChrome, signal);  auth.refresh();  auth.set(null);
//   // pass the view's mount signal so the subscription dies with the view —
//   // without it you OWN the returned unsubscribe and must call it on unmount.
//
// Opt-in freshness (#46), for the pull-only case (no SSE upstream self-healing
// on reconnect): a background tab left open overnight, or a laptop waking from
// sleep, otherwise shows last-session data until something calls refresh().
//
//   export const stats = createStore(() => get("/stats"), { refetchOn: ["visible", "online"], maxAge: 60_000 });
//
// "visible" refetches on visibilitychange→visible IF the value is older than
// maxAge (omit maxAge → always refetch on visible); "online" refetches on
// window "online" unconditionally. Listeners are module-level singletons by
// default (registered once at store creation, alive for the app's lifetime —
// the same assumption every other module-level store already makes); pass
// `signal` to release them instead (tests, or a store created per-view).

/**
 * @template T
 * @param {() => Promise<T>} load — fetches the value; called at most once until refresh()
 * @param {{ refetchOn?: ("visible" | "online")[], maxAge?: number, signal?: AbortSignal }} [opts]
 */
export function createStore(load, opts) {
  /** @type {T | null} */ let value = null;
  let loaded = false;
  let lastLoadedAt = 0;
  /** @type {Promise<void> | null} */ let inflight = null;
  /** @type {Set<(v: T | null) => void>} */ const subs = new Set();

  const notify = () => { for (const cb of subs) cb(value); };

  /** Fetch once; concurrent callers share the inflight promise. */
  function ensure() {
    if (inflight) return inflight;
    inflight = Promise.resolve()
      .then(load)
      .then((v) => { value = v; })
      .catch(() => { value = null; })           // failed load → null, not a throw
      .finally(() => { loaded = true; lastLoadedAt = Date.now(); notify(); });
    return inflight;
  }

  const refetchOn = opts?.refetchOn ?? [];
  if (refetchOn.includes("visible") && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (opts?.maxAge != null && Date.now() - lastLoadedAt < opts.maxAge) return; // still fresh
      store.refresh();
    }, { signal: opts?.signal });
  }
  if (refetchOn.includes("online") && typeof window !== "undefined") {
    window.addEventListener("online", () => store.refresh(), { signal: opts?.signal });
  }

  const store = {
    /** Kick the one-time load (idempotent). @returns {Promise<void>} */
    load: ensure,
    /** Force a re-fetch (after a mutation/login/logout). @returns {Promise<void>} */
    refresh() { inflight = null; return ensure(); },
    /** Current value (null until loaded, or on failure). @returns {T | null} */
    get: () => value,
    /** Has the first load settled? @returns {boolean} */
    isLoaded: () => loaded,
    /** Replace the value directly and notify (optimistic update / logout reset). @param {T | null} v */
    set(v) { value = v; notify(); },
    /** Subscribe to value changes. Pass the view's mount `signal` and the
     * subscription auto-releases on abort — the structural teardown every other
     * helper honours, so a re-mounting view can't pile dead callbacks (each
     * pinning its detached DOM) into `subs`. The returned unsubscribe still
     * works for callers without a signal.
     * @param {(v: T | null) => void} cb
     * @param {AbortSignal} [signal] - aborting drains this subscription
     * @returns {() => void} unsubscribe */
    subscribe(cb, signal) {
      subs.add(cb);
      const off = () => subs.delete(cb);
      signal?.addEventListener("abort", off, { once: true });
      return off;
    },
  };
  return store;
}
