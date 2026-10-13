[CmdletBinding()]
param([ValidateRange(5, 120)][int]$TimeoutSeconds = 30)

$ErrorActionPreference = 'Stop'
$AgenticRoot = if ([string]::IsNullOrWhiteSpace($env:AGENTIC_ROOT)) { 'D:\build-agentic-AI' } else { $env:AGENTIC_ROOT }
$RuntimeRoot = if ([string]::IsNullOrWhiteSpace($env:SEEDING_DATA_DIR)) { Join-Path $AgenticRoot '.agentic\marketing-seeding' } else { $env:SEEDING_DATA_DIR }
$PidFile = Join-Path $RuntimeRoot 'server.pid.json'
$ControlTokenFile = Join-Path $RuntimeRoot 'control-token'
$StopRequestFile = Join-Path $RuntimeRoot 'server.stop-request.json'
$LeaseFile = Join-Path $RuntimeRoot 'state.json.writer.lock'
$HealthUrl = 'http://127.0.0.1:4318/health'
$ControlUrl = 'http://127.0.0.1:4318/internal/shutdown'
$TaskName = 'Jang Global Seeding Dashboard'

$pidRecord = if (Test-Path -LiteralPath $PidFile) { Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json } else { $null }
$health = $null
try { $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2 } catch {}
$servicePid = if ($health -and $health.runtime -and $health.runtime.pid) { [int]$health.runtime.pid } elseif ($pidRecord -and $pidRecord.pid) { [int]$pidRecord.pid } else { $null }
if (-not $servicePid) {
    $listener = Get-NetTCPConnection -LocalPort 4318 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) { throw "Port 4318 is occupied by PID $($listener.OwningProcess), but its service identity is unknown; refusing to stop it." }
    if (Test-Path -LiteralPath $LeaseFile) { throw 'No service PID is verifiable while the writer lock still exists; refusing to remove or alter it.' }
    Write-Output 'Dashboard is already stopped; no listener or writer lock exists.'
    exit 0
}
$processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$servicePid" -ErrorAction SilentlyContinue
$portOwner = Get-NetTCPConnection -LocalPort 4318 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$identityVerified = $processInfo -and $processInfo.ExecutablePath -match '\\node\.exe$' -and $processInfo.CommandLine -match 'src/server\.mjs' -and $portOwner -and [int]$portOwner.OwningProcess -eq $servicePid
if (-not $identityVerified) { throw "PID $servicePid is not the verified Node server owning port 4318; refusing to signal it." }
if ($health -and $health.runtime -and [int]$health.runtime.pid -ne $servicePid) { throw 'The health PID and runtime PID record disagree; refusing to signal.' }
if (-not (Test-Path -LiteralPath $ControlTokenFile)) { throw 'The protected local control token is missing; graceful stop is unavailable.' }
$controlToken = [IO.File]::ReadAllText($ControlTokenFile).Trim()
if ($controlToken.Length -lt 32) { throw 'The protected local control token is invalid.' }

$requestTemp = "$StopRequestFile.$PID.tmp"
[IO.File]::WriteAllText($requestTemp, (@{ pid = $servicePid; requestedAt = (Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
Move-Item -LiteralPath $requestTemp -Destination $StopRequestFile -Force | Out-Null
try {
    $result = Invoke-RestMethod -Method Post -Uri $ControlUrl -Headers @{ Authorization = "Bearer $controlToken" } -TimeoutSec 5
    if ($result.shutdown -ne 'accepted') { throw 'Local service did not accept the graceful shutdown request.' }
} catch {
    throw "Graceful shutdown request failed; no process termination was attempted. $($_.Exception.Message)"
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$stopped = $false
do {
    $process = Get-Process -Id $servicePid -ErrorAction SilentlyContinue
    $portOwner = Get-NetTCPConnection -LocalPort 4318 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    $lock = if (Test-Path -LiteralPath $LeaseFile) { try { Get-Content -LiteralPath $LeaseFile -Raw | ConvertFrom-Json } catch { $null } } else { $null }
    if (-not $process -and -not $portOwner -and -not $lock) { $stopped = $true; break }
    Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)

if (-not $stopped) {
    throw "Graceful stop timed out for PID $servicePid. PID, port, or writer lock remains; no force termination was attempted."
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$taskDeadline = (Get-Date).AddSeconds(10)
while ($task -and $task.State -eq 'Running' -and (Get-Date) -lt $taskDeadline) {
    Start-Sleep -Milliseconds 250
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}
Write-Output "Dashboard stopped gracefully. PID $servicePid exited; port 4318 and writer lock are released. Scheduled task state: $(if ($task) { $task.State } else { 'not-installed' })."
