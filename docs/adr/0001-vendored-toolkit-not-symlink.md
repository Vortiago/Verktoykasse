# 0001: The shared toolkit is vendored from vanilla-web, not symlinked or packaged

- Status: Accepted
- Date: 2026-06-24
- Deciders: Atle

## Context

`vanilla-web` and `vanilla-components` are two **independently installable** skills in
this repo. `vanilla-web` is the engine (the "how"), and `vanilla-components` is a component
library built on it (the "what"). Six toolkit files are byte-identical across both trees
(852 LOC):

| canon (`vanilla-web`) | copy (`vanilla-components`) |
| --- | --- |
| `serve.mjs`, `preview.js`, `preview.css`, `previews/scan.mjs`, `previews/new.mjs` | same relative path |
| `templates.js` | `lib/templates.js` |

The duplication is not inert: commit `599fda3` added the *same 55 lines* of `templates.js`
to **both** copies in one commit: a forced lockstep edit. Left alone, the two copies will
drift, and an app could copy `templates.js` from either skill and get a different engine.

Two hard constraints bound any fix:

1. **No build step, no runtime deps.** Plain ES modules served statically. The only dev
   dependency is `typescript`. Nothing may transform source between edit and run/ship.
2. **Skills install independently.** `install.sh` symlinks each skill into
   `~/.claude/skills/<name>` on its own, and apps vendor files *out of* a skill's tree. So
   `vanilla-components` must remain self-contained: it cannot reach across to
   `vanilla-web` at runtime or install time.

## Decision

Make `vanilla-web` the **sole canon** for the files on `sync-from-web.sh`'s `PAIRS`
allow-list. `vanilla-components` keeps a **committed, generated copy** of each (the same
category as the committed, generated `previews/registry.js`), produced by
`vanilla-components/sync-from-web.sh`:

- Each copy carries an app-safe provenance header
  (`// canonical source: vanilla-web/<file>@<rev> sha256:<hash> - vendored copy, do not
  edit here`). You edit canon in `vanilla-web`, and you never edit the copy. ADR 0004 says
  why the hash, and not the rev beside it, identifies the copy.
- A **repo-local** git config-based `pre-commit` hook runs `sync-from-web.sh --precommit`,
  which is `--check` guarded to fire only when a canon or vendored path is staged. The
  check strips the stamp line, compares each copy's body to canon, and compares each
  stamped hash to canon's. Drift between canon and a committed copy becomes
  **un-committable**. The hook anchors on `git rev-parse --show-toplevel` so it checks
  whichever worktree the commit is in.

The vendored set is an explicit allow-list. `preview.html` and `tsconfig.json` legitimately
differ per tree and are simply not on it. A file that must diverge later just leaves the
list.

## Consequences

- **One edit site.** `reconcileList` and the rest of the engine live in exactly one module.
  Leverage flows to every consumer (the internal copy and every downstream app) identically.
- **No drift.** The gate makes a divergent copy un-committable, rather than merely
  discouraging it with a comment.
- **The copy is a generated artifact.** `vanilla-components/lib/templates.js` et al. are
  git-tracked but produced by a script, like `previews/registry.js`. Editing them directly
  is a mistake the header and the gate both catch.
- **Cost:** `sync-from-web.sh` (sharing `stamp_file` with `vendor.sh` through
  `lib-stamp.sh`), a one-line
  hook registration in `vanilla-components/install.sh`, and one rule to learn ("edit canon,
  re-sync"). It pays off in proportion to how often the toolkit changes, and `templates.js`
  is the most foundational module in the ecosystem.

## Alternatives considered

- **Symlink `vanilla-components/lib/templates.js` → `../../vanilla-web/templates.js`.**
  Rejected: skills install independently, so the sibling is not guaranteed to exist at the
  symlinked location, and copy-verbatim into apps does not dereference cleanly. The repo's
  own conventions already rule out symlinks for distribution.
- **Publish the toolkit as a package `vanilla-components` depends on.** Rejected: violates
  "no build, no runtime deps" and the static-serve model. Adds a dependency graph the whole
  stack exists to avoid.
- **Monorepo build tooling (workspaces, a bundler) to share the source.** Rejected: a build
  step is the one thing the stack is defined against. The files must be runnable and
  shippable as raw source.
- **Convention only (provenance header, no gate).** Rejected: a comment stops nobody under
  time pressure, human or agent. The candidate's value is *drift becomes impossible*, not
  *discouraged*.
- **Do nothing (tolerate the duplication).** Rejected: the lockstep edit in `599fda3` shows
  the cost is already being paid, and silent drift between two upstream copies of the engine
  is a real correctness hazard for downstream apps.

## Notes

A worktree-creation hook to (re)install the pre-commit hook per worktree is **not** needed:
`extensions.worktreeConfig` is unset, so `git config --local` writes the shared common
config that every worktree, present and future, already reads.

The hook command resolves through the `~/.claude/skills/vanilla-components` symlink, which
points at whichever worktree `install.sh` was run from. Run install from a stable worktree
(`main`) so the target persists. A feature worktree that is later removed would dangle the
symlink and block commits repo-wide.

The drift check compares the working tree, not staged blobs, a deliberate simplification
matching the edit-canon → `sync-from-web.sh` → `git add` → commit flow. It catches the
primary "forgot to re-sync" case. It does not guard a contrived stage-then-restore.

Extended by 0004: a copy is identified by a sha256 of the canon bytes it carries. The rev
in the stamp is provenance for a human, and a fallback for a stamp written before that
record.
