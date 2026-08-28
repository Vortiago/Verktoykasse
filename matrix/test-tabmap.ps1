# Cover for the two tab-map faults behind lanes that vanished and never came back:
# a session the matcher missed once stayed missed, and an equal-scoring pair followed
# window z-order instead of the evidence.
#
#   pwsh -NoProfile -File .\test-tabmap.ps1
. (Join-Path $PSScriptRoot 'lib\tabs.ps1')

$fail = 0
function Check($name, $cond) {
    if ($cond) { "  ok   $name" } else { $script:fail++; "  FAIL $name" }
}

function Tab($hwnd, $i, $text, $busy) {
    [pscustomobject]@{ Hwnd = $hwnd; Index = $i; Text = $text; IsBusy = $busy; IsIdle = -not $busy }
}
function Ses($id, $status, $task) {
    [pscustomobject]@{ SessionId = $id; Status = $status; Task = $task; Name = ''; Cwd = '' }
}

$t1 = Tab 100 1 'alpha' $true
$t2 = Tab 100 2 'beta'  $false
$t3 = Tab 200 1 'gamma' $false
$t4 = Tab 200 2 'delta' $false      # same index as t2, other window
$a = Ses 'A' 'busy' 'alpha'
$b = Ses 'B' 'idle' 'beta'

'--- Merge-SessionTab ---'

# a fresh match wins over the previous one
$m = Merge-SessionTab -Session @($a) -Fresh @{ A = $t2 } -Previous @{ A = $t1 }
Check 'fresh match wins' ($m['A'].Index -eq 2)

# the session this pass could not match keeps its last tab
$m = Merge-SessionTab -Session @($a, $b) -Fresh @{ B = $t2 } -Previous @{ A = $t1; B = $t2 }
Check 'unmatched session keeps its last tab' ($m['A'].Index -eq 1 -and $m['B'].Index -eq 2)

# but not a tab this pass gave to someone else
$m = Merge-SessionTab -Session @($a, $b) -Fresh @{ B = $t1 } -Previous @{ A = $t1 }
Check 'a tab taken this pass is not carried' (-not $m.ContainsKey('A') -and $m['B'].Index -eq 1)

# two sessions cannot both inherit the same tab
$m = Merge-SessionTab -Session @($a, $b) -Fresh @{} -Previous @{ A = $t1; B = $t1 }
Check 'one carried tab per session' ($m.Count -eq 1)

# nothing to carry stays a miss, which is what makes the caller re-try
$m = Merge-SessionTab -Session @($a) -Fresh @{} -Previous @{}
Check 'no evidence is still a miss' ($m.Count -eq 0)

# an empty session list is not an error
$m = Merge-SessionTab -Session @() -Fresh @{} -Previous @{ A = $t1 }
Check 'no sessions, no map' ($m.Count -eq 0)

'--- Resolve-SessionTab ---'

# t2 (100:2) and t4 (200:2) score the same against C: both idle, neither shares a word.
# The tab list arrives in window z-order, which changes whenever a window is raised, so
# a sort key that is not unique lets that order pick the winner.
$c = Ses 'C' 'idle' 'nothing in common'
$seen = @{}
foreach ($order in @($t2, $t4), @($t4, $t2)) {
    $r = Resolve-SessionTab -Session @($c) -Tab $order
    $seen["$($r['C'].Hwnd):$($r['C'].Index)"] = $true
}
Check 'an equal-scoring pair does not switch tabs' ($seen.Count -eq 1)

# a tab with no Claude glyph is no candidate at all. That is why a session whose tab
# Claude has not titled yet is a miss, and why the miss has to be re-tried.
$plain = [pscustomobject]@{ Hwnd = 100; Index = 9; Text = 'PowerShell'; IsBusy = $false; IsIdle = $false }
$r = Resolve-SessionTab -Session @($a) -Tab @($plain)
Check 'an untitled tab is not matched' ($r.Count -eq 0)

# the glyph alone is enough when there is one session and one Claude tab
$r = Resolve-SessionTab -Session @($a) -Tab @($t1)
Check 'one session, one tab' ($r['A'].Index -eq 1)

# the tab the rain runs in is never matched
$r = Resolve-SessionTab -Session @($a) -Tab @($t1) -Exclude @('100:1')
Check 'the excluded tab is not matched' ($r.Count -eq 0)

if ($fail) { "`n$fail FAILED"; exit 1 } else { "`nall pass"; exit 0 }
