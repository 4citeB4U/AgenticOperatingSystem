<# ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-ORDER
TAG: TOOLS.POWERSHELL.AOS_AI_SMOKE.MAIN
REGION: 🟣 MCP
VERSION: 2.0.0
===============================================================================
AOS AI + UI Smoke Test (Playwright-driven, Windows-safe, Agent-aware)

Goals:
- Start Vite (dev or preview) WITHOUT npx.ps1 execution-policy issues (cmd.exe + npm exec)
- Capture Vite stdout/stderr to log files
- Wait for HTTP readiness (and fail fast if Vite exits early)
- Run Playwright (chromium) via node_modules (no npx.ps1)
- Probe window.AGENT_CONTROL:
    - detect call surface (invoke/call/exec/dispatch/run)
    - enumerate registry keys (Map/Object) when exposed
    - run per-module action tests (MemoryLake, EmailCenter, CommunicationsOutlet, SystemSettings)
    - best-effort orchestrator tests if registry contains likely keys
- Minimal UI fallback clicks (aria-label based)
- Write artifacts under:
    tools\logs\aos-ai-smoke-YYYYMMDD-HHMMSS\

DISCOVERY_PIPELINE:
  MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
  ROLE=verification;
  INTENT_SCOPE=smoke_test;
  LOCATION_DEP=repo;
  VERTICALS=ai,ui,rag;
  RENDER_SURFACE=browser;
  SPEC_REF=LEEWAY.v12.DiscoveryArchitecture
SPDX-License-Identifier: MIT
============================================================================ #>

<# PSScriptAnalyzerSettings
@{
  DisabledRules = @(
    'PSAvoidUsingWriteHost',
    'PSAvoidUsingEmptyCatchBlock',
    'PSAvoidGlobalVars',
    'PSUseBOMForUnicodeEncodedFile'
  )
}
#>

[CmdletBinding()]
param(
  [string]$Root = "B:\AgenticOperatingSystem",
  [ValidateSet("dev","preview")] [string]$Mode = "dev",
  [int]$Port = 5173,
  [string]$ListenHost = "127.0.0.1",

  # Use [bool] defaults (avoid PSAvoidDefaultValueSwitchParameter)
  [bool]$Headed = $false,
  [int]$TimeoutMs = 90000,
  [bool]$KillStuckFirst = $true,
  [bool]$KillPortOwner = $true,
  [int]$MaxServerLogKB = 512
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function _Stamp { Get-Date -Format "yyyyMMdd-HHmmss" }
function _Step([string]$m){ Write-Host "[AOS-SMOKE] $m" -ForegroundColor Cyan }
function _Ok([string]$m){   Write-Host "[OK] $m" -ForegroundColor Green }
function _Warn([string]$m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function _Die([string]$m){ throw $m }

function Assert-Path([string]$p,[string]$label){
  if (-not (Test-Path -LiteralPath $p)) { _Die ("Missing {0}: {1}" -f $label, $p) }
}

function _GetRepoBoundProcs([string]$repoRoot){
  $esc = [regex]::Escape($repoRoot)
  Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and ($_.CommandLine -match $esc -or $_.CommandLine -match 'playwright|vite|aos-ai-smoke')
  }
}

function _StopProcTree([int]$ProcId){
  $kids = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcId }
  foreach ($k in $kids) { _StopProcTree -ProcId $k.ProcessId }
  Stop-Process -Id $ProcId -Force -ErrorAction SilentlyContinue
}

function Stop-StuckAos([string]$repoRoot){
  _Step "Scanning for repo-bound stuck processes..."
  $procs = _GetRepoBoundProcs -repoRoot $repoRoot | Where-Object {
    $_.ProcessId -ne $PID -and $_.Name -in @('pwsh.exe','powershell.exe','cmd.exe','node.exe','conhost.exe','chrome.exe','msedge.exe')
  }
  if (-not $procs) { _Ok "No repo-bound stuck processes found."; return }

  foreach ($p in ($procs | Sort-Object ProcessId -Descending)) {
    _Warn ("Stopping PID {0} ({1})" -f $p.ProcessId, $p.Name)
    _StopProcTree -ProcId $p.ProcessId
  }
  _Ok "Cleanup complete."
}

