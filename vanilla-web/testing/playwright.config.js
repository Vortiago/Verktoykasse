// @playwright/test config for a vanilla-web UI.
//
// The one line that matters here is `testIdAttribute: "data-slot"`: it points
// Playwright's `getByTestId()` at the SAME `data-slot` markers the components
// already bind through (`slot()`/`pick()` in lib/templates.js). So
//   page.getByTestId("waveName")   ⟺   page.locator('[data-slot="waveName"]')
// with auto-waiting and better errors — no new attribute, no parallel id
// namespace. There is no native HTML `testid`; `data-*` IS the platform hook.
//
// See reference/testing.md for the convention (prefer getByRole/getByLabel for
// controls, data-slot for structural seams, never presentational classes).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    // Address elements by intent: getByTestId("x") → [data-slot="x"].
    testIdAttribute: "data-slot",
    baseURL: "http://localhost:8000",
    trace: "on-first-retry",
  },
  // Boot the zero-dep serve.mjs for the suite (adjust to your start command).
  webServer: {
    command: "node serve.mjs",
    url: "http://localhost:8000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
