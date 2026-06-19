// @ts-check
// Skeleton — a shimmering content placeholder (text lines, a block, or a circle).
import { tpl } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {"text" | "block" | "circle"} SkeletonVariant */

/** @param {number | string} v */
const size = (v) => (typeof v === "number" ? `${v}px` : v);

/**
 * @param {{ variant?: SkeletonVariant, lines?: number,
 *   width?: number | string | null, height?: number | string | null }} [props]
 *   variant - text | block | circle; lines - count for `text`;
 *   width/height - px (number) or any CSS length (string).
 * @returns {{ el: HTMLElement }}
 */
function buildSkeleton({ variant = "block", lines = 3, width = null, height = null } = {}) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-skeleton").firstElementChild);
  el.classList.add(`is-${variant}`);
  if (variant === "text") {
    for (let i = 0; i < lines; i++) el.append(tpl("tpl-skeleton-line"));
  }
  if (width != null) el.style.setProperty("--skeleton-w", size(width));
  if (height != null) el.style.setProperty("--skeleton-h", size(height));
  return { el };
}

export const { warm: warmSkeleton, sync: createSkeletonSync, create: createSkeleton } =
  defineComponent(import.meta.url, "skeleton", buildSkeleton);
