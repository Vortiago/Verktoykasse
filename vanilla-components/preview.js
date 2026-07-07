// canonical source: vanilla-web/preview.js@1d6aa5d — vendored copy, do not edit here
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
// same across variants) lets you see the component's real source alongside it.

import { previews } from "./previews/registry.js";
import { factoryNameFor } from "./previews/naming.mjs";
import { tpl, pick, slot, mount, loadCSS, wireTheme, wireErrorBar, withPending } from "./lib/templates.js";

/** A component preview module's default export.
 * @typedef {(props: any, signal: AbortSignal) => Element | Promise<Element>} RenderFn */
/** @typedef {{ title: string, render: RenderFn, variants: Record<string, Record<string, unknown>> }} PreviewModule */
/** @typedef {"html" | "css" | "js"} SourceExt */
/** @typedef {"preview" | SourceExt} TabName */

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

/** Valid unquoted-object-key identifier — hoisted like TOKEN_PATTERNS below,
 * since formatLiteral runs it once per key of every variant. */
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
// Verbatim component files (title.html/.css/.js), fetched once per component and
// cached — the files themselves are the catalogue's "copy this into your app"
// surface, so no reconstructed usage snippet. Minimal syntax highlighting (just
// comments + strings) via the native CSS Custom Highlight API — no external
// tokenizer/highlighter library.

/** title:ext -> in-flight/settled fetch. Caches the PROMISE, not just its
 * eventual text: re-clicking a tab before its first fetch resolves reuses the
 * same in-flight request instead of firing a duplicate one. A failed/aborted
 * fetch evicts itself so a later genuine attempt isn't stuck with a cached
 * rejection. @type {Map<string, Promise<string>>} */
const sourceCache = new Map();

/** @param {string} title @param {SourceExt} ext @param {string} dir
 * @param {AbortSignal} signal - forwarded to fetch(), so switching components
 *   actually cancels an in-flight request instead of merely discarding its result.
 * @returns {Promise<string>} */
function fetchSource(title, ext, dir, signal) {
  const key = `${title}:${ext}`;
  let promise = sourceCache.get(key);
  if (!promise) {
    promise = fetch(`${dir}/${title}.${ext}`, { signal }).then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.text();
    });
    promise.catch(() => sourceCache.delete(key));
    sourceCache.set(key, promise);
  }
  return promise;
}

/** Copy `text` to the clipboard. `navigator.clipboard` is unavailable outside a
 * secure context (e.g. this harness opened over plain HTTP on a LAN/tailnet
 * IP), so this falls back to the classic hidden-textarea + execCommand trick.
 * @param {string} text */
async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.append(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

/** One alternation regex per language: comment tried before string at each
 * position, so a quote inside a comment can never be misread as a string.
 * @type {Record<SourceExt, RegExp>} */
const TOKEN_PATTERNS = {
  js: /(?<comment>\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(?<string>`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
  css: /(?<comment>\/\*[\s\S]*?\*\/)|(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
  html: /(?<comment><!--[\s\S]*?-->)|(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
};

/** @param {string} text @param {SourceExt} ext
 * @returns {{ comments: [number, number][], strings: [number, number][] }} */
function tokenize(text, ext) {
  const pattern = TOKEN_PATTERNS[ext];
  pattern.lastIndex = 0; // shared RegExp objects — always reset before a fresh scan
  /** @type {[number, number][]} */
  const comments = [];
  /** @type {[number, number][]} */
  const strings = [];
  let m;
  while ((m = pattern.exec(text))) {
    /** @type {[number, number]} */
    const range = [m.index, m.index + m[0].length];
    (m.groups?.comment !== undefined ? comments : strings).push(range);
  }
  return { comments, strings };
}

/** @param {Text} textNode @param {[number, number][]} ranges */
function rangesOn(textNode, ranges) {
  return ranges.map(([start, end]) => {
    const r = new Range();
    r.setStart(textNode, start);
    r.setEnd(textNode, end);
    return r;
  });
}

function clearHighlights() {
  CSS.highlights.delete("src-comment");
  CSS.highlights.delete("src-string");
}

/** Registers highlights against `textNode` — which must already be mounted in
 * the document: Custom Highlight API ranges only paint over rendered content.
 * Reads the text to tokenize straight off the node (`.data`) rather than
 * taking it as a second parameter, so the ranges can never drift out of sync
 * with what's actually on screen.
 * @param {Text} textNode @param {SourceExt} ext */
function applyHighlights(textNode, ext) {
  const { comments, strings } = tokenize(textNode.data, ext);
  CSS.highlights.set("src-comment", new Highlight(...rangesOn(textNode, comments)));
  CSS.highlights.set("src-string", new Highlight(...rangesOn(textNode, strings)));
}

/** @type {TabName[]} */
const TAB_NAMES = ["preview", "html", "css", "js"];

/** Wires the Preview/HTML/CSS/JS tab strip for one shown component. Torn down
 * for free when `signal` aborts (listeners + any live highlights).
 * @param {DocumentFragment} view @param {{ title: string, dir: string }} entry
 *   only `title`/`dir` are read — destructured rather than closing over the
 *   whole catalogue entry (which also carries the component's `load` thunk).
 * @param {AbortSignal} signal */
function wireSourceTabs(view, { title, dir }, signal) {
  const tabs = /** @type {Record<TabName, HTMLElement>} */ (
    Object.fromEntries(TAB_NAMES.map((name) => [name, pick(view, `tab-${name}`)]))
  );
  const frames = pick(view, "frames");
  const code = pick(view, "code");
  const codeText = pick(view, "code-text");
  const copyBtn = /** @type {HTMLButtonElement} */ (pick(view, "copy"));

  /** @param {TabName} tab */
  async function activate(tab) {
    for (const name of TAB_NAMES) tabs[name].setAttribute("aria-selected", String(name === tab));
    // A newer tab click (or component switch) re-marks this tab as unselected
    // (or aborts `signal`) before a slower fetch resolves — the DOM's own
    // aria-selected is already the source of truth for "is this still current".
    const stale = () => signal.aborted || tabs[tab].getAttribute("aria-selected") !== "true";

    if (tab === "preview") {
      frames.hidden = false;
      code.hidden = true;
      copyBtn.hidden = true;
      clearHighlights();
      return;
    }

    frames.hidden = true;
    code.hidden = false;
    copyBtn.hidden = false;
    try {
      const text = await withPending(code, fetchSource(title, tab, dir, signal));
      if (stale()) return;
      code.classList.remove("source-code-error");
      codeText.textContent = text;
      if (codeText.firstChild) applyHighlights(/** @type {Text} */ (codeText.firstChild), tab);
    } catch (err) {
      if (stale()) return;
      code.classList.add("source-code-error");
      codeText.textContent = `fetch failed: ${err instanceof Error ? err.message : String(err)}`;
      clearHighlights();
    }
  }

  for (const name of TAB_NAMES) tabs[name].addEventListener("click", () => activate(name), { signal });
  copyBtn.addEventListener("click", () => {
    if (!code.classList.contains("source-code-error")) copyToClipboard(codeText.textContent ?? "");
  }, { signal });
  signal.addEventListener("abort", clearHighlights, { once: true });

  activate("preview"); // establishes the initial state in code, not just in the template's static markup
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
