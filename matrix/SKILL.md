---
name: matrix
description: Matrix rain for the PowerShell console, and a live view of every open Claude Code session - one lane each, coloured and paced by status, click a lane to switch to its Windows Terminal tab. Use ONLY when the user invokes /matrix.
argument-hint: "[run | install profile | remove profile]"
disable-model-invocation: true
---

# The rain

`matrix.ps1` is a Matrix-style falling code rain for the console. With
`-Sessions` it becomes a live status view: one vertical lane per open Claude Code
session, coloured and paced by that session's status.

Windows only. The session view needs Windows Terminal; `-Click` and `-ThisWindow`
also need **Show status in terminal tab** on in Claude Code.

## Run it

```powershell
.\matrix.ps1                                 # rain
.\matrix.ps1 -Sessions                       # one lane per session
.\matrix.ps1 -Sessions -ThisWindow -Click    # this window's sessions, click to switch
```

| Flag | Does |
| --- | --- |
| `-Sessions` | one lane per open session, coloured and paced by status |
| `-ThisWindow` | keep only the sessions in this Windows Terminal window |
| `-Click` | left-click a lane to raise that session's tab |
| `-IncludeBackground` | also show background and daemon sessions |
| `-Palette` | `Green` `Amber` `Cyan` `Magenta` `Mono`; ignored by `-Sessions` |
| `-Fps` `-Speed` `-Density` | 30, 1.0, 0.25 by default |
| `-Ascii` | ASCII glyphs instead of half-width katakana |
| `-Stats` | frames/sec, build time and bytes per frame on the bottom line |
| `-Seconds` | stop after N seconds |

Any key exits. Mouse activity and terminal shortcuts do not.

`Get-Help .\matrix.ps1 -Full` has the rest.

## Install a Windows Terminal profile

```powershell
.\install-terminal-profile.ps1 -WhatIf     # what it would change
.\install-terminal-profile.ps1
.\install-terminal-profile.ps1 -Remove
```

Adds one profile that opens the session view with the CRT effect on. **Open it
as a tab, not as a window** - `-ThisWindow` scopes the lanes to the window the
rain starts in, and its own window holds no sessions.

`settings.json` is backed up to `settings.json.matrix-bak` first, then rewritten
from parsed JSON, so comments and hand formatting in it do not survive.

## Files

| File | Holds |
| --- | --- |
| `matrix.ps1` | parameters, lane layout, the frame loop |
| `lib/console.ps1` | compiling tagged types, the alternate-screen escapes, the one-cell text filter |
| `lib/types.ps1` | the C#, all compiled in one call: input filter, frame simulator/encoder, window finder |
| `lib/lanes.ps1` | a lane's colours, header and layout across the width |
| `lib/palette.ps1` | colour ramps, precomputed as SGR escape strings |
| `lib/sessions.ps1` | the Claude Code session registry and its status |
| `lib/tabs.ps1` | Windows Terminal tabs, over UI Automation |

Status comes from `~/.claude/sessions/<pid>.json`, the registry each session
writes for peer discovery. Why that and not the peer pipe, why the tab match is a
guess, and why the process tree cannot say which window a session is in, are all
in [README.md](README.md).
