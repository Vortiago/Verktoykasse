# bridge/ — vanilla-components → claude.ai/design

vanilla-components is a no-React library; claude.ai/design renders **React**. The
bridge closes that gap so the design-sync converter can consume the library: it
presents each component AS a React component, then the real converter does the rest.

## `emit-adapter.mjs` — the generator

`node bridge/emit-adapter.mjs` reads the real component sources and writes a
React-shim **adapter package** to `bridge/ds-adapter/` (gitignored, regenerated):

- each `dist/<name>.js` is the **real factory verbatim**, with only its dev-server
  self-loaders neutralized — the `<template>` is inlined and registered lazily,
  `loadCSS` becomes a no-op, and the component CSS ships via `styles.css` instead;
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
