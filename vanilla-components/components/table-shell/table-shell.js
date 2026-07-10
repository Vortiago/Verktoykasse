// @ts-check
// table-shell - a tokenized table skeleton: a sticky header built from `columns`
// and a tbody the caller fills directly or via setRows(). end-aligned columns are
// right-aligned monospace. The wrapper owns the scroll so a tall table stays boxed.
import { tpl, pick } from "../../lib/templates.js";
import { defineComponent } from "../../lib/component.js";

/** @typedef {{ key: string, label: string, align?: "start" | "end" }} TableColumn */
/** @typedef {{ columns: TableColumn[], rows?: (string | number)[][], caption?: string }} TableShellProps */
/** @typedef {{ el: HTMLElement, tbody: HTMLElement, setRows: (rows: (string | number)[][]) => void }} TableShellHandle */

/** Build one `<tr>` of cells in column order; end-aligned columns get .is-end.
 * @param {TableColumn[]} columns @param {(string | number)[]} cells @returns {HTMLElement} */
function buildRow(columns, cells) {
  const tr = /** @type {HTMLElement} */ (tpl("tpl-table-shell-tr").firstElementChild);
  columns.forEach((col, i) => {
    const td = /** @type {HTMLElement} */ (tpl("tpl-table-shell-td").firstElementChild);
    if (col.align === "end") td.classList.add("is-end");
    const cell = cells[i];
    td.textContent = cell == null ? "" : String(cell);
    tr.append(td);
  });
  return tr;
}

/** Synchronous build - requires warmTableShell() to have resolved (else tpl() throws).
 * Use inside a renderRegion rebuild after warming once at mount.
 *   columns - column defs in display order; align:"end" right-aligns + monospaces the cell.
 *   rows - optional initial rows, each inner array = cells in column order.
 *   caption - optional table caption.
 * @param {TableShellProps} props @returns {TableShellHandle} */
function buildTableShell({ columns, rows, caption } = /** @type {any} */ ({})) {
  const el = /** @type {HTMLElement} */ (tpl("tpl-table-shell").firstElementChild);

  if (caption != null) {
    const captionEl = pick(el, "caption");
    captionEl.hidden = false;
    captionEl.textContent = caption;
  }

  const headRow = pick(el, "head-row");
  for (const col of columns) {
    const th = /** @type {HTMLElement} */ (tpl("tpl-table-shell-th").firstElementChild);
    if (col.align === "end") th.classList.add("is-end");
    th.textContent = col.label;
    headRow.append(th);
  }

  const tbody = pick(el, "body");
  const setRows = (/** @type {(string | number)[][]} */ rows) => {
    tbody.replaceChildren(...rows.map((cells) => buildRow(columns, cells))); // static-render
  };
  if (rows) setRows(rows);

  return { el, tbody, setRows };
}

export const { warm: warmTableShell, sync: createTableShellSync, create: createTableShell } =
  defineComponent(import.meta.url, "table-shell", buildTableShell);
