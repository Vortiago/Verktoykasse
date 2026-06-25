---
name: worktrees
description: Create and manage git worktrees in the bare+sibling layout (each <repo>/.git is a bare clone; working trees are siblings like <repo>/main and <repo>/<branch>). Use when creating a worktree, starting feature/branch work, reviewing a PR locally, or working on multiple repos or branches in parallel.
argument-hint: "[repo] [branch]"
disable-model-invocation: true
---

# Worktrees in $REPOS_ROOT

Repos under `$REPOS_ROOT` (default `~/repos`) use the bare+sibling layout:

```
$REPOS_ROOT/<repo>/.git     bare clone (no working tree — `git status` here fails by design)
$REPOS_ROOT/<repo>/main     main-branch worktree
$REPOS_ROOT/<repo>/<feat>   one sibling worktree per branch
```

`.clone-bare.sh` sets `remote.origin.fetch` to the standard refspec and
`push.autoSetupRemote true`, so fetch/pull/push behave normally inside any
worktree.

Override the root for one invocation with `REPOS_ROOT=/path ...`.

If invoked with arguments (`/worktrees <repo> <branch>`), create that worktree
immediately, then `cd` into it.

## Create a worktree

Preferred — one command handles fetch, fresh `origin/HEAD` base, existing-branch
reuse, PR refs, and `.worktreeinclude` file copies:

```bash
$REPOS_ROOT/.new-worktree.sh <repo> <branch>     # → prints $REPOS_ROOT/<repo>/<branch>
$REPOS_ROOT/.new-worktree.sh <repo> '#123'       # → PR worktree <repo>/pr-123 from PR #123's head
```

Manual equivalent (new branch from fresh remote default):

```bash
git -C $REPOS_ROOT/<repo> fetch origin
git -C $REPOS_ROOT/<repo> worktree add $REPOS_ROOT/<repo>/<branch> -b <branch> origin/HEAD
# existing branch instead: omit -b: git -C $REPOS_ROOT/<repo> worktree add $REPOS_ROOT/<repo>/<branch> <branch>
```

After creating: run the repo's dependency setup in the new worktree if needed
(`npm install`, venv, etc.) — worktrees share git history, not build artifacts.

## Inspect / remove

```bash
git -C $REPOS_ROOT/<repo> worktree list
git -C $REPOS_ROOT/<repo> worktree remove $REPOS_ROOT/<repo>/<branch>   # after merge/abandon
git -C $REPOS_ROOT/<repo> branch -D <branch>                           # if the branch is done too
```

## Clone a new repo into this layout

```bash
$REPOS_ROOT/.clone-bare.sh <repo>    # with gh: name, owner/name, or URL; without gh: a full URL/path
```

`gh` is preferred (it resolves shorthand like `owner/name`); if it isn't
installed, the script falls back to plain `git clone` for a full URL or local
path.

## How worktree creation works

All creation paths funnel through the layout-aware `WorktreeCreate` hook
(`~/.claude/hooks/worktree-create.sh`), so Claude Code's `--worktree` flag,
subagent worktree isolation, and `.new-worktree.sh` behave identically (bare+
sibling vs ordinary repo vs PR ref). To carry gitignored-but-required local files
into new worktrees, use a repo-root `.worktreeinclude` or the `<bare>/worktree-seed/`
tree. → [`reference/internals.md`](reference/internals.md)

## Default-branch edit guard

`guard-default-branch.sh` (`PreToolUse`) blocks `Edit`/`Write`/`MultiEdit`/
`NotebookEdit` and `git commit`/`git add` when the target tree is on the repo's
default branch — feature work must not land on main directly; main advances only
via merge/pull.

- Scope: bare+sibling layout only; fails open elsewhere — ordinary repos,
  detached HEAD, bare root, `worktree-seed/`, non-git paths.
- Default = `origin/HEAD`; if unset, falls back to `main`/`master` only.
- Unaffected: feature worktrees; `git pull`/`merge`/`fetch`/`rebase` on main.
- Best-effort on `Bash`: matches the literal `git commit`/`git add` verbs (so a
  `cd … && git commit` or a quoted mention can slip/over-match) — fail-open.
- Override: `WORKTREES_ALLOW_MAIN_EDITS=1` (launch env; user-only).
- Verify: `bash worktrees/selftest.sh`.

## Gotchas

- Never commit in `$REPOS_ROOT/<repo>/` root — it's the bare repo (git refuses;
  no work tree). Work in a worktree; the guard above enforces this for `main`.
- Don't bypass the hook with ad-hoc `git worktree add` into
  `.claude/worktrees/` — `.new-worktree.sh` and the `--worktree` flag already
  route through it.
