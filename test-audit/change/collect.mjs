// The read half of the audit: ask git for the change, and read the text of the
// touched files. It parses nothing: the paths and text go to extract.mjs, so
// the parse stays testable on a fixture string. `collect` is the only module
// that talks to git.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

/**
 * The change to audit: the diff for context, and the text of every touched
 * file. A file that cannot be read (deleted, binary) is dropped. Git resolves
 * paths against the repository root, so a run from a subdirectory still reads
 * every touched file.
 * A `filter` drops discovered paths before their text is read; named files are
 * read unfiltered, because the caller named them on purpose.
 * @param {{ base?: string, head?: string, staged?: boolean, files?: string[], cwd?: string, filter?: (path: string) => boolean }} [opts]
 * @returns {{ diff: string, files: Array<{ path: string, text: string }>, ref: string }}
 */
export function collect(opts = {}) {
  const { base, head, staged = false, files, cwd = process.cwd(), filter } = opts;
  assertRef("--base", base);
  assertRef("--head", head);

  // Named files are read relative to where the caller stands, not the root.
  if (files && files.length) {
    const out = files.map((path) => ({ path, text: readWorktree(path, cwd) })).filter(hasText);
    return { diff: "", files: out, ref: "named files" };
  }

  const root = tryGit(["rev-parse", "--show-toplevel"], cwd)?.trim() || cwd;
  let spec;
  let ref;
  let source;
  let includeUntracked = false;
  if (staged) {
    spec = ["--cached"];
    ref = "the index";
    source = "index";
  } else if (head) {
    const baseRef = base ?? defaultBase(root);
    spec = [`${baseRef}...${head}`];
    ref = spec[0];
    source = { ref: head };
  } else {
    const baseRef = base ?? defaultBase(root);
    const point = tryGit(["merge-base", baseRef, "HEAD"], root)?.trim() || baseRef;
    spec = [point];
    ref = `${point} (from ${baseRef})`;
    source = "worktree";
    includeUntracked = true;
  }

  // A bad ref must fail loudly, not read as an empty change. `git` throws; the
  // optional probes (`merge-base`, untracked, a file at a ref) use tryGit.
  const diff = git(["diff", ...spec], root);
  let paths = parseNameOnly(git(["diff", "--name-only", "--diff-filter=ACMR", ...spec], root));
  if (includeUntracked) {
    const untracked = parseNameOnly(tryGit(["ls-files", "--others", "--exclude-standard"], root) ?? "");
    paths = [...new Set([...paths, ...untracked])];
  }
  const out = paths.filter((path) => !filter || filter(path)).map((path) => ({ path, text: readSource(source, path, root) })).filter(hasText);
  return { diff, files: out, ref };
}

/**
 * The newline-separated path list git prints for `--name-only`.
 * @param {string} text
 * @returns {string[]}
 */
export function parseNameOnly(text) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

/** @param {"worktree" | "index" | { ref: string }} source @param {string} path @param {string} root */
function readSource(source, path, root) {
  if (source === "worktree") return readWorktree(path, root);
  if (source === "index") return tryGit(["show", `:${path}`], root);
  return tryGit(["show", `${source.ref}:${path}`], root);
}

/** The default branch to diff against, from `origin/HEAD`, with a fallback. */
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

/** @param {{ path: string, text: string | undefined }} file */
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

/** The spawn every git call shares: utf8 text, and a buffer that fits a big change. */
function runGit(args, cwd) {
  return spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}
