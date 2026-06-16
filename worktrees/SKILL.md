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

All creation paths funnel through the `WorktreeCreate` hook
(`~/.claude/hooks/worktree-create.sh`), so Claude Code's `--worktree` flag,
subagent worktree isolation, and `.new-worktree.sh` all behave identically. The
hook is layout-aware:

- **Bare+sibling repo** (`core.bare=true`, git dir is literally `<base>/.git`):
  creates `<base>/<name>` on branch `<name>`.
- **Ordinary repo**: replicates Claude Code's default —
  `<repo-root>/.claude/worktrees/<name>` on branch `worktree-<name>`.
- **PR ref** (`#123`): fetches the PR head and bases a `pr-123` worktree on it.

### `.worktreeinclude` — carry gitignored files into new worktrees

A WorktreeCreate hook replaces Claude Code's default `.worktreeinclude`
handling, so the hook does it itself: any file matching **both** `.gitignore`
**and** the patterns in a repo-root `.worktreeinclude` is copied from the source
working tree into the new worktree. Use it for gitignored-but-required local
files — e.g. a local config the app needs to boot:

```
# .worktreeinclude
config.local.json
.env.local
```

Without this, those files would be absent in every fresh worktree.

`.worktreeinclude` copies from the *source* worktree, so the file must exist in
whatever you branch from. To land a machine-local file in *every* worktree
regardless of source — without committing a pattern list — use the seed tree.

### `<bare>/worktree-seed/` — seed every worktree from the bare repo

After creating the worktree, the hook mirrors `<bare>/worktree-seed/` into it
(self-located from the shared git dir). Drop machine-local, gitignored files there
(mirroring the worktree layout); every new worktree gets them — nothing in git
history, no dependence on the source worktree:

```
<repo>/worktree-seed/data/config.local.json   →   <repo>/<branch>/data/config.local.json
```

## Gotchas

- Never commit directly in `$REPOS_ROOT/<repo>/` root — it's the bare repo.
  Always work inside a worktree.
- Don't bypass the hook with ad-hoc `git worktree add` into
  `.claude/worktrees/` — `.new-worktree.sh` and the `--worktree` flag already
  route through it.
