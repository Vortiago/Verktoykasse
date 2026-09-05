// @ts-check
// gate: off — a test, not a gate half (check.mjs globs tools/check-*.mjs; this
// runs under `node --test` instead).
//
// Guards check-vendored's classification, the thing #74 got wrong. The stamp used
// to name the commit BEFORE the one whose bytes the copy carries, because the
// documented flow is edit canon → sync → add → commit and no command run at sync
// time can name a commit that does not exist yet. The rev-based checker then read
// an untouched copy as `forked` the moment canon moved, which is the one
// classification that exits non-zero. The stamp now carries a sha256 of the canon
// bytes, and that hash decides.
//
// Every case runs the real checker against a throwaway git checkout, because the
// stale/forked split is made of `git show <rev>:<path>` reads that no double can
// stand in for.
//
// NOTE for anyone editing this file: write no literal stamp line here. new-app.mjs
// vendors tools/*.mjs into scaffolded apps, and check-vendored's stripStamp filters
// EVERY matching line in a file — a literal fixture would be stripped out of the
// app's copy but not out of canon, and the copy would then classify as forked. The
// stamp strings below are assembled at run time for exactly that reason, and the
// self-vendoring case at the bottom pins it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(HERE, "check-vendored.mjs");
const REPO = join(HERE, "..", "..");

const sha256 = (/** @type {string} */ s) => createHash("sha256").update(s, "utf8").digest("hex");

/** The stamp's fixed words, assembled rather than written, so this file carries no
 * line that stripStamp would delete. @param {string} path @param {string} rev
 * @param {string} [hash] */
const stampText = (path, rev, hash) =>
  `${["canonical", "source:"].join(" ")} ${path}@${rev}${hash ? ` sha256:${hash}` : ""} - vendored copy`;

/** @param {string} path @param {string} rev @param {string} [hash] */
const jsStamp = (path, rev, hash) => `// ${stampText(path, rev, hash)}`;

/** Drop any stamp line, both dialects, matching what stripStamp removes.
 * Assembled at run time for the same reason the stamp text is.
 * @param {string} text */
function unstamp(text) {
  const sync = `${["canonical", "source:"].join(" ")}\\s*[\\w-]+/\\S+@\\S+`;
  const vendor = `${["from", "vanilla-components"].join(" ")}(/\\S+)?@\\w+`;
  const line = new RegExp(`${sync}|${vendor}`);
  return text.split("\n").filter((l) => !line.test(l)).join("\n");
}

/** @param {string[]} args @param {string} cwd */
const git = (args, cwd) => spawnSync("git", args, {
  cwd, encoding: "utf8",
  env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
});

/** A temp directory that cleans itself up when the test ends.
 * @param {import("node:test").TestContext} t @param {string} prefix */
function tmp(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A throwaway toolkit checkout holding `files` ({path: body}, relative to the
 * checkout root), committed so `git show <rev>:<path>` resolves.
 * @param {import("node:test").TestContext} t @param {Record<string, string>} files */
function toolkit(t, files) {
  const tk = tmp(t, "cv-tk-");
  git(["init", "-q", "-b", "main"], tk);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(tk, rel)), { recursive: true });
    writeFileSync(join(tk, rel), body);
  }
  git(["add", "-A"], tk);
  git(["commit", "-qm", "chore: canon"], tk);
  return { tk, rev: git(["rev-parse", "--short", "HEAD"], tk).stdout.trim() };
}

/** A toolkit holding the single canon file the simple cases use.
 * @param {import("node:test").TestContext} t @param {string} body */
const canonToolkit = (t, body) => toolkit(t, { "vanilla-web/x.js": body });

/** An app directory holding one stamped copy.
 * @param {import("node:test").TestContext} t @param {string} content
 * @param {string} [name] */
function app(t, content, name = "x.js") {
  const dir = tmp(t, "cv-app-");
  writeFileSync(join(dir, name), content);
  return dir;
}

