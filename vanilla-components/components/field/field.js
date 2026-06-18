// @ts-check
// field — a labeled form control. The control is a native input/select/textarea
// (per `type`); native constraint validation styling via :user-invalid in the CSS.
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./field.html", import.meta.url).href),
  loadCSS(import.meta.url, "./field.css"),
]));

/** @typedef {"text" | "number" | "email" | "password" | "search" | "select" | "textarea"} FieldType */

/**
 * @param {{ label: string, type?: FieldType, value?: string, placeholder?: string,
 *   hint?: string | null, options?: { value: string, label: string }[],
 *   required?: boolean, onInput?: (value: string) => void }} props
 * @param {AbortSignal} [signal] - required only when `onInput` is given.
 * @returns {Promise<{ el: HTMLElement,
 *   control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
 *   getValue: () => string, setValue: (value: string) => void }>}
 */
export async function createField(
  { label, type = "text", value = "", placeholder = "", hint = null, options = [], required = false, onInput } = /** @type {any} */ ({}),
  signal,
) {
  await ensure();
  const el = /** @type {HTMLElement} */ (tpl("tpl-field").firstElementChild);
  pick(el, "label").textContent = label;

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
