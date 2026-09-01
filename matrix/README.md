# How the rain works

![One lane per session, coloured and paced by its status](demo.gif)

`matrix.ps1` runs in the alternate screen buffer: scrollback survives, any key
exits. The glyphs are half-width katakana. They render one cell wide, so the
grid stays square.

It runs on Windows and on Linux. Each platform brings its own console layer and
its own terminal backend: the Windows console API with Windows Terminal, or
termios with Konsole or tmux. The rain above them is the same code.

`Get-Help .\matrix.ps1 -Full` lists every flag. `Invoke-Pester ./tests` runs
the test suite (Pester 5 or later). CI runs it on both platforms, because a
green Windows job says nothing about code that only Linux executes.

## The Windows Terminal profile

`install-terminal-profile.ps1` adds one profile that opens the session view:

```
-Fps 60 -Stats -ThisWindow -Click
```

Windows Terminal reloads `settings.json` on save, so the profile appears in the
dropdown at once. The profile GUID derives from `-Name`: a re-run updates the
same profile, `-Remove` deletes it, `-Arguments` changes what it runs.

The CRT effect is off; `-Retro` turns it on. A re-run rewrites only what the
script owns (name, command line, icon). Everything else on the profile carries
over - colour scheme, font, opacity, the CRT effect - and the profile keeps its
place in the dropdown.

The first run copies `settings.json` to `settings.json.matrix-bak` and never
overwrites that backup. The rewrite drops comments and hand formatting; the
backup keeps them.

**Open the profile as a tab, not as a window.** `-ThisWindow` scopes the lanes
to the window the rain starts in, and a fresh window holds no Claude sessions.

## Session status

The screen splits into one vertical lane per open session. Every
lane rains the same katakana. Colour, fall rate, and a fixed header tell them
apart:

```
matrix-session-status       <- name, or folder · branch
working 6m                  <- status, and how long it has held it
Let's copy in the           <- the opening prompt, wrapped
matrix.ps1 script from D:
root. I want us to make i…
```

The name is whatever `/rename` set. A name Claude Code made up itself
(`nameSource` of `derived` or `collision`) is replaced by the folder and
branch, which say more.

A narrow lane drops rows instead of wrapping them into stubs: under 18 columns
the task goes, under 10 the name goes too.

Colour and fall rate track the status. Tune them per status in `styles.psd1`;
`.\preview-matrix.ps1` shows one lane per state to check the result
(`-Shuffle` flips states at random, to watch transitions):

| Registry `status` | Lane | Rate |
| --- | --- | --- |
| `busy` | green | fast |
| `idle` | amber, turn ended and the prompt is showing | slow |
| `waiting` | red, blocked on an answer; `waitingFor` names it | crawling |

Status comes from `~/.claude/sessions/<pid>.json`, the peer-discovery registry
every session writes - the same source `ListAgents` reads. The CLI rewrites its
record the moment a session changes state.

### A host that writes no status

Not every host does. A session started from the VS Code extension registers
itself once, at startup, and never returns: its record carries no `status` and
no `statusUpdatedAt` for the whole of its life. Read literally that is an idle
session, so every such lane sat amber whatever it was doing.

The transcript is the second witness. `~/.claude/projects/*/<sessionId>.jsonl`
is appended in real time by every host, and its newest *conversation* record
says whether the turn is over:

| Newest conversation record | Lane |
| --- | --- |
| `assistant`, not stopped on a tool | `idle` - the turn ended, the prompt is showing |
| `assistant`, `stop_reason` `tool_use` | `busy` - stopped for a tool, waiting on the result |
| `user` - a prompt, or a tool result | `busy` |
| either of those two, but the file has not grown for 90 s | `waiting` |

**Not the newest record: the newest conversation record.** Claude Code appends
bookkeeping around a turn - `last-prompt`, `ai-title`, `cost-state`,
`permission-mode`, `queue-operation`, `file-history-delta` - and nearly always
after it. Of the 82 transcripts this was first tested against, 68 end on
`last-prompt` and 2 on an assistant record. Reading the last line of the file
calls every finished session mid-turn, and 90 seconds later calls it blocked:
the bug inverted. The scan walks back to the newest record whose type is
`assistant` or `user`, and skips the rest.

Nor is `end_turn` the end marker. Only `tool_use` leaves a turn open - a
subagent transcript ends on a null `stop_reason`, and a long turn is mostly
`tool_use` records, so testing for `end_turn` alone finds almost nothing.

That last row is a guess, and the only one here. A permission prompt is written
to no file: the turn stops dead at the `tool_use` record and the transcript
stops with it, so a long silence mid-turn is the one sign there is. A tool that
honestly runs that long - a build, a slow test suite - goes red too. It is the
right way round: a working session shown red early is a nuisance, a blocked
session shown green forever is the bug the fallback exists to fix. `BlockedSeconds`
in `lib/sessions.ps1` is the threshold.

