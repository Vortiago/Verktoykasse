# Verktøykasse

*Verktøykasse* — Norwegian for **toolbox**.

My general-purpose [Claude Code](https://claude.com/claude-code) skills:
conventions and canonical helper code that apply across projects, versioned
here and symlinked into `~/.claude/skills/` dotfiles-style. Project-specific
skills live with their projects (e.g. `delegate-impl` in Slipestein);
third-party skills are installed separately and don't belong here.

## Skills

- **[vanilla-web](vanilla-web/SKILL.md)** — how websites get built here:
  vanilla ES modules, HTML `<template>` components loaded by JS (no HTML
  strings in JS), `@scope` CSS with `light-dark()` tokens and container
  queries, interaction-safe re-renders (`renderRegion`), SSE for live data,
  AbortController view lifecycle, native `<dialog>`/popover overlays, hash
  routing with view transitions, zero-dep node server, JSDoc+tsc gate.
  Ships three canonical skeletons: `templates.js`, `shell.js`, `serve.mjs`.

## Install

```sh
./install.sh
```

Symlinks each skill into `~/.claude/skills/<name>`. Idempotent; a real
directory already at a live path is backed up to `<path>.pre-verktoykasse`.
