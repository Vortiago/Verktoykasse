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

- **[vanilla-components](vanilla-components/SKILL.md)** — a concrete component
  library built *on* the `vanilla-web` conventions (the "what" to its "how"):
  copy-verbatim atoms (`panel`, `stat-card`, `chip`, `status-dot`, `tooltip`) and
  shell components (`app-bar`, `side-nav` with a numbered "journey" variant,
  `view-header`) on the create-factory + `@scope` contract, plus a unified
  `light-dark()` design-token set extracted from across GitLandscape, Slipestein
  and TapScribe. No build, no deps; each part is copied into an app (`vendor.sh`
  stamps provenance). Ships a runnable preview catalogue (`node serve.mjs` →
  `/preview.html`).

- **[statusline](statusline/SKILL.md)** — the status line for all my Claude Code
  sessions. A generic core renders fixed regions: `project ⎇ branch (worktree)`,
  two core-owned link regions (GitHub issue/PR; services / running code), then a
  per-project status segment. Links are full URLs — clickable even where OSC-8 is
  stripped (tmux over ssh); `gh` lookups are background-cached so renders stay
  instant. A project adds an *extension* that declares links (`cl_addlink`) and
  prints status, sharing `lib.sh`. It lives committed at `.claude/statusline-ext.sh`
  (inert without the core) or personal at `~/.config/claude-statusline/projects/<project>.sh`.
  User-invocable as `/expand-statusline`; worked example at
  [`.claude/statusline-ext.sh`](.claude/statusline-ext.sh) (`🧰 skills 3/3`).

- **[worktrees](worktrees/SKILL.md)** — git worktrees in the bare+sibling
  layout (`<repo>/.git` bare, working trees as siblings like `<repo>/main`).
  A layout-detecting `WorktreeCreate` hook handles bare+sibling *and* ordinary
  repos, PR-ref worktrees (`#123`), and `.worktreeinclude` file copying;
  `clone-bare.sh` / `new-worktree.sh` helpers drive it. User-invocable as
  `/worktrees [repo] [branch]`.

- **[conventional-commits](conventional-commits/SKILL.md)** — Conventional
  Commits enforced machine-wide, zero deps. A POSIX-sh `commit-msg` hook wired
  globally via git 2.54 config-based hooks (`hook.conventional-commits`) validates
  every commit header (standard 11 types, `!`/`BREAKING CHANGE`, optional scope;
  merge/revert/fixup allow-listed). Because PRs squash-merge, the PR title is the
  moniker that ships — a Claude `PreToolUse(Bash)` hook validates `gh pr create`
  titles and flags a breaking-change under-report against the branch, pointing at
  the reflow workflow. Both hooks share one `validate.sh`. User-invocable as
  `/conventional-commits`.

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
