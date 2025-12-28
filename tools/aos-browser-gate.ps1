<# ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: AOS-BROWSER-GATE
TAG: TOOLS.CI.AOS_BROWSER_GATE.MAIN
REGION: 🟠 UTIL
VERSION: 1.0.0
===============================================================================
DISCOVERY_PIPELINE:
  MODEL: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
  ROLE: verifier
  INTENT_SCOPE: repo.browser-readiness.gate
  LOCATION_DEP: local
  VERTICALS: ai, ui, data
  RENDER_SURFACE: cli
  SPEC_REF: LEEWAY.v12.DiscoveryArchitecture
===============================================================================
AOS Agent Browser Gate (Single Script)

Checks:
- Workspace validation: top-level files, public/, src/, ORT wasm/mjs, models
- Build + dist verification
- Vite preview HEAD checks (WASM/MJS content-types)
- Browser smoke tests via Playwright + Chromium + WebGPU:
  - Qwen: 3 short generations
  - SmolLM: 3 short generations
  - MiniLM embeddings: similarity sanity
  - ViT: simple classification run
  - Stable Diffusion: tokenizer dry-run (3 prompts)
- LEEWAY scan: HEADER + TAG + REGION + DISCOVERY_PIPELINE (excludes model assets/caches)
- Outputs logs + JSON + Markdown reports
===============================================================================
Usage:
  pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\aos-browser-gate.ps1 -Root "B:\AgenticOperatingSystem"
============================================================================ #>

