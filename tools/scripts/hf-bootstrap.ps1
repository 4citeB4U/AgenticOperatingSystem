# ============================================================================
# LEEWAY HEADER — DO NOT REMOVE
# PROFILE: LEEWAY-ORDER
# TAG: TOOLS.POWERSHELL.SECRETS.HF_BOOTSTRAP
# REGION: 🟣 MCP
# VERSION: 1.1.0
# ============================================================================
# Hugging Face Token Bootstrap (PowerShell 7)
#
# What this does:
# 1) Reads HF token from Windows Credential Manager via get-hf-credential.ps1
# 2) Sets $env:HF_TOKEN in the CURRENT pwsh session
# 3) (Optional) Logs in with hf CLI using that token
# 4) (Optional) Installs a safe bootstrap block into your PowerShell 7 profile ($PROFILE)
#
# DISCOVERY_PIPELINE:
#   Voice → Intent → Location → Vertical → Ranking → Render
# ============================================================================

[CmdletBinding()]
param(
  [Parameter()][string]$Target = "HF_TOKEN_AOS",
  [Parameter()][string]$UserName = "huggingface",

  # If token not found, run store-hf-credential.ps1 to create it
  [Parameter()][switch]$EnsureStored,

  # If set, runs: hf auth login --token $env:HF_TOKEN
  [Parameter()][switch]$LoginWithHFCLI,

  # Prints only token length info (token never printed)
  [Parameter()][switch]$PrintLengthOnly,

  # Install a safe bootstrap block into $PROFILE so every new pwsh session sets HF_TOKEN
  [Parameter()][switch]$InstallToProfile,

  # When installing, also set an env var so future shells print length
  [Parameter()][switch]$ProfilePrintLengthOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Info([string]$m) { Write-Host $m }
function Warn([string]$m) { Write-Warning $m }

$storeScript = Join-Path $PSScriptRoot "store-hf-credential.ps1"
$getScript   = Join-Path $PSScriptRoot "get-hf-credential.ps1"

if (-not (Test-Path -LiteralPath $getScript)) {
  throw "Missing script: $getScript"
}

function Get-HFTokenOrThrow {
  param([string]$Tgt, [switch]$Ensure, [string]$U)
  $tok = & $getScript -Target $Tgt 2>$null
  if ([string]::IsNullOrWhiteSpace($tok)) {
    if (-not $Ensure) {
      throw "Credential '$Tgt' not found or empty. Re-run with -EnsureStored (or run store script)."
    }
    if (-not (Test-Path -LiteralPath $storeScript)) {
      throw "Missing store script: $storeScript"
    }
    Info "Credential '$Tgt' not found. Running store script to create it..."
    & $storeScript -Target $Tgt -UserName $U -Force | Out-Null

    $tok = & $getScript -Target $Tgt 2>$null
    if ([string]::IsNullOrWhiteSpace($tok)) {
      throw "Store succeeded but token still empty. Investigate get-hf-credential.ps1."
    }
  }
  return $tok
}

function Install-HFBootstrapToProfile {
  param(
    [string]$BootstrapPath,
    [switch]$PrintLen
  )

  $profilePath = $PROFILE
  $profileDir  = Split-Path -Parent $profilePath
  if (-not (Test-Path -LiteralPath $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
  }
  if (-not (Test-Path -LiteralPath $profilePath)) {
    New-Item -ItemType File -Path $profilePath -Force | Out-Null
  }

  $begin = "# --- AOS HF BOOTSTRAP (BEGIN) ---"
  $end   = "# --- AOS HF BOOTSTRAP (END) ---"

  $raw = Get-Content -LiteralPath $profilePath -Raw -ErrorAction SilentlyContinue
  if ($null -eq $raw) { $raw = "" }

  # Remove any prior block (prevents the 'False' bug and duplicates)
  $pattern = [regex]::Escape($begin) + ".*?" + [regex]::Escape($end) + "\s*"
  if ($raw -match $pattern) {
    $raw = [regex]::Replace($raw, $pattern, "", "Singleline")
    Set-Content -LiteralPath $profilePath -Value $raw.TrimEnd() -Encoding UTF8
    Warn "Removed existing AOS HF bootstrap block from profile."
  }

  # Optional: make future shells print length
  if ($PrintLen) {
    $env:AOS_HF_BOOTSTRAP_PRINTLEN = "1"
    try { setx AOS_HF_BOOTSTRAP_PRINTLEN 1 | Out-Null } catch {}
  }

  # SAFE BLOCK: no baked booleans, no expansion that results in a literal 'False' command.
  $block = @"
$begin
`$hfBootstrap = '$BootstrapPath'
if (Test-Path -LiteralPath `$hfBootstrap) {
  try {
    if (`$env:AOS_HF_BOOTSTRAP_PRINTLEN -eq '1') {
      & `$hfBootstrap -PrintLengthOnly | Out-Host
    } else {
      & `$hfBootstrap | Out-Host
    }
  } catch {
    Write-Host ("HF bootstrap skipped: {0}" -f `$_.Exception.Message)
  }
}
$end
"@

  Add-Content -LiteralPath $profilePath -Value ("`r`n" + $block) -Encoding UTF8
  Info "Installed HF bootstrap into profile: $profilePath"
  Info "Restart pwsh to apply (or run: `. `$PROFILE`)"
}

# 1) Read token (and optionally create it)
$token = Get-HFTokenOrThrow -Tgt $Target -Ensure:$EnsureStored -U $UserName

# 2) Set env var for this session
$env:HF_TOKEN = $token

if ($PrintLengthOnly) {
  Info ("OK: HF_TOKEN set (len={0})" -f $env:HF_TOKEN.Length)
} else {
  Info ("OK: HF_TOKEN set for this session (len={0}). Token not displayed." -f $env:HF_TOKEN.Length)
}

# 3) Optional hf CLI login
if ($LoginWithHFCLI) {
  $hf = Get-Command hf -ErrorAction SilentlyContinue
  if (-not $hf) { throw "hf CLI not found on PATH. Install it or disable -LoginWithHFCLI." }
  Info "Running: hf auth login --token (token not displayed)..."
  & hf auth login --token $env:HF_TOKEN | Out-Host
}

# 4) Optional install into profile
if ($InstallToProfile) {
  Install-HFBootstrapToProfile -BootstrapPath $PSCommandPath -PrintLen:$ProfilePrintLengthOnly
}
