[CmdletBinding()]
param(
    [ValidateRange(1, 65535)][int]$Port = 4318,
    [string]$TaskName = 'Jang Global Seeding Dashboard'
)

$ErrorActionPreference = 'Stop'
$AgenticRoot = if ([string]::IsNullOrWhiteSpace($env:AGENTIC_ROOT)) { 'D:\build-agentic-AI' } else { $env:AGENTIC_ROOT }
$RuntimeRoot = if ([string]::IsNullOrWhiteSpace($env:SEEDING_DATA_DIR)) { Join-Path $AgenticRoot '.agentic\marketing-seeding' } else { $env:SEEDING_DATA_DIR }
$PidFile = Join-Path $RuntimeRoot 'server.pid.json'
$LeaseFile = Join-Path $RuntimeRoot 'state.json.writer.lock'
$HealthUrl = "http://127.0.0.1:$Port/health"

$health = $null
try { $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2 } catch {}
$pidRecord = if (Test-Path -LiteralPath $PidFile) { Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json } else { $null }
$recordPid = if ($pidRecord -and $pidRecord.pid) { [int]$pidRecord.pid } else { $null }
$healthPid = if ($health -and $health.runtime -and $health.runtime.pid) { [int]$health.runtime.pid } else { $null }
$portOwner = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$portOwnerPid = if ($portOwner) { [int]$portOwner.OwningProcess } else { $null }
$processInfo = if ($recordPid) { Get-CimInstance Win32_Process -Filter "ProcessId=$recordPid" -ErrorAction SilentlyContinue } else { $null }
$processMatchesServer = [bool]($processInfo -and $processInfo.ExecutablePath -match '\\node\.exe$' -and $processInfo.CommandLine -match 'src/server\.mjs')
$portOwnerInfo = if ($portOwnerPid) { Get-CimInstance Win32_Process -Filter "ProcessId=$portOwnerPid" -ErrorAction SilentlyContinue } else { $null }
$portOwnerMatchesServer = [bool]($portOwnerInfo -and $portOwnerInfo.ExecutablePath -match '\\node\.exe$' -and $portOwnerInfo.CommandLine -match 'src/server\.mjs')
$pidRecordMatchesProcess = [bool]($recordPid -and $recordPid -eq $portOwnerPid -and $processMatchesServer)
$pidRecordMatchesLiveService = [bool]($recordPid -and $recordPid -eq $healthPid -and $recordPid -eq $portOwnerPid -and $processMatchesServer)
$lease = if (Test-Path -LiteralPath $LeaseFile) { try { Get-Content -LiteralPath $LeaseFile -Raw | ConvertFrom-Json } catch { $null } } else { $null }
$supervisor = if ($pidRecord -and $pidRecord.supervisorPid) { Get-Process -Id ([int]$pidRecord.supervisorPid) -ErrorAction SilentlyContinue } else { $null }
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

[pscustomobject]@{
    ready = [bool]($health -and $health.ok -and $portOwnerPid -and $portOwnerMatchesServer)
    url = "http://127.0.0.1:$Port"
    pid = if ($healthPid) { $healthPid } else { $portOwnerPid }
    pidRecordPid = $recordPid
    pidRecordMatchesLiveService = $pidRecordMatchesLiveService
    pidRecordMatchesProcess = $pidRecordMatchesProcess
    stalePidRecord = [bool]($recordPid -and -not $pidRecordMatchesProcess)
    processAlive = [bool]$processMatchesServer
    portOwnerPid = $portOwnerPid
    supervisorPid = if ($supervisor) { [int]$supervisor.Id } elseif ($pidRecord -and $pidRecord.supervisorPid) { [int]$pidRecord.supervisorPid } else { $null }
    supervisorAlive = [bool]$supervisor
    scheduledTaskState = if ($task) { [string]$task.State } else { 'not-installed' }
    writerLockPid = if ($lease) { $lease.pid } else { $null }
    writerLockMatchesService = [bool]($lease -and $portOwnerPid -eq [int]$lease.pid -and $portOwnerMatchesServer)
    sourceCommit = if ($health -and $health.runtime) { $health.runtime.sourceCommit } else { $null }
    sourceDirty = if ($health -and $health.runtime) { $health.runtime.sourceDirty } else { $null }
    schemaVersion = if ($health -and $health.runtime) { $health.runtime.schemaVersion } else { $null }
    stateRevision = if ($health -and $health.runtime) { $health.runtime.stateRevision } else { $null }
} | ConvertTo-Json
