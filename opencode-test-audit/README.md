# opencode-test-audit

An [OpenCode](https://opencode.ai) 2 plugin that runs
[`test-audit`](../test-audit/README.md) on the tests a change adds. It adds one
command, `/test-audit`, and one tool, `test-audit`.

The plugin is advisory. It reports a verdict for each test, and it never blocks a
run. The classifier, the corpus and the limits are in
[`../test-audit`](../test-audit/README.md).

## Install

```sh
opencode plugin add 'github:Vortiago/Verktoykasse#main::path:opencode-test-audit'
```

## Use

- Run `/test-audit`. It audits the working-tree change against the default
  branch and posts the report into the chat.
- Let the agent call the `test-audit` tool. The agent can set `base`, `head`,
  `staged` or `files` to scope the audit. The tool returns the same markdown
  report.

The plugin audits the project directory of the session
(`ctx.location.directory`). It sends its calls to the configured SystemOne
endpoint (`TEST_AUDIT_SYSTEMONE_URL`, by default a local Ollama 0.35 server) and
the configured decision model (`TEST_AUDIT_MODEL`). The core tool reads the same
variables.

The plugin imports the core `.mjs` modules from `core/`. It spawns no shell.

## The vendored core

OpenCode installs only the `path:` directory of a GitHub plugin, so the plugin
cannot import `../test-audit` at run time. `core/` holds a committed copy of
every module the audit loads. Each copy has a provenance stamp on its first
line that records the canon path, the commit and the sha256 of the canon bytes.
`../test-audit` is the canon. Do not edit `core/`. Edit the module in
`test-audit`, then re-vendor:

```sh
./sync-from-test-audit.sh            # re-vendor the changed modules
./sync-from-test-audit.sh --check    # fail on a stale or extra copy (CI runs this)
```

A new module in the core is a new line in the script's `FILES` list. To check
the copies before each commit, register the script as a local pre-commit hook:

```sh
git config --local hook.sync-from-test-audit.command "$PWD/sync-from-test-audit.sh --precommit"
git config --local hook.sync-from-test-audit.event pre-commit
```

This is the same pattern as the vanilla-web toolkit
([ADR 0001](../docs/adr/0001-vendored-toolkit-not-symlink.md),
[ADR 0005](../docs/adr/0005-vendored-copy-identified-by-content-hash.md)).

## Gate

```sh
node tools/check.mjs
```

It installs `@opencode/plugin` and runs `tsc --noEmit` over `index.ts`.

## Why the plugin does not block

OpenCode plugin hooks have no git-commit event and no deny decision, so the
plugin cannot block a commit. A blocking pre-push hook ships only after the
corpus proves the questions trustworthy. That hook will live beside the core
tool, not in this plugin.

## Licence

MIT