[CmdletBinding()]
param(
  [string]$Root = "B:\AgenticOperatingSystem",
  [int]$DevPort = 5173,
  [int]$PreviewPort = 4173,
  [switch]$SkipBuild = $false,
  [switch]$SkipPreview = $false,
  [switch]$SkipBrowserSmoke = $false,
  [switch]$SkipLeeway = $false,
  [bool]$AutoInstallDeps = $true,
  [switch]$Headless = $false,
  [switch]$KeepHarness = $false,
  [bool]$AutoFixLeeway = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ----------------------------
# LEEWAY detection rules
# ----------------------------
$LEEWAY_TAG_REGEX    = [regex]'TAG:\s*([A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9_]+\.[A-Z0-9_]+)'
$LEEWAY_REGION_REGEX = [regex]'REGION:\s*(🔵 UI|🧠 AI|💾 DATA|🟢 CORE|🟣 MCP|🔴 SEO|🟠 UTIL)'
$LEEWAY_HAS_HEADER   = [regex]'LEEWAY HEADER'
$LEEWAY_HAS_DP       = [regex]'DISCOVERY_PIPELINE'

# Exclusions: NEVER enforce LEEWAY headers in downloaded model assets / caches
$LEEWAY_EXCLUDE_REGEX = [regex]'\\(public\\models|public\\onnx|\.cache\\huggingface|node_modules|dist|coverage|\.git|__aos_smoke__)\\'

# ----------------------------
# Assets required
# ----------------------------
$MODEL_IDS = @(
  "onnx-community/Qwen2.5-0.5B-Instruct",
  "HuggingFaceTB/SmolLM-135M-Instruct",
  "Xenova/all-MiniLM-L6-v2",
  "onnx-community/stable-diffusion-v1-5",
  "Xenova/vit-tiny-patch16-224"
)

function Get-ModelDirCandidates([string]$id) {
  # Preferred: nested dirs matching model id (onnx-community/Qwen...).
  # Accepted legacy: slashes replaced with underscore (onnx-community_Qwen...).
  $a = $id
  $b = ($id -replace '/', '_')
  return @($a, $b)
}

$MODEL_MIN_FILES = @(
  @{
    id  = "onnx-community/Qwen2.5-0.5B-Instruct"
    rel = @("config.json","tokenizer.json")
  },
  @{
    id  = "HuggingFaceTB/SmolLM-135M-Instruct"
    rel = @("config.json","tokenizer.json")
  },
  @{
    id  = "Xenova/all-MiniLM-L6-v2"
    rel = @("config.json","tokenizer.json")
  },
  @{
    id  = "Xenova/vit-tiny-patch16-224"
    rel = @("config.json","preprocessor_config.json")
  },
  @{
    id  = "onnx-community/stable-diffusion-v1-5"
    # This is intentionally minimal for a tokenizer dry-run.
    # Your local layout must contain the tokenizer vocab / merges OR tokenizer.json depending on the export.
    rel = @(
      "tokenizer/vocab.json",
      "tokenizer/merges.txt"
    )
  }
)

$ORT_REQUIRED = @(
  "ort-wasm.wasm",
  "ort-wasm-simd.wasm",
  "ort-wasm-threaded.wasm",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs"
)

# ----------------------------
# Logging + scoring
# ----------------------------
function New-LogDir([string]$root) {
  $logs = Join-Path $root "tools\logs"
  New-Item -ItemType Directory -Path $logs -Force | Out-Null
  $stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
  $dir = Join-Path $logs ("aos-browser-gate-" + $stamp)
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  return $dir
}

$LogDir = New-LogDir $Root
$Transcript = Join-Path $LogDir "transcript.txt"
Start-Transcript -Path $Transcript -Append | Out-Null

$ResultList = New-Object System.Collections.Generic.List[object]
$Score = 100.0

function Add-Result([string]$Level, [string]$Code, [string]$Message, [double]$Penalty = 0) {
  $global:ResultList.Add([pscustomobject]@{ level=$Level; code=$Code; message=$Message; penalty=$Penalty })
  if ($Penalty -gt 0) { $global:Score = [math]::Max(0, $global:Score - $Penalty) }
  switch ($Level) {
    "PASS" { Write-Host ("[PASS] {0} :: {1}" -f $Code, $Message) -ForegroundColor Green }
    "WARN" { Write-Host ("[WARN] {0} :: {1}" -f $Code, $Message) -ForegroundColor Yellow }
    "FAIL" { Write-Host ("[FAIL] {0} :: {1}" -f $Code, $Message) -ForegroundColor Red }
    default { Write-Host ("[{0}] {1} :: {2}" -f $Level, $Code, $Message) }
  }
}

function Test-ReportPath([string]$Path, [string]$Code, [double]$PenaltyIfMissing = 5) {
  if (Test-Path -LiteralPath $Path) { Add-Result "PASS" $Code $Path; return $true }
  Add-Result "FAIL" $Code ("Missing: " + $Path) $PenaltyIfMissing
  return $false
}

function Read-TextSafe([string]$Path) {
  try { return Get-Content -LiteralPath $Path -Raw -ErrorAction Stop } catch { return "" }
}

function Invoke-Cmd([string]$Exe, [string[]]$CmdArgs, [string]$Code, [double]$PenaltyIfFail = 10) {
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.WorkingDirectory = $Root
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow  = $true

  if ($IsWindows) {
    $psi.FileName = $env:ComSpec
    $psi.ArgumentList.Add('/c') | Out-Null
    $psi.ArgumentList.Add($Exe) | Out-Null
    foreach ($a in $CmdArgs) { $psi.ArgumentList.Add($a) | Out-Null }
  } else {
    $psi.FileName = $Exe
    foreach ($a in $CmdArgs) { $psi.ArgumentList.Add($a) | Out-Null }
  }

  $p = [System.Diagnostics.Process]::new()
  $p.StartInfo = $psi
  [void]$p.Start()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()

  $outPath = Join-Path $LogDir ("cmd-" + $Code.ToLower() + ".log")
  ($stdout + "`n" + $stderr) | Out-File -FilePath $outPath -Encoding UTF8

  if ($p.ExitCode -ne 0) {
    Add-Result "FAIL" $Code ("ExitCode={0}. Log: {1}" -f $p.ExitCode, $outPath) $PenaltyIfFail
    return @{ ok=$false; code=$p.ExitCode; log=$outPath }
  }
  Add-Result "PASS" $Code ("OK. Log: {0}" -f $outPath)
  return @{ ok=$true; code=0; log=$outPath }
}

function Find-In-Repo([string]$needle, [string[]]$roots) {
  $hits = New-Object System.Collections.Generic.List[string]
  foreach ($r in $roots) {
    if (-not (Test-Path -LiteralPath $r)) { continue }
    Get-ChildItem -LiteralPath $r -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch $LEEWAY_EXCLUDE_REGEX } |
      ForEach-Object {
        $t = Read-TextSafe $_.FullName
        if ($t -and $t.Contains($needle)) { $hits.Add($_.FullName) }
      }
  }
  return @($hits)
}

function Get-ExtRegion([string]$path) {
  $p = $path.ToLowerInvariant()
  if ($p -match '\\src\\' -and $p -match '\\ui\\') { return "🔵 UI" }
  if ($p -match '\\src\\' -and $p -match '\\data\\') { return "💾 DATA" }
  if ($p -match '\\src\\' -and $p -match '\\ai\\') { return "🧠 AI" }
  if ($p -match '\\tools\\') { return "🟠 UTIL" }
  return "🟢 CORE"
}

