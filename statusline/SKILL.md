---
name: expand-statusline
description: Extend Atle's Claude Code status line with project-specific information (dev-server state, CI status, queue depth, counts, freshness, …). Use ONLY when the user invokes /expand-statusline. Not model-invoked.
argument-hint: "[what to show, e.g. 'dev server + open queue count']"
disable-model-invocation: true
---

# Expand the status line for this project

The global core (`statusline.sh`, symlinked to `~/.claude/statusline.sh`) renders
fixed regions in every git repo:

```
<project> ⎇ <branch> (<wt>) │ ◆ github-links │ 🌐 service-links │ <extension status>
```

Identity, then two link regions the **core owns** (GitHub PR/issue, and services /
running code), then the extension's status. Links are full URLs — clickable even
where OSC-8 is stripped (tmux over ssh). Outside git: `[user@host dir]`.

A per-project **extension** DECLARES service links (the core places them) and
prints a status segment. This skill writes that extension. Keep the core
generic — never hard-code a project into it.

## The contract

The core runs the extension with the **status JSON on stdin** and this
environment: `CL_ROOT` (repo root / worktree), `CL_PROJECT`, `CL_WORKTREE`,
`CL_BRANCH`, `CL_SLUG` (`owner/repo`), `CL_HOST`, `CL_LIB` (path to `lib.sh`),
`CL_LINKS` (links collector). It then renders the links the extension declared
into its link regions, appends the extension's printed **status** (` │ `
separator), and runs it under a 5s timeout (errors ignored — a broken extension
can't break the bar).

So: **declare links, don't print them**; print only status to stdout.

Source `"${CL_LIB:?}"` for the toolkit:

- **Colours**: `$CL_RESET $CL_DIM $CL_BOLD $CL_GREEN $CL_CYAN $CL_PURPLE $CL_RED
  $CL_YELLOW $CL_BLUE`.
- **`cl_addlink CATEGORY URL [ICON]`** — declare a link; `CATEGORY` is `gh` or
  `svc`. The way to expose anything clickable (not inline text).
- **`cl_dur SECONDS`** — compact duration (`7380`→`2h3m`).
- **`cl_cache KEY TTL -- CMD…`** — echo `CMD`'s stdout, refreshed in the background
  past `TTL`s. **Wrap anything slow or networked** (gh, curl) so the render never
  blocks.
- **`cl_link URL TEXT`** — low-level OSC-8 link the core uses; extensions use
  `cl_addlink`.

## Where the extension lives

First match wins:

1. **`$CL_ROOT/.claude/statusline-ext.sh`** — committed. Inert without the core,
   so safe to commit; the natural home for *project* knowledge.
2. **`~/.config/claude-statusline/projects/<project>.sh`** — personal, out of git
   history, survives worktree churn (`<project>` = `CL_PROJECT`).

**Default to #1** when the segment is about the project (dev server, CI, counts,
freshness) — it travels with the repo; give it a header noting it needs the core.
Use **#2** for machine-specific or personal bits.

## Steps when invoked

1. **Clarify the data.** From the user's argument, decide exactly what to show
   and how to obtain each piece — and whether any piece is slow/networked (→
   `cl_cache`). Ask only if genuinely ambiguous.
2. **Pick the place** — registry by default; in-repo only if asked (§ above).
3. **Write the extension.** Start from the skeleton below. Source `$CL_LIB`, read
   context from `CL_*` (and stdin if needed), keep it FAST (cheap local probes
   inline; everything else through `cl_cache`). Declare clickable things with
   `cl_addlink`; `printf` only the non-link status (with `CL_*` colours) to
   stdout. `chmod +x` it.
4. **Test it directly**, then **through the core** (see Testing).
5. **Hand off**: the bar updates within its refresh tick; if not, the user opens
   `/hooks` once or restarts (the settings watcher needs a nudge to re-read).

## Skeleton

```bash
#!/usr/bin/env bash
# <project> status-line extension — shows <what>.
set -uo pipefail
. "${CL_LIB:?}"

root="${CL_ROOT:-$PWD}"

# Declare clickable things — the core renders them in its link regions:
cl_addlink svc "http://localhost:8080" "📊"     # a dashboard / running service

# Cheap local probe → inline status:
count=$(ls "$root/queue" 2>/dev/null | wc -l)

# Slow / networked → ALWAYS via cl_cache (KEY unique per repo+branch as needed):
ci=$(cl_cache "ci_${CL_SLUG}_${CL_BRANCH}" 120 -- \
       gh run list -R "$CL_SLUG" -b "$CL_BRANCH" -L1 --json conclusion -q '.[0].conclusion')

# Print only NON-LINK status to stdout:
dot=$CL_GREEN; [ "$ci" = failure ] && dot=$CL_RED
printf '%s● ci%s %squeue%s %s' "$dot" "$CL_RESET" "$CL_DIM" "$CL_RESET" "$count"
```

## Reference

Worked example bundled with this skill: [`example-ext.sh`](example-ext.sh) — counts
the toolbox's own skills, defined vs. linked live (`🧰 skills 3/3`); declares one
`svc` link. Copy it as a starting point. (It also ships live in the toolbox at
`$CL_ROOT/.claude/statusline-ext.sh`, auto-found with no `install.sh` wiring.)

Testing — how to run the extension directly and through the core:
→ [`reference/testing.md`](reference/testing.md)
