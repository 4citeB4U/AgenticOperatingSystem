$i=1
Get-Content 'A:\AgenticOperatingSystem\leeway-agentic-smoke-dashboard.ps1' | ForEach-Object {
    Write-Host ("{0,4}: {1}" -f $i, $_)
    $i++
}