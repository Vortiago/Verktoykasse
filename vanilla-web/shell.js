// @ts-check
// Canonical app shell for the vanilla-web conventions (see SKILL.md).
// Copy to <app>/web/shell.js and adapt imports + boot data. Owns three things:
//   1. routing    — location.hash ("#/<view-id>") is the source of truth:
//                   views are deep-linkable and the back button works;
//   2. lifecycle  — one AbortController per mount; views attach every
//                   listener/fetch/timer through helpers.signal, the shell
//                   aborts it on switch — nothing can be left behind;
//   3. transitions — swaps run inside document.startViewTransition when
//                   available (crossfade for free; plain swap elsewhere).
//
// Error containment (#53): mount() runs in a try/catch. A throw aborts the
// fresh controller (releasing whatever the partial mount opened), resets
// currentView to null (so the nav link that just failed is no longer a no-op
// — clicking it again retries instead of switchView's early-return treating
// the failed view as "already current"), and paints a minimal textContent-only
// fallback into the stage. The error still reaches wireErrorBar/console via
// window.reportError — containment, not silence.
//
// Abort semantics (#61): a mount that throws because ITS OWN signal was
// aborted (a fast second navigation cancelling the first) is normal shutdown,
// not a failure — the catch returns before touching currentView or painting
// anything. An AbortError escaping mount is expected; see templates.js'
// wireErrorBar for the matching filter on the global error/unhandledrejection
// hooks.

import { views } from "./views/registry.js";
import { loadCSS, every, wireTheme, wireErrorBar, withTransition } from "./lib/templates.js";

const stage = /** @type {HTMLElement} */ (document.getElementById("stage"));

/** @typedef {{ id: string, mount(container: HTMLElement, data: unknown, helpers: Helpers): void | Promise<void>, unmount(): void }} View */
/** @typedef {{ loadCSS: typeof loadCSS, every: typeof every, signal: AbortSignal }} Helpers */

/** @type {View | null} */ let currentView = null;
/** @type {AbortController | null} */ let currentController = null;
// True once the first switchView() has completed (success or failure) — gates
// the document.title rewrite so the boot view keeps the server-rendered title
// until the user actually navigates (#60).
let hasSwitchedOnce = false;
// Captured once at boot, before any switch can overwrite it.
const APP_NAME = document.title;

/** App-wide data handed to every mount — fetch once at boot, or leave null
 * and let views fetch their own. @type {unknown} */
const appData = null;

function viewIdFromHash() {
  const id = location.hash.replace(/^#\/?/, "");
  return views.some((v) => v.id === id) ? id : views[0].id;
}

/** Minimal, textContent-only fallback painted into the stage when mount()
 * throws (#53) — no HTML strings, every node built and text-set directly.
 * The retry link is just the hash route for the SAME id: with currentView
 * reset to null, switchView(id) on that id is no longer switchView's
 * early-return no-op, so the existing hash flow IS the retry — no new
 * machinery. @param {string} id @param {unknown} err */
function renderFallback(id, err) {
  const wrap = document.createElement("div");
  wrap.dataset.slot = "viewError";
  const headline = document.createElement("p");
  headline.textContent = "This view failed to load.";
  const detail = document.createElement("p");
  detail.textContent = String(/** @type {{ message?: string }} */ (err)?.message ?? err);
  const retry = document.createElement("a");
  retry.href = `#/${id}`;
  retry.textContent = "Retry";
  retry.dataset.slot = "retryLink";
  wrap.append(headline, detail, retry);
  stage.replaceChildren(wrap);
}

/** @param {string} id */
async function switchView(id) {
  if (currentView?.id === id) return;
  const entry = views.find((v) => v.id === id);
  if (!entry) return;
  const view = /** @type {View} */ ((await entry.load()).default);

  const swap = async () => {
    currentController?.abort();
    currentView?.unmount();
    stage.replaceChildren();
    currentView = view;
    const controller = new AbortController();
    currentController = controller;
    try {
      await view.mount(stage, appData, {
        loadCSS,
        every,
        signal: controller.signal,
      });
    } catch (err) {
      if (/** @type {{ name?: string }} */ (err)?.name === "AbortError") return; // cancelled mount: normal shutdown (#61)
      window.reportError(err); // always surfaced (console + errbar), even if superseded below
      if (controller !== currentController) return; // a newer swap already owns the stage — don't clobber it
      controller.abort(); // release whatever the partial mount opened
      currentView = null; // nav link becomes the retry (#53)
      renderFallback(id, err);
      stage.tabIndex = -1;
      stage.focus({ preventScroll: false }); // the failure fallback also gets focus (#60)
      return;
    }
    syncNav(id);
    // Only on real switches — the boot view keeps the server-sent title (#60).
    if (hasSwitchedOnce) document.title = entry.title ? `${entry.title} · ${APP_NAME}` : APP_NAME;
    hasSwitchedOnce = true;
    stage.tabIndex = -1;
    stage.focus({ preventScroll: false }); // route-change focus move — screen readers announce from the top (#60)
  };
  // Animate the swap where supported (crossfade for free), else swap in place.
  // startViewTransition awaits the async callback before animating; nothing
  // awaits switchView, so the fallback's fire-and-forget swap is equivalent.
  withTransition(swap);
}

/** Mark the active nav link. Expects header links shaped href="#/<id>".
 * @param {string} id */
function syncNav(id) {
  for (const a of document.querySelectorAll('a[href^="#/"]')) {
    a.toggleAttribute("aria-current", a.getAttribute("href") === `#/${id}`);
  }
}

// Page chrome — theme toggle + error surfacing, shared with preview.js so the
// two pages can't drift (see lib/templates.js).
wireTheme();
wireErrorBar();

window.addEventListener("hashchange", () => switchView(viewIdFromHash()));
switchView(viewIdFromHash());
