# How worktree creation works (internals)

Read this when you need to understand or debug the creation path, or carry
gitignored files into new worktrees. For everyday create/inspect/remove, the
top-level SKILL.md is enough.

All creation paths funnel through the `WorktreeCreate` hook
(`~/.claude/hooks/worktree-create.sh`), so Claude Code's `--worktree` flag,
subagent worktree isolation, and `.new-worktree.sh` all behave identically. The
hook is layout-aware:

- **Bare+sibling repo** (`core.bare=true`, git dir is literally `<base>/.git`):
  creates `<base>/<name>` on branch `<name>`.
- **Ordinary repo**: replicates Claude Code's default —
  `<repo-root>/.claude/worktrees/<name>` on branch `worktree-<name>`.
- **PR ref** (`#123`): fetches the PR head and bases a `pr-123` worktree on it.

## `.worktreeinclude` — carry gitignored files into new worktrees

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

## `<bare>/worktree-seed/` — seed every worktree from the bare repo

After creating the worktree, the hook mirrors `<bare>/worktree-seed/` into it
(self-located from the shared git dir). Drop machine-local, gitignored files there
(mirroring the worktree layout); every new worktree gets them — nothing in git
history, no dependence on the source worktree:

```
<repo>/worktree-seed/data/config.local.json   →   <repo>/<branch>/data/config.local.json
```
