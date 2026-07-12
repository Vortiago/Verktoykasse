// Fixture for vc-reconcile-move.spec.js — the reconcileList moveBefore guard.
//
// Each row IS a <vc-button> (a direct child of the reconcile host), so reordering
// the list makes reconcileList call host.moveBefore(<vc-button>) — the exact path
// the element's empty connectedMoveCallback() guards. WITH that callback a move is
// lifecycle-inert: the built inner <button> keeps its identity, its JS-stamped
// state and its focus. WITHOUT it, moveBefore fires disconnect+connect, so
// disconnectedCallback aborts and connectedCallback rebuilds — a fresh inner node,
// stamp and focus gone. The spec stamps + focuses a row, moves it, and asserts the
// state survived; a regression (deleted connectedMoveCallback, or a browser without
// moveBefore) makes those assertions fail.
import "../../../components/button/button.element.js";
import { reconcileList } from "../../../lib/render.js";

const host = /** @type {HTMLElement} */ (document.getElementById("list"));
const w = /** @type {any} */ (window);

/** Render the keyed list in `ids` order. reconcileList creates a <vc-button> per
 * new key and moves survivors with moveBefore on reorder. @param {string[]} ids */
w.__render = (ids) => {
  reconcileList(
    host,
    ids,
    (id) => id,
    (id) => {
      const el = document.createElement("vc-button");
      el.setAttribute("label", id);
      el.setAttribute("variant", "ghost");
      el.dataset.key = id; // stable handle for the spec to select a row
      return el;
    },
  );
};

/** True once every row has built its inner <button> (the first connect warms the
 * template + CSS asynchronously, so the spec must await this before probing). */
w.__built = () => {
  const rows = host.querySelectorAll("vc-button");
  return rows.length > 0 && [...rows].every((el) => el.querySelector("button"));
};

/** Focus + stamp the inner <button> of row `id`, and remember that exact node so
 * a later probe can test identity. A teardown+rebuild would replace this node,
 * dropping the stamp and the focus. @param {string} id */
w.__mark = (id) => {
  const row = /** @type {HTMLElement} */ (host.querySelector(`vc-button[data-key="${id}"]`));
  const btn = /** @type {HTMLButtonElement} */ (row.querySelector("button"));
  btn.focus();
  btn.dataset.stamp = "kept";
  w.__probe = { row, btn };
};

/** State of the marked row after a move. All four hold iff the move preserved the
 * subtree; a rebuild swaps in a fresh inner node (no stamp), detaches the old one
 * (which held focus), so every flag flips. Read the stamp off the CURRENT inner
 * node — the remembered `btn` keeps its stamp even when detached. */
w.__probeState = () => {
  const { row, btn } = w.__probe;
  const now = row.querySelector("button");
  return {
    sameNode: now === btn,
    stampKept: now?.dataset.stamp === "kept",
    connected: btn.isConnected,
    focused: document.activeElement === btn,
  };
};

// Does this browser support the atomic move at all? The spec hard-asserts this
// (the pinned Chromium has it); in the wild, reconcileList still falls back to
// insertBefore — correct, just not state-preserving.
w.__supportsMove = typeof Element.prototype.moveBefore === "function";
