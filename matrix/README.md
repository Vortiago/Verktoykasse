# How the rain works

`matrix.ps1` runs in the alternate screen buffer, so scrollback survives, and
exits on any key. The glyphs are half-width katakana, which render one cell wide
so the grid stays square.

[SKILL.md](SKILL.md) is how to run it and what each flag does. This file is what
sits behind them.

## The Windows Terminal profile

`install-terminal-profile.ps1` adds one profile that opens the session view:

```
-Fps 60 -Stats -Sessions -ThisWindow -Click
```

It appears in the dropdown at once, because Windows Terminal reloads
`settings.json` as it is saved. The profile GUID is derived from `-Name`, so
running it again updates that profile instead of adding another, and `-Remove`
takes it out. `-Arguments` changes what it runs.

The CRT effect is off unless `-Retro` asks for it. On a re-run the script
rewrites only what it owns (name, command line, icon) and carries everything
else on the profile over from the existing entry - colour scheme, font,
opacity, the CRT effect - so what you set in Windows Terminal's own settings
survives, and the profile keeps its place in the dropdown.

`settings.json` is copied to `settings.json.matrix-bak` first, then rewritten
from parsed JSON. Comments and hand formatting in it do not survive that; the
backup does. It is written once and never overwritten, so a second run cannot
replace the hand-written original with the copy this script already rewrote.

**Open it as a tab, not as a window.** `-ThisWindow` scopes the lanes to the
window the rain starts in. Its own window holds no Claude sessions, so it would
correctly report that there are none.

## Session status

`-Sessions` splits the screen into one vertical lane per open session. Every
lane rains the same katakana; what tells them apart is colour, fall rate, and a
fixed header:

```
matrix-session-status       <- name, or folder · branch
working 6m                  <- status, and how long it has held it
Let's copy in the           <- the opening prompt, wrapped
matrix.ps1 script from D:
root. I want us to make i…
```

The name is whatever `/rename` set. Claude Code omits `nameSource` for those and
writes `derived` for the ones it made up itself (`matrix-session-status-9a`),
which say less than the folder and branch do, so those are replaced.

A narrow lane drops rows rather than wrapping them into stubs: under 18 columns
the task goes, under 10 the name goes too.

Colour and fall rate track the status:

| Registry `status` | Lane | Rate |
| --- | --- | --- |
| `busy` | green | fast |
| `idle` | amber, turn ended and the prompt is showing | slow |
| `waiting` | red, blocked on an answer; `waitingFor` names it | crawling |

Status comes from `~/.claude/sessions/<pid>.json`, the registry each session
writes for peer discovery. That is the same source `ListAgents` reads, and it
updates the moment a session changes state.

The registry also names a per-session pipe, `\\.\pipe\LOCAL\cc-msg-<hash>`,
which carries the peer message protocol and its `notify_idle` subscription.
**A script cannot subscribe to it.** The receiver vets the reply address
against `verifiedPeerPid` and its own socket namespace, and drops a frame whose
requester has no bound inbox of its own, so only a registered session can ask
to be told. Nothing here touches the pipe.

Liveness is a PID check plus the recorded `procStart` FILETIME, which is what
stops a recycled PID from resurrecting a dead session.

## This window only, and clicking a lane

```powershell
.\matrix.ps1 -Sessions -ThisWindow -Click
```

`-ThisWindow` keeps only the sessions running in the same Windows Terminal
window as the rain. `-Click` makes a left click on a lane switch to that
session's tab. Both rest on the same tab map:

| Step | How |
| --- | --- |
| Find the windows | `EnumWindows` for visible `CASCADIA_HOSTING_WINDOW_CLASS` handles |
| Find our window | the terminal in front when the rain starts |
| Find each window's tabs | UI Automation, `TabItem` descendants of that window handle |
| Read the click | `ENABLE_MOUSE_INPUT` on, QuickEdit off, then decode `MOUSE_EVENT` records |
| Switch the tab | every WT tab exposes `SelectionItemPattern`, so `Select()` raises it |
| Pick a session's tab | a guess, see below |

**Do not try to do this from the process tree.** Windows Terminal hosts every
window in a single process, so all of them share one `WindowsTerminal.exe` and
`claude.exe <- pwsh.exe <- WindowsTerminal.exe` resolves to the same PID for
every session on the machine.

Nothing exact identifies our own window either: ConPTY leaves `GetConsoleWindow`
null, and the terminal exposes only its chrome to UI Automation, no text to
search. Naming our own tab and looking for that name *is* exact, and was tried,
but Windows Terminal pins a tab renamed by hand and ignores it - and it
overwrites the tab title of everyone whose tab is not pinned. The window in
front is one call, has no side effects, and is right whenever the rain is
started by typing in it, so that is what is used. Read at startup, before
anything slow.

Nothing maps a console process to the tab hosting it, so a session's tab is
matched on its title. Claude Code writes that title itself: a status glyph, then
a summary of the turn.

| Glyph | Means |
| --- | --- |
| `U+25D0` `U+25D1` | working - two frames of a spinner, 960 ms apart |
| `U+2733` | not working |

The glyph is checked against the status we already have, and the rest of the
title against the session's opening prompt. The lane header names the tab it
would open (`working 6m [tab 3]`), so a wrong match is visible rather than
silent, and the number is the one Ctrl+Alt+N uses in that session's window -
tabs are numbered per window, so for a session in another window the number
only means something once you are there.

Because a session is placed in a window by its tab, `-ThisWindow` drops a
session whose tab it cannot match, rather than guessing that it is ours.

QuickEdit goes back on at exit. While the rain runs, that window cannot select
text with the mouse.

Both need `showStatusInTerminalTab` on in Claude Code, or the tabs carry no
glyph and nothing matches.

So start the rain from the window you want scoped, and leave that window in
front while it starts. `-ThisWindow` stops with an explanation rather than
quietly showing every session, because a filter that silently does nothing reads
as a bug.

### A match that has not caught up

The tab read costs ~100 ms, more than three frames, so it runs only when a
session appears, goes, or changes status. That cadence alone is wrong, because
the tab is always behind the registry: Claude titles a new tab, and moves its
glyph from one turn to the next, after the registry already says the session is
there or busy. A rebuild that lands in that gap matches nothing.

So a rebuild that misses a session is never the last word:

- **The miss is re-tried**, starting at 2 s and backing off to 30 s while the
  same sessions keep missing, until every session has a tab. Latching it
  instead is what made a new session invisible until its status happened to
  change, which for a session nobody has prompted yet is never.
- **A session keeps its last tab** when a rebuild cannot re-match it. The old tab
  is the best evidence there is until a better one arrives, and dropping it made
  a lane vanish the moment its session was prompted. A fresh match always wins,
  and a tab this pass gave to someone else is never carried.

A second fault worked the other way. The rain used to memorise its own tab, as
`window:index`, and refuse to match any session to it. But an index is not an
identity: close a tab and every index to its right shifts down, so the memorised
one came to name a real session's tab, and `-ThisWindow` hid that session for the
rest of the run. Nothing is memorised now, and nothing needs to be: the rain
writes no tab title, so its tab carries no Claude glyph and was never a candidate.

`tests/TabMap.Tests.ps1` replays all of it: a session appearing, a session
prompted, the tabs renumbered, and the desktop refusing to be read.
