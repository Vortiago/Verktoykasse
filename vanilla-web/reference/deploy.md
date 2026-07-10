# Deploy — what serve.mjs gives you, why there's no minifier, who owns caching

Read this before deploying an app, deciding whether to add a build step, or
answering "should this be minified?"/"what's the caching story?" — those three
questions have decided answers; this page is where they live instead of
re-deriving from `serve.mjs` source comments each time.

## 1. What `serve.mjs` already provides

| Concern | Behavior | Knob |
|---|---|---|
| Compression | Brotli or gzip, content-negotiated off `Accept-Encoding`; compressed bytes cached per `path\|mtime\|encoding` so a big asset compresses once, not per request | none — always on |
| Compressible scope | Only text-ish types (`.html .js .mjs .css .json .svg .md`) and only above ~1400 B (below one packet, compression isn't worth it) | none |
| Revalidation | Strong `ETag` (size+mtime) on every static response; a matching `if-none-match` gets a bodyless `304` | none |
| Default cache header | `Cache-Control: no-cache` — always revalidate, never serve provably-stale bytes after a deploy (there's no content hashing in filenames, so `immutable`/long `max-age` would be actively wrong here) | `CACHE=<seconds> node serve.mjs` switches static responses to `max-age=<n>` — ETag/304 stay wired, so post-expiry revalidation is still cheap. **Set it to the longest staleness you can tolerate after a deploy; leave unset for always-fresh.** (#57) |
| Negotiation correctness | `Vary: Accept-Encoding` on every static response, so a shared cache doesn't hand a brotli body to a client that only sent `gzip` | none |
| `/api/*` | Untouched by any of the above — SSE sends its own `no-cache`; the reverse-proxy mode passes the backend's headers straight through. The backend owns its own API cache policy | see `reference/server.md` |

**Fronting note**: behind nginx/a CDN, pick one compressor, not two. Either let
the proxy do content negotiation and compression (and turn `serve.mjs`'s off —
it's cheap to leave on since it no-ops below the packet threshold, but no
value in double-compressing), or forward the client's `Accept-Encoding` through
to `serve.mjs` unmodified and let it negotiate — and respect the `Vary` header
either way, or an intermediate cache will serve the wrong encoding to the next
client.

## 2. Minification — deliberately out of toolkit scope

Not an oversight — a considered no. State it so it stops being re-litigated
per deploy:

- **Why not in the toolkit**: a minifier is a build step and a dependency —
  the two things this stack exists to not have. `source = served` is
  load-bearing, not incidental: a prod stack trace points at the real line you
  wrote, view-source *is* the documentation (no source maps to configure or
  go stale), and an app keeps running unchanged for years because there's no
  toolchain to bit-rot underneath it.
- **The honest math**: brotli alone (already on, see above) gets you to
  roughly 70–75% off the wire for JS/CSS/HTML. Minify-then-brotli gets to
  roughly 80–85% — a real but small extra squeeze. On apps this size that
  difference is a few KB, paid once per cold cache; the `ETag`/`304` machinery
  above already makes every revisit near-free regardless of which side of
  that math you're on. This is not the lever that matters for this stack's
  load times.
- **The escape hatch — and its one trap**: the code is plain ES modules with
  no bundler-specific syntax, so any consumer is free to minify at deploy
  time with any tool they like. The rule: minify **per file, in place,
  preserving the directory tree**. **Do NOT bundle.** `loadTemplates` and
  `loadCSS` resolve their `.html`/`.css` companions relative to
  `import.meta.url` (see `reference/components.md`) — a bundler rewrites
  module URLs and flattens/renames files, which silently breaks every
  template and stylesheet fetch at runtime with no build-time error to catch
  it. The component-folder shape (`<name>.{html,css,js}` as siblings) is a
  runtime contract, not an optimization target a bundler is free to move.

## 3. The cache model — which layer owns which lifetime

| Layer | Owner | Mechanism |
|---|---|---|
| Static assets | toolkit (`serve.mjs`) | `ETag`/`304` always on; staleness bound via `CACHE=<n>` (§1, #57). No content hashing in filenames → never safe to mark `immutable`. |
| Live data | toolkit conventions | SSE push — freshness arrives as an event, there's nothing to expire; `every`/`livePoll` is the fallback for pull-only upstreams (`reference/server.md`). |
| Pull-once app state | toolkit (`store.js`) | Fetch-once + `refresh()`; a `maxAge`/`refetchOn` staleness policy is a per-store concern, not the server's. |
| API responses | **consumer — deliberately** | `api-client.js` stays uncached by design. TTL/stale-while-revalidate/invalidation caching is the TanStack-class problem — the same "pick a framework only with a concrete driver" boundary the skill draws for React. An app that needs one specific endpoint memoised wraps that one call in a `createStore`, rather than the toolkit growing a generic response cache no one asked for. |

That last row is the sentence worth keeping: it's the difference between "we
never got around to response caching" and "we decided not to, and here's the
one-line move when an app actually needs it" — which is what stops a future
session from quietly bolting on a cache library.

## Node floor

CI pins **Node 24** (the active LTS as of 2026-07) — that's the version a
deploy should target. Individual toolkit scripts (e.g. `check-css-vars.mjs`)
run fine on Node 22+; 24 is the floor to build the deploy environment against,
not a hard runtime requirement of any one file.
