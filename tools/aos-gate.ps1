<# ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-ORDER
TAG: TOOLS.POWERSHELL.AOS_GATE_RUNNER.MAIN
REGION: 🟣 MCP
VERSION: 1.0.0
DISCOVERY_PIPELINE:
  MODEL: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
  ROLE: runner
  INTENT_SCOPE: repo.browser-readiness.gate.run
  LOCATION_DEP: local
  VERTICALS: ai, ui, data
  RENDER_SURFACE: cli
  SPEC_REF: LEEWAY.v12.DiscoveryArchitecture
============================================================================ #>

param([string]$Root = "B:\AgenticOperatingSystem")
pwsh -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\aos-browser-gate.ps1" -Root $Root
exit $LASTEXITCODE
