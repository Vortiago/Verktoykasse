# Shared modules, typing, and patterns to lift

Read this when an app needs data fetching, shared state, formatting, live-data
clients, the type gate, or a not-yet-shipped pattern.

## Shared modules — copy what you need (from the skill dir)

Beyond `templates.js`, the skill ships small, framework-free modules that every
API-backed app otherwise re-rolls. Copy the ones you use into `lib/`; each is
`// @ts-check` and self-contained. (All earned promotion by being independently
re-implemented across multiple vanilla-web apps.)

- **`api-client.js`** — `get/post/put/del/request` over `fetch`, with a typed
  `ApiError`, 204 handling, and a default per-request timeout (`AbortSignal.timeout`;
  pass the view's mount `signal` to cancel on unmount). Default base is `/api`
  (edit per app).
- **`store.js`** — `createStore(load) → { load, refresh, get, set, isLoaded,
  subscribe }`. The sanctioned replacement for a framework context: module-level
  state that outlives view re-mounts, fetched once (single in-flight), with a
  `subscribe()` so the shell re-renders the chrome (avatar, etc.) on change.
- **`format.js`** — `num/date/bytes/relTime/duration/truncate` over **cached**
  `Intl.*` instances with a settable locale (`setLocale("nb-NO")`). The "render
  through Intl" rule, as one shared module instead of per-view copies.
- **`live.js`** — `liveSSE(url, onData, signal)` (the default; pairs with
  `serve.mjs`'s push-only-on-change SSE) and
  `livePoll(url, onData, signal, intervalMs)` (fallback with in-flight de-dup +
  change-only). Both tear down on abort.

## The gate — `tsc --noEmit` AND `check-css-vars`

`tsc` checks the JS; nothing else checks `var(--x)` — an undefined custom property
fails *silently*, just falling back (a transparent popover, a missing colour, as
shipped once). So the gate has two halves, run together by the `check` script.

- **Typing** — every module starts `// @ts-check` with JSDoc; shared shapes in
  `types.d.ts`. Copy `tsconfig.json` from the skill dir (`strict`, `checkJs`,
  `noUnusedLocals` turns stale imports into hard errors; unused bindings get `_`).
- **`check-css-vars`** — copy `tools/check-css-vars.mjs` verbatim (zero-dep, Node
  22+). Scans `web/**/*.{css,js}`, exits 1 on any required `var(--x)` never defined
  (`web/file:line  --name`). *Defined* = a CSS `--x:` decl OR a JS
  `setProperty("--x", …)` (so inline-set props like `--tone` don't false-positive);
  `var(--x, fallback)` is exempt — a fallback can't fail silently. Caveats (regex,
  Linux-first): a `var(--x)` in a CSS comment or JS doc-string false-positives.

Scripts to add (no `package.json` ships):

```json
"scripts": {
  "typecheck": "tsc -p tsconfig.json",
  "check-css-vars": "node tools/check-css-vars.mjs",
  "check": "tsc -p tsconfig.json && node tools/check-css-vars.mjs"
}
```

## Patterns ready to lift

Not shipped as files — copy from a project that has one when a second app needs it:

- **Router extension** for path params / query / chromeless views — extend
  `shell.js`'s `parseRoute()` to split the hash on `/` and `?`, pass
  `{ params, query }` to `mount()`, with a per-entry `param` name and a
  `chromeless` flag toggling a `body` attribute. (Reference: NorgeRundt.)
- **`anchorPopover(menu, trigger, signal)`** — position a native `[popover]`
  under its trigger on the `beforetoggle` event; use instead of CSS
  `position-area` until anchor-positioning ships in Firefox/Safari.
- **`confirm-dialog`** — a reusable native-`<dialog>` confirm (async `onConfirm`,
  inline error, `open(opts)`); the native-overlay alternative to `window.confirm`.