A registry that does write a status is always believed. It knows what a file
cannot, including the `waitingFor` reason the header prints. The transcript is
read only when the registry says nothing, and when it cannot answer either - no
file yet, not one complete record in the tail - the lane keeps the registry's
answer rather than being recoloured on a bad read.

The header ages a status from the write that changed it, not the newest one: a
working session appends every second or two and would otherwise read `working 0s`
for the whole turn. A session already mid-turn when the rain starts has no such
write to point at, so its first age is short and grows true from there.

The registry also names a per-session pipe, `\\.\pipe\LOCAL\cc-msg-<hash>`,
which carries the peer message protocol and its `notify_idle` subscription.
**A script cannot subscribe to it.** The receiver vets the reply address
against `verifiedPeerPid` and drops a frame whose requester has no bound inbox.
Nothing here touches the pipe.

Liveness is a PID check plus the recorded `procStart` FILETIME. The FILETIME
stops a recycled PID from resurrecting a dead session.

## This window only, and clicking a lane

```powershell
.\matrix.ps1 -ThisWindow -Click
```

`-ThisWindow` keeps only the sessions in the same terminal window as the rain.
`-Click` makes a left click on a lane switch to that session's tab. Both rest on
the same tab map. On Windows the backend is Windows Terminal over UI Automation:

| Step | How |
| --- | --- |
| Find the windows | `EnumWindows` for visible `CASCADIA_HOSTING_WINDOW_CLASS` handles |
| Find our window | the terminal in front when the rain starts |
| Find each window's tabs | UI Automation, `TabItem` descendants of that window handle |
| Read the click | `ENABLE_MOUSE_INPUT` on, QuickEdit off, then decode `MOUSE_EVENT` records |
| Switch the tab | every WT tab exposes `SelectionItemPattern`, so `Select()` raises it |
| Pick a session's tab | a guess, see below |

**Do not use the process tree on Windows Terminal.** It hosts every window in
one process, so `claude.exe <- pwsh.exe <- WindowsTerminal.exe` resolves to the
same PID for every session on the machine. Konsole is one process for every
window too, but it will name a tab's shell PID over D-Bus, which is what makes
the process tree the exact answer there and a dead end here.

Nothing identifies our own window exactly either. ConPTY leaves
`GetConsoleWindow` null, and UI Automation sees only the terminal's chrome, no
text. Naming our own tab and searching for it would be exact, but Windows
Terminal pins a hand-renamed tab and stops titling it. So the rain takes the
window in front at startup: one call, no side effects, correct whenever the
rain is started by typing in it. It is read before anything slow runs.

No API maps a console process to the tab hosting it, so a session's tab is
matched on its title. Claude Code writes that title itself: a status glyph,
then a summary of the turn.

| Glyph | Means |
| --- | --- |
| `U+25D0` `U+25D1` | working - two frames of a spinner, 960 ms apart |
| `U+2733` | not working |

The glyph is checked against the status we already have, and the rest of the
title against the session's opening prompt. The lane header names the matched
tab (`working 6m [tab 3]`), so a wrong match is visible. The number is what
Ctrl+Alt+N uses in that tab's own window; tabs are numbered per window.

`-ThisWindow` places a session in a window by its tab. A session with no
matched tab is dropped, not guessed to be ours.

QuickEdit is off while the rain runs, so that window cannot select text with
the mouse. It goes back on at exit.

Both flags need `showStatusInTerminalTab` on in Claude Code. Without it the
tabs carry no glyph and nothing matches.

### Konsole, on Linux

Konsole answers the same six questions over D-Bus, spoken straight to its Unix
socket. There is no client library and no helper binary.

| Step | How |
| --- | --- |
| Find the windows | `Introspect` on `/Windows` names one node per window |
| Find our window | `KONSOLE_DBUS_WINDOW`, set before the shell starts. Exact, not a guess |
| Find each window's tabs | `sessionList` on the window, then `processId` per session |
| Read the click | termios raw mode, SGR mouse reporting (modes 1000 and 1006) |
| Switch the tab | `setCurrentSession` on the window |
| Pick a session's tab | the tab whose process id is among the session's ancestors |

The last row is the difference that matters. Konsole names a tab's shell PID, so
the match is exact and none of the title scoring below applies. The walk goes up
from the claude PID, because claude is often not the tab shell's direct child.

Konsole cannot raise a window. `org.kde.konsole.Window` is ViewManager's whole
scriptable list and nothing in it raises or activates, so clicking a session that
lives in another Konsole window switches that window's tab where you cannot see
it. Windows Terminal has no such gap.

