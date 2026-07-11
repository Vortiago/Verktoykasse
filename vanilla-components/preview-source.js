// canonical source: vanilla-web/preview-source.js@4dabf5c — vendored copy, do not edit here
// @ts-check
// View-source widget for the vanilla-web component preview harness (see
// reference/preview.md, "View source"). preview.js is this module's ONLY
// intended caller: for each shown component it mounts one Preview/HTML/CSS/JS
// tab strip — once per component, not per variant, since the underlying files
// are identical across every variant — and hands this module the tab strip's
// view fragment, that component's `{ title, dir }`, and a teardown signal.
// `wireSourceTabs` is the single export; everything else here is private to it.
//
// Fetches a component's real HTML/CSS/JS files verbatim
// (`${dir}/${title}.${ext}`, the registry's `dir` field) — what you see is
// exactly what you'd copy into your own app, same as the rest of this
// copy-verbatim library. Highlighting is intentionally minimal — comments and
// strings only, no keywords/tags/properties — via the native CSS Custom
// Highlight API (`CSS.highlights` / `::highlight()`) rather than an external
// tokenizer/highlighter library; the CSS lives in preview.css as
// `::highlight(src-comment)` / `::highlight(src-string)`. A copy button next
// to the tabs puts the active tab's raw text on the clipboard.
//
// Known limitation (accepted, not a bug to chase — see reference/preview.md):
// the string-detection regex has no concept of a JS regex literal or a
// template-literal `${…}` interpolation, so either can make the tokenizer
// misread real code that follows, or swallow an interpolated expression whole
// as one flat string run — cosmetic only, never a crash.

import { pick, withPending } from "./lib/templates.js";

/** @typedef {"html" | "css" | "js"} SourceExt */
/** @typedef {"preview" | SourceExt} TabName */

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
export function wireSourceTabs(view, { title, dir }, signal) {
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