function Get-InferredTag([string]$path) {
  $p = $path.ToLowerInvariant()
  if ($p -match '\\src\\.*\\components\\([^\\]+)') { return ("UI.COMPONENT.{0}.MAIN" -f ($Matches[1].ToUpperInvariant() -replace '[^A-Z0-9_]+','_')) }
  if ($p -match '\\src\\.*\\pages\\([^\\]+)') { return ("UI.PUBLIC.PAGE.{0}" -f ($Matches[1].ToUpperInvariant() -replace '[^A-Z0-9_]+','_')) }
  if ($p -match '\\src\\.*\\(model|models)\\') { return "AI.ORCHESTRATION.MODEL.LOADER" }
  if ($p -match '\\src\\.*\\(store|stores|db|indexeddb)\\') { return "DATA.LOCAL.STORE.MAIN" }
  if ($p -match '\\tools\\.*\\([^\\]+)\.ps1$') { return ("TOOLS.CI.{0}.MAIN" -f ($Matches[1].ToUpperInvariant() -replace '[^A-Z0-9_]+','_')) }
  return "CORE.SYSTEM.ASSET.MAIN"
}

function Add-LeewayHeader([string]$filePath, [string]$tag, [string]$region) {
  $t = Read-TextSafe $filePath
  if ($t -match $LEEWAY_HAS_HEADER -and $t -match $LEEWAY_HAS_DP) { return $true }
  $dp = @"
DISCOVERY_PIPELINE:
  MODEL: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
  ROLE: implementer
  INTENT_SCOPE: local.file.standardization
  LOCATION_DEP: local
  VERTICALS: ai, ui, data
  RENDER_SURFACE: code
  SPEC_REF: LEEWAY.v12.DiscoveryArchitecture
"@
  $hdr = @"
<# ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: AUTO-FIX
TAG: $tag
REGION: $region
VERSION: 0.1.0
===============================================================================
$dp
============================================================================ #>

"@
  try {
    Set-Content -LiteralPath $filePath -Value ($hdr + $t) -Encoding UTF8
    return $true
  } catch {
    return $false
  }
}

# ----------------------------
# Start checks
# ----------------------------
Add-Result "PASS" "ROOT" ("Root = {0}" -f $Root)
if (-not (Test-Path -LiteralPath $Root)) {
  Add-Result "FAIL" "ROOT_EXISTS" "Root path not found" 100
  Stop-Transcript | Out-Null
  exit 1
}

$pkgJson   = Join-Path $Root "package.json"
$indexHtml = Join-Path $Root "index.html"
$srcDir    = Join-Path $Root "src"
$publicDir = Join-Path $Root "public"
$toolsDir  = Join-Path $Root "tools"
$distDir   = Join-Path $Root "dist"
$onnxDir   = Join-Path $publicDir "onnx"
$modelsDir = Join-Path $publicDir "models"

Test-ReportPath $pkgJson   "PKG_JSON"   20 | Out-Null
Test-ReportPath $srcDir    "SRC_DIR"    20 | Out-Null
Test-ReportPath $publicDir "PUBLIC_DIR" 15 | Out-Null
if (Test-Path -LiteralPath $indexHtml) { Add-Result "PASS" "TOP_INDEX_HTML" $indexHtml } else { Add-Result "WARN" "TOP_INDEX_HTML" "index.html not found at root (may be ok)" 2 }

$viteTs = Join-Path $Root "vite.config.ts"
$viteJs = Join-Path $Root "vite.config.js"
if ((Test-Path -LiteralPath $viteTs) -or (Test-Path -LiteralPath $viteJs)) { Add-Result "PASS" "VITE_CONFIG" "vite.config present" }
else { Add-Result "FAIL" "VITE_CONFIG" "Missing vite.config.(ts|js)" 10 }

# Inventory
$InventoryPath = Join-Path $LogDir "file-inventory.txt"
Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\dist\\' } |
  Select-Object -ExpandProperty FullName |
  Sort-Object |
  Out-File -FilePath $InventoryPath -Encoding UTF8
Add-Result "PASS" "INVENTORY" ("Wrote inventory: {0}" -f $InventoryPath)

# ORT assets
if (Test-Path -LiteralPath $onnxDir) {
  foreach ($f in $ORT_REQUIRED) {
    $p = Join-Path $onnxDir $f
    Test-ReportPath $p ("ORT_" + ($f.ToUpper().Replace(".","_"))) 5 | Out-Null
  }
} else {
  Add-Result "FAIL" "ONNX_DIR" "public/onnx missing" 25
}

# Model files (supports nested or underscore folder style)
if (Test-Path -LiteralPath $modelsDir) {
  foreach ($m in $MODEL_MIN_FILES) {
    $id = [string]$m.id
    $rels = [string[]]$m.rel
    $cands = Get-ModelDirCandidates $id
    $foundAll = $false
    $missing = @()

    foreach ($cand in $cands) {
      $ok = $true
      foreach ($rel in $rels) {
        $p = Join-Path (Join-Path $modelsDir $cand) $rel
        if (-not (Test-Path -LiteralPath $p)) { $ok = $false }
      }
      if ($ok) { $foundAll = $true; break }
    }

    if ($foundAll) {
      Add-Result "PASS" ("MODEL_FILES_" + ($id -replace '[^A-Za-z0-9]+','_')) $id
    } else {
      $missing = @()
      foreach ($cand in $cands) {
        foreach ($rel in $rels) {
          $p = Join-Path (Join-Path $modelsDir $cand) $rel
          if (-not (Test-Path -LiteralPath $p)) { $missing += ($cand + "/" + $rel) }
        }
      }
      Add-Result "FAIL" ("MODEL_FILES_" + ($id -replace '[^A-Za-z0-9]+','_')) ("Missing (checked nested+underscore): " + ($missing | Select-Object -First 12 -Unique -join ", ")) 15
    }
  }
} else {
  Add-Result "FAIL" "MODELS_DIR" "public/models missing" 30
}

