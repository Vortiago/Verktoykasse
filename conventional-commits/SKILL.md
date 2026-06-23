---
name: conventional-commits
description: Conventional Commits ruleset and the reflow workflow behind this machine's commit-msg and PR-title hooks. Use when a commit-msg or PR-title hook rejects a message, when choosing a commit type or PR-title moniker (feat / fix / feat! / …), or when a branch carries a stale breaking-change commit that must be reflowed before a squash-merge.
---

# Conventional Commits

Enforced machine-wide by two hooks that share `validate.sh`. The rules here are
the source of truth; both hooks point back here on rejection.

Squash-merge ships each PR as one commit — title = subject, PR body = body +
footer. This skill owns all of it: grammar, PR title, PR body.

## Header grammar

```
<type>[(scope)][!]: <subject>
```

- scope: optional, `[a-z0-9._-]`.
- `!` (or a `BREAKING CHANGE:` footer in the body) marks a breaking change.

## Types

| type | for | semver |
|------|-----|--------|
| `feat` | new feature | MINOR |
| `fix` | bug fix | PATCH |
| `perf` | performance improvement | PATCH |
| `refactor` | neither fixes a bug nor adds a feature | — |
| `docs` | documentation only | — |
| `test` | tests only | — |
| `build` | build system or **dependencies** | — |
| `ci` | CI config / scripts | — |
| `style` | formatting / whitespace — **not** CSS | — |
| `chore` | maintenance, nothing else fits | — |
| `revert` | reverts a prior commit | — |

Footguns: `style` ≠ visual styling; dependency bumps are `build`, not `chore`.

## Severity ladder (highest wins)

`breaking` (`!` / `BREAKING CHANGE:`) → `feat` → `fix` → other.

## PR titles (squash-merge)

The PR title is squash-merged onto `main` — it is the moniker that ships;
per-commit messages are scaffolding. The title's severity must be ≥ the highest
severity among the branch's commits. A branch with a `feat!` commit titled
`fix:` under-reports a breaking change.

## PR body

Squash-merged into the commit body. **Never empty.** Scale to the diff:

- Trivial → one line of *why*: `Bump eslint 9.1→9.2; no config change.`
- Substantial → 1–3 sentences of *why* (not a restated diff), then trailers.

Trailers, one per line:

```
Closes #N    auto-closes the issue on merge to the default branch
Refs #N      related, don't close
BREAKING CHANGE: <what + migration>    mirrors a breaking title
```

No headings, checklists, or Testing/Screenshots scaffolding. Verify `Closes`
took: `gh pr view <n> --json closingIssuesReferences` (can lag a moment).

## Reflow a stale breaking commit

When the PR-title hook flags a breaking under-report, either:

- **(a)** the change really is breaking → add `!` to the title; or
- **(b)** the breaking commit was reverted/superseded and is **not** in the net
  diff → rewrite branch history (`git rebase -i <base>`: reword / squash / drop
  the `!` commit) so none remains, then retry.

The hook cannot tell (a) from (b) — decide from the net diff.

## Enforcement

- **`commit-msg.sh`** — global git hook (`hook.conventional-commits`, git ≥ 2.54),
  validates every commit header. Allow-lists merge / revert / fixup / squash.
  Bypass: `git commit --no-verify`.
- **`pr-title-check.sh`** — Claude `PreToolUse(Bash)` hook on `gh pr create` /
  `gh pr edit` and `az repos pr create` / `az repos pr update`; title syntax and
  an empty body are hard blocks, a breaking under-report is an advisory block.
  Fails open on anything it cannot parse. (For `az`, only `--title` carries the title — `-t` is
  `--target-branch`.)

Install (registers both hooks): `./install.sh conventional-commits` → [install.sh](install.sh)
