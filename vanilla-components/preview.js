// canonical source: vanilla-web/preview.js@71330ec — vendored copy, do not edit here
// @ts-check
// Standalone component preview harness for the vanilla-web conventions
// (see reference/preview.md). Loaded by preview.html as its OWN page — it is
// NOT part of the app router, so nothing here ships in the real app bundle.
//
// Left rail lists components from the generated previews/registry.js; selecting
// one (location.hash = "#/<title>") renders EVERY variant of that component
// stacked in labeled frames. Components are real factories, called exactly as
// the app calls them — what you see is what the app renders.

import { previews } from "./previews/registry.js";
import { tpl, pick, slot, mount, loadCSS, wireTheme, wireErrorBar } from "./lib/templates.js";

/** A component preview module's default export.
 * @typedef {(props: any, signal: AbortSignal) => Element | Promise<Element>} RenderFn */
/** @typedef {{ title: string, render: RenderFn, variants: Record<string, Record<string, unknown>> }} PreviewModule */

loadCSS(import.meta.url, "./preview.css");

const rail = /** @type {HTMLElement} */ (document.getElementById("rail"));
const canvas = /** @type {HTMLElement} */ (document.getElementById("canvas"));

const sorted = [...previews].sort((a, b) => a.title.localeCompare(b.title));

// One AbortController per shown component: aborted before the next render so a
// component's listeners (attached with this signal) die with it — same teardown
// contract the app shell gives views.
/** @type {AbortController | null} */
let controller = null;

// ── Rail ──────────────────────────────────────────────────────────────────────
function buildRail() {
  const frag = document.createDocumentFragment();
  for (const p of sorted) {
    const item = tpl("tpl-preview-railitem");
    const a = /** @type {HTMLAnchorElement} */ (pick(item, "link"));
    a.textContent = p.title;
    a.href = `#/${p.title}`;
    frag.append(item);
  }
  mount(rail, frag);
}

/** @param {string} title */
function syncRail(title) {
  for (const a of rail.querySelectorAll("a")) {
    a.toggleAttribute("aria-current", a.getAttribute("href") === `#/${title}`);
  }
}

// ── Canvas ────────────────────────────────────────────────────────────────────
function titleFromHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  // A malformed percent-escape makes decodeURIComponent throw; fall back to the
  // raw value rather than blanking the page on a hand-edited/truncated hash.
  let t = raw;
  try {
    t = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  return sorted.some((p) => p.title === t) ? t : sorted[0]?.title;
}

/** @param {string} message */
function frameError(message) {
  return slot(tpl("tpl-preview-error"), { msg: message });
}

/** @param {string | undefined} title */
async function show(title) {
  if (!title) {
    mount(canvas, document.createTextNode("No components have *.preview.js files yet."));
    return;
  }
  const entry = sorted.find((p) => p.title === title);
  if (!entry) return;

  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  const preview = /** @type {PreviewModule} */ ((await entry.load()).default);
  if (signal.aborted) return; // a newer selection won the race

  // A hand-broken preview file (no variants object) must surface as a message,
  // not throw out of show() and blank the canvas.
  if (!preview?.variants || typeof preview.variants !== "object") {
    mount(canvas, frameError(`${title}: preview is missing a { variants } object`));
    syncRail(title);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const [name, props] of Object.entries(preview.variants)) {
    const frame = tpl("tpl-preview-frame");
    slot(frame, { name, props: JSON.stringify(props) });
    const stage = pick(frame, "stage");
    try {
      const el = await preview.render(props, signal);
      if (signal.aborted) return;
      stage.append(el);
    } catch (err) {
      // One variant failing must not blank the whole canvas. `err` may be a
      // non-Error throw, so never assume .message.
      stage.append(frameError(`render failed: ${err instanceof Error ? err.message : String(err)}`));
    }
    frag.append(frame);
  }
  if (signal.aborted) return;
  mount(canvas, frag);
  syncRail(title);
}

// ── Page chrome ───────────────────────────────────────────────────────────────
// Theme toggle + error surfacing, shared with shell.js (preview.js is a separate
// standalone page, so it wires the same helpers itself, with its own theme key).
wireTheme("preview-theme");
wireErrorBar();

// ── Boot ──────────────────────────────────────────────────────────────────────
buildRail();
window.addEventListener("hashchange", () => show(titleFromHash()));
show(titleFromHash());