# Model ids referenced in repo (helps catch "models exist but code never references them")
$searchRoots = @($srcDir, (Join-Path $Root "services"), (Join-Path $Root "tools")) | Where-Object { Test-Path -LiteralPath $_ }
foreach ($id in $MODEL_IDS) {
  $hits = @(Find-In-Repo $id $searchRoots)
  if ($hits.Count -gt 0) {
    $hitPath = Join-Path $LogDir ("registry-hit-" + ($id -replace '[^A-Za-z0-9]+','_') + ".txt")
    $hits | Out-File -FilePath $hitPath -Encoding UTF8
    Add-Result "PASS" ("MODEL_REGISTERED_" + ($id -replace '[^A-Za-z0-9]+','_')) ("Referenced in source (see {0})" -f $hitPath)
  } else {
    Add-Result "FAIL" ("MODEL_REGISTERED_" + ($id -replace '[^A-Za-z0-9]+','_')) "Model id not referenced in src/services/tools" 10
  }
}

# Absolute Windows paths in src (breaks portability)
$absHits = @()
Get-ChildItem -LiteralPath $srcDir -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match '\.(ts|tsx|js|jsx|html|css|md)$' } |
  ForEach-Object {
    $t = Read-TextSafe $_.FullName
    if ($t -match '(?<!\\)\b[A-Z]:\\') { $absHits += $_.FullName }
  }

if ($absHits.Count -gt 0) {
  $p = Join-Path $LogDir "absolute-paths-found.txt"
  $absHits | Sort-Object | Out-File $p -Encoding UTF8
  Add-Result "FAIL" "ABSOLUTE_PATHS" ("Windows absolute paths found in src. List: {0}" -f $p) 10
} else {
  Add-Result "PASS" "ABSOLUTE_PATHS" "No Windows absolute paths detected in src"
}

# Node/npm presence
try { $nodeV = (& node -v) 2>$null; Add-Result "PASS" "NODE" $nodeV.Trim() } catch { Add-Result "FAIL" "NODE" "Node not found in PATH" 40 }
try { $npmV  = (& npm -v) 2>$null; Add-Result "PASS" "NPM"  $npmV.Trim() } catch { Add-Result "FAIL" "NPM" "npm not found in PATH" 40 }

# deps + playwright
$nodeModules = Join-Path $Root "node_modules"
if (-not (Test-Path -LiteralPath $nodeModules)) {
  if ($AutoInstallDeps) {
    Add-Result "WARN" "DEPS" "node_modules missing; running npm install" 0
    Invoke-Cmd "npm" @("install") "NPM_INSTALL" 20 | Out-Null
  } else {
    Add-Result "FAIL" "DEPS" "node_modules missing; run npm install" 20
  }
} else {
  Add-Result "PASS" "DEPS" "node_modules present"
}

$playOk = $false
try {
  $r = Invoke-Cmd "node" @("-e","""require.resolve('playwright'); console.log('ok')""") "PLAYWRIGHT_RESOLVE" 0
  $playOk = $r.ok
} catch { $playOk = $false }

if (-not $playOk) {
  if ($AutoInstallDeps) {
    Add-Result "WARN" "PLAYWRIGHT" "Installing playwright + chromium" 0
    Invoke-Cmd "npm" @("i","-D","playwright") "PLAYWRIGHT_INSTALL" 15 | Out-Null
    Invoke-Cmd "npx" @("playwright","install","chromium") "PLAYWRIGHT_BROWSER_INSTALL" 15 | Out-Null
  } else {
    Add-Result "FAIL" "PLAYWRIGHT" "Playwright missing. Install or enable AutoInstallDeps." 15
  }
} else {
  Add-Result "PASS" "PLAYWRIGHT" "Playwright already installed"
}

# Build
if (-not $SkipBuild) {
  $build = Invoke-Cmd "npm" @("run","build") "NPM_BUILD" 25
  if ($build.ok) {
    Test-ReportPath $distDir "DIST_DIR" 15 | Out-Null
    Test-ReportPath (Join-Path $distDir "index.html") "DIST_INDEX" 10 | Out-Null
    if (Test-Path -LiteralPath $onnxDir)   { Test-ReportPath (Join-Path $distDir "onnx")   "DIST_ONNX"   10 | Out-Null }
    if (Test-Path -LiteralPath $modelsDir) { Test-ReportPath (Join-Path $distDir "models") "DIST_MODELS" 10 | Out-Null }
  }
} else {
  Add-Result "WARN" "NPM_BUILD" "Skipped build" 1
}

