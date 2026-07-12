// #59 — serve.mjs sends the security headers on every static response, so a
// future refactor of serve.mjs can't silently drop them.
//
// This skill directory ships no index.html (an app does) — preview.html is
// the closest always-present "index"-like static asset here; a real app's own
// suite would assert this against "/" directly.
import { test, expect } from "@playwright/test";

test("a static response carries CSP / nosniff / referrer-policy, no HSTS", async ({ request }) => {
  const res = await request.get("/preview.html");
  expect(res.status()).toBe(200);

  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("trusted-types vanilla-templates");
  expect(headers["content-security-policy"]).toContain("require-trusted-types-for 'script'");
  expect(headers["content-security-policy"]).not.toContain("unsafe-inline"); // no TEST=1 carve-out (serve.mjs) — unconditional CSP
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toBeUndefined(); // deliberately omitted — see reference/security.md
});

test("error paths carry the CSP too — a static 404 and an /api 404 are still responses", async ({ request }) => {
  const staticMiss = await request.get("/no-such-file.html");
  expect(staticMiss.status()).toBe(404);
  expect(staticMiss.headers()["content-security-policy"]).toContain("default-src 'self'");

  const apiMiss = await request.get("/api/no-such-endpoint");
  expect(apiMiss.status()).toBe(404);
  expect(apiMiss.headers()["content-security-policy"]).toContain("default-src 'self'");
});
