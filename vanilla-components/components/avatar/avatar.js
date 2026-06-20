// @ts-check
// Avatar — a round badge showing an image, or initials derived from a name.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";
import { applyTone } from "../../lib/tone.js";

/** Up to two initials from a name: "Ada Lovelace" → "AL", "ada" → "AD".
 * @param {string} name */
export function initialsFrom(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * @param {{ name?: string | null, initials?: string | null, src?: string | null,
 *   size?: number, tone?: import("../../lib/tone.js").ToneName | (string & {}) | null }} [props]
 *   name - drives initials + the accessible label; initials - explicit override;
 *   src - image URL (wins over initials); size - px; tone - fill colour.
 * @returns {{ el: HTMLElement, setName: (name: string | null) => void, setSrc: (src: string | null) => void }}
 */
function buildAvatar({ name = null, initials = null, src = null, size = 32, tone = null } = {}) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-avatar").firstElementChild);
  const imgEl = /** @type {HTMLImageElement} */ (pick(el, "img"));
  const textEl = pick(el, "initials");
  el.style.setProperty("--avatar-size", `${size}px`);
  if (tone != null) applyTone(el, tone);

  /** @param {string | null} n */
  const setName = (n) => {
    textEl.textContent = initials ?? (n ? initialsFrom(n) : "?");
    if (n) { el.setAttribute("aria-label", n); imgEl.alt = n; }
    else { el.removeAttribute("aria-label"); imgEl.alt = ""; }
  };
  /** @param {string | null} s */
  const setSrc = (s) => {
    const has = !!s;
    imgEl.hidden = !has;
    textEl.hidden = has;
    if (has) imgEl.src = /** @type {string} */ (s);
    else imgEl.removeAttribute("src");
  };

  setName(name);
  setSrc(src);
  return { el, setName, setSrc };
}

export const { warm: warmAvatar, sync: createAvatarSync, create: createAvatar } =
  defineComponent(import.meta.url, "avatar", buildAvatar);
