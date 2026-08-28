# Shared test fixtures. Not named *.Tests.ps1, so Pester does not try to run it.

function New-TestTab ($hwnd, $index, $text, $glyph) {
    # $glyph: 'busy', 'idle', or 'none' for a tab Claude has not titled
    [pscustomobject]@{
        Hwnd = $hwnd; Index = $index; Text = $text
        IsBusy = $glyph -eq 'busy'; IsIdle = $glyph -eq 'idle'
    }
}