function Stop-PortOwner([int]$LocalPort){
  try {
    $conns = Get-NetTCPConnection -LocalPort $LocalPort -ErrorAction Stop | Where-Object { $_.State -in @('Listen','Established') }
    if (-not $conns) { return }
    $procIds = $conns.OwningProcess | Sort-Object -Unique
    foreach ($procId in $procIds) {
      if ($procId -and ($procId -ne $PID)) {
        _Warn ("Killing process owning port {0} (PID {1})" -f $LocalPort, $procId)
        _StopProcTree -ProcId $procId
      }
    }
  } catch {
    # ignore if not available
  }
}

function _WaitHttpOk([string]$url,[int]$timeoutMs,[System.Diagnostics.Process]$serverProc){
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $timeoutMs) {
    if ($serverProc -and $serverProc.HasExited) { return $false }
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 350
  }
  return $false
}

function Start-LongRunningCmd(
  [string]$workDir,
  [string]$cmdLine,
  [string]$stdoutFile,
  [string]$stderrFile
){
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $env:ComSpec
  $psi.Arguments = "/c $cmdLine"
  $psi.WorkingDirectory = $workDir
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $p.EnableRaisingEvents = $true

  $outStream = [System.IO.StreamWriter]::new($stdoutFile, $false, [System.Text.Encoding]::UTF8)
  $errStream = [System.IO.StreamWriter]::new($stderrFile, $false, [System.Text.Encoding]::UTF8)

  $p.add_OutputDataReceived([System.Diagnostics.DataReceivedEventHandler]{
    param($src,$evt)
    if ($null -ne $evt.Data) { $outStream.WriteLine($evt.Data); $outStream.Flush() }
  })
  $p.add_ErrorDataReceived([System.Diagnostics.DataReceivedEventHandler]{
    param($src,$evt)
    if ($null -ne $evt.Data) { $errStream.WriteLine($evt.Data); $errStream.Flush() }
  })
  $p.add_Exited({
    try { $outStream.Dispose() } catch {}
    try { $errStream.Dispose() } catch {}
  })

  $null = $p.Start()
  $p.BeginOutputReadLine()
  $p.BeginErrorReadLine()
  return $p
}

function Install-PlaywrightChromium([string]$repoRoot,[string]$logDir){
  _Step "Installing Playwright + chromium if missing (no npx.ps1)..."
  $cli = Join-Path $repoRoot "node_modules\@playwright\test\cli.js"

  if (-not (Test-Path -LiteralPath $cli)) {
    _Step "Installing @playwright/test..."
    & $env:ComSpec /c "npm i -D @playwright/test" `
      1> (Join-Path $logDir "npm-playwright-install.stdout.txt") `
      2> (Join-Path $logDir "npm-playwright-install.stderr.txt")
    if ($LASTEXITCODE -ne 0) { _Die "Failed to install @playwright/test. See log dir." }
  }

  & $env:ComSpec /c "node .\node_modules\@playwright\test\cli.js install chromium" `
    1> (Join-Path $logDir "playwright-cli-install.stdout.txt") `
    2> (Join-Path $logDir "playwright-cli-install.stderr.txt")

  if ($LASTEXITCODE -ne 0) { _Die "Playwright chromium install failed. See log dir." }
  _Ok "Playwright chromium ready."
}

