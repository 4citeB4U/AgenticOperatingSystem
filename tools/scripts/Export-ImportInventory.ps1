<#
  Export-ImportInventory.ps1
  ============================================================
  Purpose
    Inventory all files under specified roots and extract import-like references:
      - ESM import ... from "x"   and  import "x"
      - export ... from "x"
      - require("x")
      - dynamic import("x")
      - CSS @import "x" / @import url("x")

  Output Location (DEFAULT)
    <tools>\ImportInventory\<timestamp>\

  Outputs
    - Files.csv
    - Imports.csv
    - Imports.json
    - Summary.txt
    - Unreadable.txt (optional)

  Usage
    Set-ExecutionPolicy -Scope Process Bypass -Force
    & "B:\AgenticOperatingSystem\tools\Export-ImportInventory.ps1" -ResolveTsconfigPaths
#>

[CmdletBinding()]
param(
  [Parameter()]
  [string[]]$Roots = @(
    "B:\AgenticOperatingSystem\public",
    "B:\AgenticOperatingSystem\src"
  ),

  # Default is the script folder: <scriptDir>\ImportInventory
  [Parameter()]
  [string]$OutRoot = $null,

  # Parse imports only from these extensions (inventory still captures all files).
  [Parameter()]
  [string[]]$ParseExtensions = @(
    ".js",".jsx",".ts",".tsx",
    ".mjs",".cjs",
    ".css",".scss",".sass",".less",
    ".json",".md",".html",".htm"
  ),

  # Used for resolving relative imports like ./x and ../y
  [Parameter()]
  [string[]]$ResolveExtensions = @(
    ".ts",".tsx",".js",".jsx",".mjs",".cjs",".json",".css",".scss",".less"
  ),

  [Parameter()]
  [switch]$ResolveTsconfigPaths,

  [Parameter()]
  [switch]$ParseAllFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -------------------------
# Helpers (approved verbs + array-safe)
# -------------------------
function New-TimestampedDirectory {
  param([Parameter(Mandatory)][string]$Base)

  $stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
  $dir = Join-Path $Base $stamp
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

function Resolve-FullPathSafe {
  param([Parameter(Mandatory)][string]$Path)
  try { return [System.IO.Path]::GetFullPath($Path) } catch { return $Path }
}

function Get-FileTextSafe {
  param([Parameter(Mandatory)][string]$Path)

  # Read file as bytes. If binary-ish, return $null.
  try {
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($null -eq $bytes) { return $null }
    if ($bytes.Length -eq 0) { return "" }

    $limit = [Math]::Min(4096, $bytes.Length)
    for ($i = 0; $i -lt $limit; $i++) {
      if ($bytes[$i] -eq 0) { return $null }
    }

    # Decode as UTF8 with BOM support; fallback to system default.
    try {
      $utf8 = New-Object System.Text.UTF8Encoding($true, $true)
      return $utf8.GetString($bytes)
    } catch {
      return [System.Text.Encoding]::Default.GetString($bytes)
    }
  } catch {
    return $null
  }
}

function ConvertTo-TextSafe {
  param([Parameter(Mandatory=$false)]$Value)

  if ($null -eq $Value) { return $null }

  # If already string, done
  if ($Value -is [string]) { return $Value }

  # If bytes, decode
  if ($Value -is [byte[]]) {
    try {
      $utf8 = New-Object System.Text.UTF8Encoding($true, $true)
      return $utf8.GetString($Value)
    } catch {
      return [System.Text.Encoding]::Default.GetString($Value)
    }
  }

  # If enumerable (e.g. string[]), join lines
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    try { return (@($Value) -join "`n") } catch { }
  }

  # Last resort
  try { return [string]$Value } catch { return $null }
}

function Get-ImportMatches {
  param([Parameter(Mandatory=$false)]$Text)

  $s = ConvertTo-TextSafe -Value $Text
  if ([string]::IsNullOrEmpty($s)) { return @() }

  $results = New-Object System.Collections.Generic.List[object]

  # Use static regex API to avoid constructor overload issues in some hosts
  # ESM: import ... from 'x'  OR import 'x'
  $patImport = '(?m)^\s*import\s+(?:[\s\S]*?\s+from\s+)?["''](?<spec>[^"''\r\n]+)["'']\s*;?'
  foreach ($m in [regex]::Matches($s, $patImport)) {
    $results.Add([pscustomobject]@{ kind="import"; spec=$m.Groups["spec"].Value })
  }

  # ESM re-export: export ... from 'x'
  $patExportFrom = '(?m)^\s*export\s+[\s\S]*?\s+from\s+["''](?<spec>[^"''\r\n]+)["'']\s*;?'
  foreach ($m in [regex]::Matches($s, $patExportFrom)) {
    $results.Add([pscustomobject]@{ kind="export-from"; spec=$m.Groups["spec"].Value })
  }

  # CommonJS require('x')
  $patRequire = 'require\s*\(\s*["''](?<spec>[^"''\r\n]+)["'']\s*\)'
  foreach ($m in [regex]::Matches($s, $patRequire)) {
    $results.Add([pscustomobject]@{ kind="require"; spec=$m.Groups["spec"].Value })
  }

  # Dynamic import('x')
  $patDynImport = '(?<!\w)import\s*\(\s*["''](?<spec>[^"''\r\n]+)["'']\s*\)'
  foreach ($m in [regex]::Matches($s, $patDynImport)) {
    $results.Add([pscustomobject]@{ kind="dynamic-import"; spec=$m.Groups["spec"].Value })
  }

  # CSS @import "x"  OR @import url("x")
  $patCssImport = '@import\s+(?:url\(\s*)?["''](?<spec>[^"''\r\n]+)["'']\s*\)?\s*;?'
  foreach ($m in [regex]::Matches($s, $patCssImport)) {
    $results.Add([pscustomobject]@{ kind="css-import"; spec=$m.Groups["spec"].Value })
  }

  return @($results)
}

function Resolve-RelativeImport {
  param(
    [Parameter(Mandatory)][string]$SourceFile,
    [Parameter(Mandatory)][string]$Spec,
    [Parameter(Mandatory)][string[]]$KnownExts
  )

  if (-not ($Spec.StartsWith(".") -or $Spec.StartsWith(".."))) { return @() }

  $srcDir = Split-Path -Parent $SourceFile
  $base = Resolve-FullPathSafe (Join-Path $srcDir $Spec)

  $candidates = New-Object System.Collections.Generic.List[string]

  if (Test-Path -LiteralPath $base -PathType Leaf) { $candidates.Add($base) }

  if (Test-Path -LiteralPath $base -PathType Container) {
    foreach ($ext in @($KnownExts)) {
      $idx = Join-Path $base ("index{0}" -f $ext)
      if (Test-Path -LiteralPath $idx -PathType Leaf) { $candidates.Add($idx) }
    }
  }

  foreach ($ext in @($KnownExts)) {
    $p = "{0}{1}" -f $base, $ext
    if (Test-Path -LiteralPath $p -PathType Leaf) { $candidates.Add($p) }
  }

  foreach ($ext in @($KnownExts)) {
    $p = Join-Path $base ("index{0}" -f $ext)
    if (Test-Path -LiteralPath $p -PathType Leaf) { $candidates.Add($p) }
  }

  return @($candidates | Select-Object -Unique)
}

function Get-RepoCandidateDirectories {
  param([Parameter(Mandatory)][string[]]$Roots)

  $dirs = New-Object System.Collections.Generic.List[string]
  foreach ($r in @($Roots)) {
    if (-not $r) { continue }
    $rr = Resolve-FullPathSafe $r
    if (-not (Test-Path -LiteralPath $rr)) { continue }

    $dirs.Add($rr)

    $p1 = Split-Path -Parent $rr
    if ($p1) { $dirs.Add($p1) }

    $p2 = $null
    if ($p1) { $p2 = Split-Path -Parent $p1 }
    if ($p2) { $dirs.Add($p2) }
  }

  return @($dirs | Select-Object -Unique)
}

function Get-TsconfigPath {
  param([Parameter(Mandatory)][string[]]$Roots)

  $candidates = @(Get-RepoCandidateDirectories -Roots $Roots)
  foreach ($d in @($candidates)) {
    $p = Join-Path $d "tsconfig.json"
    if (Test-Path -LiteralPath $p -PathType Leaf) { return $p }
  }
  return $null
}

function Get-TsconfigPathMap {
  param([Parameter(Mandatory)][string]$TsconfigPath)

  try {
    $raw = Get-Content -LiteralPath $TsconfigPath -Raw -ErrorAction Stop
    $json = $raw | ConvertFrom-Json -ErrorAction Stop

    $baseUrl = $json.compilerOptions.baseUrl
    if (-not $baseUrl) { $baseUrl = "." }

    $paths = $json.compilerOptions.paths
    if (-not $paths) { return $null }

    $tsDir = Split-Path -Parent $TsconfigPath
    $baseAbs = Resolve-FullPathSafe (Join-Path $tsDir $baseUrl)

    return [pscustomobject]@{
      TsconfigPath = $TsconfigPath
      BaseAbs      = $baseAbs
      Paths        = $paths
    }
  } catch {
    return $null
  }
}

function Resolve-TsconfigAliasImport {
  param(
    [Parameter(Mandatory)][string]$Spec,
    [Parameter(Mandatory)]$TsPathsInfo,
    [Parameter(Mandatory)][string[]]$KnownExts
  )

  $results = New-Object System.Collections.Generic.List[string]
  $paths = $TsPathsInfo.Paths

  foreach ($key in $paths.PSObject.Properties.Name) {
    $escaped = [regex]::Escape($key).Replace("\*", "(?<wild>.+)")
    $re = [regex]::new("^$escaped$")  # simple constructor; no options overload

    $m = $re.Match($Spec)
    if (-not $m.Success) { continue }

    $wild = $m.Groups["wild"].Value
    $targets = $paths.$key

    foreach ($t in @($targets)) {
      $targetRel = $t -replace "\*", $wild
      $baseCandidate = Resolve-FullPathSafe (Join-Path $TsPathsInfo.BaseAbs $targetRel)

      if (Test-Path -LiteralPath $baseCandidate -PathType Leaf) { $results.Add($baseCandidate) }

      if (Test-Path -LiteralPath $baseCandidate -PathType Container) {
        foreach ($ext in @($KnownExts)) {
          $idx = Join-Path $baseCandidate ("index{0}" -f $ext)
          if (Test-Path -LiteralPath $idx -PathType Leaf) { $results.Add($idx) }
        }
      }

      foreach ($ext in @($KnownExts)) {
        $p = "{0}{1}" -f $baseCandidate, $ext
        if (Test-Path -LiteralPath $p -PathType Leaf) { $results.Add($p) }
      }
    }
  }

  return @($results | Select-Object -Unique)
}

# -------------------------
# Normalize & validate Roots (force array)
# -------------------------
$validRoots = @()
foreach ($r in @($Roots)) {
  if (-not $r) { continue }
  $nr = Resolve-FullPathSafe $r
  if (-not (Test-Path -LiteralPath $nr)) {
    Write-Warning "Root not found: $nr"
  } else {
    $validRoots += $nr
  }
}
$validRoots = @($validRoots | Select-Object -Unique)

if ($validRoots.Count -eq 0) {
  throw "No valid Roots were found. Fix the paths and re-run."
}

# -------------------------
# Output folder defaults to script directory
# -------------------------
if (-not $OutRoot) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $OutRoot = Join-Path $scriptDir "ImportInventory"
}