/** @param {string} cwd @param {string} tk */
function run(cwd, tk) {
  const r = spawnSync(process.execPath, [CHECKER, tk], { cwd, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

// A non-ASCII body on purpose: the checker hashes stripStamp(text) as a UTF-8
// string while the writers hash raw bytes, and the toolkit files carry em dashes
// and box-drawing glyphs. If that round trip were lossy, this is where it shows.
const BODY = "const a = 1; // canon — the ✓ case\nconst b = 2;\n";

test("untouched copy stamped one commit behind its own bytes is stale, not forked (#74)", (t) => {
  // The reported shape, end to end. Canon is edited, THEN synced (so the stamp
  // takes the rev of the commit before the edit), THEN committed. Later canon
  // moves again, so the content-first path no longer answers.
  const { tk, rev: revBefore } = canonToolkit(t, BODY);
  const synced = `${BODY}const c = 3;\n`;
  writeFileSync(join(tk, "vanilla-web", "x.js"), synced);       // edit canon
  const dir = app(t, `${jsStamp("vanilla-web/x.js", revBefore, sha256(synced))}\n${synced}`); // sync
  git(["commit", "-qam", "chore: the edit the copy carries"], tk); // commit
  writeFileSync(join(tk, "vanilla-web", "x.js"), `${synced}const d = 4;\n`); // canon moves on

  const { code, out } = run(dir, tk);
  assert.equal(code, 0, out);
  assert.match(out, /stale \(1\)/);
  assert.doesNotMatch(out, /✗ forked/); // the success summary also says "nothing forked"
  // The stale line prints the values the new stamp needs, hash included.
  assert.match(out, new RegExp(`sha256:${sha256(`${synced}const d = 4;\n`)}`));
});

test("a wrong rev in the stamp does not change the verdict — the hash decides", (t) => {
  const { tk } = canonToolkit(t, BODY);
  const dir = app(t, `${jsStamp("vanilla-web/x.js", "deadbee", sha256(BODY))}\n${BODY}`);
  writeFileSync(join(tk, "vanilla-web", "x.js"), `${BODY}const c = 3;\n`);

  const { code, out } = run(dir, tk);
  assert.equal(code, 0, out);
  assert.match(out, /stale \(1\)/);
});

test("an edited copy is forked and exits 1", (t) => {
  const { tk, rev } = canonToolkit(t, BODY);
  const edited = BODY.replace("const b = 2;", "const b = 22; // local edit");
  const dir = app(t, `${jsStamp("vanilla-web/x.js", rev, sha256(BODY))}\n${edited}`);

  const { code, out } = run(dir, tk);
  assert.equal(code, 1, out);
  assert.match(out, /forked \(1\)/);
  assert.match(out, /vs stamped original/);
});

test("an edited copy with an untrustworthy rev names current canon as the basis", (t) => {
  const { tk } = canonToolkit(t, BODY);
  const edited = BODY.replace("const b = 2;", "const b = 22;");
  const dir = app(t, `${jsStamp("vanilla-web/x.js", "deadbee", sha256(BODY))}\n${edited}`);

  const { code, out } = run(dir, tk);
  assert.equal(code, 1, out);
  assert.match(out, /vs current canon/);
});

test("a stamp with no hash still classifies through the rev", (t) => {
  const { tk, rev } = canonToolkit(t, BODY);
  const dir = app(t, `${jsStamp("vanilla-web/x.js", rev)}\n${BODY}`);
  writeFileSync(join(tk, "vanilla-web", "x.js"), `${BODY}const c = 3;\n`);

  const { code, out } = run(dir, tk);
  assert.equal(code, 0, out);
  assert.match(out, /stale \(1\)/);
});

test("the documented off-by-one on a hash-less stamp is forked — why the migration exists", (t) => {
  // v1 committed, then v2 committed. The copy carries v2's bytes but the stamp
  // names v1, which is what stamping at sync time produced. Then canon moves
  // again, so the content-first path cannot save it.
  const { tk, rev: rev1 } = canonToolkit(t, BODY);
  const v2 = `${BODY}const c = 3;\n`;
  writeFileSync(join(tk, "vanilla-web", "x.js"), v2);
  git(["commit", "-qam", "chore: v2"], tk);
  const dir = app(t, `${jsStamp("vanilla-web/x.js", rev1)}\n${v2}`);
  writeFileSync(join(tk, "vanilla-web", "x.js"), `${v2}const d = 4;\n`);

  const { code, out } = run(dir, tk);
  assert.equal(code, 1, out);
  assert.match(out, /forked \(1\)/);
});

test("a shebang file stamps on line 2 and still parses", (t) => {
  const shebang = `#!/usr/bin/env node\n${BODY}`;
  const { tk, rev } = canonToolkit(t, shebang);
  const lines = shebang.split("\n");
  const dir = app(t, [lines[0], jsStamp("vanilla-web/x.js", rev, sha256(shebang)), ...lines.slice(1)].join("\n"));

  const { code, out } = run(dir, tk);
  assert.equal(code, 0, out);
  assert.match(out, /up-to-date \(1\)/);
});

test("a .css copy parses its own comment syntax", (t) => {
  const css = ":root { --a: 1; }\n";
  const { tk, rev } = canonToolkit(t, css);
  // The checker resolves canon by the stamped path, so the copy may sit anywhere.
  const dir = app(t, `/* ${stampText("vanilla-web/x.js", rev, sha256(css))} */\n${css}`, "x.css");

  const { code, out } = run(dir, tk);
  assert.equal(code, 0, out);
  assert.match(out, /up-to-date \(1\)/);
});

test("the checker and this test file survive being vendored into an app", (t) => {
  // new-app.mjs copies tools/*.mjs into a scaffolded app and stamps each one. If
  // either file carried a literal stamp line in its body, stripStamp would delete
  // it from the copy and the copy would classify as forked.
  const names = ["check-vendored.mjs", "check-vendored.test.mjs"];
  // Strip first: run inside a scaffolded app, these two files already carry
  // new-app.mjs's stamp, and stamping a stamped body would make the fixture's
  // canon differ from what the checker strips back out.
  const bodies = Object.fromEntries(names.map((n) => [n, unstamp(readFileSync(join(HERE, n), "utf8"))]));
  const { tk } = toolkit(t, Object.fromEntries(names.map((n) => [`vanilla-web/tools/${n}`, bodies[n]])));

  const dir = tmp(t, "cv-app-");
  mkdirSync(join(dir, "tools"), { recursive: true });
  for (const name of names) {
    const lines = bodies[name].split("\n");
    writeFileSync(join(dir, "tools", name),
      [lines[0], jsStamp(`vanilla-web/tools/${name}`, "0000000", sha256(bodies[name])), ...lines.slice(1)].join("\n"));
  }

  const { code, out } = run(dir, tk);
  assert.equal(code, 0, out);
  assert.match(out, /up-to-date \(2\)/);
});

test("sync-from-web.sh --check fails when a copy's recorded hash stops matching canon", (t) => {
  const sync = join(REPO, "vanilla-components", "sync-from-web.sh");
  if (!existsSync(sync)) return t.skip("vanilla-components is not installed beside this skill");

  // Work on a copy of the repo, so the real tree is never touched.
  const clone = tmp(t, "cv-repo-");
  for (const d of ["vanilla-web", "vanilla-components"]) {
    cpSync(join(REPO, d), join(clone, d), { recursive: true, filter: (s) => !s.includes("node_modules") });
  }
  git(["init", "-q", "-b", "main"], clone);
  git(["add", "-A"], clone);
  git(["commit", "-qm", "chore: seed"], clone);

  const comp = join(clone, "vanilla-components");
  const check = () => spawnSync("bash", ["./sync-from-web.sh", "--check"], { cwd: comp, encoding: "utf8" });
  const pass = check();
  assert.equal(pass.status, 0, `${pass.stdout}${pass.stderr}`);

  // Both stamp faults in one run, because each is reported per file and the run
  // costs ~120 forks over the 15 pairs. Bodies still match canon in both cases:
  // only the sha256 check catches either, since the body diff sees nothing wrong.
  const wrongHash = join(comp, "lib", "render.js");   // records a hash that is not canon's
  const noHash = join(comp, "lib", "chrome.js");      // records no hash at all, and must
  //   report rather than die: the reader returns empty there, and under
  //   `set -o pipefail` an unguarded grep miss would kill the script first.
  writeFileSync(wrongHash, readFileSync(wrongHash, "utf8").replace(/sha256:[0-9a-f]{64}/, `sha256:${"0".repeat(64)}`));
  writeFileSync(noHash, readFileSync(noHash, "utf8").replace(/ sha256:[0-9a-f]{64}/, ""));

  const fail = check();
  assert.equal(fail.status, 1, `${fail.stdout}${fail.stderr}`);
  assert.match(fail.stderr, /lib\/render\.js records sha256:0{64}/);
  assert.match(fail.stderr, /lib\/chrome\.js records sha256:none/);
});

test("the shell writer and node agree on the hash", (t) => {
  const lib = join(REPO, "vanilla-components", "lib-stamp.sh");
  if (!existsSync(lib)) return t.skip("vanilla-components is not installed beside this skill");

  const f = join(app(t, BODY), "x.js");

  const r = spawnSync("bash", ["-c", `source "$1"; sha256_of "$2"`, "_", lib, f], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), sha256(BODY));
});