function Start-Vite([string]$repoRoot,[string]$mode,[string]$listenHost,[int]$port,[string]$logDir){
  $viteStdOut = Join-Path $logDir "vite.stdout.txt"
  $viteStdErr = Join-Path $logDir "vite.stderr.txt"

  if ($mode -eq "preview") {
    _Step "Building for preview..."
    & $env:ComSpec /c "npm run build" `
      1> (Join-Path $logDir "vite-build.stdout.txt") `
      2> (Join-Path $logDir "vite-build.stderr.txt")
    if ($LASTEXITCODE -ne 0) { _Die "Build failed. See vite-build.stderr.txt" }

    $cmd = "npm exec --yes vite preview -- --host $listenHost --port $port"
    _Step ("Starting Vite preview -> http://{0}:{1}/" -f $listenHost, $port)
    return Start-LongRunningCmd -workDir $repoRoot -cmdLine $cmd -stdoutFile $viteStdOut -stderrFile $viteStdErr
  }

  $cmd2 = "npm exec --yes vite -- --host $listenHost --port $port"
  _Step ("Starting Vite dev -> http://{0}:{1}/" -f $listenHost, $port)
  return Start-LongRunningCmd -workDir $repoRoot -cmdLine $cmd2 -stdoutFile $viteStdOut -stderrFile $viteStdErr
}

function Set-LogFileTail([string]$path,[int]$maxKB){
  try {
    if (-not (Test-Path -LiteralPath $path)) { return }
    $bytes = (Get-Item -LiteralPath $path).Length
    $limit = $maxKB * 1024
    if ($bytes -le $limit) { return }
    $tail = Get-Content -LiteralPath $path -Raw -ErrorAction Stop
    $tailBytes = [System.Text.Encoding]::UTF8.GetBytes($tail)
    if ($tailBytes.Length -le $limit) { return }
    # naive tail: keep last N chars
    $keep = [Math]::Max(1, [int]($tail.Length * ($limit / [double]$tailBytes.Length)))
    $trim = $tail.Substring([Math]::Max(0, $tail.Length - $keep))
    Set-Content -LiteralPath $path -Value $trim -Encoding UTF8
  } catch {}
}

# ---------------- MAIN ----------------
$Root = (Resolve-Path -LiteralPath $Root).Path
$BaseUrl = "http://$ListenHost`:$Port/"

$logDir = Join-Path $Root ("tools\logs\aos-ai-smoke-{0}" -f (_Stamp))
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Assert-Path $Root "Root"
Assert-Path (Join-Path $Root "package.json") "package.json"
Assert-Path (Join-Path $Root "node_modules") "node_modules (npm install required)"

if ($KillStuckFirst) { Stop-StuckAos -repoRoot $Root }
if ($KillPortOwner) { Stop-PortOwner -LocalPort $Port }

Install-PlaywrightChromium -repoRoot $Root -logDir $logDir

