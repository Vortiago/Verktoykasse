// @ts-check
// Shared tone resolution — the single home of the "base set + custom colour"
// idiom every tone-bearing component uses (chip, status-dot, alert, …). A named
// tone maps to a `tone-<name>` class whose `--tone` is defined ONCE in tones.css
// (so the base set is editable in one place); any other string is a raw CSS
// colour driven inline through the shared `tone-custom` rule. Promote a recurring
// custom colour into the base set by adding a token + a tones.css line + a name
// here — nothing else changes.

/** @typedef {"ok" | "warn" | "bad" | "info" | "accent"} ToneName */

/** The base tone set. Each name has a `--<name>` token and a `.tone-<name>` rule
 *  in tones.css. Add to all three to grow the base set. @type {readonly ToneName[]} */
export const NAMED_TONES = ["ok", "warn", "bad", "info", "accent"];
const NAMED = new Set(NAMED_TONES);

/** Resolve a `tone` into a class + an optional inline `--tone` colour. A named
 *  tone maps to its `tone-<name>` class; `"neutral"`/`""`/`null` is the default
 *  (no tone); any other string is a raw CSS colour driving `tone-custom`. Pure —
 *  no DOM, so it's unit-testable (see lib/tone.test.mjs).
 *  @param {ToneName | (string & {}) | null} [tone]
 *  @returns {{ className: string | null, color: string | null }} */
export function resolveTone(tone) {
  if (tone == null || tone === "" || tone === "neutral") return { className: null, color: null };
  if (NAMED.has(/** @type {ToneName} */ (tone))) return { className: `tone-${tone}`, color: null };
  return { className: "tone-custom", color: tone }; // a raw CSS colour
}

/** Apply a tone to `el`: a named tone adds `tone-<name>`; a raw colour adds
 *  `tone-custom` + an inline `--tone` (only if it's a valid CSS colour, so a
 *  typo'd tone degrades to neutral, not a broken color-mix). Clears any prior
 *  tone first, so it's safe to call repeatedly (e.g. a polled status flip).
 *  @param {HTMLElement} el
 *  @param {ToneName | (string & {}) | null} [tone] */
export function applyTone(el, tone) {
  for (const c of [...el.classList]) if (c.startsWith("tone-")) el.classList.remove(c);
  el.style.removeProperty("--tone");
  const { className, color } = resolveTone(tone);
  if (color != null) {
    if (typeof CSS === "undefined" || CSS.supports("color", color)) {
      el.classList.add("tone-custom");
      el.style.setProperty("--tone", color);
    }
  } else if (className) {
    el.classList.add(className);
  }
}
