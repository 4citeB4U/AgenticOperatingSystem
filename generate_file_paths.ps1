<#
    This PowerShell script enumerates all files under a given root directory
    (default: B:\AgenticOperatingSystem) and writes their full paths to a
    log file in the root directory.  It skips any files inside `node_modules`
    and `dist` subdirectories.  Run it from PowerShell using:

        .\generate_file_paths.ps1 -RootPath "B:\AgenticOperatingSystem"

    The results will be saved to `file_paths.log` in the same root directory.
#>

param(
    [string]$RootPath = "B:\AgenticOperatingSystem"
)

$LogFile = Join-Path $RootPath "file_paths.log"

# Remove any existing log file so we start fresh
if (Test-Path $LogFile) {
    Remove-Item $LogFile -Force
}

# Recursively find all files, excluding node_modules and dist directories
Get-ChildItem -Path $RootPath -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\dist\\'
    } |
    ForEach-Object {
        $_.FullName | Out-File -FilePath $LogFile -Encoding UTF8 -Append
    }

Write-Host "✓ File paths written to $LogFile"