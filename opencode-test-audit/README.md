# opencode-test-audit

An [OpenCode](https://opencode.ai) 2 plugin that runs
[`test-audit`](../test-audit/README.md) on the tests a change adds. It adds one
command, `/test-audit`, and one tool, `test-audit`.

The plugin is advisory. It reports a per-test verdict and it never blocks a run.
The classifier, the corpus, and the honest limits live in `../test-audit`.

## Install

```sh
opencode plugin add 'github:Vortiago/Verktoykasse#main::path:opencode-test-audit'
```

## Use

- Run `/test-audit`. It audits the working-tree change against the default
  branch and posts the report into the chat.
- Let the agent call the `test-audit` tool with `base`, `head`, `staged`, or
  `files` to scope the audit. The tool returns the same markdown report.

The command audits the session's project directory (`ctx.location.directory`).
Calls go to the in-house SystemOne endpoint on Koishi, the same one
`searx-researcher` uses. Set `TEST_AUDIT_ARBITER_URL` to point elsewhere.

## Why advisory

There is no git-commit event and no deny decision on plugin hooks, so this
plugin cannot block a commit. That is the honest shape for v1: the corpus must
prove the questions trustworthy before a blocking pre-push hook is worth wiring.
Once it holds, the hook ships beside the tool, not in this plugin.

## Layout

```
index.ts        the command and the tool
tools/check.mjs the gate command (npm install + tsc --noEmit)
```

It imports the core `.mjs` modules from `../test-audit` directly and spawns no
shell.

## Licence

MIT