$outDir = New-TimestampedDirectory -Base $OutRoot

$filesCsv      = Join-Path $outDir "Files.csv"
$importsCsv    = Join-Path $outDir "Imports.csv"
$importsJson   = Join-Path $outDir "Imports.json"
$summaryTxt    = Join-Path $outDir "Summary.txt"
$unreadableTxt = Join-Path $outDir "Unreadable.txt"

Write-Host "Scanning roots:" -ForegroundColor Cyan
$validRoots | ForEach-Object { Write-Host "  $_" }
Write-Host "Output folder:" -ForegroundColor Cyan
Write-Host "  $outDir"

# -------------------------
# Enumerate files (force array)
# -------------------------
$allFiles = @(
  foreach ($root in @($validRoots)) {
    Get-ChildItem -LiteralPath $root -Recurse -File -Force -ErrorAction SilentlyContinue
  }
)

@($allFiles) |
  Select-Object FullName, Length, LastWriteTime, CreationTime, Extension |
  Sort-Object FullName |
  Export-Csv -NoTypeInformation -Encoding UTF8 -Path $filesCsv

# -------------------------
# Pick parse set (force array)
# -------------------------
if ($ParseAllFiles) {
  $parseFiles = @($allFiles)
} else {
  $parseFiles = @(
    $allFiles | Where-Object {
      $ext = $_.Extension
      if (-not $ext) { return $false }
      $ParseExtensions -contains $ext.ToLowerInvariant()
    }
  )
}
$parseTotal = $parseFiles.Count

