// The read half of the audit: ask git for the change, and read the text of the
// touched files. It parses nothing: the paths and text go to extract.mjs, so
// the parse stays testable on a fixture string. `collect` is the only module
// that talks to git.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

/**
 * Where a touched file's text is read from: the working tree, the index, or a commit.
 * @typedef {"worktree" | "index" | { ref: string }} Source
 */

/**
 * The change to audit: the text of every touched file, and a reader for the
 * diff. The diff is read only on demand, because a change with no tests never
 * needs it. A discovered file that cannot be read (deleted, binary) is dropped.
 * Git resolves paths against the repository root, so a run from a subdirectory
 * still reads every touched file.
 * A `filter` drops discovered paths before their text is read; named files are
 * read unfiltered, because the caller named them on purpose, and one that
 * cannot be read fails the run.
 * @param {{ base?: string, head?: string, staged?: boolean, files?: string[], cwd?: string, filter?: (path: string) => boolean }} [opts]
 * @returns {{ readDiff: () => string, files: Array<{ path: string, text: string }>, ref: string }}
 */
export function collect(opts = {}) {
  const { base, head, staged = false, files, cwd = process.cwd(), filter } = opts;
  assertRef("--base", base);
  assertRef("--head", head);
  // Named files replace the git read, so a range given with them would be
  // silently dropped. An empty list would read as "no files" and audit all.
  if (files && !files.length) throw new Error("files needs at least one path");
  if (files && (base || head || staged)) throw new Error("files cannot combine with base, head, or staged");

  // Named files are read relative to where the caller stands, not the root. One
  // that cannot be read fails the run: dropped, a typo would read as a clean audit.
  if (files && files.length) {
    const out = files.map((path) => {
      const text = readWorktree(path, cwd);
      if (text === undefined) throw new Error(`cannot read ${path}`);
      return { path, text };
    });
    return { readDiff: () => "", files: out, ref: "named files" };
  }

  const root = tryGit(["rev-parse", "--show-toplevel"], cwd)?.trim() || cwd;
  let spec;
  let ref;
  /** @type {Source} */
  let source;
  if (staged) {
    spec = ["--cached"];
    ref = "the index";
    source = "index";
  } else if (head) {
    const baseRef = base || defaultBase(root);
    spec = [`${baseRef}...${head}`];
    ref = spec[0];
    source = { ref: head };
  } else {
    const baseRef = base || defaultBase(root);
    const point = tryGit(["merge-base", baseRef, "HEAD"], root)?.trim() || baseRef;
    spec = [point];
    ref = `${point} (from ${baseRef})`;
    source = "worktree";
  }

  // A bad ref must fail loudly, not read as an empty change. `git` throws; the
  // optional probes (`merge-base`, untracked, a file at a ref) use tryGit.
  // `--` makes git read the spec as a revision: `--base src`, a directory and no
  // ref, must fail, not narrow the diff to the paths under src/.
  let paths = parseNameOnly(git(["diff", "--name-only", "-z", "--diff-filter=ACMR", ...spec, "--"], root));
  if (source === "worktree") {
    const untracked = parseNameOnly(tryGit(["ls-files", "-z", "--others", "--exclude-standard"], root) ?? "");
    paths = [...new Set([...paths, ...untracked])];
  }
  const out = paths.filter((path) => !filter || filter(path)).map((path) => ({ path, text: readSource(source, path, root) })).filter(hasText);
  // A fixed diff shape whatever the user's git config: no colour, no external
  // driver, and the a/ b/ prefixes that the section and hunk parse expects.
  const diffArgs = ["diff", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/", ...spec, "--"];
  return { readDiff: () => git(diffArgs, root), files: out, ref };
}

/**
 * The NUL-separated path list git prints for `--name-only -z` and `ls-files -z`:
 * each path exact, never C-quoted, whatever characters it holds.
 * @param {string} text
 * @returns {string[]}
 */
export function parseNameOnly(text) {
  return text.split("\0").filter(Boolean);
}

/** @param {Source} source @param {string} path @param {string} root */
function readSource(source, path, root) {
  if (source === "worktree") return readWorktree(path, root);
  if (source === "index") return tryGit(["show", `:${path}`], root);
  return tryGit(["show", `${source.ref}:${path}`], root);
}

/**
 * The default branch to diff against: `origin/HEAD`, then `origin/main`, then a
 * local `main`, so a clone without the remote symbolic ref still runs.
 * @param {string} root
 */
function defaultBase(root) {
  const ref = tryGit(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"], root);
  if (ref) return ref.trim().replace(/^refs\/remotes\//, "");
  if (tryGit(["rev-parse", "--verify", "--quiet", "origin/main"], root)) return "origin/main";
  if (tryGit(["rev-parse", "--verify", "--quiet", "main"], root)) return "main";
  return "origin/main";
}

/**
 * A ref that starts with `-` is read by git as an option, not a ref, and the
 * plugin passes a model-controlled value here.
 * @param {string} flag @param {string | undefined} value
 */
function assertRef(flag, value) {
  if (value && value.startsWith("-")) throw new Error(`${flag} is not a ref: ${value}`);
}

/**
 * @param {{ path: string, text: string | undefined }} file
 * @returns {file is { path: string, text: string }}
 */
function hasText(file) {
  return typeof file.text === "string";
}

/** @param {string} path @param {string} base */
function readWorktree(path, base) {
  try {
    return readFileSync(resolve(base, path), "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Run git and fail loudly: the caller asked for a change and must know when
 * the range is bad. `tryGit` is for the probes whose absence is expected.
 * @param {string[]} args @param {string} cwd
 */
function git(args, cwd) {
  const result = runGit(args, cwd);
  if (result.error) throw new Error(`git ${args.join(" ")}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${(result.stderr || "").trim().slice(0, 300)}`);
  }
  return result.stdout;
}

/** @param {string[]} args @param {string} cwd @returns {string | undefined} */
function tryGit(args, cwd) {
  const result = runGit(args, cwd);
  return result.status === 0 ? result.stdout : undefined;
}

/**
 * The spawn every git call shares: utf8 text, and a buffer that fits a big change.
 * `core.quotePath=false` keeps a non-ASCII path in a diff header as text, so the
 * header parse still finds it (`tests/kø.test.js`, not `"tests/k\303\270..."`).
 * @param {string[]} args @param {string} cwd
 */
function runGit(args, cwd) {
  return spawnSync("git", ["-c", "core.quotePath=false", ...args], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}
