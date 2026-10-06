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

## Remote

The TUI half does not read a local file. It asks the server for the list through
the `list` method of the `tasklist` RPC, so the sidebar works against a remote
server. The server emits an `updated` event after each write, and the TUI
re-reads on that event. It also re-reads on `server.connected`, so a reconnect
never leaves the sidebar stale. There is no poll.

The server half must run on the same machine as the server. Install the plugin
there in the same way:

```sh
opencode plugin add 'github:Vortiago/Verktoykasse#main::path:opencode-tasklist'
```

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
- The plugin must run on the server that owns the session, because the RPC and
  the store live there.

## Licence

MIT
