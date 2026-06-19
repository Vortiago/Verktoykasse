// @ts-check
// list-row — a leading · title+meta · trailing row. Becomes an <a> when `href`
// is set (real link semantics), a <button> when `onSelect` is set, else a <div>.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @param {HTMLElement} host @param {string | Node | null} content */
function fill(host, content) {
  if (content == null) return;
  if (typeof content === "string") host.textContent = content;
  else host.replaceChildren(content);
  host.hidden = false;
}

/**
 * @param {{ title: string, meta?: string | null,
 *   leading?: string | Node | null, trailing?: string | Node | null,
 *   href?: string | null, onSelect?: () => void }} props
 *   leading/trailing take a string or a Node (drop in an avatar/chip/button).
 * @param {AbortSignal} [signal] - required only when `onSelect` is given.
 * @returns {{ el: HTMLElement, setTitle: (title: string) => void, setMeta: (meta: string | null) => void }}
 */
function buildListRow({ title, meta = null, leading = null, trailing = null, href = null, onSelect } = /** @type {any} */ ({}), signal) {
  const base = /** @type {HTMLElement} */ (tpl("tpl-list-row").firstElementChild);
  // Swap the <div> root for an <a>/<button>, keeping the slot children.
  /** @type {HTMLElement} */
  let el = base;
  if (href != null) {
    const a = document.createElement("a");
    a.className = base.className;
    a.append(...base.childNodes);
    a.href = href;
    el = a;
  } else if (onSelect) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = base.className;
    b.append(...base.childNodes);
    el = b;
  }

  const titleEl = pick(el, "title");
  titleEl.textContent = title;
  const metaEl = pick(el, "meta");
  if (meta != null) { metaEl.hidden = false; metaEl.textContent = meta; }
  fill(pick(el, "leading"), leading);
  fill(pick(el, "trailing"), trailing);

  // onSelect wires a click only when there's no href — an href already navigates,
  // so attaching onSelect to the <a> too would both fire the handler AND navigate.
  if (onSelect && href == null) el.addEventListener("click", () => onSelect(), { signal });

  return {
    el,
    setTitle: (t) => { titleEl.textContent = t; },
    setMeta: (m) => { metaEl.hidden = m == null; metaEl.textContent = m ?? ""; },
  };
}

export const { warm: warmListRow, sync: createListRowSync, create: createListRow } =
  defineComponent(import.meta.url, "list-row", buildListRow);
