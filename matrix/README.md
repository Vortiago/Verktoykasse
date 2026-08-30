# How the rain works

`matrix.ps1` runs in the alternate screen buffer: scrollback survives, any key
exits. The glyphs are half-width katakana. They render one cell wide, so the
grid stays square.

`Get-Help .\matrix.ps1 -Full` lists every flag. `Invoke-Pester ./tests` runs
the test suite (Pester 5 or later).

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
`.\Preview-Matrix.ps1` shows one lane per state to check the result
(`-Shuffle` flips states at random, to watch transitions):

| Registry `status` | Lane | Rate |
| --- | --- | --- |
| `busy` | green | fast |
| `idle` | amber, turn ended and the prompt is showing | slow |
| `waiting` | red, blocked on an answer; `waitingFor` names it | crawling |

Status comes from `~/.claude/sessions/<pid>.json`, the peer-discovery registry
every session writes - the same source `ListAgents` reads. It updates the
moment a session changes state.

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

`-ThisWindow` keeps only the sessions in the same Windows Terminal window as
the rain. `-Click` makes a left click on a lane switch to that session's tab.
Both rest on the same tab map:

| Step | How |
| --- | --- |
| Find the windows | `EnumWindows` for visible `CASCADIA_HOSTING_WINDOW_CLASS` handles |
| Find our window | the terminal in front when the rain starts |
| Find each window's tabs | UI Automation, `TabItem` descendants of that window handle |
| Read the click | `ENABLE_MOUSE_INPUT` on, QuickEdit off, then decode `MOUSE_EVENT` records |
| Switch the tab | every WT tab exposes `SelectionItemPattern`, so `Select()` raises it |
| Pick a session's tab | a guess, see below |

**Do not use the process tree.** Windows Terminal hosts every window in one
process, so `claude.exe <- pwsh.exe <- WindowsTerminal.exe` resolves to the
same PID for every session on the machine.

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

Start the rain from the window you want scoped, and keep that window in front
while it starts. When `-ThisWindow` finds nothing it stops with an explanation;
a filter that silently does nothing reads as a bug.

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
