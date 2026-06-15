# Verktøykasse

*Verktøykasse* — Norwegian for **toolbox**.

My general-purpose [Claude Code](https://claude.com/claude-code) skills:
conventions and canonical helper code that apply across projects, versioned
here and symlinked into `~/.claude/skills/` dotfiles-style. Project-specific
skills live with their projects; third-party skills are installed separately
and don't belong here.

## Skills

- **[vanilla-web](vanilla-web/SKILL.md)** — how websites get built here:
  vanilla ES modules, HTML `<template>` components loaded by JS (no HTML
  strings in JS), `@scope` CSS with `light-dark()` tokens and container
  queries, interaction-safe re-renders (`renderRegion`), SSE for live data,
  AbortController view lifecycle, native `<dialog>`/popover overlays, hash
  routing with view transitions, zero-dep node server, JSDoc+tsc gate.
  Ships three canonical skeletons: `templates.js`, `shell.js`, `serve.mjs`.

- **[worktrees](worktrees/SKILL.md)** — git worktrees in the bare+sibling
  layout (`<repo>/.git` bare, working trees as siblings like `<repo>/main`).
  A layout-detecting `WorktreeCreate` hook handles bare+sibling *and* ordinary
  repos, PR-ref worktrees (`#123`), and `.worktreeinclude` file copying;
  `clone-bare.sh` / `new-worktree.sh` helpers drive it. User-invocable as
  `/worktrees [repo] [branch]`.

## Install

```sh
./install.sh              # all skills
./install.sh worktrees    # just one skill
```

Symlinks each skill into `~/.claude/skills/<name>`. Idempotent; a real
directory already at a live path is backed up to `<path>.pre-verktoykasse`.

A skill may ship its own `<skill>/install.sh` for extra wiring — e.g.
`worktrees` also symlinks its hook into `~/.claude/hooks/`, links the helper
scripts into your repos root (it prompts for the path; override with
`REPOS_ROOT=…`), and registers the `WorktreeCreate` hook in `settings.json`.
