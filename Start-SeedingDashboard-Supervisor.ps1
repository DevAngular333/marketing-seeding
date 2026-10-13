[CmdletBinding()]
param(
    [ValidateRange(1, 3600)][int]$CheckIntervalSeconds = 5
)

$ErrorActionPreference = 'Stop'
$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $AppRoot 'Start-SeedingDashboard.ps1'
$AgenticRoot = if ([string]::IsNullOrWhiteSpace($env:AGENTIC_ROOT)) { 'D:\build-agentic-AI' } else { $env:AGENTIC_ROOT }
$RuntimeRoot = if ([string]::IsNullOrWhiteSpace($env:SEEDING_DATA_DIR)) { Join-Path $AgenticRoot '.agentic\marketing-seeding' } else { $env:SEEDING_DATA_DIR }
$PidFile = Join-Path $RuntimeRoot 'server.pid.json'
$StopRequestFile = Join-Path $RuntimeRoot 'server.stop-request.json'
$SupervisorLockFile = Join-Path $RuntimeRoot 'server.supervisor.lock'
$WriterLockFile = Join-Path $RuntimeRoot 'state.json.writer.lock'
$HealthUrl = 'http://127.0.0.1:4318/health'
$ControlTokenFile = Join-Path $RuntimeRoot 'control-token'
$lockHandle = $null
$child = $null
$stopToken = $null
$stopChildRequested = $false

function Get-Health {
    try { return Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2 } catch { return $null }
}

function Get-StopRequest {
    if (-not (Test-Path -LiteralPath $StopRequestFile)) { return $null }
    try { return Get-Content -LiteralPath $StopRequestFile -Raw | ConvertFrom-Json } catch { return $null }
}

function Load-StopToken {
    if (Test-Path -LiteralPath $ControlTokenFile) { $script:stopToken = [IO.File]::ReadAllText($ControlTokenFile).Trim() }
}

function Remove-PidRecordIfOwned([int]$ExpectedPid) {
    if (-not (Test-Path -LiteralPath $PidFile)) { return }
    try {
        $record = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
        if ([int]$record.pid -eq $ExpectedPid) { Remove-Item -LiteralPath $PidFile -Force }
    } catch {}
}

function Remove-StopRequestIfOwned([int]$ExpectedPid) {
    $request = Get-StopRequest
    if ($request -and [int]$request.pid -eq $ExpectedPid) { Remove-Item -LiteralPath $StopRequestFile -Force -ErrorAction SilentlyContinue }
}

