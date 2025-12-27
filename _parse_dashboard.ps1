$path = 'A:\AgenticOperatingSystem\leeway-agentic-smoke-dashboard.ps1'
[ref]$tokens = $null
[ref]$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
if ($errors -and $errors.Count -gt 0) {
    foreach ($e in $errors) {
        Write-Host "ERROR: $($e.Message) at $($e.Extent.StartLineNumber):$($e.Extent.StartColumn)"
    }
    exit 1
} else { Write-Host 'PARSE_OK' }
