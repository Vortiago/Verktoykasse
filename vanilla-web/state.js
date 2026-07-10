// @ts-check
// Canonical view-local state seam for the vanilla-web conventions (see SKILL.md
// → reference/state.md). Copy into <app>/lib/state.js. The synchronous,
// view-local sibling of store.js: where store.js is module-level state that
// outlives a view's re-mounts, createState is state that lives for exactly one
// mount, for the unidirectional-flow rule at high state density (see
// reference/state.md) — an event handler never touches DOM, it only writes
// state; every dependent region subscribes once, at mount().
//
//   const filters = createState({ status: "all", query: "" });
//   filters.get();                            // current value
//   filters.set({ ...filters.get(), query }); // replace + notify
//   filters.update((s) => ({ ...s, query })); // functional patch + notify
//   filters.subscribe(renderTable, signal);   // signal-scoped, per store.js convention

/**
 * @template T
 * @param {T} initial
 */
export function createState(initial) {
  let value = initial;
  /** @type {Set<(v: T) => void>} */ const subs = new Set();
  let notifyQueued = false;

  // Batch: N writes in the same handler (or microtask turn) → 1 notify per
  // subscriber, not N — queueMicrotask coalesces same-tick writes for free.
  // Reentrancy: the flag clears BEFORE the loop and the value is snapshotted
  // once per round, so a set() from inside a subscriber schedules a fresh
  // round — every subscriber in a round sees the same value, no torn reads.
  function scheduleNotify() {
    if (notifyQueued) return;
    notifyQueued = true;
    queueMicrotask(() => {
      notifyQueued = false;
      const v = value;
      for (const cb of subs) cb(v);
    });
  }

  return {
    /** Current value. @returns {T} */
    get: () => value,
    /** Replace the value and (batched) notify. @param {T} v */
    set(v) { value = v; scheduleNotify(); },
    /** Functional patch and (batched) notify. @param {(v: T) => T} fn */
    update(fn) { value = fn(value); scheduleNotify(); },
    /** Subscribe to (batched) value changes. Pass the mount `signal` — same
     * structural-teardown contract as store.subscribe — and the subscription
     * auto-releases on abort.
     * @param {(v: T) => void} cb
     * @param {AbortSignal} [signal] - aborting drains this subscription
     * @returns {() => void} unsubscribe */
    subscribe(cb, signal) {
      subs.add(cb);
      const off = () => subs.delete(cb);
      signal?.addEventListener("abort", off, { once: true });
      return off;
    },
  };
}
