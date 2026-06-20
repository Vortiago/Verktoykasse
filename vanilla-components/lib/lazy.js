// @ts-check
// Lazy-visual lifecycle — defer building an expensive visual (a map, a canvas, a
// chart) until its host element is actually laid out and/or on-screen. Extracts
// the recurring "only init once el.isConnected && clientWidth > 0, watch resize"
// dance from map/chart components. Both helpers are abort-aware and degrade safely
// when the observer APIs are missing — and they detach the abort listener on the
// success path, so a long-lived signal doesn't accumulate dead listeners.

/** Resolve once `el` is connected AND has a non-zero layout box — i.e. it's safe
 *  to measure it / mount a map into it. Resolves immediately if already sized,
 *  otherwise watches with a ResizeObserver. Never rejects; if `signal` aborts
 *  first it resolves too (the caller's own teardown handles the abort).
 *  @param {Element} el
 *  @param {AbortSignal} [signal]
 *  @returns {Promise<void>} */
export function whenSized(el, signal) {
  return new Promise((resolve) => {
    const sized = () => el.isConnected && el.clientWidth > 0 && el.clientHeight > 0;
    if (sized() || signal?.aborted || typeof ResizeObserver === "undefined") return resolve();
    const ro = new ResizeObserver(() => { if (sized()) finish(); });
    const onAbort = () => finish();
    function finish() {
      ro.disconnect();
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
    ro.observe(el);
    signal?.addEventListener("abort", onAbort);
  });
}

/** Run `cb` once, the first time `el` scrolls into view — for deferring
 *  below-the-fold work. Fires immediately when IntersectionObserver is
 *  unavailable. Disconnects (and detaches the abort listener) after firing and
 *  on `signal` abort.
 *  @param {Element} el
 *  @param {() => void} cb
 *  @param {AbortSignal} [signal]
 *  @param {IntersectionObserverInit} [options] */
export function onceVisible(el, cb, signal, options) {
  if (signal?.aborted) return;
  if (typeof IntersectionObserver === "undefined") { cb(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { finish(); cb(); }
  }, options);
  const onAbort = () => finish();
  function finish() {
    io.disconnect();
    signal?.removeEventListener("abort", onAbort);
  }
  io.observe(el);
  signal?.addEventListener("abort", onAbort);
}
