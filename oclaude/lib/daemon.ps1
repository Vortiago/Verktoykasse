# oclaude daemon -- probe, start and restart the ollama daemon.
# Loaded by ../oclaude.ps1.
#
# Windows and Unix (Linux and macOS) own the daemon differently.
#
# On Windows the tray application or a plain `ollama serve` owns it. The daemon reads
# its settings from whatever launched it, so those live in User-scope OLLAMA_* settings.
#
# On Unix a service manager usually owns it, under its OWN user and so with its own
# model store. `ollama serve` started by hand there is a second daemon with an empty
# store, the wrong-daemon failure Test-OllamaIdentity exists to catch. So the Unix path
# drives the service where there is one.
#
# oclaude holds no daemon settings of its own. Whatever starts the daemon supplies them,
# and this file is the only one that knows which starter that is.

function Test-OClaudeIsWindows {
    # Windows PowerShell 5.1 does not define $IsWindows. It reads as $null there and
    # would send every test down the Unix branch. 5.1 runs on Windows only, so undefined
    # IS Windows.
    if ($null -eq $IsWindows) { return $true }
    return [bool]$IsWindows
}

function Test-OllamaServer {
    param([string]$Endpoint = (Get-OClaudeConfig).Endpoint)
    # -NoProxy: loopback must not go through a corporate proxy, and skipping WPAD
    # keeps the first call in a session from blowing the timeout
    try { $null = Invoke-RestMethod -Uri "$Endpoint/api/version" -TimeoutSec 10 -NoProxy; $true }
    catch { $false }
}

function Wait-OllamaServer {
    # Returns the loop's own verdict, so the failure path does not pay another probe
    # (and another 10s timeout) to learn what the loop already knew.
    param([string]$Endpoint = (Get-OClaudeConfig).Endpoint, [int]$TimeoutSec = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-OllamaServer -Endpoint $Endpoint) { return $true }
        Start-Sleep -Milliseconds 400
    }
    return $false
}

function Get-OllamaDaemonEnv {
    # The OLLAMA_* settings for a daemon oclaude starts itself. Both the lazy start and
    # the explicit restart read this, so the two cannot disagree.
    #
    # Windows: User scope, which every starter reads. A shell opened before a change
    # holds a stale copy, so read the scope, not $env:. Unix has no second scope, so the
    # child inherits this shell. A systemd unit reads neither, and Get-OllamaServiceEnv
    # covers that.
    #
    # OLLAMA_HOST bites when missing: the daemon then binds loopback only, breaking
    # every container with no error anywhere.
    $found = [ordered]@{}
    $scope = if (Test-OClaudeIsWindows) { 'User' } else { $null }
    $names = 'OLLAMA_HOST', 'OLLAMA_KEEP_ALIVE', 'OLLAMA_MAX_LOADED_MODELS',
             'OLLAMA_CONTEXT_LENGTH', 'OLLAMA_KV_CACHE_TYPE', 'OLLAMA_FLASH_ATTENTION',
             'OLLAMA_IGPU_ENABLE', 'OLLAMA_LLM_LIBRARY', 'OLLAMA_NUM_PARALLEL'
    foreach ($v in $names) {
        $val = if ($scope) { [Environment]::GetEnvironmentVariable($v, $scope) }
               else { [Environment]::GetEnvironmentVariable($v) }
        if ($val) { $found[$v] = $val }
    }
    $found
}

function Get-OllamaServiceUnit {
    # 'system', 'user' or $null. Unix only. The answer decides how to start the daemon
    # and where its settings come from.
    if (Test-OClaudeIsWindows) { return $null }
    if (-not (Get-Command systemctl -ErrorAction SilentlyContinue)) { return $null }

    # list-unit-files, not is-active: a stopped unit is still the thing to start, and
    # is-active answers 'inactive' for an absent unit and a stopped one alike.
    if (@(systemctl list-unit-files ollama.service 2>$null) -match 'ollama\.service') {
        return 'system'
    }
    if (@(systemctl --user list-unit-files ollama.service 2>$null) -match 'ollama\.service') {
        return 'user'
    }
    return $null
}

