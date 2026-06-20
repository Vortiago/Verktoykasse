# Testing — Playwright against a vanilla-web UI

Read this when writing or running browser e2e (Playwright) for a vanilla-web UI,
or deciding how tests select elements.

## `data-slot` is the test-id

Playwright's test-id attribute defaults to `data-testid`; repoint it at
**`data-slot`**, the marker vanilla-web components already bind through
(`slot()`/`pick()` in `lib/templates.js`) — reuse it rather than adding a
separate `data-testid`. `get_by_test_id("waveName")` then resolves
`[data-slot="waveName"]`.

Wire it once: `testing/playwright.config.js` sets `testIdAttribute: "data-slot"`;
`testing/conftest.py` calls `selectors.set_test_id_attribute("data-slot")`
(synchronous even on the async API — no `await`). It's additive — existing
`[data-slot=…]` CSS locators keep working; this only adds the `get_by_test_id`
entry point.

## Selecting

Prefer the handle you don't have to author — controls carry an accessible name,
so they're addressable with zero markup and survive a restyle:

| target | selector |
| --- | --- |
| button (`createButton`) | `get_by_role("button", name=…)` |
| labelled field (`createField`) | `get_by_label(…)` |
| structural seam — row, panel, badge (no role) | `get_by_test_id(…)` → `data-slot` |

**Never select on presentational classes** (`.wavrow__dur`, `.segctl__opt`) —
they're styling and break exactly when you restyle. **Never auto-generate ids:** a
name-derived id collides when a component repeats; a position-derived id rots when
you reorder or filter — the two changes a test most needs to survive. Set the
handle by hand at the one call site that needs it.

## Running the app under test

Boot the zero-dep `serve.mjs` through the `webServer` block (see
`testing/playwright.config.js`) — the suite gets a real server on a known port.

**Wait on DOM conditions, never fixed sleeps.** A vanilla-web view polls `/api`
on a tick, so assert on what appears: locator visibility, `.count()`, text —
locators auto-wait, and `wait_for_function` covers derived state. A `sleep` races
the poll and you get a flaky suite.

## The one test to write: the interaction hold

A vanilla-web view re-renders every poll tick. The **interaction hold** is its
signature invariant: a tick must not clobber a focused control or an in-progress
text selection (`renderRegion` / `selectionInside` — see
`reference/interactivity.md`). It's the bug a polled UI reintroduces most often
and the hardest to catch by eye, so it's the test that earns its keep:

> focus every interactive control in the view → cross at least one poll period →
> assert no node was rebuilt out from under the focus (a `<select>` stays open, a
> caret stays put, a selection survives).

Pin **render-signature hygiene** alongside it: a value that churns every tick
(progress, counters, captions) must not share a render signature with an
O(content) region, or every tick rebuilds the whole region. Assert an identity
stamp on the heavy region survives a churn tick. The rules both tests enforce live
in `reference/interactivity.md`.
