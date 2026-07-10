// @ts-check
// Panel — bordered, elevated surface with an optional header + a body, and an
// optional collapsed state. Factory contract: create<Name>(props[, signal]) →
// { el, headEl, bodyEl, setCollapsed }. The root wires exactly ONE `command`
// listener, unconditionally, for a custom `--toggle` Invoker Command — an
// element-rooted listener like this dies with the node when it's removed, so
// `signal` isn't load-bearing for cleanup here; it's taken anyway, by
// convention, and forwarded straight through. Panel owns no toggle button
// itself: a caller-facing one typically lives in the caller's own `head`
// content and `commandfor`s an id the caller sets on `el`. Chrome/Edge ≥135
// (see reference/compat.md).
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** Put a string (as text) or a Node into a host. `null`/`undefined` leaves it empty.
 * @param {HTMLElement} host @param {string | Node | null | undefined} content */
function fill(host, content) {
  if (content == null) return;
  if (typeof content === "string") host.textContent = content;
  else host.replaceChildren(content); // static-render
}

/** @typedef {{ head?: string | Node | null, body?: string | Node | null, fill?: boolean, collapsed?: boolean }} PanelProps */
/** @typedef {{ el: HTMLElement, headEl: HTMLElement, bodyEl: HTMLElement, setCollapsed: (collapsed: boolean) => void }} PanelHandle */

/** Synchronous build — requires warmPanel() to have resolved (else tpl() throws).
 * Use inside a renderRegion rebuild after warming once at mount.
 * @param {PanelProps} [props]
 * @param {AbortSignal} [signal] - optional; a component-rooted listener dies with the node regardless.
 * @returns {PanelHandle} */
function buildPanel({ head = null, body = null, fill: doFill = false, collapsed = false } = {}, signal) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-panel").firstElementChild);
  if (doFill) el.classList.add("is-fill");
  const headEl = pick(el, "head");
  const bodyEl = pick(el, "body");
  if (head != null) {
    headEl.hidden = false;
    fill(headEl, head);
  }
  fill(bodyEl, body);

  const setCollapsed = (/** @type {boolean} */ collapsed) => {
    el.dataset.collapsed = collapsed ? "true" : "false";
    bodyEl.hidden = collapsed;
  };
  setCollapsed(collapsed);

  el.addEventListener("command", (e) => {
    const evt = /** @type {Event & { command: string }} */ (e);
    if (evt.command === "--toggle") setCollapsed(el.dataset.collapsed !== "true");
  }, { signal });

  return { el, headEl, bodyEl, setCollapsed };
}

export const { warm: warmPanel, sync: createPanelSync, create: createPanel } =
  defineComponent(import.meta.url, "panel", buildPanel);
