// @ts-check
// Shared preview-only affordance: an external, caller-authored <button> that
// drives a component's command/commandfor Invoker Command (--dismiss, --toggle,
// …) — proof the declarative face isn't limited to the component's own markup.
// Mints a fresh unique id on `target` per call (so multiple rendered instances
// on the same catalogue page never collide) and wires the button's commandfor
// to it. Preview harness only — never shipped to apps, so it lives under
// previews/ next to the catalogue, not in lib/ (same reasoning as trigger.js).

let seq = 0;

/** @param {HTMLElement} target the element the command acts on — gets a fresh id
 *  @param {string} command e.g. "--toggle", "--dismiss"
 *  @param {string} label button text
 *  @param {{ idPrefix: string, style?: string }} opts idPrefix names the id
 *   (e.g. "panel-preview"); style is extra trailing CSS text on the button
 *  @returns {HTMLButtonElement} */
export function commandButton(target, command, label, { idPrefix, style = "" }) {
  target.id = `${idPrefix}-${++seq}`;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.setAttribute("command", command);
  btn.setAttribute("commandfor", target.id);
  btn.style.cssText = `font:inherit; font-size:12px;${style ? ` ${style}` : ""}`;
  return btn;
}
