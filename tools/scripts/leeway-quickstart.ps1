# ============================================================================
# LEEWAY Compliance Quick-Start Script
# Installs audit system and runs initial compliance check
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "🚀 LEEWAY Compliance Quick-Start" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Step 1: Check if tsx is installed
Write-Host "📦 Checking dependencies..." -ForegroundColor White

try {
    npm list tsx --depth=0 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⬇️  Installing tsx..." -ForegroundColor Yellow
        npm install --save-dev tsx | Out-Null
        Write-Host "  ✅ tsx installed" -ForegroundColor Green
    } else {
        Write-Host "  ✅ tsx already installed" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ Failed to install tsx" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Check if audit files exist
Write-Host "📄 Checking audit system files..." -ForegroundColor White

$auditSystemPath = "src/LeeWayAuditSystem.ts"
$auditCliPath = "src/leeway-audit.ts"

$filesExist = (Test-Path $auditSystemPath) -and (Test-Path $auditCliPath)

if (-not $filesExist) {
    Write-Host "  ⚠️  Audit system files not found" -ForegroundColor Yellow
    Write-Host "  💡 Please copy the following files to your project:" -ForegroundColor Cyan
    Write-Host "     - src/LeeWayAuditSystem.ts" -ForegroundColor Gray
    Write-Host "     - src/leeway-audit.ts" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  📚 See setup guide for details" -ForegroundColor Cyan
    exit 1
}

Write-Host "  ✅ Audit system files found" -ForegroundColor Green
Write-Host ""

# Step 3: Add npm scripts to package.json
Write-Host "📝 Updating package.json scripts..." -ForegroundColor White

$packageJsonPath = "package.json"
$packageJson = Get-Content $packageJsonPath | ConvertFrom-Json

# Check if scripts already exist
$needsUpdate = $false

$requiredScripts = @{
    "leeway:audit" = "tsx src/leeway-audit.ts"
    "leeway:fix" = "tsx src/leeway-audit.ts --fix"
    "leeway:report" = "tsx src/leeway-audit.ts --report"
}

foreach ($scriptName in $requiredScripts.Keys) {
    if (-not $packageJson.scripts.$scriptName) {
        $needsUpdate = $true
        break
    }
}

if ($needsUpdate) {
    # Add scripts
    foreach ($scriptName in $requiredScripts.Keys) {
        $packageJson.scripts | Add-Member -NotePropertyName $scriptName -NotePropertyValue $requiredScripts[$scriptName] -Force
    }
    
    # Save package.json
    $packageJson | ConvertTo-Json -Depth 100 | Set-Content $packageJsonPath
    Write-Host "  ✅ Scripts added to package.json" -ForegroundColor Green
} else {
    Write-Host "  ✅ Scripts already configured" -ForegroundColor Green
}

Write-Host ""

# Step 4: Run initial audit
Write-Host "🔍 Running initial compliance audit..." -ForegroundColor White
Write-Host ""

try {
    npm run leeway:audit
    $auditExitCode = $LASTEXITCODE
} catch {
    $auditExitCode = 1
}

Write-Host ""

# Step 5: Provide next steps based on results
if ($auditExitCode -eq 0) {
    Write-Host "✅ Your project is LEEWAY compliant! 🎉" -ForegroundColor Green
    Write-Host ""
    Write-Host "Recommended next steps:" -ForegroundColor Cyan
    Write-Host "  • Run 'npm run leeway:report' for detailed analysis" -ForegroundColor Gray
    Write-Host "  • Add CI check to maintain compliance" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Compliance issues detected" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps to fix:" -ForegroundColor Cyan
    Write-Host "  1. Review the report above" -ForegroundColor White
    Write-Host "  2. Run: npm run leeway:fix" -ForegroundColor Green
    Write-Host "  3. Review changes: git diff" -ForegroundColor White
    Write-Host "  4. Run audit again: npm run leeway:audit" -ForegroundColor White
    Write-Host ""
    Write-Host "📚 See LEEWAY_SETUP_GUIDE.md for detailed instructions" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Done! ✨" -ForegroundColor Green
Write-Host ""