# Preview HEAD checks
if (-not $SkipPreview) {
  $previewProc = $null
  try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "npx"
    $psi.Arguments = "vite preview --host 127.0.0.1 --port $PreviewPort --strictPort"
    $psi.WorkingDirectory = $Root
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow  = $true
    $previewProc = New-Object System.Diagnostics.Process
    $previewProc.StartInfo = $psi
    [void]$previewProc.Start()
    Start-Sleep -Seconds 2

    function Test-Head([string]$Url, [string]$ExpectCT, [string]$Code, [double]$PenaltyIfFail = 5) {
      try {
        $resp = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 15
        $ct = ""
        try { $ct = [string]$resp.Headers["Content-Type"] } catch { $ct = "" }
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
          if ($ExpectCT -and (-not ($ct -and $ct.ToLower().Contains($ExpectCT.ToLower())))) {
            Add-Result "WARN" $Code ("HTTP {0}, Content-Type={1} (expected contains {2})" -f $resp.StatusCode, $ct, $ExpectCT) 1
          } else {
            Add-Result "PASS" $Code ("HTTP {0}, CT={1}" -f $resp.StatusCode, $ct)
          }
          return $true
        }
        Add-Result "FAIL" $Code ("HTTP {0}" -f $resp.StatusCode) $PenaltyIfFail
        return $false
      } catch {
        Add-Result "FAIL" $Code ("HEAD failed: " + $_.Exception.Message) $PenaltyIfFail
        return $false
      }
    }

    $baseUrl = "http://127.0.0.1:$PreviewPort"
    Test-Head "$baseUrl/" "text/html" "PREVIEW_ROOT" 10 | Out-Null
    foreach ($f in $ORT_REQUIRED) {
      $url = "$baseUrl/onnx/$f"
      $expect = if ($f.EndsWith(".wasm")) { "application/wasm" } elseif ($f.EndsWith(".mjs")) { "javascript" } else { "" }
      Test-Head $url $expect ("PREVIEW_ORT_" + ($f.ToUpper().Replace(".","_"))) 5 | Out-Null
    }
  } finally {
    if ($previewProc -and -not $previewProc.HasExited) { $previewProc.Kill(); $previewProc.WaitForExit() }
  }
} else {
  Add-Result "WARN" "PREVIEW" "Skipped preview checks" 1
}

# LEEWAY scan (optional autofix when -AutoFixLeeway)
if (-not $SkipLeeway) {
  $exts = @("*.ts","*.tsx","*.js","*.jsx","*.html","*.css","*.md","*.ps1")
  $scanRoots = @($srcDir,$publicDir,$toolsDir,(Join-Path $Root "services")) | Where-Object { Test-Path -LiteralPath $_ }

  $files = New-Object System.Collections.Generic.List[string]
  foreach ($r in $scanRoots) {
    foreach ($e in $exts) {
      Get-ChildItem -LiteralPath $r -Recurse -File -Filter $e -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch $LEEWAY_EXCLUDE_REGEX } |
        ForEach-Object { $files.Add($_.FullName) }
    }
  }

  if ($files.Count -eq 0) {
    Add-Result "FAIL" "LEEWAY_SCAN" "No files found to scan" 10
  } else {
    $missingHeader = 0; $badTag = 0; $badRegion = 0; $missingDP = 0; $fixed = 0; $fixFail = 0

    foreach ($f in $files) {
      $t = Read-TextSafe $f

      $hasHeader = ($t -match $LEEWAY_HAS_HEADER)
      $hasDP     = ($t -match $LEEWAY_HAS_DP)
      $hasTag    = ($t -match $LEEWAY_TAG_REGEX)
      $hasRegion = ($t -match $LEEWAY_REGION_REGEX)

      if (-not $hasHeader) { $missingHeader++ }
      if (-not $hasDP)     { $missingDP++ }
      if (-not $hasTag)    { $badTag++ }
      if (-not $hasRegion) { $badRegion++ }

      if ($AutoFixLeeway -and (-not ($hasHeader -and $hasDP -and $hasTag -and $hasRegion))) {
        $tag = Get-InferredTag $f
        $region = Get-ExtRegion $f
        $ok = Add-LeewayHeader $f $tag $region
        if ($ok) { $fixed++ } else { $fixFail++ }
      }
    }

    if ($AutoFixLeeway) {
      Add-Result "WARN" "LEEWAY_AUTOFIX" ("AutoFix attempted. Fixed={0}, Failed={1}" -f $fixed,$fixFail) 0
      # Re-scan counts after autofix (cheap, not perfect but effective)
      $missingHeader = 0; $badTag = 0; $badRegion = 0; $missingDP = 0
      foreach ($f in $files) {
        $t = Read-TextSafe $f
        if (-not ($t -match $LEEWAY_HAS_HEADER)) { $missingHeader++ }
        if (-not ($t -match $LEEWAY_HAS_DP))     { $missingDP++ }
        if (-not ($t -match $LEEWAY_TAG_REGEX))  { $badTag++ }
        if (-not ($t -match $LEEWAY_REGION_REGEX)) { $badRegion++ }
      }
    }

    if ($missingHeader -eq 0 -and $badTag -eq 0 -and $badRegion -eq 0 -and $missingDP -eq 0) {
      Add-Result "PASS" "LEEWAY_COMPLIANCE" ("100% compliant across {0} files" -f $files.Count)
    } else {
      Add-Result "FAIL" "LEEWAY_COMPLIANCE" ("MissingHeader={0}, BadTAG={1}, BadREGION={2}, MissingDP={3}" -f $missingHeader,$badTag,$badRegion,$missingDP) 25
    }
  }
} else {
  Add-Result "WARN" "LEEWAY" "Skipped LEEWAY scan" 1
}

