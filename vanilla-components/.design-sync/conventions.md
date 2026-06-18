# vanilla-components

Five primitives, exposed as React components on `window.VanillaComponents`:
`Panel`, `StatCard`, `Chip`, `StatusDot`, `Tooltip`. Import and use them
directly — **no provider or theme wrapper is required**. (Under the hood each is
a thin React shim over a vanilla `<template>`+`@scope` factory; you don't need to
know that to use them.)

## Components & props

- `<Panel head? body? fill? />` — bordered, elevated surface; `head`/`body` are strings.
- `<StatCard label value unit? hint? tone? />` — labeled hero number. `tone`: `ok | warn | bad | accent`.
- `<Chip text tone? dot? />` — inline pill/badge. `tone`: `ok | warn | bad | info | accent`; `dot` adds a leading dot.
- `<StatusDot tone? pulse? label? />` — status dot. `tone`: `neutral | ok | warn | bad | info | accent`; `pulse` adds a halo.
- `<Tooltip content? />` — a positioned hover card (the card shows it open).

## Styling idiom — design tokens (CSS custom properties)

The look comes from a token set in `styles.css`, all `light-dark()` themed (they
follow `color-scheme` automatically). For your OWN layout and glue around these
components, style with these tokens — never hard-coded colors:

- **surfaces**: `var(--bg)`, `var(--bg-elev)`, `var(--bg-elev-2)`; border `var(--hairline)`
- **ink**: `var(--text)`, `var(--text-dim)`
- **accent / status**: `var(--accent)`, `var(--ok)`, `var(--warn)`, `var(--bad)`, `var(--info)`
- **type**: `var(--sans)`, `var(--mono)`
- **space scale**: `var(--space-xs | --space-s | --space-m | --space-l)`
- **shape**: `var(--r)` (default radius), `var(--r-pill)` (fully rounded)

## Example

```jsx
<div style={{ display: "grid", gap: "var(--space-m)", padding: "var(--space-l)", background: "var(--bg)", color: "var(--text)" }}>
  <StatCard label="Throughput" value="142" unit="tok/s" tone="ok" />
  <Panel head="Sessions" body="12 active · 3 recording" />
  <div style={{ display: "flex", gap: "var(--space-s)", alignItems: "center" }}>
    <Chip text="ready" tone="ok" dot />
    <StatusDot tone="ok" pulse label="live" />
  </div>
</div>
```