# -------------------------
# Optional: tsconfig paths
# -------------------------
$tsPathsInfo = $null
if ($ResolveTsconfigPaths) {
  $tsconfig = Get-TsconfigPath -Roots $validRoots
  if ($tsconfig) {
    $tsPathsInfo = Get-TsconfigPathMap -TsconfigPath $tsconfig
    if ($tsPathsInfo) {
      Write-Host "TS path alias resolution enabled:" -ForegroundColor Cyan
      Write-Host "  tsconfig: $($tsPathsInfo.TsconfigPath)"
      Write-Host "  baseAbs : $($tsPathsInfo.BaseAbs)"
    } else {
      Write-Warning "tsconfig.json found but compilerOptions.paths could not be parsed."
    }
  } else {
    Write-Warning "ResolveTsconfigPaths enabled, but no tsconfig.json found near the repo roots."
  }
}

# -------------------------
# Parse imports (array-safe + resilient)
# -------------------------
$importRowsList = New-Object System.Collections.Generic.List[object]
$unreadableList = New-Object System.Collections.Generic.List[string]

$counter = 0
foreach ($f in @($parseFiles)) {
  $counter++
  if (($counter % 250) -eq 0 -or $counter -eq 1 -or $counter -eq $parseTotal) {
    Write-Host ("Parsed {0} / {1}" -f $counter, $parseTotal)
  }

  $text = Get-FileTextSafe -Path $f.FullName
  if ($null -eq $text) {
    $unreadableList.Add($f.FullName)
    continue
  }

  # If anything unexpected happens during parsing, do not die—log file as unreadable and continue.
  $importHits = @()
  try {
    $importHits = @(Get-ImportMatches -Text $text)
  } catch {
    $unreadableList.Add($f.FullName)
    continue
  }

  foreach ($hit in @($importHits)) {
    $spec = ($hit.spec | ForEach-Object { $_.Trim() })
    if (-not $spec) { continue }

    $isRelative = $spec.StartsWith(".") -or $spec.StartsWith("..")
    $resolved = @()
    $resolvedVia = $null

    if ($isRelative) {
      $resolved = @(Resolve-RelativeImport -SourceFile $f.FullName -Spec $spec -KnownExts $ResolveExtensions)
      $resolvedVia = "relative"
    } elseif ($tsPathsInfo) {
      $aliasResolved = @(Resolve-TsconfigAliasImport -Spec $spec -TsPathsInfo $tsPathsInfo -KnownExts $ResolveExtensions)
      if ($aliasResolved.Count -gt 0) {
        $resolved = @($aliasResolved)
        $resolvedVia = "tsconfig-paths"
      }
    }

    $bucket = $null
    foreach ($r in @($validRoots)) {
      if ($f.FullName.StartsWith($r, [System.StringComparison]::OrdinalIgnoreCase)) { $bucket = $r; break }
    }

    $importRowsList.Add([pscustomobject]@{
      SourceFile     = $f.FullName
      SourceExt      = $f.Extension
      ImportKind     = $hit.kind
      ImportSpec     = $spec
      IsRelative     = $isRelative
      ResolvedVia    = $resolvedVia
      ResolvedCount  = @($resolved).Count
      ResolvedPaths  = (@($resolved) -join "; ")
      RootBucket     = $bucket
    })
  }
}

