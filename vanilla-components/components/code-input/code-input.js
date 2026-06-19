// @ts-check
// code-input — a row of single-character cells for an OTP / verification code.
// Handles arrow/backspace navigation, paste-to-fill across cells, and fires
// onComplete when every cell is filled. Generic: any resend/cooldown UI is the
// caller's (compose this with a button).
import { tpl } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/**
 * @param {{ length?: number, type?: "numeric" | "text", autoFocus?: boolean,
 *   onComplete?: (code: string) => void, onInput?: (code: string) => void }} [props]
 * @param {AbortSignal} [signal] - aborting removes the cell listeners.
 * @returns {{ el: HTMLElement, getValue: () => string, setValue: (code: string) => void,
 *   clear: () => void, focus: () => void }}
 */
function buildCodeInput({ length = 6, type = "numeric", autoFocus = false, onComplete, onInput } = {}, signal) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-code-input").firstElementChild);

  /** @type {HTMLInputElement[]} */
  const cells = [];
  for (let i = 0; i < length; i++) {
    const input = /** @type {HTMLInputElement} */ (tpl("tpl-code-input-cell").firstElementChild);
    input.inputMode = type === "numeric" ? "numeric" : "text";
    input.setAttribute("aria-label", `Character ${i + 1} of ${length}`);
    cells.push(input);
    el.append(input);
  }

  const getValue = () => cells.map((c) => c.value).join("");
  /** @param {string} s */
  const sanitize = (s) => (type === "numeric" ? s.replace(/\D/g, "") : s.replace(/\s/g, ""));
  /** @param {number} i */
  const focusCell = (i) => {
    const c = cells[Math.max(0, Math.min(i, length - 1))];
    c?.focus();
    c?.select();
  };
  const emit = () => {
    const v = getValue();
    onInput?.(v);
    if (v.length === length) onComplete?.(v);
  };
  /** Spread `text` across cells from `start`, then focus the last filled cell.
   * @param {string} text @param {number} start */
  const distribute = (text, start) => {
    const chars = [...sanitize(text)];
    for (let k = 0; k < chars.length && start + k < length; k++) cells[start + k].value = chars[k];
    focusCell(Math.min(start + chars.length, length - 1));
  };

  cells.forEach((input, i) => {
    input.addEventListener("input", () => {
      const cleaned = sanitize(input.value);
      if (cleaned.length <= 1) {
        input.value = cleaned;
        if (cleaned) focusCell(i + 1);
      } else {
        distribute(cleaned, i); // fast typing / one cell receiving several chars
      }
      emit();
    }, { signal });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && i > 0) focusCell(i - 1);
      else if (e.key === "ArrowLeft") { e.preventDefault(); focusCell(i - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); focusCell(i + 1); }
    }, { signal });
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      distribute(e.clipboardData?.getData("text") ?? "", 0); // a pasted code fills from the start, regardless of which cell has focus
      emit();
    }, { signal });
  });

  /** Programmatic set — populates the cells WITHOUT firing onInput/onComplete, so
   *  prefilling or resetting a code can't trigger submission (the events are for
   *  user entry only; clear() likewise stays silent). @param {string} code */
  const setValue = (code) => {
    const chars = [...sanitize(code)].slice(0, length);
    cells.forEach((c, i) => { c.value = chars[i] ?? ""; });
  };
  const clear = () => { for (const c of cells) c.value = ""; focusCell(0); };

  if (autoFocus) queueMicrotask(() => focusCell(0));

  return { el, getValue, setValue, clear, focus: () => focusCell(0) };
}

export const { warm: warmCodeInput, sync: createCodeInputSync, create: createCodeInput } =
  defineComponent(import.meta.url, "code-input", buildCodeInput);
