// @playwright/test config for the vanilla-components skill's own memory-leak
// suite. Mirrors vanilla-web/testing/playwright.config.js. Drives the component
// catalogue (preview.html, served by ../serve.mjs) as a real mount/unmount loop.
//
// `testIdAttribute: "data-slot"` matches the markers components bind through.
// Chromium launches with --js-flags=--expose-gc + --enable-precise-memory-info
// so the CDP HeapProfiler.collectGarbage GC has a window.gc backstop (see
// lib/mem.js). serve.mjs is one dir up and defaults to 8080, so it runs from `..`
// with PORT pinned. Uses 8001 so it can run alongside the vanilla-web suite.
import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT || "8001";
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  use: {
    testIdAttribute: "data-slot",
    baseURL,
    trace: "on-first-retry",
    launchOptions: { args: ["--js-flags=--expose-gc", "--enable-precise-memory-info"] },
  },
  // A test-only static server (serves the skill root) — see static-server.mjs for
  // why it's used instead of the vendored serve.mjs.
  webServer: {
    command: "node static-server.mjs",
    env: { PORT },
    url: `${baseURL}/preview.html`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
