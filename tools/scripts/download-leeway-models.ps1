# ============================================================================
# LEEWAY HEADER — DO NOT REMOVE
# PROFILE: LEEWAY-ORDER
# TAG: TOOLS.POWERSHELL.MODELS.DOWNLOADER
# REGION: 🟣 MCP
# VERSION: 2.2.0
# ============================================================================
# Agentic OS — Model Downloader (Original Core Set)
#
# Purpose:
# - Downloads your ORIGINAL model set (as you listed)
# - Maintains predictable folder layout under public/models
# - Supports ONNX-community repos (ONNX artifacts) + Xenova repos (Transformers.js assets)
#
# DISCOVERY_PIPELINE:
#   Voice → Intent → Location → Vertical → Ranking → Render
# ============================================================================

[CmdletBinding()]
param(
  [Parameter()][string]$BaseDir = "B:\AgenticOperatingSystem\public\models"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Directory {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Get-ToolPath([string]$exe) {
  $cmd = Get-Command $exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Path }
  return $null
}

function Get-SafeFileName([Parameter(Mandatory)][string]$s) {
  ($s -replace '[^\w\.-]+', '_').Trim('_')
}

$hfExe = Get-ToolPath "hf"
if (-not $hfExe) {
  throw "Missing 'hf' CLI. Install/update: py -m pip install -U huggingface_hub"
}

function Invoke-HFDownload {
  param(
    [Parameter(Mandatory)][string]$Repo,
    [Parameter(Mandatory)][string]$OutDir,
    [Parameter(Mandatory)][string[]]$IncludePatterns
  )

  New-Directory $OutDir

  # NOTE: --include is strict allowlist. Use patterns that match repo layout.
  $hfArgs = @("download", $Repo, "--local-dir", $OutDir)

  foreach ($p in $IncludePatterns) {
    $hfArgs += @("--include", $p)
  }

  Write-Information "hf $($hfArgs -join ' ')"
  & $hfExe @hfArgs
}

function Test-HasAny {
  param([string]$Dir, [string[]]$Patterns)
  foreach ($p in $Patterns) {
    $found = Get-ChildItem -LiteralPath $Dir -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -like "*$p" }
    if (@($found).Count -gt 0) { return $true }
  }
  return $false
}

# ------------------------------------------------------------------
# ORIGINAL core model list (exactly as you stated)
# ------------------------------------------------------------------
$models = @(
  "onnx-community/Qwen2.5-0.5B-Instruct",      # QWEN core (chat)
  "HuggingFaceTB/SmolLM-135M-Instruct",       # VISION core
  "Xenova/all-MiniLM-L6-v2",                  # ORIGINAL EMBED core
  "onnx-community/stable-diffusion-v1-5",     # IMG_GEN
  "Xenova/vit-tiny-patch16-224"               # backup vision
)

# ------------------------------------------------------------------
# Include rules (per-repo family)
# - onnx-community repos: usually have ONNX under /onnx or nested; use ** patterns
# - Xenova repos: usually provide model + tokenizer/config; pull common assets
# ------------------------------------------------------------------
function Get-IncludesForRepo([string]$repo) {
  if ($repo -like "onnx-community/*") {
    return @(
      "**/*.onnx",
      "**/*.json",
      "**/*.txt"
    )
  }

  if ($repo -like "Xenova/*") {
    # Xenova models are typically Transformers.js packs (may include .onnx in /onnx/)
    return @(
      "**/*.onnx",
      "**/*.json",
      "**/*.txt",
      "**/*.bin"
    )
  }

  # Fallback conservative
  return @("**/*.onnx", "**/*.json", "**/*.txt")
}

# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
Write-Information "🚀 Agentic OS — Model Downloader (Original Core Set)"
Write-Information "📁 Target: $BaseDir"
New-Directory $BaseDir

$failures = @()

foreach ($repo in $models) {
  $safe = Get-SafeFileName ($repo.Replace("/", "_"))
  $out  = Join-Path $BaseDir $safe
  $include = Get-IncludesForRepo $repo

  Write-Information ""
  Write-Information "📥 $repo"
  Write-Information "   Out : $out"

  try {
    Invoke-HFDownload -Repo $repo -OutDir $out -IncludePatterns $include | Out-Host

    # Basic verification: ensure we got something meaningful
    $hasOnnx = Test-HasAny -Dir $out -Patterns @(".onnx")
    $hasCfg  = Test-HasAny -Dir $out -Patterns @("config.json")
    $hasTok  = Test-HasAny -Dir $out -Patterns @("tokenizer.json","vocab.json","merges.txt")

    Write-Information ("  📊 Verify: ONNX={0} Config={1} TokenizerParts={2}" -f $hasOnnx, $hasCfg, $hasTok)

    if (-not $hasOnnx -or -not $hasCfg) {
      Write-Warning "  ⚠️ Possibly incomplete: $repo (missing ONNX or config.json)"
    } else {
      Write-Information "  ✅ OK: $repo"
    }
  }
  catch {
    $msg = ($_ | Out-String).Trim()
    Write-Warning "FAILED: $repo"
    Write-Warning $msg
    $failures += @{ repo = $repo; reason = $msg }
  }
}

Write-Information ""
Write-Information "🎉 DONE."

if ($failures.Count -gt 0) {
  Write-Information ""
  Write-Warning "Some models failed:"
  $failures | ForEach-Object {
    Write-Information (" - {0}" -f $_.repo)
  }
  Write-Information ""
  Write-Information "If failures show 401 Unauthorized, run: hf auth login"
}
