# bridge/ — vanilla-components → claude.ai/design

vanilla-components is a no-React library; claude.ai/design renders **React**. The
bridge closes that gap so the design-sync converter can consume the library: it
presents each component AS a React component, then the real converter does the rest.

## `emit-adapter.mjs` — the generator

`node bridge/emit-adapter.mjs` discovers the components by walking `components/`
(each carries a `<name>.bridge.mjs` with its narrowed `Props` + optional shim; a
real component missing one fails the build loudly), reads the real sources, and
writes a React-shim **adapter package** to `bridge/ds-adapter/` (gitignored, regenerated):

- each `dist/<name>.js` is the **real factory verbatim**, with its two `lib/` imports
  swapped for bridge editions: `_bridge-templates.js` (real `tpl`/`pick`/`slot`) and
  `_bridge-defineComponent.js`, whose `warm()` injects the pre-inlined `<template>`
  (registered at the top of each module) instead of fetching — component CSS ships
  via `styles.css`;
- a thin React shim wraps the factory (`useRef` + `useEffect` → mount the factory's
  element), so `import { Panel } from "vanilla-components"` is a real React component;
- `dist/index.d.ts` carries the agent-facing `Props`; `styles.css` is the compiled
  token + component stylesheet (`cssEntry`).

**Honest caveat:** React appears ONLY in the shim (interop glue). The components stay
vanilla — nothing is reimplemented. The imperative `Tooltip` is shown-on-mount so its
card isn't blank.

## Running the sync

The real design-sync converter (staged into `.ds-sync/`) consumes the adapter. The
full recipe — build → validate (headless render-check) → upload — lives in
`.design-sync/NOTES.md`. The library is synced to the **Vanilla Components** project
on claude.ai/design.
