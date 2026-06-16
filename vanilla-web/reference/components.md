# Components & HTML — the build-a-piece-of-UI detail

Read this when authoring views or components (templates, the factory contract).

## HTML — templates in .html files, never strings in JS

All markup lives in `.html` files as `<template id="tpl-…">` blocks with
`data-slot="name"` markers for dynamic content. JS never contains HTML strings
— no `innerHTML = \`…\``, no `createElement` chains for structure (creating a
text node or toggling `hidden` in place is fine).

```html
<template id="tpl-run-row">
  <tr class="run">
    <td class="mono" data-slot="date"></td>
    <td data-slot="task"></td>
  </tr>
</template>
```

```js
const row = tpl("tpl-run-row");
pick(row, "date").textContent = run.date;   // pick() throws on a typo'd slot
host.appendChild(row);
```

Numbers, dates, and durations render through `Intl` (`NumberFormat`,
`DateTimeFormat`, `RelativeTimeFormat`) — never hand-rolled padding or `toFixed`
display logic. (`lib/format.js` wraps these; see `reference/modules.md`.)

`templates.js` is the canonical helper module — copy into `lib/` verbatim;
extend, don't fork. API: `loadTemplates`, `tpl`, `slot`, `pick`, `mount`,
`loadCSS`, `every`, `renderRegion`, `selectionInside`.

## Components — reusable UI lives in components/, one folder each

Markup starts view-private (a `<template>` in the view's own `.html`). The
moment a second view needs it, promote it to `components/<name>/` — don't build
a component library speculatively, and don't copy-paste templates between views.

A component is one folder with three same-named files:

- `<name>.html` — its `<template id="tpl-<name>">` blocks (ids are global, so
  the component name prefixes them);
- `<name>.css` — `@scope (.<name>)` styles, `container-type` on the root if its
  layout should respond to its own width;
- `<name>.js` — a factory that owns loading its own template + CSS (a
  module-level promise makes it once-only), clones, fills slots, wires its
  internal events, and returns the element plus in-place updaters.

```js
// components/stat-card/stat-card.js
// @ts-check
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./stat-card.html", import.meta.url).href),
  loadCSS(import.meta.url, "./stat-card.css"),
]));

/** @param {{ label: string, value: string, onSelect?: () => void }} props
 *  @param {AbortSignal} signal — the view's mount signal */
export async function createStatCard({ label, value, onSelect }, signal) {
  await ensure();
  const el = /** @type {HTMLElement} */ (tpl("tpl-stat-card").firstElementChild);
  pick(el, "label").textContent = label;
  const valueEl = pick(el, "value");
  valueEl.textContent = value;
  if (onSelect) el.addEventListener("click", onSelect, { signal });
  return { el, update: (/** @type {string} */ v) => { valueEl.textContent = v; } };
}
```

```js
// in a view's mount():
const card = await createStatCard({ label: "Runs", value: "0" }, signal);
host.append(card.el);
// later ticks mutate in place — no swap, nothing to clobber:
card.update(String(state.runs));
```

The contract in short: **`create<Name>(props, signal) → { el, …updaters }`**.

- Listeners always attach with the caller's `signal`, so component listeners die
  with the view that mounted it — components never need an unmount.
- Component CSS loads once and stays for the app's lifetime (it's `@scope`d, it
  can't leak); only *view* CSS is removed on unmount.
- Data flows in via props and updater calls; events flow out via callback props.
  For anything broader, dispatch a `CustomEvent` on `el` and let the view listen
  — components never import views or reach for global state.
- A component that only renders once can return `el` alone; add updaters the
  first time a caller would otherwise rebuild it.
