# ==================================================================================================
# LEEWAY INDUSTRIES — AOS (Agentic Operating System)
# TAG: TOOLS.POWERSHELL.PIPELINESRAG.HEALTH
# REGION: 🟠 UTIL
# DISCOVERY_PIPELINE:
#   Voice -> Intent -> Location -> Vertical -> Ranking -> Render
# --------------------------------------------------------------------------------------------------
# File: tools\PipelinesRagHealth.ps1
# Purpose:
#   Pipeline + RAG health verification (local-first):
#     - Ensures models_clean exists and JSON assets are valid (optionally auto-clean from models/)
#     - Verifies /onnx WASM reachability
#     - Runs vite build (optional) + vite preview (optional)
#     - Performs HTTP checks to ensure assets are not SPA HTML fallbacks
#     - Logs everything under tools\logs\
# --------------------------------------------------------------------------------------------------
# Run:
#   pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\PipelinesRagHealth.ps1
#   pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\PipelinesRagHealth.ps1 -NoBuild
#   pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\PipelinesRagHealth.ps1 -AutoFixModelsClean
# ==================================================================================================

[CmdletBinding()]
param(
  [string]$RepoRoot = "B:\AgenticOperatingSystem",

  # Disk folders (under public/)
  [string]$PublicDirName = "public",
  [string]$ModelsSrcDirName = "models",
  [string]$ModelsCleanDirName = "models_clean",
  [string]$OnnxDirName = "onnx",

  # Web paths (as served)
  [string]$ModelsWebPath = "/models_clean",
  [string]$OnnxWebPath = "/onnx",

  [int]$Port = 4173,
  [switch]$NoBuild,
  [switch]$NoServer,

  # If set, generate public\models_clean from public\models by extracting valid JSON bodies.
  [switch]$AutoFixModelsClean,

  [int]$HttpTimeoutMs = 8000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ToolsLogDir([string]$Root) {
  $dir = Join-Path $Root "tools\logs"
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $dir
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = Get-ToolsLogDir -Root $RepoRoot
$logPath = Join-Path $logDir ("pipelines_rag_health_{0}.log" -f $stamp)
Start-Transcript -Path $logPath -Append | Out-Null

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host ("=" * 92) -ForegroundColor DarkGray
  Write-Host $Title -ForegroundColor Cyan
  Write-Host ("=" * 92) -ForegroundColor DarkGray
}
function Write-Ok([string]$Msg)   { Write-Host ("OK   - {0}" -f $Msg) -ForegroundColor Green }
function Write-Warn([string]$Msg) { Write-Host ("WARN - {0}" -f $Msg) -ForegroundColor Yellow }
function Write-Fail([string]$Msg) { Write-Host ("FAIL - {0}" -f $Msg) -ForegroundColor Red }

function Get-NpmPath {
  $cmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Path }
  $cmd = Get-Command "npm" -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Path }
  throw "npm not found in PATH"
}

function Invoke-Npm([string[]]$CmdArguments, [string]$Label) {
  $npm = Get-NpmPath
  Write-Host ""
  Write-Host (">> {0}: {1} {2}" -f $Label, $npm, ($CmdArguments -join " ")) -ForegroundColor DarkCyan
  Push-Location $RepoRoot
  try {
    & $npm @CmdArguments
    $code = $LASTEXITCODE
    if ($code -eq 0) { Write-Ok ($Label + " succeeded"); return $true }
    Write-Fail ("{0} failed (exit {1})" -f $Label, $code); return $false
  } finally {
    Pop-Location
  }
}

function Read-Text([string]$Path) { Get-Content -LiteralPath $Path -Raw -ErrorAction Stop }

function Find-FirstJsonObjectStart([string]$Text) {
  $idx = $Text.IndexOf("{")
  if ($idx -lt 0) { return -1 }
  return $idx
}

function Test-JsonValid([string]$Text) {
  try { $null = $Text | ConvertFrom-Json -ErrorAction Stop; return $true } catch { return $false }
}

