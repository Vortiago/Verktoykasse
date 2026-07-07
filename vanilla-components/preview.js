// canonical source: vanilla-web/preview.js@2f05a4c — vendored copy, do not edit here
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

/** "stat-card" -> "createStatCard" — the create<Name> factory contract, same
 * convention previews/new.mjs seeds (a mismatch there fails the tsc gate).
 * @param {string} title @returns {string} */
function factoryNameFor(title) {
  return `create${title.replace(/(^|[-_])([a-z])/g, (_, __, c) => c.toUpperCase())}`;
}

/** Formats `value` as it'd actually be written in source — unquoted object keys
 * where they're valid identifiers, callback/function props omitted (there's no
 * meaningful literal to show for one, and a caller wouldn't pass `undefined`
 * for it either).
 * @param {unknown} value @returns {string} */
function formatLiteral(value) {
  if (Array.isArray(value)) return `[${value.map(formatLiteral).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => typeof v !== "function" && v !== undefined)
      .map(([k, v]) => `${/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k)}: ${formatLiteral(v)}`);
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

/** title:ext -> file text. @type {Map<string, string>} */
const sourceCache = new Map();

/** @param {string} title @param {SourceExt} ext @param {string} dir
 * @param {AbortSignal} signal - forwarded to fetch(), so switching components
 *   actually cancels an in-flight request instead of merely discarding its result.
 * @returns {Promise<string>} */
async function fetchSource(title, ext, dir, signal) {
  const key = `${title}:${ext}`;
  const cached = sourceCache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch(`${dir}/${title}.${ext}`, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  sourceCache.set(key, text);
  return text;
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
 * @param {AbortSignal} signal */
function wireSourceTabs(view, entry, signal) {
  const tabs = /** @type {Record<TabName, HTMLElement>} */ (
    Object.fromEntries(TAB_NAMES.map((name) => [name, pick(view, `tab-${name}`)]))
  );
  const frames = pick(view, "frames");
  const code = pick(view, "code");
  const codeText = pick(view, "code-text");
  const copyBtn = /** @type {HTMLButtonElement} */ (pick(view, "copy"));

  /** @type {TabName} last-requested tab — guards against a slower fetch for a
   * tab the user has already clicked away from overwriting the newer one. */
  let requested = "preview";

  /** @param {TabName} tab */
  async function activate(tab) {
    requested = tab;
    const stale = () => signal.aborted || requested !== tab; // a newer selection (or tab click) won the race
    for (const name of TAB_NAMES) tabs[name].setAttribute("aria-selected", String(name === tab));

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
      const text = await withPending(code, fetchSource(entry.title, tab, entry.dir, signal));
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
  for (const [name, props] of Object.entries(preview.variants)) {
    const frame = tpl("tpl-preview-frame");
    slot(frame, { name, usage: `${factoryNameFor(title)}(${formatLiteral(props)})` });
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