function Get-OllamaSystemctlArgument {
    # The argument list that addresses this unit. Every systemctl call and every
    # systemctl command this file PRINTS comes through here, so a third scope means
    # editing one function.
    param([Parameter(Mandatory)][string]$Unit, [Parameter(Mandatory)][string[]]$Arguments)
    if ($Unit -eq 'user') { return @('--user') + $Arguments }
    return $Arguments
}

function Get-OllamaServiceDropInPath {
    # Where a systemd unit reads its environment. This drop-in is the Unix equivalent of
    # Windows User scope. The restart report and the help text both name it.
    param([Parameter(Mandatory)][string]$Unit)
    if ($Unit -eq 'user') { '~/.config/systemd/user/ollama.service.d/override.conf' }
    else { '/etc/systemd/system/ollama.service.d/override.conf' }
}

function Get-OllamaSettingsHint {
    # Where a changed OLLAMA_* actually takes, in one line, for the help text. It lives
    # here because this file discovers who owns the daemon. An answer written elsewhere
    # would be the less informed of the two.
    $unit = Get-OllamaServiceUnit
    if ($unit) { return ('set OLLAMA_* in {0}' -f (Get-OllamaServiceDropInPath -Unit $unit)) }
    if (Test-OClaudeIsWindows) { return 'set User-scope OLLAMA_* variables' }
    return 'export OLLAMA_* in the shell that starts the daemon'
}

