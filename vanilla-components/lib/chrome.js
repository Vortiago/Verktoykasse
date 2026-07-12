// canonical source: vanilla-web/chrome.js@11345e6 — vendored copy, do not edit here
// @ts-check
// Canonical page-chrome wiring for the vanilla-web conventions (see SKILL.md).
// Copy into <app>/web/lib/chrome.js; extend, don't fork. Identity: the two
// pieces of chrome every page wires — the theme toggle and the error bar —
// shared by the app shell (shell.js) and the standalone component preview
// harness (preview.js), so the two pages can't drift. Both look up well-known
// ids in the shell markup (`#theme`, `#errbar`).
//
// This module imports nothing from templates.js or render.js, and nothing
// there imports this — components and defineComponent import ONLY
// templates.js, never this file.

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
    // ?? is for adopters compiling under noUncheckedIndexedAccess — the
    // modulo keeps the index in range, but their tsc can't see that.
    current = themes[(themes.indexOf(current) + 1) % themes.length] ?? "auto";
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