# Browser smoke harness (Vite-processed HTML: must live in repo root, not public/)
if (-not $SkipBrowserSmoke) {
  $devProc = $null
  $harnessDir = Join-Path $Root "__aos_smoke__"
  $harnessIndex = Join-Path $harnessDir "index.html"
  $harnessMod = Join-Path $harnessDir "smoke.ts"
  $runnerNode = Join-Path $LogDir "__aos_playwright_runner__.mjs"
  $smokeOut = Join-Path $LogDir "browser-smoke-results.json"

  try {
    New-Item -ItemType Directory -Path $harnessDir -Force | Out-Null

@"
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AOS Browser Smoke</title>
    <style>body{font-family:system-ui;margin:16px}pre{white-space:pre-wrap}</style>
  </head>
  <body>
    <h2>AOS Browser Smoke Harness</h2>
    <pre id="log">Starting…</pre>
    <script type="module">
      import './smoke.ts';
    </script>
  </body>
</html>
"@ | Out-File -FilePath $harnessIndex -Encoding UTF8

@"
import { env, pipeline, AutoTokenizer } from '@xenova/transformers';

const el = document.getElementById('log') as HTMLElement;
const log = (...a: any[]) => { el.textContent += '\\n' + a.join(' '); console.log(...a); };

type Status = 'PASS' | 'WARN' | 'FAIL';
type Row = { id: string; status: Status; details: string; samples?: string[]; ts: string };
const results: Row[] = [];
const now = () => new Date().toISOString();

function ok(id: string, details: string, samples: string[] = []) { results.push({ id, status:'PASS', details, samples, ts: now() }); log('[PASS]', id, details); }
function warn(id: string, details: string, samples: string[] = []) { results.push({ id, status:'WARN', details, samples, ts: now() }); log('[WARN]', id, details); }
function fail(id: string, details: string) { results.push({ id, status:'FAIL', details, ts: now() }); log('[FAIL]', id, details); }

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

async function tinyGen(gen: any, prompt: string) {
  const out = await gen(prompt, { max_new_tokens: 16, do_sample: false, temperature: 0.7 });
  return Array.isArray(out) ? (out[0]?.generated_text ?? JSON.stringify(out)) : JSON.stringify(out);
}

async function main() {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.useBrowserCache = true;
  env.localModelPath = '/models';
  (env as any).backends ??= {};
  (env as any).backends.onnx ??= {};
  (env as any).backends.onnx.wasm ??= {};
  (env as any).backends.onnx.wasm.wasmPaths = '/onnx/';

  if (!navigator.gpu) {
    fail('WEBGPU', 'navigator.gpu not available');
    (window as any).__AOS_SMOKE_DONE__ = true;
    (window as any).__AOS_SMOKE_RESULTS__ = results;
    return;
  }
  ok('WEBGPU', 'navigator.gpu available');

  try {
    const gen = await pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct', { device: 'webgpu' });
    const samples = [
      await tinyGen(gen, 'Answer in 1 sentence: What is AOS?'),
      await tinyGen(gen, 'Answer in 1 sentence: Define WebGPU.'),
      await tinyGen(gen, 'Answer in 1 sentence: What is an embedding?'),
    ];
    ok('onnx-community/Qwen2.5-0.5B-Instruct', '3 generations OK', samples);
  } catch (e: any) {
    fail('onnx-community/Qwen2.5-0.5B-Instruct', String(e?.message ?? e));
  }

  try {
    const gen = await pipeline('text-generation', 'HuggingFaceTB/SmolLM-135M-Instruct', { device: 'webgpu' });
    const samples = [
      await tinyGen(gen, 'Answer in 1 sentence: What is offline inference?'),
      await tinyGen(gen, 'Answer in 1 sentence: What is ONNX?'),
      await tinyGen(gen, 'Answer in 1 sentence: What is WASM?'),
    ];
    ok('HuggingFaceTB/SmolLM-135M-Instruct', '3 generations OK', samples);
  } catch (e: any) {
    fail('HuggingFaceTB/SmolLM-135M-Instruct', String(e?.message ?? e));
  }

  try {
    const emb = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { device: 'webgpu' });
    const a = await emb('truck driver safety compliance', { pooling: 'mean', normalize: true });
    const b = await emb('FMCSA compliance for drivers', { pooling: 'mean', normalize: true });
    const c = await emb('banana smoothie recipe', { pooling: 'mean', normalize: true });
    const va = Array.from(a.data as any) as number[];
    const vb = Array.from(b.data as any) as number[];
    const vc = Array.from(c.data as any) as number[];
    const simAB = cosine(va, vb), simAC = cosine(va, vc);
    const samples = [
      'cosine(compliance vs compliance)=' + simAB.toFixed(4),
      'cosine(compliance vs recipe)=' + simAC.toFixed(4),
      (simAB > simAC ? 'OK: related > unrelated' : 'WARN: ordering unexpected')
    ];
    if (simAB > simAC) ok('Xenova/all-MiniLM-L6-v2', 'Embedding similarity ordering OK', samples);
    else warn('Xenova/all-MiniLM-L6-v2', 'Embeddings produced; ordering unexpected', samples);
  } catch (e: any) {
    fail('Xenova/all-MiniLM-L6-v2', String(e?.message ?? e));
  }

  try {
    const clf = await pipeline('image-classification', 'Xenova/vit-tiny-patch16-224', { device: 'webgpu' });
    const canvas = document.createElement('canvas'); canvas.width = 224; canvas.height = 224;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#2b6'; ctx.fillRect(0, 0, 224, 224);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 32px system-ui'; ctx.fillText('AOS', 60, 120);
    const out = await clf(canvas);
    ok('Xenova/vit-tiny-patch16-224', 'Classification ran', [JSON.stringify(out).slice(0, 400)]);
  } catch (e: any) {
    fail('Xenova/vit-tiny-patch16-224', String(e?.message ?? e));
  }

  try {
    const t = await AutoTokenizer.from_pretrained('onnx-community/stable-diffusion-v1-5', { local_files_only: true });
    const p1 = await t('a photorealistic city street at night', { padding: true, truncation: true });
    const p2 = await t('a cute robot assistant in a neon UI', { padding: true, truncation: true });
    const p3 = await t('a futuristic dashboard with glowing panels', { padding: true, truncation: true });
    const samples = [
      'tokens(p1)=' + (p1.input_ids?.data?.length ?? '?'),
      'tokens(p2)=' + (p2.input_ids?.data?.length ?? '?'),
      'tokens(p3)=' + (p3.input_ids?.data?.length ?? '?'),
    ];
    ok('onnx-community/stable-diffusion-v1-5', 'Tokenizer dry-run OK', samples);
  } catch (e: any) {
    fail('onnx-community/stable-diffusion-v1-5', String(e?.message ?? e));
  }

  (window as any).__AOS_SMOKE_DONE__ = true;
  (window as any).__AOS_SMOKE_RESULTS__ = results;
  log('DONE');
}

main().catch((e) => {
  fail('HARNESS', String((e as any)?.message ?? e));
  (window as any).__AOS_SMOKE_DONE__ = true;
  (window as any).__AOS_SMOKE_RESULTS__ = results;
});
"@ | Out-File -FilePath $harnessMod -Encoding UTF8

    # Start Vite dev server
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "npx"
    $psi.Arguments = "vite --host 127.0.0.1 --port $DevPort --strictPort"
    $psi.WorkingDirectory = $Root
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow  = $true
    $devProc = New-Object System.Diagnostics.Process
    $devProc.StartInfo = $psi
    [void]$devProc.Start()
    Start-Sleep -Seconds 2

@"
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = process.env.AOS_SMOKE_URL;
const out = process.env.AOS_SMOKE_OUT;
const headless = process.env.AOS_HEADLESS === '1';

const browser = await chromium.launch({ headless });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => (window as any).__AOS_SMOKE_DONE__ === true, null, { timeout: 240000 });
const results = await page.evaluate(() => (window as any).__AOS_SMOKE_RESULTS__ || []);
fs.writeFileSync(out, JSON.stringify({ url, headless, results }, null, 2), 'utf8');
await browser.close();
"@ | Out-File -FilePath $runnerNode -Encoding UTF8

    $env:AOS_SMOKE_URL = "http://127.0.0.1:$DevPort/__aos_smoke__/index.html"
    $env:AOS_SMOKE_OUT = $smokeOut
    $env:AOS_HEADLESS  = $(if ($Headless) { "1" } else { "0" })

    $run = Invoke-Cmd "node" @("$runnerNode") "BROWSER_SMOKE" 25
    if ($run.ok -and (Test-Path -LiteralPath $smokeOut)) {
      $json = Get-Content -LiteralPath $smokeOut -Raw | ConvertFrom-Json
      $fails = @($json.results | Where-Object { $_.status -eq "FAIL" })
      $warns = @($json.results | Where-Object { $_.status -eq "WARN" })
      if ($fails.Count -eq 0 -and $warns.Count -eq 0) {
        Add-Result "PASS" "BROWSER_SMOKE_RESULTS" ("All probes PASS. File: {0}" -f $smokeOut)
      } else {
        Add-Result "FAIL" "BROWSER_SMOKE_RESULTS" ("FAIL={0}, WARN={1}. See: {2}" -f $fails.Count,$warns.Count,$smokeOut) 25
      }
    } else {
      Add-Result "FAIL" "BROWSER_SMOKE_RESULTS" ("Smoke output missing: {0}" -f $smokeOut) 25
    }
  } catch {
    Add-Result "FAIL" "BROWSER_SMOKE" $_.Exception.Message 30
  } finally {
    if ($devProc -and -not $devProc.HasExited) { $devProc.Kill(); $devProc.WaitForExit() }
    if (-not $KeepHarness) { try { Remove-Item -LiteralPath $harnessDir -Recurse -Force -ErrorAction SilentlyContinue } catch {} }
  }
} else {
  Add-Result "WARN" "BROWSER_SMOKE" "Skipped browser smoke tests" 1
}

