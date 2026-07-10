#!/usr/bin/env node
// @ts-check
// Canonical zero-dependency static server for the vanilla-web conventions
// (see SKILL.md). Static files + a few extension points you opt into:
//
//   STATIC      always on: MIME, traversal guard, directory index, and
//               content-negotiated compression (brotli/gzip, cached by mtime) +
//               strong ETag / 304 so reloads re-validate cheaply.
//   SSE         /api/events — push-only-on-change live data (see broadcast()).
//   REVERSE     set API_ORIGIN=http://host:port and every /api/* request is
//   PROXY       transparently proxied there (cookies/headers/body both ways) —
//               for a dev frontend fronting a separate backend.
//   INLINE API  or handle /api/* in-file (this server IS the backend): add
//               handlers at the marked hook (readJsonBody + sendJson helpers).
//   CLIENT      POST /api/client-errors — sendBeacon target for wireErrorBar's
//   ERRORS      relay (lib/templates.js #62): console.error("[client]", …) with
//               a timestamp, so a browser error lands somewhere an LLM session
//               can read it. Flood-guarded (30/min, one warn when capped); no
//               storage, no dashboard — the log line IS the feature.
//   PREVIEW     on by default: regenerates previews/registry.js on startup so a
//               new *.preview.js shows up at /preview.html. PREVIEW=off to skip.
//
//   PORT=4098 node serve.mjs                       # loopback only (default)
//   HOST=$(tailscale ip -4) node serve.mjs         # expose on the tailnet
//   API_ORIGIN=http://localhost:5000 node serve.mjs  # proxy /api → backend
//   PREVIEW=off node serve.mjs                      # skip preview generation
//   CACHE=60 node serve.mjs                         # static cache-control: max-age=60 (ETag/304 still apply)
//                                                    # unset: no-cache, revalidate every load (today's default).
//                                                    # Set it to the longest staleness you can tolerate after a
//                                                    # deploy; leave unset for always-fresh. /api/* and SSE are
//                                                    # untouched either way.

import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFile, stat } from "node:fs/promises";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { gzip, brotliCompress, constants } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "127.0.0.1";
const API_ORIGIN = process.env.API_ORIGIN || ""; // set → reverse-proxy /api/*
const PREVIEW = process.env.PREVIEW !== "off"; // on by default; PREVIEW=off to skip (prod)
const TEST = process.env.TEST === "1"; // gate the leak-suite hooks (inert in prod)
const CACHE = Number(process.env.CACHE) || 0; // seconds; 0/unset → no-cache (always revalidate)

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

// Text-ish types worth compressing (images/fonts are already compressed).
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".md"]);
const MIN_COMPRESS = 1400; // don't bother below ~1 packet

// Security headers (#59) — a static object spread into every static-file
// response (304, compressed 200, plain 200 all share the one `headers` object
// below, so none of the three paths can silently drop these). The CSP's
// default-src 'self' + script-src implied by it should Just Work here: no
// build, no inline <script>, no HTML strings in JS (slot()/pick() write
// textContent only) — the one innerHTML (loadTemplates) goes through a named
// Trusted Types policy (templates.js), which is what makes
// require-trusted-types-for 'script' safe to turn on. frame-ancestors 'none':
// a dashboard has no legitimate embedder. No HSTS here — this server is plain
// HTTP behind a tailnet/proxy; HSTS belongs to whatever terminates TLS.
// Loosening for an app that embeds remote images: add `https:` to img-src.
// Unconditional — even under TEST=1: the shell e2e specs used to need
// 'unsafe-inline' for an inline import map that swapped shell.js's registry
// import; that's gone (see the /views/registry.js route below), so the CSP no
// longer needs a test-only carve-out at all.
const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; frame-ancestors 'none'; trusted-types vanilla-templates; require-trusted-types-for 'script'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

// path|mtimeMs|enc → compressed Buffer, so a big asset compresses once. Keyed by
// mtime; a dev server's file set is small, so no eviction is needed.
/** @type {Map<string, Buffer>} */
const compressCache = new Map();
/** @param {string|undefined} accept @returns {"br"|"gzip"|null} */
function pickEncoding(accept) {
  const a = (accept || "").toLowerCase();
  if (a.includes("br")) return "br";
  if (a.includes("gzip")) return "gzip";
  return null;
}

/** @param {import("node:http").ServerResponse} res
 * @param {number} status @param {unknown} obj */
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

/** Read a request body to a string (1 MB cap). Rejects (rather than hanging) when
 * the body is oversized or the request aborts mid-stream. @param {import("node:http").IncomingMessage} req */
function readBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */ const chunks = [];
    let len = 0;
    req.on("data", (c) => {
      len += c.length;
      if (len > 1e6) { reject(new Error("request body too large")); return; } // settle + stop buffering (handler replies 500)
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
    req.on("aborted", () => reject(new Error("request aborted")));
  });
}

// ── Server-Sent Events ──────────────────────────────────────────────────────
// The default transport for live data (SKILL.md → Live data): the server
// pushes ONLY when the payload actually changed, so the client never renders
// a no-op tick. EventSource reconnects by itself. Wire a source of change
// (fs.watch, a poll of an upstream API, a job queue) to broadcast(). Client side
// is lib/live.js → liveSSE().

/** @type {Set<import("node:http").ServerResponse>} */
const sseClients = new Set();
let lastEventBody = "";

/** Push `data` to every connected client — only if it changed.
 * @param {unknown} data */
function broadcast(data) {
  const body = JSON.stringify(data);
  if (body === lastEventBody) return; // unchanged → no event → no re-render
  lastEventBody = body;
  for (const res of sseClients) res.write(`data: ${body}\n\n`);
}

/** @param {import("node:http").ServerResponse} res */
function handleEvents(res) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  res.flushHeaders(); // EventSource stays "connecting" until headers arrive
  if (lastEventBody) res.write(`data: ${lastEventBody}\n\n`); // current state on connect
  sseClients.add(res);
  res.on("close", () => sseClients.delete(res));
}

// ── Client-error relay (#62) ─────────────────────────────────────────────────
// wireErrorBar (lib/templates.js) sendBeacons here — AFTER it filters
// AbortError, so a cancelled navigation never shows up. The log line IS the
// feature: no storage, no dashboard, just somewhere an LLM session maintaining
// the app can actually read what broke in someone's browser. Payload is a
// CLOSED shape ({ msg, src, url, ua }) — this endpoint is not analytics, and
// scope-creep here is how KISS dies. Flood guard: a render-loop error can fire
// once per tick, so cap it at 30/minute with a single warn when capped —
// sendBeacon never reads the response, so there's nothing to signal the
// client with anyway.
const CLIENT_ERROR_LIMIT_PER_MIN = 30;
let clientErrorCount = 0; // per-minute, reset below — feeds the flood guard
let clientErrorTotal = 0; // lifetime — the leak-suite-style TEST hook below reads this
let clientErrorCapWarned = false;
setInterval(() => { clientErrorCount = 0; clientErrorCapWarned = false; }, 60_000).unref();

/** @param {import("node:http").IncomingMessage} req @param {import("node:http").ServerResponse} res */
async function handleClientError(req, res) {
  const body = await readBody(req).catch(() => "");
  if (clientErrorCount >= CLIENT_ERROR_LIMIT_PER_MIN) {
    if (!clientErrorCapWarned) {
      console.warn(`[client] rate limit hit (${CLIENT_ERROR_LIMIT_PER_MIN}/min) — dropping further reports this minute`);
      clientErrorCapWarned = true;
    }
    res.writeHead(204).end();
    return;
  }
  clientErrorCount++;
  try {
    const { msg, src, url, ua } = JSON.parse(body);
    console.error("[client]", new Date().toISOString(), { msg, src, url, ua });
    clientErrorTotal++;
  } catch (err) {
    console.warn("[client] malformed report:", /** @type {Error} */ (err).message);
  }
  res.writeHead(204).end();
}

