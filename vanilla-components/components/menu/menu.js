// @ts-check
// menu — a popover action list tethered to a trigger. A <button> trigger toggles
// it natively (popovertarget), any other element via a click listener. Built on
// popover="auto" (light-dismiss + Esc) + CSS Anchor Positioning (menu.css).
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {{ id: string, label: string, icon?: string, disabled?: boolean, danger?: boolean }} MenuItem */

let seq = 0; // unique anchor-name + id per instance

/**
 * @param {HTMLElement} trigger - the menu anchors to and opens from this element.
 * @param {{ items?: (MenuItem | "separator")[], onSelect?: (id: string) => void, align?: "start" | "end" }} [opts]
 * @param {AbortSignal} [signal] - aborting removes the menu + listeners.
 * @returns {{ el: HTMLElement, open: () => void, close: () => void, dispose: () => void }}
 */
function buildMenu(trigger, { items = [], onSelect, align = "start" } = {}, signal) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-menu").firstElementChild);
  if (align === "end") el.classList.add("is-align-end");

  const n = ++seq;
  el.id = `menu-${n}`;
  const anchor = `--menu-${n}`;
  trigger.style.setProperty("anchor-name", anchor);
  el.style.setProperty("position-anchor", anchor);

  for (const item of items) {
    if (item === "separator") { el.append(tpl("tpl-menu-separator")); continue; }
    const btn = /** @type {HTMLButtonElement} */ (tpl("tpl-menu-item").firstElementChild);
    pick(btn, "label").textContent = item.label;
    if (item.icon != null) { const ic = pick(btn, "icon"); ic.hidden = false; ic.textContent = item.icon; }
    if (item.danger) btn.classList.add("is-danger");
    if (item.disabled) btn.disabled = true;
    btn.addEventListener("click", () => { el.hidePopover(); onSelect?.(item.id); }, { signal });
    el.append(btn);
  }

  document.body.appendChild(el);

  const isOpen = () => el.matches(":popover-open");
  const open = () => { if (!isOpen()) el.showPopover(); };
  const close = () => { if (isOpen()) el.hidePopover(); };
  // A <button> can be the native popover invoker (toggle + correct light-dismiss
  // semantics for free); anything else gets a manual toggle listener.
  if (trigger instanceof HTMLButtonElement) trigger.setAttribute("popovertarget", el.id);
  else trigger.addEventListener("click", () => (isOpen() ? close() : open()), { signal });

  const dispose = () => {
    el.remove();
    trigger.style.removeProperty("anchor-name");
    if (trigger instanceof HTMLButtonElement) trigger.removeAttribute("popovertarget");
  };
  signal?.addEventListener("abort", dispose, { once: true });

  return { el, open, close, dispose };
}

export const { warm: warmMenu, sync: createMenuSync, create: createMenu } =
  defineComponent(import.meta.url, "menu", buildMenu);
