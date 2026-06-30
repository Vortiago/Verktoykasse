// Minimal zero-dep static server for the memory-leak suite (webServer in
// playwright.config.js). Serves the skill root (this file's ../..) so the suite
// can drive preview.html as a real mount/unmount loop.
//
// Why not ../serve.mjs? The vendored vanilla-components/serve.mjs carries its
// provenance banner ABOVE the `#!/usr/bin/env node` shebang, so `node serve.mjs`
// throws a SyntaxError (a vendoring bug to fix in lib-stamp.sh, tracked
// separately). preview.html is fully static — previews/registry.js is committed —
// so a plain file server is all the component tier needs; no SSE, no codegen.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // testing/ -> skill root
const PORT = Number(process.env.PORT) || 8001;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    let filePath = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    // Enforce a directory boundary, not a bare string prefix (ROOT="/a/skill"
    // must not match "/a/skill-other"): require ROOT itself or ROOT + separator.
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) return void res.writeHead(403).end("Forbidden");
    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) { filePath = join(filePath, "index.html"); info = await stat(filePath).catch(() => null); }
    if (!info) return void res.writeHead(404).end("Not found");
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end("Server error: " + /** @type {Error} */ (err).message);
  }
}).listen(PORT, "127.0.0.1", () => console.log(`  static → http://127.0.0.1:${PORT}/preview.html`));