# Convert Lists -> Arrays (critical for stable exports & grouping)
$importRows  = @($importRowsList.ToArray())
$unreadable  = @($unreadableList.ToArray())
$allFilesArr = @($allFiles)

# Export imports
$importRows |
  Sort-Object SourceFile, ImportSpec, ImportKind |
  Export-Csv -NoTypeInformation -Encoding UTF8 -Path $importsCsv

$importRows |
  ConvertTo-Json -Depth 6 |
  Set-Content -Encoding UTF8 -Path $importsJson

if ($unreadable.Count -gt 0) {
  $unreadable | Sort-Object | Set-Content -Encoding UTF8 -Path $unreadableTxt
}

# Summary
$totalFiles    = $allFilesArr.Count
$totalImports  = $importRows.Count
$uniqueSpecs   = @($importRows | Select-Object -ExpandProperty ImportSpec -Unique).Count
$unresolvedRel = @($importRows | Where-Object { $_.IsRelative -and $_.ResolvedCount -eq 0 }).Count

$topExternal = $importRows |
  Where-Object { -not $_.IsRelative } |
  Group-Object ImportSpec |
  Sort-Object Count -Descending |
  Select-Object -First 30

$topRelative = $importRows |
  Where-Object { $_.IsRelative } |
  Group-Object ImportSpec |
  Sort-Object Count -Descending |
  Select-Object -First 30

