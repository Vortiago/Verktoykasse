// @playwright/test config for a vanilla-web UI.
//
// `testIdAttribute: "data-slot"` points Playwright's `getByTestId()` at the SAME
// `data-slot` markers the components already bind through (`slot()`/`pick()` in
// lib/templates.js). So
//   page.getByTestId("waveName")   ⟺   page.locator('[data-slot="waveName"]')
// with auto-waiting and better errors — no new attribute, no parallel id
// namespace. There is no native HTML `testid`; `data-*` IS the platform hook.
//
// The memory-leak suite (tests/e2e/memory-*.spec.js, helper lib/mem.js) needs a
// deterministic GC, so Chromium launches with --js-flags=--expose-gc (the CDP
// HeapProfiler.collectGarbage path is primary; window.gc is the backstop) and
// --enable-precise-memory-info. See reference/testing.md.
//
// serve.mjs lives one dir up (web root) and defaults to PORT 8080, so the
// webServer block runs it from `..` and pins PORT to match baseURL — an app sets
// `cwd`/PORT to wherever its serve.mjs lives. TEST=1 enables the env-gated SSE
// test hooks the live-update spec drives.
import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT || "8000";
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Memory specs measure a shared heap; never parallelise them against each other.
  workers: 1,
  fullyParallel: false,
  use: {
    testIdAttribute: "data-slot",
    baseURL,
    trace: "on-first-retry",
    launchOptions: { args: ["--js-flags=--expose-gc", "--enable-precise-memory-info"] },
  },
  webServer: {
    command: "node serve.mjs",
    cwd: "..",
    env: { PORT, TEST: "1", PREVIEW: "on" },
    url: `${baseURL}/preview.html`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
