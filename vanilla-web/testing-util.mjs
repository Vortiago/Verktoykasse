// testing-util — small helpers shared by this package's *.test.mjs files
// (memory-leak guards, abort-semantics guards, batching guards). Toolkit-
// internal: not itself a *.test.mjs (so check.mjs's `node --test` glob never
// picks it up) and not a gate half.
//
//   patchGlobal(t, name, value)  stub a globalThis property for one test
//   makeFlush(n)                 build a flush() draining n microtask turns
//   fakeEventTarget()            minimal addEventListener/dispatch double

/** Install a value on globalThis for the life of one node:test, restoring the
 * exact prior property descriptor after. Uses defineProperty (not plain
 * assignment) because some real globals (`navigator`, `location`) are
 * getter-only accessors in ESM/strict mode — a plain `globalThis.x = ...`
 * throws on those; defineProperty works uniformly for both cases and for the
 * plain writable data properties (`fetch`, `EventSource`, …) the other call
 * sites patch. */
export function patchGlobal(t, name, value) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, name);
  const prevDescriptor = had ? Object.getOwnPropertyDescriptor(globalThis, name) : undefined;
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: true });
  t.after(() => {
    if (prevDescriptor) Object.defineProperty(globalThis, name, prevDescriptor);
    else delete globalThis[name];
  });
}

/** Build a flush() that resolves `n` queued microtask turns — enough to drain
 * an awaited async chain (fetch/then chains, queueMicrotask notifies,
 * Promise.resolve() chains) before asserting on its effects. Different call
 * sites need different depths (tuned empirically against their own chain),
 * hence a factory rather than one fixed n. @param {number} n */
export const makeFlush = (n) => async () => { for (let i = 0; i < n; i++) await Promise.resolve(); };

/** Minimal EventTarget double: addEventListener(type, fn, {signal, once}) +
 * dispatch(type, event?) fire listeners synchronously (once-listeners
 * self-remove), passing `event` through to each listener when given — a
 * no-arg dispatch(type) call still works, listeners just see `undefined`;
 * listenerCount(type) backs "exactly one armed / detached after flush"
 * assertions. Shared by the fake document/window/dialog/popover doubles. */
export function fakeEventTarget() {
  /** @type {Map<string, Set<{ fn: Function, once?: boolean }>>} */
  const listeners = new Map();
  return {
    /** @param {string} type @param {Function} fn @param {{ signal?: AbortSignal, once?: boolean }} [opts] */
    addEventListener(type, fn, opts) {
      if (opts?.signal?.aborted) return; // mirror real EventTarget: a pre-aborted signal never registers
      if (!listeners.has(type)) listeners.set(type, new Set());
      const entry = { fn, once: !!opts?.once };
      listeners.get(type).add(entry);
      opts?.signal?.addEventListener("abort", () => listeners.get(type)?.delete(entry), { once: true });
    },
    /** @param {string} type @param {unknown} [event] */
    dispatch(type, event) {
      for (const entry of [...(listeners.get(type) ?? [])]) {
        entry.fn(event);
        if (entry.once) listeners.get(type)?.delete(entry);
      }
    },
    /** @param {string} type */
    listenerCount(type) { return listeners.get(type)?.size ?? 0; },
  };
}