`showStatusInTerminalTab` is not needed here, since nothing reads the title.

Start the rain from the window you want scoped, and keep that window in front
while it starts. When `-ThisWindow` finds nothing it stops with an explanation;
a filter that silently does nothing reads as a bug.

### tmux, on Linux

tmux nests in every terminal, so it wins the backend question: a rain inside
tmux talks tmux, whether the outer terminal is Konsole, a plain xterm, or
another tmux - `$TMUX` names the innermost server, and the client reaches it on
its own. There is nothing to configure beyond that.

| Step | How |
| --- | --- |
| Find the windows | there are none; a tmux session is the scope, a window is the tab |
| Find our scope | `tmux display-message -p -t $TMUX_PANE '#{session_id}'` - exact, like `KONSOLE_DBUS_WINDOW` |
| Find every tab | one `tmux list-panes -a -F '…'`: session id, window id, window index, `pane_pid`, `pane_id` |
| Read the click | the same termios + SGR mouse path; tmux translates it both ways, coordinates pane-relative |
| Switch the tab | `tmux select-window -t @3` |
| Pick a session's tab | the pane whose `pane_pid` is among the session's ancestors - exact, no title scoring |

tmux parses every escape the rain writes - the alternate screen, the cursor, the
mouse modes - and re-encodes them for the outer terminal itself, so there is no
`allow-passthrough`, no DCS wrapper, and no tmux version floor beyond mouse
forwarding. It re-encodes mouse coordinates relative to the pane too, which is
what the grid wants: a rain in a split still lines its lanes up with its clicks.

**`set -g mouse on` in the outer tmux is required.** With it, a click's default
binding is `select-pane` followed by a pass-through, so the rain sees it. Without
it tmux never asks the outer terminal for mouse events and `-Click` silently
does nothing - tmux does not warn.

**Windows, not panes.** A click switches to the session's window; a pane
sharing the rain's own window is a no-op click, and the rain stays where it is
until a keypress leaves it. A session in another tmux *session* has that
session's current window moved where nobody can see it - Konsole's "cannot
raise" gap, one level up; `switch-client` would fix it and is deliberately out
of scope.

Sessions running over ssh inside a pane never appear: their pid is not in this
machine's `/proc`, so liveness drops them before the tab map is consulted.

Start the rain from the tmux session you want scoped. Nothing has to be in front
while it starts - `$TMUX_PANE` names our pane and the server answers for it
exactly, so unlike Windows Terminal there is no launch-time race to lose. When
`-ThisWindow` finds nothing it stops with an explanation; a filter that silently
does nothing reads as a bug.

### A match that has not caught up

A tab read costs ~100 ms (three frames), so it runs only when a session
appears, goes, or changes status. The tab always lags the registry: Claude
titles a new tab, and moves its glyph, after the registry already carries the
change. A rebuild in that gap matches nothing, so a miss is never the last
word:

- **A miss is re-tried**: at 2 s first, backing off to 30 s while the same
  sessions keep missing, until every session has a tab.
- **A session keeps its last tab** when a rebuild cannot re-match it. The old
  tab is the best evidence until a better one arrives. A fresh match always
  wins, and a tab this pass gave to someone else is never carried.

The rain's own tab needs no exclusion: the rain writes no tab title, so its
tab carries no glyph and is never a candidate.

`tests/TabMap.Tests.ps1` replays all of it: a session appearing, a session
prompted, the tabs renumbered, and the desktop refusing to be read.

## Where the code lives

```
matrix.ps1              the rain
preview-matrix.ps1      one lane per state, for checking styles.psd1
lib/
  console.ps1           the screen: escape sequences, text filtering, compilation
  stats.ps1             the -Stats overlay
  types.ps1             which C# sources this platform compiles
  palette.ps1           colours
  lanes.ps1             sessions to lanes
  sessions.ps1          Claude's session registry, and the /proc process-table readers
  terminal/
    tabmap.ps1          session to tab, over time, and the pid match both Linux
                        backends answer with. Knows no platform
    windows-terminal.ps1  the UI Automation backend
    konsole.ps1           the D-Bus backend
    tmux.ps1              the backend that runs inside tmux: a session is the scope, a window the tab
  cs/
    Renderer.cs         simulate and encode a frame
    ConsoleVT_Windows.cs, ConsoleVT_Linux.cs
    Windows.cs          window lookup, UI Automation
    DBus.cs, DBusEncode.cs, DBusDecode.cs
```

A `_Windows` or `_Linux` suffix in `cs/` means the platform picks one of them. A
file with no suffix is shared. `matrix.ps1` loads `tabmap.ps1` and exactly one
backend under it, so Windows never sources Konsole code and Linux never sources
UI Automation. A third platform adds a backend and a C# pair, nothing else.
