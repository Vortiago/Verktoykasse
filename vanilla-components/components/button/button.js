// @ts-check
// Button — a styled native <button> with tone/size variants.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./button.html", import.meta.url).href),
  loadCSS(import.meta.url, "./button.css"),
]));

/** @typedef {"default" | "primary" | "danger" | "ghost"} ButtonVariant */

/**
 * @param {{ label: string, variant?: ButtonVariant, size?: "md" | "sm",
 *   icon?: string | null, onClick?: () => void, disabled?: boolean }} props
 * @param {AbortSignal} [signal] - required only when `onClick` is given.
 * @returns {Promise<{ el: HTMLButtonElement, setLabel: (label: string) => void, setDisabled: (disabled: boolean) => void }>}
 */
export async function createButton(
  { label, variant = "default", size = "md", icon = null, onClick, disabled = false } = /** @type {any} */ ({}),
  signal,
) {
  await ensure();
  const el = /** @type {HTMLButtonElement} */ (tpl("tpl-button").firstElementChild);
  if (variant !== "default") el.classList.add(`is-${variant}`);
  if (size === "sm") el.classList.add("is-sm");

  const labelEl = pick(el, "label");
  labelEl.textContent = label;
  if (icon != null) {
    const iconEl = pick(el, "icon");
    iconEl.hidden = false;
    iconEl.textContent = icon;
  }
  el.disabled = disabled;
  if (onClick) el.addEventListener("click", onClick, { signal });

  return {
    el,
    setLabel: (label) => { labelEl.textContent = label; },
    setDisabled: (disabled) => { el.disabled = disabled; },
  };
}
