# vanilla-components

A component library exposed as React components on `window.VanillaComponents`.
Import and use them directly — **no provider or theme wrapper is required**.
(Under the hood each is a thin React shim over a vanilla `<template>` + `@scope`
factory; you don't need to know that to use them.)

## Components & props

**Atoms**
- `<Panel head? body? fill? />` — bordered, elevated surface; `head`/`body` are strings.
- `<StatCard label value unit? hint? tone? />` — labeled hero number.
- `<Chip text tone? dot? />` — inline pill/badge; `dot` adds a leading dot.
- `<StatusDot tone? pulse? label? />` — status dot; `pulse` adds a halo.
- `<Avatar name? initials? src? size? tone? />` — round initials-or-image badge.
- `<Tooltip content? />` — a positioned hover card (the card shows it open).

**Controls**
- `<Button label variant? size? icon? href? />` — `variant`: `default | primary | danger | ghost`; `href` renders a styled `<a>`.
- `<Field label type? value? placeholder? hint? options? required? />` — labeled input/select/textarea with native validation.
- `<CodeInput length? type? autoFocus? />` — multi-cell OTP / verification-code entry.
- `<Progress value max? tone? label? />` — track + fill meter.
- `<KvRow label value tone? />` — key·value line.
- `<EmptyState icon? title detail? />` — centered "nothing here" placeholder.
- `<SegmentedControl options current? />` — radio/toggle group; an option may carry its own `tone`.
- `<Dialog title? body? scroll? closeOnBackdrop? />` — native `<dialog>`, driven by open()/close().

**Feedback**
- `<Alert tone? title? message dismissible? />` — inline banner; `bad` is assertive.
- `<Spinner size? label? />` — indeterminate loading ring.
- `<Skeleton variant? lines? width? height? />` — shimmer placeholder; `variant`: `text | block | circle`.

**Overlays & navigation**
- `<Menu items />` — popover action list anchored to a trigger; `items` are `{ id, label, icon?, disabled?, danger? }` or `"separator"`.
- `<AppBar brand items current? />` — top bar with underline-tab nav.
- `<SideNav groups current? />` — grouped left-pane nav.
- `<ViewHeader eyebrow? title sub? />` — stage header.

**Layout**
- `<TableShell columns rows? caption? />` — tokenized table skeleton (sticky header, numeric columns right-aligned).
- `<ChecklistRow text done? />` — done/undone item with a box marker.
- `<ListRow title meta? leading? trailing? href? />` — leading · title+meta · trailing row; draws its own divider between rows.

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

### Tones

Every tone-bearing prop (`Chip`, `StatusDot`, `Avatar`, `Alert`, `SegmentedControl`
options, …) takes the same `tone`:

- a **named** tone — `ok | warn | bad | info | accent` (mapped to the status tokens
  above), or `neutral`/omit for the quiet default;
- **any CSS colour string** (e.g. `"#8b5cf6"`) as an escape hatch — it drives the
  same look inline.

## Example

```jsx
<div style={{ display: "grid", gap: "var(--space-m)", padding: "var(--space-l)", background: "var(--bg)", color: "var(--text)" }}>
  <StatCard label="Throughput" value="142" unit="tok/s" tone="ok" />
  <Panel head="Sessions" body="12 active · 3 recording" />
  <Alert tone="info" title="Heads up" message="A new build is available." />
  <div style={{ display: "flex", gap: "var(--space-s)", alignItems: "center" }}>
    <Chip text="ready" tone="ok" dot />
    <StatusDot tone="ok" pulse label="live" />
    <Avatar name="Ada Lovelace" tone="accent" />
  </div>
</div>
```
