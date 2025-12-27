<#
leeway-agentic-smoke-dashboard.ps1

Usage:
  powershell -ExecutionPolicy Bypass -File .\leeway-agentic-smoke-dashboard.ps1

This script launches a simple Windows Forms UI to run read-only checks and writes logs
into <RepoRoot>\logs\leeway-agentic-smoke\<timestamp>\
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Get-Timestamp { Get-Date -Format 'yyyyMMdd-HHmmss' }

# Default repo root is current working directory; allow user to change via dialog
$defaultRepo = (Get-Location).Path
$RepoRoot = $defaultRepo

# UI elements
$form = New-Object System.Windows.Forms.Form
$form.Text = "LEEWAY Agentic Smoke Dashboard"
$form.Size = New-Object System.Drawing.Size(760,560)
$form.StartPosition = 'CenterScreen'

$lblRepo = New-Object System.Windows.Forms.Label
$lblRepo.Text = "Repo Root:"
$lblRepo.AutoSize = $true
$lblRepo.Location = New-Object System.Drawing.Point(12,12)
$form.Controls.Add($lblRepo)

$txtRepo = New-Object System.Windows.Forms.TextBox
$txtRepo.Location = New-Object System.Drawing.Point(90,8)
$txtRepo.Size = New-Object System.Drawing.Size(540,22)
$txtRepo.Text = $RepoRoot
$form.Controls.Add($txtRepo)

$btnBrowse = New-Object System.Windows.Forms.Button
$btnBrowse.Text = "Browse"
$btnBrowse.Location = New-Object System.Drawing.Point(640,6)
$btnBrowse.Size = New-Object System.Drawing.Size(100,24)
$btnBrowse.Add_Click({
    $fbd = New-Object System.Windows.Forms.FolderBrowserDialog
    $fbd.SelectedPath = $txtRepo.Text
    if ($fbd.ShowDialog() -eq 'OK') { $txtRepo.Text = $fbd.SelectedPath }
})
$form.Controls.Add($btnBrowse)

$group = New-Object System.Windows.Forms.GroupBox
$group.Text = "Checks"
$group.Location = New-Object System.Drawing.Point(12,40)
$group.Size = New-Object System.Drawing.Size(728,180)
$form.Controls.Add($group)

$checks = @{}
$labels = @("Toolchain","Models","LEEWAY Compliance","LLM Health","LLM Behavior Suite","RAG Eval","Browser + Axe (optional)")
$y = 20
foreach ($label in $labels) {
    $cb = New-Object System.Windows.Forms.CheckBox
    $cb.AutoSize = $true
    $cb.Text = $label
    $cb.Location = New-Object System.Drawing.Point(12,$y)
    $group.Controls.Add($cb)
    $checks[$label] = $cb
    $y += 26
}

$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = "Start Checks"
$btnStart.Location = New-Object System.Drawing.Point(12,232)
$btnStart.Size = New-Object System.Drawing.Size(110,30)
$form.Controls.Add($btnStart)

$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = "Close"
$btnCancel.Location = New-Object System.Drawing.Point(132,232)
$btnCancel.Size = New-Object System.Drawing.Size(110,30)
$btnCancel.Add_Click({ $form.Close() })
$form.Controls.Add($btnCancel)

# Output box
$txtOut = New-Object System.Windows.Forms.TextBox
$txtOut.Location = New-Object System.Drawing.Point(12,270)
$txtOut.Size = New-Object System.Drawing.Size(728,260)
$txtOut.Multiline = $true
$txtOut.ScrollBars = 'Vertical'
$txtOut.ReadOnly = $true
$txtOut.Font = New-Object System.Drawing.Font('Consolas',9)
$form.Controls.Add($txtOut)

# Helpers
function Write-Log([string]$s) {
    $time = Get-Date -Format 'HH:mm:ss'
    $line = "[$time] $s"
    $txtOut.AppendText($line + [Environment]::NewLine)
    $Global:sessionLines.Add($line)
}

function Save-FileText([string]$path, [string]$text) {
    New-Item -ItemType Directory -Path (Split-Path $path) -Force | Out-Null
    [System.IO.File]::WriteAllText($path, $text)
}

function Save-Json([string]$path, $obj) {
    $json = $obj | ConvertTo-Json -Depth 10
    Save-FileText -path $path -text $json
}