$serverProc = $null
try {
  $serverProc = Start-Vite -repoRoot $Root -mode $Mode -listenHost $ListenHost -port $Port -logDir $logDir

  if (-not (_WaitHttpOk -url $BaseUrl -timeoutMs $TimeoutMs -serverProc $serverProc)) {
    Set-LogFileTail (Join-Path $logDir "vite.stdout.txt") $MaxServerLogKB
    Set-LogFileTail (Join-Path $logDir "vite.stderr.txt") $MaxServerLogKB

    if ($serverProc -and $serverProc.HasExited) {
      _Die ("Vite exited early. See {0}" -f (Join-Path $logDir "vite.stderr.txt"))
    }
    _Die ("Server did not become ready within {0}ms: {1}" -f $TimeoutMs, $BaseUrl)
  }
  _Ok "Server ready."

  _Step "Writing Playwright runner..."
  $runner = Join-Path $logDir "aos-ai-smoke-runner.cjs"

  $runnerJs = @'
const fs = require("node:fs");
const path = require("node:path");

const baseUrl   = process.env.AOS_BASEURL;
const logDir    = process.env.AOS_LOGDIR;
const headed    = (process.env.AOS_HEADED || "0") === "1";
const timeoutMs = Number(process.env.AOS_TIMEOUT || "90000");

function out(name, text) {
  fs.writeFileSync(path.join(logDir, name), text, "utf8");
}
function asJson(x){ return JSON.stringify(x, null, 2); }
function nowIso(){ return new Date().toISOString(); }

(async () => {
  const { chromium } = require("@playwright/test");

  const results = {
    meta: { baseUrl, headed, timeoutMs, startedAt: nowIso() },
    agentControl: null,
    calls: [],
    ui: [],
    errors: [],
  };

  const consoleLines = [];
  const browser = await chromium.launch({ headless: !headed });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => consoleLines.push(`[pageerror] ${err?.message || String(err)}`));

  async function snap(tag){
    await page.screenshot({ path: path.join(logDir, `${tag}.png`), fullPage: true });
  }

  async function evalAgentControl(){
    return await page.evaluate(() => {
      const ac = window.AGENT_CONTROL || window.__AGENT_CONTROL__ || window.agentControl || null;
      const info = { present: !!ac, keys: [], registryKeys: [], registryType: null, callShape: {} };
      if (!ac) return info;

      info.keys = Object.keys(ac);

      const reg = ac.registry || ac._registry || ac.REGISTRY || ac.handlers || ac._handlers || ac.map || null;
      try {
        if (reg instanceof Map) {
          info.registryType = "Map";
          info.registryKeys = Array.from(reg.keys());
        } else if (reg) {
          info.registryType = "Object";
          info.registryKeys = Object.keys(reg);
        }
      } catch {}
  
      info.callShape = {
        hasInvoke: typeof ac.invoke === "function",
        hasCall: typeof ac.call === "function",
        hasExec: typeof ac.exec === "function",
        hasDispatch: typeof ac.dispatch === "function",
        hasRun: typeof ac.run === "function",
      };

      return info;
    });
  }

  async function tryAC(component, method, args){
    return await page.evaluate(async ({ component, method, args }) => {
      const ac = window.AGENT_CONTROL || window.__AGENT_CONTROL__ || window.agentControl || null;
      if (!ac) return { ok:false, error:"AGENT_CONTROL missing" };

      const candidates = [
        (c,m,a) => ac.invoke?.(c,m,a),
        (c,m,a) => ac.call?.(c,m,a),
        (c,m,a) => ac.exec?.(c,m,a),
        (c,m,a) => ac.dispatch?.(c,m,a),
        (c,m,a) => ac.run?.(c,m,a),
      ];

      for (const fn of candidates) {
        try {
          if (typeof fn !== "function") continue;
          const res = await fn(component, method, args);
          return { ok:true, res };
        } catch (e) {}
      }

      // fallback: direct registry access if exposed
      const reg = ac.registry || ac._registry || ac.handlers || ac._handlers || null;
      try {
        const target = reg instanceof Map ? reg.get(component) : reg?.[component];
        if (!target) return { ok:false, error:`No component registered: ${component}` };
        const f = target?.[method];
        if (typeof f !== "function") return { ok:false, error:`No method: ${component}.${method}` };
        const r = await f(args);
        return { ok:true, res:r };
      } catch (e) {
        return { ok:false, error: e?.message || String(e) };
      }
    }, { component, method, args });
  }

  async function clickIfExists(locator){
    try {
      const n = await locator.count();
      if (n > 0) { await locator.first().click({ timeout: 5000 }); return true; }
    } catch {}
    return false;
  }

  function record(scope, component, method, args, r){
    results.calls.push({ ts: nowIso(), scope, component, method, args, result: r });
  }

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(900);

    const acInfo = await evalAgentControl();
    results.agentControl = acInfo;

    // -------- per-module tests (non-destructive) --------
    const perComponentPlan = [
      // MemoryLake (RAG-ish)
      { scope:"component", c:"MemoryLake", m:"list", a:{ pathPrefix:"agent/", limit:10 } },
      { scope:"component", c:"MemoryLake", m:"list", a:{ pathPrefix:"agent/actions/", limit:10 } },

      // EmailCenter
      { scope:"component", c:"EmailCenter", m:"openFolder", a:{ folder:"INBOX" } },
      { scope:"component", c:"EmailCenter", m:"searchMail", a:{ q:"System" } },

      // CommunicationsOutlet
      { scope:"component", c:"CommunicationsOutlet", m:"openTab", a:{ tab:"phone" } },
      { scope:"component", c:"CommunicationsOutlet", m:"openNotes", a:{} },
      { scope:"component", c:"CommunicationsOutlet", m:"closeNotes", a:{} },
      { scope:"component", c:"CommunicationsOutlet", m:"addContact", a:{ name:"Smoke Tester", number:"5550001111" } },

      // SystemSettings (best-effort harmless reads)
      { scope:"component", c:"SystemSettings", m:"get", a:{} },
      { scope:"component", c:"SystemSettings", m:"read", a:{} },
      { scope:"component", c:"SystemSettings", m:"snapshot", a:{} },
    ];

    for (const t of perComponentPlan) {
      const r = await tryAC(t.c, t.m, t.a);
      record(t.scope, t.c, t.m, t.a, r);
    }

    // -------- orchestrator tests (only if registry exposes likely keys) --------
    const registryKeys = Array.isArray(acInfo.registryKeys) ? acInfo.registryKeys : [];
    const orchestratorCandidates = [
      "AgentLee","AgentLeeCore","AgentLeeOS","AOS","Orchestrator","Shell","Navigator","CoreRegistry","App"
    ];
    const found = orchestratorCandidates.filter(k => registryKeys.includes(k));
    const navMethods = ["navigate","open","close","openPanel","closePanel","setActiveSection","setRoute"];

    for (const oc of found) {
      for (const nm of navMethods) {
        const r = await tryAC(oc, nm, { target:"home" });
        record("orchestrator", oc, nm, { target:"home" }, r);
      }
    }

    // -------- UI fallback clicks --------
    results.ui.push({ ts: nowIso(), step:"click_open_sidebar", ok: await clickIfExists(page.getByLabel("Open sidebar")) });
    results.ui.push({ ts: nowIso(), step:"click_close_agent_panel", ok: await clickIfExists(page.getByLabel("Close agent panel")) });

    await snap("final");
    out("browser-console.txt", consoleLines.join("\n") + "\n");
    out("results.json", asJson(results));

    const anyComponentOk = results.calls.some(x => x.scope === "component" && x.result && x.result.ok === true);
    if (acInfo.present && !anyComponentOk) {
      throw new Error("AGENT_CONTROL present but no component calls succeeded. Ensure component keys match + expose invoke/call/exec/dispatch/run OR registry handlers.");
    }

    process.exit(0);
  } catch (e) {
    results.errors.push({ ts: nowIso(), error: e?.message || String(e) });
    try { await snap("failure"); } catch {}
    out("browser-console.txt", consoleLines.join("\n") + "\n");
    out("results.json", asJson(results));
    console.error("[SMOKE-FAIL]", e?.message || e);
    process.exit(1);
  } finally {
    await page.close().catch(()=>{});
    await ctx.close().catch(()=>{});
    await browser.close().catch(()=>{});
  }
})();
'@

  Set-Content -LiteralPath $runner -Value $runnerJs -Encoding UTF8

  $env:AOS_BASEURL = $BaseUrl
  $env:AOS_LOGDIR  = $logDir
  $env:AOS_HEADED  = ($Headed ? '1' : '0')
  $env:AOS_TIMEOUT = "$TimeoutMs"

  _Step "Running Playwright smoke..."
  & $env:ComSpec /c ("node `"{0}`"" -f $runner) `
    1> (Join-Path $logDir "node.stdout.txt") `
    2> (Join-Path $logDir "node.stderr.txt")

  if ($LASTEXITCODE -ne 0) {
    _Die ("Smoke test failed. See {0}" -f (Join-Path $logDir "results.json"))
  }

  _Ok ("Smoke test PASS. Artifacts: {0}" -f $logDir)
}
finally {
  try {
    if ($serverProc -and -not $serverProc.HasExited) {
      _Warn ("Stopping Vite PID {0}" -f $serverProc.Id)
      _StopProcTree -ProcId $serverProc.Id
    }
  } catch {}

  Set-LogFileTail (Join-Path $logDir "vite.stdout.txt") $MaxServerLogKB
  Set-LogFileTail (Join-Path $logDir "vite.stderr.txt") $MaxServerLogKB
  

  if ($KillStuckFirst) { Stop-StuckAos -repoRoot $Root }
}