# Final grade + reports
$failCount = (@($ResultList | Where-Object { $_.level -eq "FAIL" })).Count
$warnCount = (@($ResultList | Where-Object { $_.level -eq "WARN" })).Count
$finalScore = [math]::Round($Score, 1)

$grade =
  if ($finalScore -ge 95 -and $failCount -eq 0) { "GOLD" }
  elseif ($finalScore -ge 85) { "SILVER" }
  elseif ($finalScore -ge 70) { "BRONZE" }
  else { "NON-COMPLIANT" }

$reportJson = Join-Path $LogDir "report.json"
$reportMd   = Join-Path $LogDir "report.md"

([pscustomobject]@{
  root=$Root
  timestamp=(Get-Date).ToString("o")
  score=$finalScore
  grade=$grade
  failCount=$failCount
  warnCount=$warnCount
  results=$ResultList
  artifacts=@{
    logDir=$LogDir
    transcript=$Transcript
    inventory=$InventoryPath
    smoke=(if (Test-Path -LiteralPath (Join-Path $LogDir "browser-smoke-results.json")) { (Join-Path $LogDir "browser-smoke-results.json") } else { "" })
  }
}) | ConvertTo-Json -Depth 8 | Out-File -FilePath $reportJson -Encoding UTF8

$md = New-Object System.Collections.Generic.List[string]
$md.Add("# AOS Browser Gate Report") | Out-Null
$md.Add("") | Out-Null
$md.Add(("- Root: {0}" -f $Root)) | Out-Null
$md.Add(("- Timestamp: {0}" -f (Get-Date).ToString("o"))) | Out-Null
$md.Add(("- Score: {0}" -f $finalScore)) | Out-Null
$md.Add(("- Grade: {0}" -f $grade)) | Out-Null
$md.Add(("- FAIL: {0} / WARN: {1}" -f $failCount, $warnCount)) | Out-Null
$md.Add("") | Out-Null
$md.Add("## Results") | Out-Null
$md.Add("") | Out-Null
$md.Add("| Level | Code | Penalty | Message |") | Out-Null
$md.Add("|---|---|---:|---|") | Out-Null
foreach ($r in $ResultList) {
  $msg = ([string]$r.message).Replace("`r","").Replace("`n"," ")
  $md.Add(("| {0} | {1} | {2} | {3} |" -f $r.level, $r.code, $r.penalty, $msg)) | Out-Null
}
$md | Out-File $reportMd -Encoding UTF8

Write-Host ""
Write-Host ("=== FINAL === Score={0} Grade={1} FAIL={2} WARN={3}" -f $finalScore,$grade,$failCount,$warnCount) -ForegroundColor Cyan
Write-Host ("Report: {0}" -f $reportMd) -ForegroundColor Cyan
Write-Host ("JSON:   {0}" -f $reportJson) -ForegroundColor Cyan

Stop-Transcript | Out-Null

# CI gate: scores below 70 are blocking (LEEWAY standard)
if ($finalScore -lt 70 -or $failCount -gt 0) { exit 1 }
exit 0