// ── Reverse proxy (opt-in via API_ORIGIN) ────────────────────────────────────
// Transparently forwards /api/* to a separate backend, passing headers/cookies/
// body both ways — so a dev frontend can share a cookie session with its API.
/** @param {import("node:http").IncomingMessage} req @param {import("node:http").ServerResponse} res */
function proxyApi(req, res) {
  const target = new URL(req.url || "/", API_ORIGIN);
  const isHttps = target.protocol === "https:";
  const doRequest = isHttps ? httpsRequest : httpRequest;
  const upstream = doRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      method: req.method,
      path: target.pathname + target.search,
      headers: { ...req.headers, host: target.host },
    },
    (upRes) => { res.writeHead(upRes.statusCode || 502, upRes.headers); upRes.pipe(res); },
  );
  upstream.on("error", (err) =>
    sendJson(res, 502, { error: `proxy to ${API_ORIGIN} failed: ${err.message}` }));
  req.pipe(upstream);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const urlPath = decodeURIComponent(url.pathname);

    // /api/* — SSE first, then proxy (if API_ORIGIN) OR your inline handlers, else 404.
    if (urlPath === "/api/events") return handleEvents(res);
    if (urlPath === "/api/client-errors" && req.method === "POST") return handleClientError(req, res);
    // Leak-suite hooks (TEST=1 only): observe SSE client count + drive change so
    // the memory-live-update spec can exercise real liveSSE teardown. Inert in prod.
    if (TEST && urlPath === "/api/test/sse-count") return sendJson(res, 200, { count: sseClients.size });
    // e2e proxy for "the server log received the report" (#62) — Playwright can't
    // read this process's stdout directly, so expose the count it's already
    // tracking. TEST=1 only, same as the other hooks in this block.
    if (TEST && urlPath === "/api/test/client-error-count") return sendJson(res, 200, { count: clientErrorTotal });
    if (TEST && urlPath === "/api/test/broadcast" && req.method === "POST") {
      const raw = await readBody(req);
      broadcast(raw ? JSON.parse(raw) : {});
      return sendJson(res, 200, { ok: true, clients: sseClients.size });
    }
    if (urlPath.startsWith("/api")) {
      if (API_ORIGIN) return proxyApi(req, res);
      // INLINE API HOOK — handle same-origin endpoints here when this server IS
      // the backend, e.g.: if (urlPath === "/api/status") return void handleStatus(res);
      return sendJson(res, 404, { error: "no such endpoint" });
    }

    // Fixture views registry (TEST=1 only): the shell e2e specs need shell.js's
    // `import { views } from "./views/registry.js"` to resolve to their fixture
    // views (testing/fixtures/shell-harness/*) instead of the real, empty
    // registry — this rewrite serves the fixture's bytes AT the exact URL
    // shell.js imports, so the canon shell.js runs completely unmodified and
    // the response still goes through the normal static pipeline below
    // (ETag/compression/security headers included). Only this one path is
    // rewritten; every other consumer of "/views/registry.js" under TEST=1
    // (there are none today — no other fixture or spec references it) would
    // see the same swap. Inert in prod (TEST unset).
    let filePath = TEST && urlPath === "/views/registry.js"
      ? join(ROOT, "testing", "fixtures", "shell-harness", "registry.js")
      : normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    let info = await stat(filePath).catch(() => null);
    if (info && info.isDirectory()) {
      filePath = join(filePath, "index.html");
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found: " + urlPath);
      return;
    }

    const ext = extname(filePath).toLowerCase();
    const etag = `"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`;
    const headers = {
      ...SECURITY_HEADERS,
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": CACHE > 0 ? `max-age=${CACHE}` : "no-cache", // #57 — ETag/304 still apply either way
      etag,
      vary: "Accept-Encoding",
    };

    // Conditional request — nothing changed, skip the body.
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, headers).end();
      return;
    }

    const body = await readFile(filePath);

    // Compress text-ish payloads above the threshold, reusing cached bytes.
    const enc = info.size >= MIN_COMPRESS && COMPRESSIBLE.has(ext) ? pickEncoding(req.headers["accept-encoding"]) : null;
    if (enc) {
      const key = `${filePath}|${info.mtimeMs}|${enc}`;
      let out = compressCache.get(key);
      if (!out) {
        out = enc === "br"
          ? await brotliAsync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
          : await gzipAsync(body, { level: 6 });
        compressCache.set(key, out);
      }
      res.writeHead(200, { ...headers, "content-encoding": enc, "content-length": out.length });
      res.end(req.method === "HEAD" ? undefined : out);
      return;
    }

    res.writeHead(200, { ...headers, "content-length": info.size });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" }).end("Server error: " + /** @type {Error} */ (err).message);
  }
});

// ── Component preview catalogue (opt-out via PREVIEW=off) ─────────────────────
// On by default: if a previews/ generator is present, regenerate its registry on
// startup so a newly added *.preview.js is catalogued without a manual step.
// Inert when there's no previews/scan.mjs; `node previews/scan.mjs` is the manual
// fallback. See reference/preview.md.
if (PREVIEW) {
  const scanPath = join(ROOT, "previews", "scan.mjs");
  // Probe for the generator explicitly, so a genuine error inside scan.mjs is
  // reported instead of being mistaken for "no preview feature installed".
  if (await stat(scanPath).then(() => true, () => false)) {
    try {
      const { default: scanPreviews } = await import("./previews/scan.mjs");
      const n = await scanPreviews(ROOT);
      console.log(`  previews: ${n} component(s) catalogued`);
    } catch (err) {
      console.warn("  preview scan failed:", /** @type {Error} */ (err).message);
    }
  }
}

server.listen(PORT, HOST, () => {
  console.log(`\n  →  http://${HOST}:${PORT}/${API_ORIGIN ? `   (proxy /api → ${API_ORIGIN})` : ""}\n\n  (Ctrl+C to stop)\n`);
});