function Write-StopRequest([int]$ExpectedPid) {
    $temp = "$StopRequestFile.$PID.tmp"
    [IO.File]::WriteAllText($temp, (@{ pid = $ExpectedPid; requestedAt = (Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temp -Destination $StopRequestFile -Force | Out-Null
}

function Request-ChildShutdown([int]$ExpectedPid) {
    $request = Get-StopRequest
    if (-not $request -or [int]$request.pid -ne $ExpectedPid) { return $false }
    try {
        $record = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
        $lease = Get-Content -LiteralPath $WriterLockFile -Raw | ConvertFrom-Json
        if ([int]$record.pid -ne $ExpectedPid -or [int]$lease.pid -ne $ExpectedPid) { return $false }
    } catch { return $false }
    try {
        Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:4318/internal/shutdown' `
            -Headers @{ Authorization = "Bearer $stopToken" } -TimeoutSec 3 | Out-Null
        return $true
    } catch { return $false }
}

function Write-SupervisorLog([string]$Message) {
    $stamp = (Get-Date).ToString('o')
    Write-Output "$stamp $Message"
}

try {
    New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null
    try {
        $lockHandle = [IO.File]::Open($SupervisorLockFile, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch [IO.IOException] {
        Write-SupervisorLog 'A dashboard supervisor already owns the runtime lock.'
        exit 0
    }
    $lockHandle.SetLength(0)
    $lockBytes = [Text.Encoding]::UTF8.GetBytes((@{ pid = $PID; startedAt = (Get-Date).ToString('o') } | ConvertTo-Json -Compress))
    $lockHandle.Write($lockBytes, 0, $lockBytes.Length)
    $lockHandle.Flush()
    Load-StopToken

    while ($true) {
        $request = Get-StopRequest
        if ($request -and (-not $request.pid -or -not (Get-Process -Id ([int]$request.pid) -ErrorAction SilentlyContinue))) {
            Remove-Item -LiteralPath $StopRequestFile -Force -ErrorAction SilentlyContinue
            Write-SupervisorLog 'Stale stop request cleared; no managed service process remains.'
        }

        $health = Get-Health
        if ($health -and $health.ok) {
            $healthPid = if ($health.runtime -and $health.runtime.pid) { [int]$health.runtime.pid } else { 0 }
            if (-not $child -and $healthPid -gt 0) {
                $candidate = Get-Process -Id $healthPid -ErrorAction SilentlyContinue
                if ($candidate) {
                    $child = $candidate
                    Write-SupervisorLog "Attached to the healthy service child PID $healthPid."
                    $child.WaitForExit()
                    $child.Refresh()
                    Remove-PidRecordIfOwned $healthPid
                    $request = Get-StopRequest
                    if ($request -and [int]$request.pid -eq $healthPid) {
                        Remove-StopRequestIfOwned $healthPid
                        Write-SupervisorLog "Graceful service stop completed for PID $healthPid with exit code $($child.ExitCode)."
                        break
                    }
                    Write-SupervisorLog "Attached service child PID $healthPid exited with code $($child.ExitCode); restart evaluation follows."
                    $child.Dispose()
                    $child = $null
                    continue
                }
            }
            $request = Get-StopRequest
            if ($request -and [int]$request.pid -eq $healthPid -and $stopToken) {
                [void](Request-ChildShutdown $healthPid)
            }
            Start-Sleep -Seconds $CheckIntervalSeconds
            continue
        }

        if (Test-Path -LiteralPath $StopRequestFile) {
            Remove-Item -LiteralPath $StopRequestFile -Force -ErrorAction SilentlyContinue
            Write-SupervisorLog 'Stop requested while service was already down; supervisor exiting.'
            break
        }

        try {
            $managed = & $StartScript -ManagedChild -SupervisorPid $PID
            $child = $managed.Process
            if ($child -isnot [Diagnostics.Process]) { throw 'Managed start did not return a child process handle.' }
            Load-StopToken
            Write-SupervisorLog "Started and owns service child PID $($child.Id); health verified: $($managed.HealthVerified)."
            $child.WaitForExit()
            $child.Refresh()
            $childPid = [int]$child.Id
            Remove-PidRecordIfOwned $childPid
            $request = Get-StopRequest
            if ($request -and [int]$request.pid -eq $childPid) {
                Remove-StopRequestIfOwned $childPid
                Write-SupervisorLog "Graceful service stop completed for PID $childPid with exit code $($child.ExitCode)."
                break
            }
            Write-SupervisorLog "Service child PID $childPid exited with code $($child.ExitCode); restart evaluation follows."
            $child.Dispose()
            $child = $null
        } catch {
            Write-SupervisorLog "Managed service start failed: $($_.Exception.Message)"
            if ($child) {
                $child.Refresh()
                if (-not $child.HasExited) { $child.WaitForExit() }
                $child.Dispose()
                $child = $null
            }
        }
        Start-Sleep -Seconds $CheckIntervalSeconds
    }
} finally {
    if ($child -and -not $child.HasExited -and $stopToken) {
        $child.Refresh()
        Write-StopRequest ([int]$child.Id)
        $stopChildRequested = Request-ChildShutdown ([int]$child.Id)
        if ($stopChildRequested) {
            [void]$child.WaitForExit(15000)
            $child.Refresh()
            if ($child.HasExited) { Remove-PidRecordIfOwned ([int]$child.Id) }
        }
        if (-not $child.HasExited) {
            Write-SupervisorLog "Graceful stop did not complete within 15 seconds for PID $($child.Id); supervisor retains ownership and will continue waiting."
            $child.WaitForExit()
            $child.Refresh()
            Remove-PidRecordIfOwned ([int]$child.Id)
            Write-SupervisorLog "Owned service child PID $($child.Id) exited with code $($child.ExitCode)."
        }
        $child.Dispose()
    }
    if ($lockHandle) { $lockHandle.Dispose() }
}
