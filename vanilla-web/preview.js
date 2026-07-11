// @ts-check
// Standalone component preview harness for the vanilla-web conventions
// (see reference/preview.md). Loaded by preview.html as its OWN page — it is
// NOT part of the app router, so nothing here ships in the real app bundle.
//
// Left rail lists components from the generated previews/registry.js; selecting
// one (location.hash = "#/<title>") renders EVERY variant of that component
// stacked in labeled frames. Components are real factories, called exactly as
// the app calls them — what you see is what the app renders. A Preview/HTML/
// CSS/JS tab strip (once per component, not per variant — the files are the
// same across variants) lets you see the component's real source alongside
// it — that widget (fetch, tokenize, CSS Custom Highlight, clipboard) lives
// in its own module, preview-source.js; this file only mounts it per shown
// component via wireSourceTabs.

import { previews } from "./previews/registry.js";
import { factoryNameFor } from "./previews/naming.mjs";
import { tpl, pick, slot, mount, loadCSS } from "./lib/templates.js";
import { wireTheme, wireErrorBar } from "./lib/chrome.js";
import { wireSourceTabs } from "./preview-source.js";

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

// ── Usage snippet ─────────────────────────────────────────────────────────────
// Each variant's caption shows the actual call you'd write, not raw JSON —
// reconstructed from data the catalogue already has (title + that variant's
// props), so no per-component authoring. Storybook's "Show code" is the closest
// analog: a snippet attached to each individual story, not a single shared one.
// The factory-naming half of this lives in previews/naming.mjs, shared with
// the scaffolder (previews/new.mjs) so the two can't drift from EACH OTHER —
// that's a guarantee about this harness's own two consumers of the convention,
// not a check against what a component's own module actually exports; a
// factory that's hand-renamed off the create<Name> convention prints a
// snippet calling a name that doesn't exist, with nothing to catch it.

/** Valid unquoted-object-key identifier — hoisted since formatLiteral runs it
 * once per key of every variant. */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** @param {unknown} v — true for a value with a meaningful literal to print. */
const isLiteral = (v) => typeof v !== "function" && v !== undefined;

/** Formats `value` as it'd actually be written in source — unquoted object keys
 * where they're valid identifiers, callback/function values omitted (there's no
 * meaningful literal to show for one, and a caller wouldn't pass `undefined`
 * for it either) in both objects AND arrays — Array.prototype.join renders a
 * bare `undefined` element as an empty string, so without this an array of
 * callbacks would print as a confusing `[1, , 2]` instead of being dropped.
 * @param {unknown} value @returns {string} */
function formatLiteral(value) {
  if (Array.isArray(value)) return `[${value.filter(isLiteral).map(formatLiteral).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => isLiteral(v))
      .map(([k, v]) => `${IDENTIFIER.test(k) ? k : JSON.stringify(k)}: ${formatLiteral(v)}`);
    return entries.length ? `{ ${entries.join(", ")} }` : "{}";
  }
  return JSON.stringify(value);
}

// ── View source ───────────────────────────────────────────────────────────────
// The Preview/HTML/CSS/JS tab strip itself — fetch, tokenize, CSS Custom
// Highlight, clipboard — is wireSourceTabs from preview-source.js (imported
// above); show() below just mounts it once per shown component.

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
  const factory = factoryNameFor(title); // loop-invariant — same for every variant
  for (const [name, props] of Object.entries(preview.variants)) {
    const frame = tpl("tpl-preview-frame");
    slot(frame, { name, usage: `${factory}(${formatLiteral(props)})` });
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

  const view = tpl("tpl-preview-component");
  pick(view, "frames").append(frag);
  wireSourceTabs(view, entry, signal);
  mount(canvas, view);
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
