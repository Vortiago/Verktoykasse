# Server & live data — serve.mjs

Read this when serving the app, proxying/adding an API, or wiring live data.

## Server

Zero-dependency node `serve.mjs` (copy from the skill dir): static files with
MIME map and traversal guard, `PORT`/`HOST` env (default loopback;
`HOST=$(tailscale ip -4)` for tailnet exposure). The static path negotiates
**compression** (brotli/gzip per `Accept-Encoding`, cached by mtime) and emits a
strong **ETag** so reloads re-validate with `304` — both free, always on. For
`/api/*` you opt into one of three shapes:

- **SSE** — `/api/events` + `broadcast()` for live data (below).
- **Reverse proxy** — set `API_ORIGIN=http://host:port` and every `/api/*`
  request is transparently proxied there (headers/cookies/body both ways), so a
  dev frontend shares a cookie session with a separate backend.
- **Inline handlers** — add same-origin endpoints at the marked hook when this
  server *is* the backend; bound request bodies and run any child process via
  `execFile` with an args array (never a shell).

If the app already has a Python backend, FastAPI + `StaticFiles` is the accepted
alternative — the frontend conventions don't change.

## Live data — SSE by default, polling as fallback

Live data goes over Server-Sent Events, not interval polling. The skeleton's SSE
section (`/api/events` + `broadcast()`) pushes **only when the payload changed**,
so the client's poll → parse → sig-compare → maybe-render loop mostly disappears,
and `EventSource` reconnects by itself. Client side (or use `liveSSE` from
`lib/live.js`, see `reference/modules.md`):

```js
const es = new EventSource("/api/events");
es.onmessage = (e) => {
  const state = JSON.parse(e.data);
  renderRegion(host, () => buildStatus(state), { sig: e.data });
};
signal.addEventListener("abort", () => es.close(), { once: true });
```

Every event means real change, but swaps still go through `renderRegion` — the
user may be mid-interaction when one arrives. Interval polling (via
`every(fn, ms, signal)`, or `livePoll`) stays acceptable for trivial pages or
backends where an event stream isn't worth the wiring; the re-render rules in
`reference/interactivity.md` are what make polling survivable.
