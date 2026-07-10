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

// Visual regression (issue #56) is a SEPARATE, opt-in project: Playwright runs
// every configured project on a bare `npx playwright test` — there's no native
// "excluded unless selected" project flag — so the only way to keep
// visual.spec.js out of the default run is to not put the project in `projects`
// at all unless it's actually being asked for. That check has to be an env var,
// not a `process.argv` sniff: each worker is a SEPARATE forked process that
// re-evaluates this config with its own argv (no `--project`, so a project
// present only when argv says so vanishes mid-run with "Project not found in
// the worker process") — but Playwright forks workers with the PARENT's env
// inherited, so an env var survives the fork where argv doesn't.
//   PW_VISUAL=1 npx playwright test --project=visual
// `chromium` additionally `testIgnore`s the file as a second, belt-and-suspenders
// guard (invisible to `--project=chromium` too, and to a future project added
// without thinking about this one).
const wantsVisual = process.env.PW_VISUAL === "1";

const projects = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /visual\.spec\.js/ },
];
if (wantsVisual) {
  projects.push({
    name: "visual",
    testMatch: /visual\.spec\.js/,
    use: {
      ...devices["Desktop Chrome"],
      // Static baselines: no animation-driven noise, no OS-preference drift.
      reducedMotion: "reduce",
      colorScheme: "light", // the spec itself emulates both themes per card
    },
    expect: {
      toHaveScreenshot: {
        // Baselines are CI's alone (see CONTEXT.md → Pinned environment); a
        // small ratio catches real regressions without chasing local font/GPU
        // antialiasing noise across environments.
        maxDiffPixelRatio: 0.01,
        animations: "disabled", // stop CSS/Web Animations before capturing (spinner/skeleton/pulse)
      },
    },
    // Flat, predictable location instead of Playwright's default nested
    // <test file>-snapshots/ folder — one place to point CI's baseline-commit
    // step at. Resolves relative to this config file (testing/).
    snapshotPathTemplate: "__screenshots__/{arg}{ext}",
  });
}

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
  // Boot the skill's own serve.mjs (one dir up), serving the committed
  // previews/registry.js. PREVIEW=off so a test run never rewrites that tracked
  // file on startup (keep the suite hermetic); PORT is pinned to baseURL.
  webServer: {
    command: "node serve.mjs",
    cwd: "..",
    env: { PORT, PREVIEW: "off" },
    url: `${baseURL}/preview.html`,
    reuseExistingServer: !process.env.CI,
  },
  projects,
});
