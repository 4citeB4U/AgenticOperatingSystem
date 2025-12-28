<#
.SYNOPSIS
  Run a suite of diagnostics for the Agent Lee repo and start the dev server.

.DESCRIPTION
  Runs TypeScript checks, a production build, optional PSScriptAnalyzer, ensures
  Playwright browsers are installed, optionally runs an axe accessibility audit
  (via tools/diagnostics/run-axe.mjs), and starts the dev server in the background.

  Logs are written to a timestamped directory under `tools/logs/`.
#>

param(
    [string]$Url = 'http://localhost:3000',
    [switch]$RunAxe,
    [switch]$SkipPlaywright,
    [int]$PlaywrightRetries = 3
)

Set-StrictMode -Version Latest

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$logDir = Join-Path -Path $PSScriptRoot -ChildPath ("logs/diagnostics-$ts")
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

Write-Host "Diagnostics start: $([DateTime]::Now)" -ForegroundColor Cyan

Push-Location $PSScriptRoot\..\
try {
    Write-Host "Running TypeScript check..." -ForegroundColor Yellow
    node node_modules/typescript/bin/tsc --noEmit 2>&1 | Tee-Object -FilePath (Join-Path $logDir "tsc.txt")

    Write-Host "Running production build (this may take a while)..." -ForegroundColor Yellow
    npm run build 2>&1 | Tee-Object -FilePath (Join-Path $logDir "build.txt")

    if (Get-Module -ListAvailable -Name PSScriptAnalyzer) {
        Write-Host "Running PSScriptAnalyzer..." -ForegroundColor Yellow
        Import-Module PSScriptAnalyzer -ErrorAction SilentlyContinue
        Invoke-ScriptAnalyzer -Path . -Recurse 2>&1 | Tee-Object -FilePath (Join-Path $logDir "psscriptanalyzer.txt")
    } else {
        Write-Host "PSScriptAnalyzer not available; skipping." -ForegroundColor DarkYellow
    }

    if ($SkipPlaywright) {
        Write-Host "Skipping Playwright browser install (requested)." -ForegroundColor DarkYellow
    } else {
        Write-Host "Ensuring Playwright browsers are installed..." -ForegroundColor Yellow
        $success = $false
        $lastErr = $null
        for ($i = 1; $i -le $PlaywrightRetries; $i++) {
            Write-Host "Playwright install attempt $i of $PlaywrightRetries..." -ForegroundColor Yellow
            try {
                if ($IsWindows) {
                    $out = cmd /c "npx playwright install" 2>&1
                } else {
                    $out = npx playwright install 2>&1
                }
                $out | Tee-Object -FilePath (Join-Path $logDir ("playwright-install-attempt-$i.txt"))
                $success = $true
                break
            } catch {
                $lastErr = $_
                Write-Host "Playwright install attempt $i failed." -ForegroundColor DarkYellow
                Start-Sleep -Seconds (5 * $i)
            }
        }
        if (-not $success) {
            Write-Host "Playwright browsers install failed after $PlaywrightRetries attempts. Continuing without browsers. See logs for details." -ForegroundColor Red
            if ($lastErr) { $lastErr | Out-File (Join-Path $logDir "playwright-install-error.txt") }
        }
    }

    Write-Host "Starting dev server (npm run dev) in background..." -ForegroundColor Yellow
    $devProc = Start-Process -FilePath "npm" -ArgumentList "run","dev" -PassThru
    Start-Sleep -Seconds 4

    if ($RunAxe) {
        Write-Host "Running axe accessibility audit against $Url..." -ForegroundColor Yellow
        try {
            $axeOutput = node tools/diagnostics/run-axe.mjs $Url 2>&1
            $axeOutput | Tee-Object -FilePath (Join-Path $logDir "axe.json")
        } catch {
            $_ | Out-File (Join-Path $logDir "axe-error.txt")
        }
    }

    Write-Host "Diagnostics finished. Logs: $logDir" -ForegroundColor Green
    if ($devProc) { Write-Host "Dev server PID: $($devProc.Id)" -ForegroundColor Green }
} finally {
    Pop-Location
}

exit 0
