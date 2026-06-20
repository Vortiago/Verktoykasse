// @ts-check
// Shared preview-only affordance: a styled trigger button for overlay components
// (tooltip/menu/dialog) whose catalogue cards render a trigger you interact with,
// rather than pinning the overlay open. Preview harness only — never shipped to
// apps, so it lives under previews/ next to the catalogue, not in lib/.

/** @param {string} label @param {{ cursor?: string }} [opts]
 *  @returns {HTMLButtonElement} */
export function previewTrigger(label, { cursor = "pointer" } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  Object.assign(btn.style, {
    font: "inherit",
    fontSize: "12px",
    padding: "4px 10px",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--r)",
    background: "var(--bg-elev)",
    color: "var(--text)",
    cursor,
  });
  return btn;
}
