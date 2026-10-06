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

The plugin imports the core `.mjs` modules from `../test-audit`. It spawns no
shell.

## Why the plugin does not block

OpenCode plugin hooks have no git-commit event and no deny decision, so the
plugin cannot block a commit. A blocking pre-push hook ships only after the
corpus proves the questions trustworthy. That hook will live beside the core
tool, not in this plugin.

## Licence

MIT
