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

import { views } from "./views/registry.js";
import { loadCSS, every } from "./lib/templates.js";

const stage = /** @type {HTMLElement} */ (document.getElementById("stage"));

/** @typedef {{ id: string, mount(container: HTMLElement, data: unknown, helpers: Helpers): void | Promise<void>, unmount(): void }} View */
/** @typedef {{ loadCSS: typeof loadCSS, every: typeof every, signal: AbortSignal }} Helpers */

/** @type {View | null} */ let currentView = null;
/** @type {AbortController | null} */ let currentController = null;

/** App-wide data handed to every mount — fetch once at boot, or leave null
 * and let views fetch their own. @type {unknown} */
const appData = null;

function viewIdFromHash() {
  const id = location.hash.replace(/^#\/?/, "");
  return views.some((v) => v.id === id) ? id : views[0].id;
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
    currentController = new AbortController();
    await view.mount(stage, appData, {
      loadCSS,
      every,
      signal: currentController.signal,
    });
    syncNav(id);
  };
  // startViewTransition waits for the async callback before animating.
  if (document.startViewTransition) document.startViewTransition(swap);
  else await swap();
}

/** Mark the active nav link. Expects header links shaped href="#/<id>".
 * @param {string} id */
function syncNav(id) {
  for (const a of document.querySelectorAll('a[href^="#/"]')) {
    a.toggleAttribute("aria-current", a.getAttribute("href") === `#/${id}`);
  }
}

// ── Theme ───────────────────────────────────────────────────────────────────
// light-dark() tokens follow the root's color-scheme, so a manual override is
// one style property; "auto" clears it and defers to the OS. Wires
// <button id="theme"> when the shell has one; choice persists per app.
const themeBtn = document.getElementById("theme");
const THEMES = ["auto", "light", "dark"];

/** @param {string} t */
function applyTheme(t) {
  document.documentElement.style.colorScheme = t === "auto" ? "" : t;
  if (themeBtn) themeBtn.textContent = t;
}
applyTheme(localStorage.getItem("theme") || "auto");
themeBtn?.addEventListener("click", () => {
  const next = THEMES[(THEMES.indexOf(localStorage.getItem("theme") || "auto") + 1) % THEMES.length];
  localStorage.setItem("theme", next);
  applyTheme(next);
});

// ── Errors ──────────────────────────────────────────────────────────────────
// Listener exceptions and unhandled rejections vanish silently by default.
// Always logs; fills <output id="errbar"> when the shell markup has one.
const errbar = document.getElementById("errbar");
/** @param {string} msg */
function showError(msg) {
  console.error(msg);
  if (errbar) { errbar.textContent = msg; errbar.hidden = false; }
}
window.addEventListener("error", (e) => showError(e.message));
window.addEventListener("unhandledrejection", (e) => showError(`unhandled: ${e.reason}`));

window.addEventListener("hashchange", () => switchView(viewIdFromHash()));
switchView(viewIdFromHash());
