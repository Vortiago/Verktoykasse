// @ts-check
// Canonical shared-state singleton for the vanilla-web conventions (see SKILL.md).
// Copy into <app>/lib/store.js. The sanctioned replacement for "what you'd reach
// for a framework context for": module-level state that outlives view re-mounts,
// fetched once, with a subscribe() so the shell re-renders the chrome on change.
//
//   // lib/auth.js
//   export const auth = createStore(() => get("/auth/me"));
//   await auth.load();                 // boot once before the router
//   auth.get();  auth.subscribe(renderChrome);  auth.refresh();  auth.set(null);

/**
 * @template T
 * @param {() => Promise<T>} load — fetches the value; called at most once until refresh()
 */
export function createStore(load) {
  /** @type {T | null} */ let value = null;
  let loaded = false;
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
      .finally(() => { loaded = true; notify(); });
    return inflight;
  }

  return {
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
    /** @param {(v: T | null) => void} cb @returns {() => void} unsubscribe */
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },
  };
}
