#!/usr/bin/env node
// @ts-check
// Canonical zero-dependency static server for the vanilla-web conventions
// (see SKILL.md). Copy next to web/ and adapt: add same-origin /api/*
// handlers in-file when the page needs live data.
//
//   PORT=4098 node serve.mjs                      # loopback only (default)
//   HOST=$(tailscale ip -4) node serve.mjs        # expose on the tailnet

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "127.0.0.1";

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
  ".ico": "image/x-icon",
};

/** @param {import("node:http").ServerResponse} res
 * @param {number} status @param {unknown} obj */
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

// ── Server-Sent Events ──────────────────────────────────────────────────────
// The default transport for live data (SKILL.md → Live data): the server
// pushes ONLY when the payload actually changed, so the client never renders
// a no-op tick. EventSource reconnects by itself. Wire a source of change
// (fs.watch, a poll of an upstream API, a job queue) to broadcast().

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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const urlPath = decodeURIComponent(url.pathname);

    // Same-origin API handlers go here, before the static path:
    // if (urlPath === "/api/status") return void handleStatus(res);
    if (urlPath === "/api/events") return handleEvents(res);
    if (urlPath.startsWith("/api")) return sendJson(res, 404, { error: "no such endpoint" });

    let filePath = normalize(join(ROOT, urlPath));
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
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-cache",
      "content-length": info.size,
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" }).end("Server error: " + /** @type {Error} */ (err).message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  →  http://${HOST}:${PORT}/\n\n  (Ctrl+C to stop)\n`);
});
