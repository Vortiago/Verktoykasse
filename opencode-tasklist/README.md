# opencode-tasklist

An [OpenCode](https://opencode.ai) 2 plugin that gives the agent a persistent
task list, modelled on Claude Code's `Task*` tools.

OpenCode 1 shipped a `todowrite` tool. OpenCode 2 removed it, so a model can
lose the thread of a long build. This plugin restores a task list as four
tools, adds two behaviours that keep a model on task, and shows the list in the
TUI sidebar.

## Install

```sh
opencode plugin add 'github:Vortiago/Verktoykasse#main::path:opencode-tasklist'
```

## Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `TaskCreate` | `subject`, optional `activeForm` | the new task id |
| `TaskList` | none | every task as id, subject, status |
| `TaskUpdate` | `taskId`, optional `status`, `subject`, `activeForm` | the updated task |
| `TaskGet` | `taskId` | one task's details |

A task has an `id`, a `subject`, a `status`, and an optional `activeForm`, the
present-continuous form shown while the task runs. The statuses are `pending`,
`in_progress`, `completed`, and `deleted`. A `TaskUpdate` with
`status: "deleted"` removes the task.

## Behaviours

1. **Post-compaction injection.** The plugin injects the current list once, on
   the first model call after a compaction. It injects on no other call. The
   `compaction` session hook sets a one-shot flag, and the next `context` hook
   consumes it. This is deterministic, because both hooks run in the model call
   itself. An event subscription would race the next call.
2. **Stop-sign nudge.** When a session stops with open tasks, the plugin sends
   one user turn:

   ```text
   You have N tasks left. Here is the current state:
   #1 [in_progress] The first task
   #2 [pending] The second task
   ```

   A snapshot diff resets the reminder count on progress, and the count stops
   the reminder after two idle stops with no progress.

## Storage

The list lives in `~/.opencode/tasklist/<sessionID>.json`, next to the plan
files in `~/.opencode/plan/`. The file is pretty-printed JSON, so a person can
inspect a run without a tool. Every tool reads the file, changes it, and writes
it back, so the file is the single source of truth and survives a plugin
reload.

## Sidebar

The package also has a TUI half, exported as `./tui`. It appends one component
to the `sidebar.content` slot and shows the current session's tasks:

```text
Tasks
🔄 The first task
⬜ The second task
✅ The finished task
```

A mark shows the state: `⬜` pending, `🔄` in progress, `✅` done. A finished task
is muted. The component reads the same JSON file the tools write, so the sidebar
and the tools never disagree. It shows a muted `No tasks` line when the list is
empty. A long subject does not wrap, so each task stays on one line. Colours come
from the theme tokens, so the view fits light and dark. One constant holds the
marks. Swap them for the classic `☐ ◐ ☑` if a colour emoji panics a renderer.

The component polls the file once a second, so an update is not instant. The poll
also reads the file when nothing changed. A server event or an RPC method would be
instant, at the cost of a second path between the server and the TUI.

## Naming

The tools keep Claude Code's names and casing: `TaskCreate`, `TaskList`,
`TaskUpdate`, `TaskGet`. OpenCode preserves the casing of a plugin tool name.
A model that knows Claude Code already knows these tools.

## Limits

- The plugin cannot tell a deliberate stop from a natural one, so the nudge can
  follow a stop that a person made. The reminder count bounds this.
- The plugin does not exclude a read-only plan session. A plan session that
  records tasks can receive a nudge to finish them.
- The per-session maps are never cleared on session deletion. The leak is small.
- The sidebar reads the local file, so it works only when the TUI and the server
  share a machine. A remote server would instead need an RPC method on the
  server half.

## Licence

MIT
