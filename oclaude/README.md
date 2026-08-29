# oclaude — Claude Code on local Ollama models

Run Claude Code against models running locally in Ollama. Requires **Ollama >= 0.32** (which serves the Anthropic Messages API natively) and **PowerShell** (Windows).

## Quick start

```powershell
# 1. Install — wires oclaude into your PowerShell profile
powershell -ExecutionPolicy Bypass -File .\install.ps1

# 2. Open a new PowerShell session, then pull the models
oclaude-pull

# 3. Run Claude Code
oclaude
```

## How it works

Ollama >= 0.32 exposes `/v1/messages`, the same endpoint Claude Code uses with the Anthropic API. oclaude points `ANTHROPIC_BASE_URL` at `http://localhost:11434`, sets `ANTHROPIC_AUTH_TOKEN=ollama`, and configures 20+ `CLAUDE_CODE_*` environment variables so Claude Code works well with local models.

## The tier system

Claude Code selects models by tier (OPUS, SONNET, HAIKU, FABLE). oclaude maps each tier to an Ollama model tag, so you get different models for different roles:

| Tier | Role | Example |
|------|------|---------|
| **OPUS** | Main session model — runs plan and execution | `qwen3.6:35b-a3b-q8_0` |
| **SONNET** | Permission classifier — gates tool calls without asking | `lfm2.5:8b-a1b-q8_0` |
| **HAIKU** | Background traffic — keeps the big model's runner free | `lfm2.5:8b-a1b-q8_0` |
| **FABLE** | Cloud tier (optional) | `nemotron-3-ultra:550b:cloud` |

### Derived tags

Each tier points at a **base model** (e.g. `qwen3.6:35b-a3b-q8_0`). oclaude builds **derived tags** (e.g. `cc-chat-35b-q8`) that pin `num_ctx` and sampling parameters on top of the base model. A derived tag is a lightweight manifest — it references the base model's existing blobs, so it costs no extra disk.

Run `oclaude-build-models` after editing the model map to rebuild derived tags. Run `oclaude-pull` to pull any missing base models first.

## Commands

| Command | Description |
|---------|-------------|
| `oclaude [args]` | Launch Claude Code (default `--model opus`). Args pass straight through: `-p`, `-c`, `--model`, ... |
| `oclaude-status` | Daemon state, per-tier model status, cloud access check, loaded models |
| `oclaude-pull` | Pull base models, then rebuild derived tags |
| `oclaude-build-models` | Recreate derived tags (`num_ctx` + sampling params) |
| `oclaude-restart-daemon` | Restart Ollama with User-scope `OLLAMA_*` env vars applied |
| `oclaude-help` | This help text; run `claude --help` for the CLI's own flags |

## Config

Edit the model map in [`lib/config.ps1`](lib/config.ps1). The file is structured as:

1. **Model map** — tier names → Ollama model tags. Edit the `From` values in `$derived` to change which model each tier uses.
2. **Derived tags** — base model + pinned `num_ctx` + sampling params. Rebuild with `oclaude-build-models`.
3. **Names** — human-readable labels shown in Claude Code's model picker.
4. **Tunables** — `KeepAlive`, `MaxLoadedModels`, `ContextLength`, `MaxContextTokens`, `AutoCompactWindow`, `StreamIdleMs`, `ToolConcurrency`, `TimeoutMs`.

The Claude Code env knobs (`MaxContextTokens`, `AutoCompactWindow`, `StreamIdleMs`, `ToolConcurrency`, `TimeoutMs`, etc.) are the most important tuning parameters. They control context limits, auto-compaction, idle timeouts, and tool concurrency — all critical for local model stability.

## Troubleshooting

### Wrong daemon answered on port 11434

If `oclaude-status` shows missing derived tags, a stale Ollama from another user profile may have grabbed the port. Run:

```powershell
netstat -ano | Select-String ":11434.*LISTENING"
Get-CimInstance Win32_Process -Filter "Name like 'ollama%'" | Select-Object ProcessId, ExecutablePath
taskkill /F /PID <pid>    # from an elevated shell
oclaude-restart-daemon
```

### Model not pulled

oclaude warns at launch if a tier's model is missing. Pull with:

```powershell
oclaude-pull
```

### Stale shell

If you edit the oclaude files while a PowerShell session has them loaded, the shell runs stale code. oclaude detects this and warns:

```
stale: this shell loaded oclaude at 14:30, but config.ps1 changed at 14:35.
       run  . $PROFILE  (or open a new tab) to pick the change up.
```

### Cloud model access denied

Cloud tiers (FABLE) resolve server-side — Ollama doesn't need them pulled. If you get a 403, the model requires a subscription or plan access. Remove it from the model map or swap in a local alternative.

### Daemon won't start

Check that Ollama is installed and the tray app (if present) isn't conflicting:

```powershell
oclaude-restart-daemon
```

## Platform

PowerShell only (Windows). Ollama itself is cross-platform, but the wrapper uses PowerShell cmdlets (`Invoke-RestMethod`, `Start-Process`, `Get-Process`, etc.) for daemon management.
