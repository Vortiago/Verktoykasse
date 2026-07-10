// #62 — client-error relay: a browser error reaches the server log (the one
// place an LLM session maintaining the app can actually read it), and the
// errbar still renders as before — the relay is additive, not a replacement.
//
// Playwright can't read this process's stdout directly, so the assertion goes
// through serve.mjs's TEST-only /api/test/client-error-count hook (same shape
// as the existing /api/test/sse-count hook) rather than parsing console output.
//
// #67 — the flood guard's 30/min budget is one counter for the WHOLE suite's
// shared webServer process; reset it in beforeEach so this spec owns its own
// budget instead of racing other specs' errors for it.
import { test, expect } from "@playwright/test";
import { FIXTURE } from "../../lib/harness.js";

const clientErrorCount = async (request) => (await (await request.get("/api/test/client-error-count")).json()).count;

test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset-client-errors");
});

test("a throwing view relays to the server log and the errbar still renders", async ({ page, request }) => {
  const before = await clientErrorCount(request);

  await page.goto(`${FIXTURE}#/broken`);
  await expect(page.getByTestId("viewError")).toBeVisible(); // containment (#53) still renders
  await expect(page.locator("#errbar")).toBeVisible(); // errbar behaviour is unchanged, not replaced

  await expect.poll(() => clientErrorCount(request)).toBeGreaterThan(before);
});
