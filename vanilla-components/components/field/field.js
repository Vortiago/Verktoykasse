// @ts-check
// field — a labeled form control. The control is a native input/select/textarea
// (per `type`); native constraint validation styling via :user-invalid in the CSS.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {"text" | "number" | "email" | "password" | "search" | "select" | "textarea"} FieldType */

/**
 * @param {{ label: string, type?: FieldType, value?: string, placeholder?: string,
 *   hint?: string | null, options?: { value: string, label: string }[],
 *   required?: boolean, hideLabel?: boolean, onInput?: (value: string) => void }} props
 *   hideLabel - visually hide the label (kept as the control's aria-label) so the
 *     field fits a compact toolbar — `label` is still required for accessibility.
 * @param {AbortSignal} [signal] - required only when `onInput` is given.
 * @returns {{ el: HTMLElement,
 *   control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
 *   getValue: () => string, setValue: (value: string) => void }}
 */
function buildField(
  { label, type = "text", value = "", placeholder = "", hint = null, options = [], required = false, hideLabel = false, onInput } = /** @type {any} */ ({}),
  signal,
) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-field").firstElementChild);
  const labelEl = pick(el, "label");
  labelEl.textContent = label;
  if (hideLabel) labelEl.classList.add("is-sr-only"); // visually hidden, aria-label set below

  /** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} */
  let control;
  if (type === "select") {
    const sel = document.createElement("select");
    for (const o of options) sel.add(new Option(o.label, o.value));
    control = sel;
  } else if (type === "textarea") {
    const ta = document.createElement("textarea");
    if (placeholder) ta.placeholder = placeholder;
    control = ta;
  } else {
    const inp = document.createElement("input");
    inp.type = type;
    if (placeholder) inp.placeholder = placeholder;
    control = inp;
  }
  control.className = "field-input";
  control.value = value;
  if (required) control.required = true;
  if (hideLabel) control.setAttribute("aria-label", label);
  pick(el, "control").append(control);

  if (hint != null) {
    const hintEl = pick(el, "hint");
    hintEl.hidden = false;
    hintEl.textContent = hint;
  }
  if (onInput) control.addEventListener("input", () => onInput(control.value), { signal });

  return {
    el,
    control,
    getValue: () => control.value,
    setValue: (value) => { control.value = value; },
  };
}

export const { warm: warmField, sync: createFieldSync, create: createField } =
  defineComponent(import.meta.url, "field", buildField);
