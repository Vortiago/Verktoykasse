// @ts-check
// Throws synchronously from mount() — the shared fixture for two specs:
//   #53 error containment: a textContent-only fallback renders into the stage,
//       other views still switch, and clicking this view's own nav link again
//       retries instead of no-op'ing (currentView reset to null).
//   #62 client-error relay: the same thrown error reaches window.reportError →
//       wireErrorBar → sendBeacon("/api/client-errors"), so the server's
//       TEST-only /api/test/client-error-count hook should increment.
export default {
  id: "broken",
  mount() {
    throw new Error("boom: the broken view always fails to mount");
  },
  unmount() {},
};
