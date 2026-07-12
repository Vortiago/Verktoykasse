# Security — the XSS model, the headers, and what's deliberately out of scope

Read this before adding a sink for untrusted HTML, changing `serve.mjs`'s
response headers, or asking "do we need a sanitizer here."

## The XSS model

The attack surface is small **by invariant**, not by a sanitizer bolted on
after the fact:

- `slot()`/`pick()` (`lib/templates.js`) write `textContent` only — user data
  never becomes markup through the normal fill-a-template path. There is no
  "escape this string" step anywhere in app code because nothing app-level
  ever parses a string as HTML.
- `<template>` content is inert until cloned (a browser primitive, not a
  toolkit one) — the markup a component ships in its `.html` file can't
  execute anything just by being fetched and inlined.
- `@scope` CSS can't reach outside its own component root, so a compromised
  style can't restyle the whole page into a convincing phish surface.
- The one `innerHTML` assignment in the codebase is `loadTemplates`
  (`lib/templates.js`) inlining a same-origin `.html` file's `<template>`
  blocks — fetched from the app's own static tree, never from user input, and
  inert per the point above until something explicitly clones and appends it.

**This model holds only as long as the invariants hold** — a stray
`innerHTML =`/`insertAdjacentHTML(` in app code, writing untrusted data into
markup, breaks it silently unless something catches the diff. That tripwire
is the conventions checker (#41, `tools/check-conventions.mjs`): a grep-grade
static rule flagging any HTML-string sink outside `lib/templates.js`. No
sanitizer library is needed while both the invariant and its checker hold —
adding one would be solving a problem this architecture doesn't have.

## Headers `serve.mjs` sends

A static header object spread into every response, default-on (opt out, not
opt in):

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'; trusted-types vanilla-templates; require-trusted-types-for 'script'` | `default-src 'self'` Just Works here in a way it structurally can't for most frameworks: no build means no inline `<script>`, no injected runtime chunks, no CSS-in-JS style injection — the app was already only ever going to load same-origin scripts/styles. `frame-ancestors 'none'`: a dashboard has no legitimate embedder. The `trusted-types`/`require-trusted-types-for` pair is the Trusted Types enforcement, below. |
| `X-Content-Type-Options` | `nosniff` | Free, always correct — no reason a static file server should ever want MIME-sniffing on. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sane default: full path same-origin, origin-only cross-origin, nothing on downgrade. |
| *(no `Strict-Transport-Security`)* | — | `serve.mjs` speaks plain HTTP behind a tailnet/reverse proxy; HSTS is a statement about a TLS-terminating edge, and that's not this process. Set it at whatever does terminate TLS, not here. |

### Documented overrides

- **Remote images** (an app that genuinely embeds images off-origin): loosen
  to `img-src 'self' https:` — don't drop `default-src 'self'` wholesale for
  one directive's sake.
- **Embedded dashboard** (this app IS meant to sit in someone else's iframe):
  remove `frame-ancestors 'none'` (or replace it with an explicit allow-list of
  embedding origins) — it's a per-app exception, not a reason to ship the
  default open.

## Trusted Types — enforced, not advisory

`require-trusted-types-for 'script'` means the browser throws at runtime on
any injection-sink write (`innerHTML`, `insertAdjacentHTML`, etc.) that isn't
a `TrustedHTML` produced by an allow-listed policy. `loadTemplates` owns the
single named policy declared in the CSP (`vanilla-templates`) and is the only
sink that needs one, per the XSS model above — every trusted-HTML write in the
toolkit goes through that one call, which makes the policy itself the audit
point: grep for `trustedTypes.createPolicy` and there is exactly one hit.

**The failure mode this catches**: a stray `innerHTML =` written directly in
app code (the thing #41's checker also flags) doesn't just violate a
convention under this header — it throws a `TypeError` in the browser,
in every session, immediately. That's a much harder wall than a review
comment.

**The one-line loosening**: an app that genuinely needs a second trusted-HTML
sink (say, rendering fetched Markdown to HTML) adds that sink's name to the
CSP's `trusted-types` directive and creates a second named policy next to
`vanilla-templates`'s — don't widen `vanilla-templates` itself to cover an
unrelated use, and don't drop `require-trusted-types-for` wholesale just to
unblock one new sink.

## Deliberately out of scope

- **Auth** — an app concern, not a toolkit one; nothing here dictates a
  session/token scheme.
- **CSRF** — for cookie-based auth behind the proxy, `SameSite` is the
  relevant cookie attribute; that's a pointer, not a rule this toolkit
  enforces.
- **Dependency scanning** — there are no dependencies. Not "we haven't gotten
  to it" — the toolkit has zero runtime dependencies by design (the same
  build-step-is-a-liability stance as `reference/deploy.md`'s minification
  section), so there is no supply chain here to scan.
