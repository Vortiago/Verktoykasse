"""pytest-playwright wiring for the `data-slot` test-id convention.

Point Playwright's test-id attribute at `data-slot` — the SAME marker the
vanilla-web components bind through (`slot()`/`pick()` in lib/templates.js) — so
tests address elements by intent:

    page.get_by_test_id("waveName")   ==   page.locator('[data-slot="waveName"]')

with auto-waiting and clean errors. Plain `[data-slot=...]` locators keep
working; this only ADDS the get_by_test_id entry point. There is no native HTML
`testid`; `data-*` is the platform's scriptable-handle mechanism, so this is the
native convention, not a borrowed framework idiom.

`set_test_id_attribute` is SYNCHRONOUS even on the async API — no `await`.

See reference/testing.md: prefer get_by_role/get_by_label for controls,
data-slot for structural seams, never presentational classes.
"""

import pytest


# ── Flavor A: pytest-playwright (the standard for new suites) ────────────────
# pytest-playwright exposes a session-scoped `playwright` fixture. Set the
# attribute once on its selectors registry; every `page` in the run inherits it.
@pytest.fixture(scope="session", autouse=True)
def _wire_data_slot_test_id(playwright):
    playwright.selectors.set_test_id_attribute("data-slot")


# ── Flavor B: raw async_playwright() (when you own the Playwright lifecycle) ──
# If the suite drives `async with async_playwright() as pw:` itself rather than
# using pytest-playwright's fixtures, wrap that in ONE context manager so the
# convention has a single source of truth instead of a per-call-site set:
#
#     from contextlib import asynccontextmanager
#
#     @asynccontextmanager
#     async def playwright_session():
#         from playwright.async_api import async_playwright  # lazy: keep modules
#         async with async_playwright() as pw:               # import-safe w/o pw
#             pw.selectors.set_test_id_attribute("data-slot")
#             yield pw
#
# Then every test uses `async with playwright_session() as pw:` and gets the
# data-slot wiring for free. (This is the shape TapScribe's tests/e2e uses.)