function New-DirectoryIfMissing([string]$Path) {
  if (!(Test-Path $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function Copy-File([string]$Src, [string]$Dst) {
  New-DirectoryIfMissing (Split-Path $Dst -Parent)
  Copy-Item -LiteralPath $Src -Destination $Dst -Force
}

function Sync-ModelsCleanFromModels([string]$PublicPath, [string]$ModelsSrc, [string]$ModelsClean) {
  $srcRoot   = Join-Path $PublicPath $ModelsSrc
  $cleanRoot = Join-Path $PublicPath $ModelsClean

  if (!(Test-Path $srcRoot)) { throw ("Source models folder missing: {0}" -f $srcRoot) }
  New-DirectoryIfMissing $cleanRoot

  $modelDirs = Get-ChildItem -LiteralPath $srcRoot -Directory
  foreach ($dir in $modelDirs) {
    $srcModel = $dir.FullName
    $dstModel = Join-Path $cleanRoot $dir.Name
    New-DirectoryIfMissing $dstModel

    # Copy ONNX folder as-is
    $srcOnnx = Join-Path $srcModel "onnx"
    if (Test-Path $srcOnnx) {
      Copy-Item -LiteralPath $srcOnnx -Destination (Join-Path $dstModel "onnx") -Recurse -Force
    }

    # For JSON-ish files, attempt to extract the real JSON object if headers were injected.
    $jsonFiles = @("config.json","tokenizer_config.json","special_tokens_map.json","tokenizer.json")
    foreach ($jf in $jsonFiles) {
      $srcFile = Join-Path $srcModel $jf
      if (!(Test-Path $srcFile)) { continue }

      $raw = Read-Text $srcFile
      $trim = $raw.TrimStart()

      # If already valid JSON, copy as-is
      if (Test-JsonValid $trim) {
        Copy-File $srcFile (Join-Path $dstModel $jf)
        continue
      }

      # Otherwise, try to find the first '{' and parse from there
      $i = Find-FirstJsonObjectStart $raw
      if ($i -ge 0) {
        $candidate = $raw.Substring($i).TrimStart()
        if (Test-JsonValid $candidate) {
          New-DirectoryIfMissing (Split-Path (Join-Path $dstModel $jf) -Parent)
          Set-Content -LiteralPath (Join-Path $dstModel $jf) -Value $candidate -Encoding UTF8
          Write-Warn ("Cleaned non-JSON prefix from {0}\{1}" -f $dir.Name, $jf)
          continue
        }
      }

      # If still not valid, copy original and warn (so you can inspect)
      Copy-File $srcFile (Join-Path $dstModel $jf)
      Write-Fail ("Could not auto-clean JSON for {0}\{1}. File copied as-is; it will still break pipelines." -f $dir.Name, $jf)
    }
  }
}

function Invoke-HttpGet([string]$Url) {
  $timeoutSec = [math]::Ceiling($HttpTimeoutMs / 1000)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-WebRequest -Uri $Url -TimeoutSec $timeoutSec -UseBasicParsing -ErrorAction Stop
    $sw.Stop()
    return [pscustomobject]@{ Ok=$true; Status=[int]$r.StatusCode; Ms=[int]$sw.ElapsedMilliseconds; Body=$r.Content; ContentType=($r.Headers["Content-Type"] | Select-Object -First 1) }
  } catch {
    $sw.Stop()
    return [pscustomobject]@{ Ok=$false; Status=0; Ms=[int]$sw.ElapsedMilliseconds; Err=$_.Exception.Message; Body=""; ContentType="" }
  }
}

function Assert-NotHtmlFallback([string]$Url, [string]$Label) {
  $r = Invoke-HttpGet $Url
  if (!$r.Ok) { Write-Fail ("{0} HTTP failed: {1} :: {2}" -f $Label, $Url, $r.Err); return $false }
  if ($r.Status -lt 200 -or $r.Status -ge 300) { Write-Fail ("{0} HTTP status {1}: {2}" -f $Label, $r.Status, $Url); return $false }

  $t = ([string]$r.Body).TrimStart()
  if ($t.StartsWith("<!DOCTYPE") -or $t.StartsWith("<html")) {
    Write-Fail ("{0} returned HTML fallback: {1}" -f $Label, $Url)
    return $false
  }

  Write-Ok ("{0} reachable ({1}ms): {2}" -f $Label, $r.Ms, $Url)
  return $true
}

function Start-VitePreview([int]$ListenPort) {
  $npm = Get-NpmPath
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $npm
  $argLine = "exec vite preview -- --port {0} --strictPort" -f $ListenPort
  $psi.Arguments = $argLine
  $psi.WorkingDirectory = $RepoRoot
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $null = $p.Start()
  Start-Sleep -Milliseconds 600
  return $p
}

function Stop-Proc($Proc) {
  if ($null -eq $Proc) { return }
  try {
    if (!$Proc.HasExited) {
      $Proc.Kill($true)
      $Proc.WaitForExit(4000) | Out-Null
    }
  } catch {}
}

# --------------------------------------------------------------------------------------------------
# Begin
# --------------------------------------------------------------------------------------------------
Write-Section "Pipelines + RAG Health — Context"
Write-Ok ("RepoRoot: {0}" -f $RepoRoot)
Write-Ok ("Log: {0}" -f $logPath)
Write-Ok ("ModelsWebPath: {0}" -f $ModelsWebPath)
Write-Ok ("OnnxWebPath: {0}" -f $OnnxWebPath)
Write-Ok ("Port: {0}" -f $Port)

$publicPath = Join-Path $RepoRoot $PublicDirName

Write-Section "Ensure models_clean workflow"
  if ($AutoFixModelsClean) {
  Write-Warn "AutoFixModelsClean enabled: generating public\models_clean from public\models"
  Sync-ModelsCleanFromModels -PublicPath $publicPath -ModelsSrc $ModelsSrcDirName -ModelsClean $ModelsCleanDirName
  Write-Ok "models_clean generation attempt completed"
} else {
  $cleanPath = Join-Path $publicPath $ModelsCleanDirName
  if (Test-Path $cleanPath) { Write-Ok ("Found: {0}" -f $cleanPath) }
  else { Write-Warn ("Missing: {0}. If pipelines fail due to invalid JSON, run with -AutoFixModelsClean." -f $cleanPath) }
}

Write-Section "Build (optional)"
$buildOk = $true
if ($NoBuild) { Write-Warn "Skipping build (-NoBuild)" }
else { $buildOk = Invoke-Npm -CmdArguments @("run","build") -Label "npm run build" }

Write-Section "Server (vite preview) + HTTP checks"
$serverProc = $null
$httpOk = $true
$baseHttp = ("http://localhost:{0}" -f $Port)

if ($NoServer) {
  Write-Warn "Skipping server (-NoServer). HTTP checks skipped."
} else {
  $distPath = Join-Path $RepoRoot "dist"
  if (!(Test-Path $distPath)) {
    Write-Fail ("dist missing: {0}. Run build first (or remove -NoBuild)." -f $distPath)
    $httpOk = $false
  } else {
    $serverProc = Start-VitePreview -ListenPort $Port

    # wait readiness
    $ready = $false
    for ($i=0; $i -lt 30; $i++) {
      $r = Invoke-HttpGet $baseHttp
      if ($r.Ok -and $r.Status -ge 200 -and $r.Status -lt 500) { $ready = $true; break }
      Start-Sleep -Milliseconds 300
    }
    if ($ready) { Write-Ok ("vite preview reachable: {0}" -f $baseHttp) }
    else { Write-Fail ("vite preview not reachable: {0}" -f $baseHttp); $httpOk = $false }

    # must NOT be HTML fallback
    $httpOk = (Assert-NotHtmlFallback -Url ($baseHttp + $OnnxWebPath + "/ort-wasm-simd-threaded.wasm") -Label "ONNX wasm") -and $httpOk

    $modelsToCheck = @("qwen2.5-0.5b-instruct","all-minilm-l6-v2","smolvlm-256m-instruct")
    foreach ($m in $modelsToCheck) {
      $httpOk = (Assert-NotHtmlFallback -Url ($baseHttp + $ModelsWebPath + "/" + $m + "/config.json") -Label ($m + "/config.json")) -and $httpOk
      $httpOk = (Assert-NotHtmlFallback -Url ($baseHttp + $ModelsWebPath + "/" + $m + "/tokenizer_config.json") -Label ($m + "/tokenizer_config.json")) -and $httpOk
      $httpOk = (Assert-NotHtmlFallback -Url ($baseHttp + $ModelsWebPath + "/" + $m + "/special_tokens_map.json") -Label ($m + "/special_tokens_map.json")) -and $httpOk
      $httpOk = (Assert-NotHtmlFallback -Url ($baseHttp + $ModelsWebPath + "/" + $m + "/tokenizer.json") -Label ($m + "/tokenizer.json")) -and $httpOk
    }

    # Optional: if you have a node probe script, run it
    $probe = Join-Path $RepoRoot "tools\probe_models.mjs"
    if (Test-Path $probe) {
      Write-Section "Optional: Node probe (tools\probe_models.mjs)"
      $nodeOk = $true
      try {
        Push-Location $RepoRoot
        & node $probe
        if ($LASTEXITCODE -ne 0) { $nodeOk = $false }
      } catch {
        $nodeOk = $false
      } finally {
        Pop-Location
      }
      if ($nodeOk) { Write-Ok "Node probe succeeded" } else { Write-Warn "Node probe failed/skipped (see log output)" }
    } else {
      Write-Warn "No tools\probe_models.mjs detected; skipping node probe."
    }
  }
}

Write-Section "Summary"
$allOk = $true
if (!$buildOk -and !$NoBuild) { $allOk = $false }
if (!$httpOk -and !$NoServer) { $allOk = $false }

if ($allOk) { Write-Ok "PIPELINES+RAG HEALTH: PASS" } else { Write-Fail "PIPELINES+RAG HEALTH: FAIL" }
Write-Host ""
Write-Host ("Log written to: {0}" -f $logPath) -ForegroundColor Magenta

if ($serverProc) { Stop-Proc $serverProc }
Stop-Transcript | Out-Null

if ($allOk) { exit 0 } else { exit 1 }
