// @ts-check
// Button — a styled native <button> with tone/size variants.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {"default" | "primary" | "danger" | "ghost"} ButtonVariant */

/**
 * A styled native button, or — when `href` is set — a link styled identically
 * (so an action-that-navigates keeps real anchor semantics: middle/ctrl-click,
 * "open in new tab"). `pressed` makes it an aria-pressed toggle.
 * @param {{ label: string, variant?: ButtonVariant, size?: "md" | "sm",
 *   icon?: string | null, href?: string | null, target?: string | null,
 *   onClick?: () => void, disabled?: boolean, pressed?: boolean }} props
 * @param {AbortSignal} [signal] - required only when `onClick` is given.
 * @returns {{ el: HTMLButtonElement | HTMLAnchorElement,
 *   setLabel: (label: string) => void, setDisabled: (disabled: boolean) => void,
 *   setPressed: (pressed: boolean) => void }}
 */
function buildButton(
  { label, variant = "default", size = "md", icon = null, href = null, target = null, onClick, disabled = false, pressed = false } = /** @type {any} */ ({}),
  signal,
) {
  const base = /** @type {HTMLButtonElement} */ (tpl("tpl-button").firstElementChild);
  // href ⇒ swap the <button> root for an <a>, keeping the icon/label spans.
  /** @type {HTMLButtonElement | HTMLAnchorElement} */
  let el = base;
  if (href != null) {
    const a = document.createElement("a");
    a.className = base.className;
    a.append(...base.childNodes);
    a.href = href;
    if (target != null) { a.target = target; a.rel = "noopener"; } // avoid reverse-tabnabbing
    el = a;
  }
  if (variant !== "default") el.classList.add(`is-${variant}`);
  if (size === "sm") el.classList.add("is-sm");

  const labelEl = pick(el, "label");
  labelEl.textContent = label;
  if (icon != null) {
    const iconEl = pick(el, "icon");
    iconEl.hidden = false;
    iconEl.textContent = icon;
  }

  /** A link can't be natively disabled — mark it aria-disabled + untabbable
   * (CSS .is-disabled kills pointer events); a real button uses the property.
   * @param {boolean} d */
  const setDisabled = (d) => {
    if (el instanceof HTMLButtonElement) el.disabled = d;
    else { el.classList.toggle("is-disabled", d); el.setAttribute("aria-disabled", String(d)); el.tabIndex = d ? -1 : 0; }
  };
  setDisabled(disabled);

  /** @param {boolean} p */
  const setPressed = (p) => {
    el.classList.toggle("is-pressed", p);
    // aria-pressed is only valid on a button role — a link is not a toggle.
    if (el instanceof HTMLButtonElement) el.setAttribute("aria-pressed", String(p));
  };
  if (pressed) setPressed(true);

  // A link has no native disabled, so its click listener must bail when disabled
  // (pointer-events:none stops the mouse, but not keyboard/programmatic activation).
  if (onClick) el.addEventListener("click", (e) => {
    if (!(el instanceof HTMLButtonElement) && el.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
    onClick();
  }, { signal });

  return {
    el,
    setLabel: (label) => { labelEl.textContent = label; },
    setDisabled,
    setPressed,
  };
}

export const { warm: warmButton, sync: createButtonSync, create: createButton } =
  defineComponent(import.meta.url, "button", buildButton);