# Core runner
$btnStart.Add_Click({
    $RepoRoot = $txtRepo.Text.Trim()
    if (-not (Test-Path $RepoRoot)) { [System.Windows.Forms.MessageBox]::Show("Repo root not found: $RepoRoot","Error","OK","Error") | Out-Null; return }

    # prepare logs dir
    $ts = Get-Timestamp
    $publicRoot = Join-Path $RepoRoot 'public'
    $LogFolder = Join-Path -Path (Join-Path $RepoRoot 'logs') -ChildPath (Join-Path 'leeway-agentic-smoke' $ts)
    New-Item -ItemType Directory -Path $LogFolder -Force | Out-Null
    $sessionLog = Join-Path $LogFolder 'session.log'
    $resultsJson = Join-Path $LogFolder 'results.json'
    $resultsMd = Join-Path $LogFolder 'results.md'
    $devserver_out = Join-Path $LogFolder 'devserver_output.txt'
    $axe_stdout = Join-Path $LogFolder 'axe_stdout.txt'
    $axe_stderr = Join-Path $LogFolder 'axe_stderr.txt'
    $axe_results = Join-Path $LogFolder 'axe-results.json'

    $Global:sessionLines = New-Object System.Collections.Generic.List[string]
    Write-Log "Run started. Logs: $LogFolder"

    $results = [ordered]@{
        timestamp = $ts
        repo = $RepoRoot
        checks = @{}
    }

    # TOOLCHAIN check
    if ($checks['Toolchain'].Checked) {
        Write-Log "Running Toolchain check..."
        $toolchain = @{}
        $tools = @{ node='node'; npm='npm'; python='python'; git='git'; docker='docker' }
        foreach ($k in $tools.Keys) {
            $exe = $tools[$k]
            $cmd = Get-Command $exe -ErrorAction SilentlyContinue
            if ($cmd) {
                try {
                    $ver = & $exe --version 2>&1 | Out-String
                    $ver = $ver.Trim()
                } catch { $ver = "(found, version unknown)" }
                $toolchain[$k] = @{ present = $true; version = $ver }
                Write-Log "  $k: present ($ver)"
            } else {
                $toolchain[$k] = @{ present = $false; version = $null }
                Write-Log "  $k: NOT FOUND"
            }
        }
        $results.checks.Toolchain = $toolchain
    }

    # MODELS check
    if ($checks['Models'].Checked) {
        Write-Log "Running Models check..."
        $publicRoot = Join-Path $RepoRoot 'public'
        $modelsRoot = Join-Path $publicRoot 'models'
        $modelSummary = [ordered]@{}
        $exists = Test-Path $modelsRoot
        $modelSummary.exists = $exists
        if ($exists) {
            $onnx = Get-ChildItem -Path $modelsRoot -Recurse -File -Include *.onnx -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count
            $wasm = Get-ChildItem -Path $modelsRoot -Recurse -File -Include *.wasm -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count
            $jsons = Get-ChildItem -Path $modelsRoot -Recurse -File -Include *.json -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count
            $modelSummary.counts = @{ onnx=$onnx; wasm=$wasm; json=$jsons }
            Write-Log "  Models folder found. onnx=$onnx, wasm=$wasm, json=$jsons"

            # attempt to serve public folder and GET up to 5 sample assets
            $port = 0
            $pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Path
            if ($pythonExe) {
                # pick random free port
                $listener = New-Object System.Net.Sockets.TcpListener([IPAddress]::Loopback,0)
                $listener.Start()
                $port = ($listener.LocalEndpoint).Port
                $listener.Stop()
                try {
                    $psArgs = "-m http.server $port --bind 127.0.0.1"
                    $proc = Start-Process -FilePath $pythonExe -ArgumentList $psArgs -WorkingDirectory $publicRoot -PassThru -WindowStyle Hidden
                    Start-Sleep -Seconds 1
                    Write-Log "  Started temporary static server on port $port (PID $($proc.Id))"
                    $modelSummary.devserver = @{ port = $port; pid = $proc.Id }

                    $assetSamples = Get-ChildItem -Path $modelsRoot -Recurse -File | Select-Object -First 5
                    $fetches = @()
                    foreach ($a in $assetSamples) {
                        $rel = $a.FullName.Substring($publicRoot.Length)
                        $rel = $rel.TrimStart('\')
                        $rel = $rel -replace '\\','/'
                        $url = ("http://127.0.0.1:{0}/{1}" -f $port, $rel)
                        try {
                            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
                            $ok = $r.StatusCode -eq 200
                        } catch { $ok = $false }
                        $fetches += @{ path = $rel; url = $url; ok = $ok }
                        Write-Log ("    GET {0} -> {1}" -f $rel, $ok)
                    }
                    $modelSummary.sampleFetches = $fetches
                } catch {
                    Write-Log "  Failed to start static server: $_"
                } finally {
                    if ($proc -and -not $proc.HasExited) {
                        try { $proc.Kill() } catch {}
                        Start-Sleep -Milliseconds 200
                    }
                }
            } else {
                Write-Log "  Python not found; skipping temporary server fetches."
            }
        } else {
            Write-Log "  Models folder not found at $modelsRoot"
        }
        $results.checks.Models = $modelSummary
    }

    # LEEWAY Compliance
    if ($checks['LEEWAY Compliance'].Checked) {
        Write-Log "Running LEEWAY compliance check..."
        $pkg = Join-Path $RepoRoot 'package.json'
        $comp = [ordered]@{ found = $false; ran = $false; output = $null; result = 'SKIPPED' }
        if (Test-Path $pkg) {
            $comp.found = $true
            try {
                $js = Get-Content $pkg -Raw | ConvertFrom-Json
                $scripts = $js.scripts
                $scriptName = $null
                if ($scripts.'leeway:audit') { $scriptName = 'leeway:audit' }
                elseif ($scripts.'leeway:check') { $scriptName = 'leeway:check' }
                if ($scriptName) {
                    Write-Log "  Found npm script '$scriptName' — running it (read-only assumption)"
                    $comp.ran = $true
                    $startInfo = & npm run $scriptName --silent 2>&1 | Out-String
                    $comp.output = $startInfo.Trim()
                    if ($comp.output -match 'PASS') { $comp.result = 'PASS' }
                    elseif ($comp.output -match 'WARN') { $comp.result = 'WARN' }
                    elseif ($comp.output -match 'FAIL') { $comp.result = 'FAIL' }
                    else { $comp.result = 'UNKNOWN' }
                    Write-Log "    result: $($comp.result)"
                } else {
                    Write-Log "  No leeway script found in package.json scripts"
                }
            } catch { Write-Log "  Error reading package.json: $_" }
        } else { Write-Log "  package.json not found; skipping" }
        $results.checks.LEEWAY = $comp
    }

    # LLM Health
    if ($checks['LLM Health'].Checked) {
        Write-Log "Running LLM Health check..."
        $llmFile = Join-Path $RepoRoot '.leeway.llm.json'
        $llmRes = [ordered]@{ found = $false; ran = $false; ok = $false; probeResponse = $null }
        if (Test-Path $llmFile) {
            $llmRes.found = $true
            try {
                $cfg = Get-Content $llmFile -Raw | ConvertFrom-Json
                $apiKey = $null
                if ($cfg.apiKeyEnv) { $apiKey = [Environment]::GetEnvironmentVariable($cfg.apiKeyEnv) }
                elseif ($cfg.apiKey) { $apiKey = $cfg.apiKey }
                if (-not $apiKey) { Write-Log "  API key env missing: $($cfg.apiKeyEnv)"; $llmRes.note = 'API key not found'; $results.checks.LLM = $llmRes }
                else {
                    $llmRes.ran = $true
                    $body = $null
                    # attempt standard chat format then fallback
                    $chatBody = @{ model = $cfg.modelId; messages = @(@{ role='user'; content = $cfg.healthPrompt }) }
                    $json = $chatBody | ConvertTo-Json -Depth 10
                    try {
                        $hdr = @{ Authorization = "Bearer $apiKey"; 'Content-Type'='application/json' }
                        $resp = Invoke-RestMethod -Method Post -Uri $cfg.endpointUrl -Body $json -Headers $hdr -TimeoutSec 30 -ErrorAction Stop
                        $llmRes.probeResponse = $resp
                        Write-Log "  LLM call success (chat-like)"
                    } catch {
                        Write-Log "  Chat-like request failed; trying simple prompt format..."
                        $simple = @{ prompt = $cfg.healthPrompt; model = $cfg.modelId }
                        try {
                            $resp2 = Invoke-RestMethod -Method Post -Uri $cfg.endpointUrl -Body ($simple|ConvertTo-Json -Depth 10) -Headers $hdr -TimeoutSec 30 -ErrorAction Stop
                            $llmRes.probeResponse = $resp2
                            Write-Log "  LLM call success (prompt-like)"
                        } catch {
                            Write-Log "  LLM call failed: $_"
                            $llmRes.probeResponse = "ERROR: $_"
                        }
                    }
                    # shallow validation: check expectedExact in returned text
                    $respText = ($llmRes.probeResponse | Out-String).Trim()
                    $llmRes.probeText = $respText
                    if ($cfg.expectedExact -and $respText -match [regex]::Escape($cfg.expectedExact)) { $llmRes.ok = $true; Write-Log "  Health probe matched expected exact string." }
                    else { $llmRes.ok = $false; Write-Log "  Health probe did not match expected exact string." }
                }
            } catch { Write-Log "  Error reading .leeway.llm.json: $_" }
        } else { Write-Log "  .leeway.llm.json not found; skipping" }
        $results.checks.LLMHealth = $llmRes
    }

    # LLM Behavior Suite
    if ($checks['LLM Behavior Suite'].Checked) {
        Write-Log "Running LLM Behavior Suite..."
        $testsFile = Join-Path $RepoRoot 'llm_behavior_tests.json'
        $beh = [ordered]@{ found = $false; results = @() }
        if (Test-Path $testsFile) {
            $beh.found = $true
            $tests = Get-Content $testsFile -Raw | ConvertFrom-Json
            foreach ($t in $tests) {
                $entry = [ordered]@{ name=$t.name; prompt=$t.prompt; ok=$false; details=@{} }
                # reuse .leeway.llm.json if present
                $llmFile = Join-Path $RepoRoot '.leeway.llm.json'
                if (Test-Path $llmFile) {
                    $cfg = Get-Content $llmFile -Raw | ConvertFrom-Json
                    $apiKey = [Environment]::GetEnvironmentVariable($cfg.apiKeyEnv)
                    if ($apiKey) {
                        $hdr = @{ Authorization = "Bearer $apiKey"; 'Content-Type'='application/json' }
                        $chatBody = @{ model = $cfg.modelId; messages = @(@{ role='user'; content = $t.prompt }) }
                        try {
                            $resp = Invoke-RestMethod -Method Post -Uri $cfg.endpointUrl -Body ($chatBody|ConvertTo-Json -Depth 10) -Headers $hdr -TimeoutSec 30
                            $text = ($resp | Out-String)
                            $entry.details.response = $text
                            $ok = $true
                            if ($t.mustContain) { foreach ($m in $t.mustContain) { if ($text -notmatch [regex]::Escape($m)) { $ok = $false } } }
                            if ($t.mustNotContain) { foreach ($n in $t.mustNotContain) { if ($text -match [regex]::Escape($n)) { $ok = $false } } }
                            $entry.ok = $ok
                            Write-Log "  Test '$($t.name)': $ok"
                        } catch { Write-Log "  Test '$($t.name)' failed to call LLM: $_"; $entry.details.error = $_ }
                    } else { Write-Log "  API key missing for behavior tests; skipping tests." }
                } else { Write-Log "  No .leeway.llm.json available for behavior tests; skipping" }
                $beh.results += $entry
            }
        } else { Write-Log "  llm_behavior_tests.json not found; skipping" }
        $results.checks.LLMBehavior = $beh
    }

    # RAG Eval
    if ($checks['RAG Eval'].Checked) {
        Write-Log "Running RAG Eval..."
        $f = Join-Path $RepoRoot 'rag_eval.json'
        $rag = [ordered]@{ found = $false; results = @() }
        if (Test-Path $f) {
            $rag.found = $true
            $cases = Get-Content $f -Raw | ConvertFrom-Json
            foreach ($c in $cases) {
                $entry = [ordered]@{ name=$c.name; query=$c.query; endpoint=$c.endpoint; ok=$false; response=$null }
                try {
                    $resp = Invoke-RestMethod -Method Post -Uri $c.endpoint -Body (@{ query=$c.query }|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 30
                    $entry.response = $resp
                    # try to find doc ids in response (common fields: docs, results)
                    $ids = @()
                    if ($resp.docs) { $ids = $resp.docs | ForEach-Object { $_.id } }
                    elseif ($resp.results) { $ids = $resp.results | ForEach-Object { $_.id } }
                    $entry.docIds = $ids
                    $missing = @()
                    foreach ($expected in $c.expectedDocIds) { if ($ids -notcontains $expected) { $missing += $expected } }
                    $entry.ok = ($missing.Count -eq 0)
                    Write-Log "  RAG '$($c.name)': OK=$($entry.ok)"
                } catch { Write-Log "  RAG '$($c.name)' call failed: $_"; $entry.error = $_ }
                $rag.results += $entry
            }
        } else { Write-Log "  rag_eval.json not found; skipping" }
        $results.checks.RAG = $rag
    }

    # Browser + Axe
    if ($checks['Browser + Axe (optional)'].Checked) {
        Write-Log "Running Browser + Axe (best-effort)..."
        $ba = [ordered]@{ attempted = $false; note = $null }
        $npxCmd = Get-Command npx -ErrorAction SilentlyContinue
        if (-not $npxCmd) { Write-Log "  npx not found; cannot run Playwright/Axe. Skipping."; $ba.note = 'npx not found' }
        else {
            $ba.attempted = $true
            # attempt to start dev server if npm script exists
            $pkg = Join-Path $RepoRoot 'package.json'
            $devProc = $null
            if (Test-Path $pkg) {
                $js = Get-Content $pkg -Raw | ConvertFrom-Json
                $devScript = $js.scripts.dev -or $js.scripts.start -or $js.scripts.serve
                if ($devScript) {
                    Write-Log "  Starting dev server via 'npm run dev|start|serve' (best-effort)"
                    try {
                        $proc = Start-Process -FilePath npm -ArgumentList 'run','dev' -WorkingDirectory $RepoRoot -PassThru -WindowStyle Hidden
                        Start-Sleep -Seconds 2
                        $devProc = $proc
                        Write-Log "    started dev server (PID $($proc.Id))"
                    } catch { Write-Log "    failed to start dev server: $_" }
                }
            }
            # attempt to run a Playwright + axe script via npx if available (best-effort)
            try {
                $cmd = "npx -y @axe-core/playwright --help"
                Write-Log "  Attempting to run axe-core/playwright (best-effort)"
                $null = & npx -y @axe-core/playwright --help 2>$null
                # If the above didn't error, try to run a scan against localhost:3000 (best-effort)
                $target = 'http://127.0.0.1:3000'
                Write-Log "  Running axe-core/playwright scan against $target"
                & npx -y @axe-core/playwright $target --output $axe_results *> $axe_stdout 2*> $axe_stderr
                Write-Log "  Axe scan attempted; outputs written to logs folder"
            } catch {
                Write-Log "  Axe/Playwright run failed or not installed: $_"
                $ba.note = 'axe/playwright not available or run failed'
            } finally {
                if ($devProc -and -not $devProc.HasExited) { try { $devProc.Kill() } catch {} }
            }
        }
        $results.checks.BrowserAxe = $ba
    }

    # finalize
    Write-Log "Writing logs and results..."
    Save-FileText -Path $sessionLog -Text ($Global:sessionLines -join "`r`n")
    Save-Json -Path $resultsJson -Obj $results

    # results.md quick summary
    $md = @()
    $md += "# LEEWAY Agentic Smoke Results - $ts"
    $md += "Repository: $RepoRoot"
    foreach ($k in $results.checks.Keys) {
        $md += "\n## $k"
        $val = $results.checks[$k]
        $md += "```json"
        $md += ($val | ConvertTo-Json -Depth 6)
        $md += "```"
    }
    Save-FileText -Path $resultsMd -Text ($md -join "`r`n")

    Write-Log "Run complete. Session log: $sessionLog"
    [System.Windows.Forms.MessageBox]::Show("Run complete. Logs written to:`n$LogFolder","Done","OK","Information") | Out-Null

    # update global todo - mark implemented
    $Global:done = $true
})

# Show form
$form.Add_Shown({ $form.Activate() })
[void]$form.ShowDialog()

# End
Write-Output "Script closed." 