$summaryLines = New-Object System.Collections.Generic.List[string]
$summaryLines.Add("Import Inventory Summary")
$summaryLines.Add("========================")
$summaryLines.Add("Timestamp:               $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")")
$summaryLines.Add("Roots:                   $($validRoots -join ' | ')")
$summaryLines.Add("Output Folder:           $outDir")
$summaryLines.Add("")
$summaryLines.Add(("Total files found:             {0}" -f $totalFiles))
$summaryLines.Add(("Files parsed for imports:      {0}" -f $parseTotal))
$summaryLines.Add(("Total import statements found: {0}" -f $totalImports))
$summaryLines.Add(("Unique import specs:           {0}" -f $uniqueSpecs))
$summaryLines.Add(("Unresolved relative imports:   {0}" -f $unresolvedRel))
$summaryLines.Add(("Unreadable files:              {0}" -f $unreadable.Count))
$summaryLines.Add("")
if ($ResolveTsconfigPaths) {
  if ($tsPathsInfo) {
    $summaryLines.Add("TSConfig alias resolution: ENABLED")
    $summaryLines.Add(("  tsconfig: {0}" -f $tsPathsInfo.TsconfigPath))
    $summaryLines.Add(("  baseAbs : {0}" -f $tsPathsInfo.BaseAbs))
  } else {
    $summaryLines.Add("TSConfig alias resolution: ENABLED (no usable tsconfig paths parsed)")
  }
  $summaryLines.Add("")
}

$summaryLines.Add("Top external/non-relative imports (count):")
foreach ($g in $topExternal) { $summaryLines.Add(("  {0,5}  {1}" -f $g.Count, $g.Name)) }
$summaryLines.Add("")
$summaryLines.Add("Top relative imports (count):")
foreach ($g in $topRelative) { $summaryLines.Add(("  {0,5}  {1}" -f $g.Count, $g.Name)) }
$summaryLines.Add("")
$summaryLines.Add("Outputs:")
$summaryLines.Add(("  {0}" -f $filesCsv))
$summaryLines.Add(("  {0}" -f $importsCsv))
$summaryLines.Add(("  {0}" -f $importsJson))
$summaryLines.Add(("  {0}" -f $summaryTxt))
if ($unreadable.Count -gt 0) { $summaryLines.Add(("  {0}" -f $unreadableTxt)) }

@($summaryLines) | Set-Content -Encoding UTF8 -Path $summaryTxt

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Outputs:" -ForegroundColor Cyan
Write-Host "  $filesCsv"
Write-Host "  $importsCsv"
Write-Host "  $importsJson"
Write-Host "  $summaryTxt"
if ($unreadable.Count -gt 0) { Write-Host "  $unreadableTxt" }
Write-Host ""
Write-Host "Opening output folder..." -ForegroundColor Cyan
Start-Process $outDir
