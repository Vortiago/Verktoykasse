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

**Wait on DOM conditions, never fixed sleeps.** A vanilla-web view updates live
(an SSE event or a poll tick), so assert on what appears: locator visibility,
`.count()`, text — locators auto-wait, and `wait_for_function` covers derived
state. A `sleep` races the update and you get a flaky suite.

## The one test to write: the interaction hold

A vanilla-web view re-renders on every live update (a poll tick or a pushed SSE
event). The **interaction hold** is its signature invariant: an update must not
clobber a focused control or an in-progress text selection (`renderRegion` /
`selectionInside` — see `reference/interactivity.md`). It's the bug a
live-updating UI reintroduces most often and the hardest to catch by eye, so
it's the test that earns its keep:

> focus every interactive control in the view → cross at least one update (a poll
> tick or a pushed event) → assert no node was rebuilt out from under the focus
> (a `<select>` stays open, a caret stays put, a selection survives).

Pin **render-signature hygiene** alongside it: a value that churns every tick
(progress, counters, captions) must not share a render signature with an
O(content) region, or every tick rebuilds the whole region. Assert an identity
stamp on the heavy region survives a churn tick. The rules both tests enforce live
in `reference/interactivity.md`.

## The other test to write: layout reachability

The flexbox clip-vs-scroll trap (`reference/css.md` — a stacked `overflow: clip`
card shrunk below its content with no scroll owner clips silently) hides on a
tall dev monitor and only bites on a short laptop. A layout-reachability sweep
catches it, and a new stacked view that forgets a scroll owner re-trips it.

Make it **structure-independent** — assert on the SYMPTOM, never name the fix
class (`scroll-stack` etc.) — so it re-fails if a refactor reintroduces the clip:

> At a short viewport, for each view, evaluate in the page:
> - **clipped** = every `overflow: clip`/`hidden` box whose `scrollHeight >
>   clientHeight + 1` (content cut off);
> - **belowFold** = boxes whose `getBoundingClientRect().bottom > innerHeight + 1`
>   (a precondition: if empty, the view fits and the scroll case isn't exercised —
>   so don't let "reachable" pass vacuously);
> - **unreachable** = belowFold boxes with NO scrollable ancestor (walk parents
>   for `overflow-y` in `auto`/`scroll` AND `scrollHeight > clientHeight + 1`,
>   stopping at the view boundary).
> Assert `clipped == []` and `unreachable == []`. Then take the one control that
> vanished, `scroll_into_view_if_needed()`, and assert its `bounding_box()` lands
> fully inside the viewport (a `None` box subsumes an `is_visible` check).

One short height is enough — natural-height cards overflow any normal viewport,
so there's no pixel threshold to sweep. Reference impl:
TapScribe's `tests/e2e/test_dashboard_ui.py::test_no_view_clips_content_without_scroll_path`
(per-view) and `::test_settings_stack_scrolls_without_clipping_cards` (the
single-view form with the belowFold precondition spelled out).

## Memory leaks — the teardown + detached-node test

A live-updating UI re-mounts views and re-renders on every tick, so a single
resource left open per cycle (a subscription never dropped, a `<link>` never
removed, an `EventSource` never closed) accumulates until the tab runs out of
heap. Two tiers guard it; both ship in this skill and copy into an app verbatim.

**Node tier (`*.leak.test.mjs`, `node --test`, zero-dep, deterministic).** Asserts
the teardown CONTRACT of the data/update helpers with no browser — fake
`EventSource`/`fetch` on `globalThis`, `node:test` `mock.timers`/`mock.fn`, and a
real `AbortController`. `store.leak.test.mjs` (subscribe drains on abort /
unsubscribe), `templates.leak.test.mjs` (`every` clears its interval, registers
its abort listener `{once:true}`), `live.leak.test.mjs` (`liveSSE` closes,
`livePoll` stops + de-dupes), `lazy.leak.test.mjs` (observer disconnect + abort-
listener parity). Needs Node ≥20.4 (`mock.timers` setInterval). Run:
`cd vanilla-web && node --test ./*.leak.test.mjs`.

**Browser tier (`testing/tests/e2e/memory-*.spec.js`, `@playwright/test` + CDP).**
The real heap proof. Drives a real mount/unmount loop (the live-harness fixture,
or the component catalogue's `preview.html`), forces GC via CDP
`HeapProfiler.collectGarbage` (twice — V8 needs ~2 sweeps for `WeakRef`), and
asserts the **integer** gates exactly: `WeakRef`-survivor count `=== 0` after GC,
and a DOM census (total nodes, `<head>` `<link>`s, `<body>` children) that stays
**flat across cycles** (compare per-round spread, not an absolute baseline — warmup
loads a one-time pool). JS-heap bytes are corroborating only: a median-ratio of
late vs early samples over ≥40 post-warmup cycles, never an absolute threshold. A transient survivor is
killed by `survivorsAfterGC` (GC up to N times, stop at 0); a real leak never
drains. `memory-detector-selftest.spec.js` points the same harness at a
deliberately-leaky fixture and asserts it TRIPS, so the green specs can't pass
vacuously. The `@playwright/test` dep lives only under `testing/` (the shipped app
stays zero-dep). Run: `cd vanilla-web/testing && npm i && npx playwright install
chromium && npm test` (vanilla-components has its own `testing/` mirror). Launch
Chromium with `--js-flags=--expose-gc` (wired in `playwright.config.js`).