function Get-OllamaServiceEnv {
    # What the service manager hands the daemon, in the same shape Get-OllamaDaemonEnv
    # returns, so one printer serves both owners.
    param([Parameter(Mandatory)][string]$Unit)
    $sc = Get-OllamaSystemctlArgument -Unit $Unit `
                                      -Arguments @('show', 'ollama', '--property=Environment')
    $shown = @(systemctl @sc 2>$null) -join ''

    $found = [ordered]@{}
    foreach ($token in @(($shown -replace '^Environment=', '') -split '\s+')) {
        $clean = $token -replace '^"|"$', ''
        if ($clean -match '^(OLLAMA_[A-Z0-9_]+)=(.*)$') { $found[$Matches[1]] = $Matches[2] }
    }
    $found
}

function Show-OllamaServiceDropIn {
    # What to do when the service passes nothing. oclaude prints it rather than applying
    # it: the drop-in needs root, so a setting written here would never take.
    param([Parameter(Mandatory)][string]$Unit)
    # sudo is a privilege decision and stays here. The scope prefix is not.
    $sc     = Get-OllamaSystemctlArgument -Unit $Unit -Arguments @('daemon-reload')
    $reload = if ($Unit -eq 'user') { 'systemctl {0}' -f ($sc -join ' ') }
              else { 'sudo systemctl {0}' -f ($sc -join ' ') }
    Write-Host '  A drop-in file is this platform''s User scope. Set them there:' -ForegroundColor DarkGray
    Write-Host ('    {0}' -f (Get-OllamaServiceDropInPath -Unit $Unit)) -ForegroundColor DarkGray
    Write-Host '      [Service]' -ForegroundColor DarkGray
    Write-Host '      Environment="OLLAMA_KEEP_ALIVE=4h"' -ForegroundColor DarkGray
    Write-Host ('    {0}, then oclaude-restart-daemon' -f $reload) -ForegroundColor DarkGray
}

function Start-OllamaProcess {
    # Spawns `ollama serve` detached. A last resort on Unix, the usual path on Windows
    # without the tray application.
    if (Test-OClaudeIsWindows) {
        Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
        return
    }
    # -WindowStyle is Windows-only, and unredirected the daemon writes its log over the
    # prompt. Two files, because Start-Process refuses one for both.
    $tmp = [System.IO.Path]::GetTempPath()
    Start-Process -FilePath 'ollama' -ArgumentList 'serve' `
        -RedirectStandardOutput (Join-Path $tmp 'oclaude-ollama-serve.out') `
        -RedirectStandardError  (Join-Path $tmp 'oclaude-ollama-serve.err') | Out-Null
}

function Start-OllamaService {
    # Starts or restarts the systemd unit. Returns $true when the command ran.
    param([Parameter(Mandatory)][string]$Unit,
          [ValidateSet('start', 'restart')][string]$Action = 'start')
    $sc = Get-OllamaSystemctlArgument -Unit $Unit -Arguments @($Action, 'ollama')

    if ($Unit -eq 'user') {
        systemctl @sc
        return ($LASTEXITCODE -eq 0)
    }
    # A system unit needs root. -n so a machine with no password rule fails at once
    # instead of waiting for a password nobody is watching for. No sudo and sudo refusing
    # are the same answer, so both land on the message below.
    if (Get-Command sudo -ErrorAction SilentlyContinue) {
        sudo -n systemctl @sc 2>$null
        if ($LASTEXITCODE -eq 0) { return $true }
    }

    Write-Host ("ollama: the daemon is a system service, so {0} needs root:" -f $Action) -ForegroundColor Red
    Write-Host ("    sudo systemctl {0} ollama" -f $Action) -ForegroundColor DarkGray
    Write-Host '  Do not run `ollama serve` instead. The service runs as its own user with' -ForegroundColor DarkYellow
    Write-Host '  its own model store, so a hand-started daemon serves an empty one.' -ForegroundColor DarkYellow
    return $false
}

function Start-OllamaServer {
    param([string]$Endpoint = (Get-OClaudeConfig).Endpoint, [int]$TimeoutSec = 30)
    if (Test-OllamaServer -Endpoint $Endpoint) { return $true }

    Write-Host 'ollama: daemon down, starting...' -ForegroundColor DarkYellow

    $unit = Get-OllamaServiceUnit
    if ($unit) {
        if (-not (Start-OllamaService -Unit $unit -Action 'start')) { return $false }
    } else {
        $spawnEnv = Get-OllamaDaemonEnv
        $saved = @{}
        foreach ($v in $spawnEnv.Keys) { $saved[$v] = [Environment]::GetEnvironmentVariable($v) }
        try {
            foreach ($v in $spawnEnv.Keys) { Set-Item "Env:$v" $spawnEnv[$v] }
            Start-OllamaProcess
        } finally {
            foreach ($v in $spawnEnv.Keys) {
                if ($null -eq $saved[$v]) { Remove-Item "Env:$v" -ErrorAction SilentlyContinue }
                else { Set-Item "Env:$v" $saved[$v] }
            }
        }
    }

    if (Wait-OllamaServer -Endpoint $Endpoint -TimeoutSec $TimeoutSec) {
        Write-Host 'ollama: up' -ForegroundColor DarkGreen
        return $true
    }
    Write-Error "ollama: did not answer on $Endpoint within ${TimeoutSec}s"
    $false
}

function Test-OllamaIdentity {
    # A health check proves SOMETHING answers on the port, not that it is YOUR daemon.
    # A second Windows profile, or a hand-started `ollama serve` beside a Unix service,
    # can grab the port: health check green, different model store, every cc-* tag gone,
    # no error anywhere. So the tags decide. A wrong-store daemon cannot fake them, and
    # they are exactly what breaks.
    param($Cfg)

    try {
        $ver = (Invoke-RestMethod -Uri "$($Cfg.Endpoint)/api/version" -TimeoutSec 10 -NoProxy).version
    } catch {
        Write-Host "  identity: cannot query the daemon -- $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    Write-Host ("  {0,-26} {1}" -f 'server version', $ver) -ForegroundColor Gray

    # An all-cloud map has nothing local to check. Saying so beats reporting a pass
    # that was never made.
    $expected = Get-OClaudeLocalModel -Cfg $Cfg
    if (-not $expected) {
        Write-Host ("  {0,-26} {1}" -f 'model store', 'no local tier, nothing to check') -ForegroundColor Gray
        return $true
    }

    # Get-OllamaModel reports each name tagged and bare, which is the question here:
    # the map spells derived tags bare. The version call above proved the daemon answers,
    # so an empty list now is a verdict rather than a transport failure.
    $have    = Get-OllamaModel -Endpoint $Cfg.Endpoint
    $missing = @($expected | Where-Object { $have -notcontains $_ })
    if (-not $missing) {
        Write-Host ("  {0,-26} {1} local tags present" -f 'model store', $expected.Count) -ForegroundColor Gray
        return $true
    }

    $port = ([uri]$Cfg.Endpoint).Port
    Write-Host ''
    Write-Host 'ollama: WRONG DAEMON ANSWERED' -ForegroundColor Red
    Write-Host ("  missing local tags: {0}" -f ($missing -join ', ')) -ForegroundColor Red
    Write-Host '  Something else holds the port and is serving its own model store.' -ForegroundColor Red
    Write-Host '  Find it, then stop it:' -ForegroundColor DarkYellow
    if (Test-OClaudeIsWindows) {
        Write-Host ('    netstat -ano | Select-String ":{0}.*LISTENING"' -f $port) -ForegroundColor DarkGray
        Write-Host '    Get-CimInstance Win32_Process -Filter "Name like ''ollama%''" |' -ForegroundColor DarkGray
        Write-Host '      Select-Object ProcessId, ExecutablePath' -ForegroundColor DarkGray
        Write-Host '    taskkill /F /PID <pid>        # from an elevated shell' -ForegroundColor DarkGray
    } else {
        Write-Host ("    ss -lptn 'sport = :{0}'" -f $port) -ForegroundColor DarkGray
        Write-Host '    ps -o pid,user,args -C ollama' -ForegroundColor DarkGray
        Write-Host '    kill <pid>                    # sudo if it belongs to another user' -ForegroundColor DarkGray
    }
    return $false
}

function oclaude-restart-daemon {
    # Restarts the daemon so a changed setting takes: a User-scope setting on Windows, a
    # unit drop-in under systemd. Aborts any in-flight `ollama pull`.
    #
    # Only the restart differs by owner. The wait, the report and the identity check are
    # shared, so a change to any of them lands once.
    [void](Test-OClaudeStale)
    $cfg     = Get-OClaudeConfig
    $unit    = Get-OllamaServiceUnit
    $viaTray = $false
    $applied = [ordered]@{}

    if ($unit) {
        # systemd owns the children through the unit's cgroup, so the llama-server
        # sweep below would only race with it.
        if (-not (Start-OllamaService -Unit $unit -Action 'restart')) { return }
    } else {
        # No service manager. The daemon sees only what its launcher held, so re-read
        # and relaunch.
        $applied = Get-OllamaDaemonEnv
        foreach ($v in $applied.Keys) { Set-Item "Env:$v" $applied[$v] }

        # llama-server runners are children the tray does not manage. Killing only the
        # parents orphans them, still holding tens of GiB and starving the scheduler.
        Get-Process -Name 'ollama app', 'ollama', 'llama-server' -ErrorAction SilentlyContinue |
            Stop-Process -Force
        Start-Sleep -Seconds 3

        $app = if (Test-OClaudeIsWindows) {
            Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama app.exe'
        } else { $null }
        $viaTray = [bool]($app -and (Test-Path $app))
        if ($viaTray) { Start-Process -FilePath $app } else { Start-OllamaProcess }
    }

    if (-not (Wait-OllamaServer -Endpoint $cfg.Endpoint -TimeoutSec 30)) {
        Write-Error 'ollama: did not come back up'
        if ($unit) {
            $sc = Get-OllamaSystemctlArgument -Unit $unit -Arguments @('status', 'ollama')
            Write-Host ('  systemctl {0}' -f ($sc -join ' ')) -ForegroundColor DarkGray
        }
        return
    }

    # One report over one shape of map, whoever supplied it.
    $settings = if ($unit) { Get-OllamaServiceEnv -Unit $unit } else { $applied }
    Write-Host ('ollama: restarted with {0}' -f
                $(if ($settings.Count) { 'these settings' } else { 'no OLLAMA_* set' })) `
        -ForegroundColor DarkGreen
    $settings.GetEnumerator() | Sort-Object Key | ForEach-Object {
        # The tray forces its own OLLAMA_CONTEXT_LENGTH, so reporting ours as applied
        # would be a lie on that path.
        $note = if ($viaTray -and $_.Key -eq 'OLLAMA_CONTEXT_LENGTH') { '   (tray overrides this)' } else { '' }
        Write-Host ("  {0,-26} {1}{2}" -f $_.Key, $_.Value, $note) -ForegroundColor Gray
    }
    if ($unit -and -not $settings.Count) { Show-OllamaServiceDropIn -Unit $unit }

    [void](Test-OllamaIdentity -Cfg $cfg)
}
