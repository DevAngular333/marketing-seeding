[CmdletBinding()]
param(
    [switch]$ManagedChild,
    [int]$SupervisorPid = $PID
)

$ErrorActionPreference = 'Stop'
$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgenticRoot = if ([string]::IsNullOrWhiteSpace($env:AGENTIC_ROOT)) { 'D:\build-agentic-AI' } else { $env:AGENTIC_ROOT }
$RuntimeRoot = if ([string]::IsNullOrWhiteSpace($env:SEEDING_DATA_DIR)) { Join-Path $AgenticRoot '.agentic\marketing-seeding' } else { $env:SEEDING_DATA_DIR }
$LogRoot = Join-Path $RuntimeRoot 'logs'
$PidFile = Join-Path $RuntimeRoot 'server.pid.json'
$TokenFile = Join-Path $RuntimeRoot 'operator-token'
$AutomationTokenFile = Join-Path $RuntimeRoot 'automation-token'
$ControlTokenFile = Join-Path $RuntimeRoot 'control-token'
$PrivateAclScript = Join-Path $AppRoot 'scripts\Set-PrivateRuntimeAcl.ps1'
$HealthUrl = 'http://127.0.0.1:4318/health'

New-Item -ItemType Directory -Path $LogRoot -Force | Out-Null

function Initialize-RuntimeToken([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
        $tempTokenFile = "$Path.$PID.tmp"
        [IO.File]::WriteAllText($tempTokenFile, $token, (New-Object Text.UTF8Encoding($false)))
        & $PrivateAclScript -Path $tempTokenFile
        Move-Item -LiteralPath $tempTokenFile -Destination $Path
    }
    & $PrivateAclScript -Path $Path
    return [IO.File]::ReadAllText($Path).Trim()
}

function Get-BuildIdentity {
    $commit = 'unknown'
    $dirty = $false
    try {
        $commit = (& git -C $AppRoot rev-parse HEAD 2>$null | Select-Object -First 1).Trim()
        $dirty = [bool](& git -C $AppRoot status --porcelain 2>$null)
    } catch {}
    if ($commit -notmatch '^[a-fA-F0-9]{7,40}$') { $commit = 'unknown' }
    return @{ commit = $commit; dirty = $dirty }
}

function Write-AtomicPidRecord([hashtable]$Record) {
    $temp = "$PidFile.$PID.tmp"
    [IO.File]::WriteAllText($temp, ($Record | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temp -Destination $PidFile -Force | Out-Null
    & $PrivateAclScript -Path $PidFile
}

function Get-HealthyService {
    try { return Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2 } catch { return $null }
}

if (-not $ManagedChild) {
    $expectedBuild = Get-BuildIdentity
    $taskName = 'Jang Global Seeding Dashboard'
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
        if ($task.State -ne 'Running') { Start-ScheduledTask -TaskName $taskName }
    } else {
        $supervisor = Join-Path $AppRoot 'Start-SeedingDashboard-Supervisor.ps1'
        Start-Process -FilePath (Get-Command powershell.exe).Source `
            -ArgumentList @('-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', $supervisor) `
            -WorkingDirectory $AppRoot -WindowStyle Hidden | Out-Null
    }
    $deadline = (Get-Date).AddSeconds(15)
    do {
        $health = Get-HealthyService
        if ($health -and $health.ok) {
            if (-not $health.runtime -or $health.runtime.sourceCommit -ne $expectedBuild.commit -or [bool]$health.runtime.sourceDirty -ne [bool]$expectedBuild.dirty) {
                throw "A different or uninstrumented build is already serving port 4318 (PID $($health.runtime.pid)); refusing to report it as this worktree's service."
            }
            Write-Output "Global Seeding dashboard ready at http://127.0.0.1:4318 (PID $($health.runtime.pid), build $($health.runtime.sourceCommit))"
            exit 0
        }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)
    throw 'The managed dashboard supervisor did not make the service healthy within 15 seconds.'
}

$operatorToken = Initialize-RuntimeToken $TokenFile
$automationToken = Initialize-RuntimeToken $AutomationTokenFile
$controlToken = Initialize-RuntimeToken $ControlTokenFile
$allTokens = @($operatorToken, $automationToken, $controlToken)
if (@($allTokens | Sort-Object -Unique).Count -ne 3) {
    throw 'Runtime operator, automation, and control tokens must be distinct.'
}
if (@($allTokens | Where-Object { $_.Length -lt 32 }).Count -gt 0) {
    throw 'A runtime token is shorter than the required minimum.'
}

$existing = Get-HealthyService
if ($existing -and $existing.ok) {
    throw "Port 4318 is already serving PID $($existing.runtime.pid); refusing to create a second child."
}
$listener = Get-NetTCPConnection -LocalPort 4318 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) { throw "Port 4318 is occupied by PID $($listener.OwningProcess); refusing to start a second writer." }

$build = Get-BuildIdentity
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout = Join-Path $LogRoot "server-$stamp.out.log"
$stderr = Join-Path $LogRoot "server-$stamp.err.log"
$environment = @{
    SEEDING_OPERATOR_TOKEN = $operatorToken
    SEEDING_AUTOMATION_TOKEN = $automationToken
    SEEDING_CONTROL_TOKEN = $controlToken
    SEEDING_DATA_DIR = $RuntimeRoot
    SEEDING_BUILD_COMMIT = $build.commit
    SEEDING_BUILD_DIRTY = ([string]$build.dirty).ToLowerInvariant()
    OPENSSL_CONF = ''
}
$oldValues = @{}
foreach ($key in $environment.Keys) {
    $oldValues[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $environment[$key], 'Process')
}
try {
    $process = Start-Process -FilePath 'node.exe' `
        -ArgumentList @('src/server.mjs') `
        -WorkingDirectory $AppRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru
} finally {
    foreach ($key in $environment.Keys) { [Environment]::SetEnvironmentVariable($key, $oldValues[$key], 'Process') }
}

Write-AtomicPidRecord @{
    pid = $process.Id
    supervisorPid = $SupervisorPid
    startedAt = (Get-Date).ToString('o')
    sourceCommit = $build.commit
    sourceDirty = $build.dirty
    stdout = $stdout
    stderr = $stderr
}

$deadline = (Get-Date).AddSeconds(15)
$ready = $false
do {
    if ($process.HasExited) { throw "Dashboard child exited with code $($process.ExitCode). Check its error log." }
    $health = Get-HealthyService
    if ($health -and $health.ok -and $health.runtime.pid -eq $process.Id) { $ready = $true; break }
    Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)
if (-not $ready) {
    $process.Refresh()
    if ($process.HasExited) { throw "Dashboard child exited with code $($process.ExitCode). Check its error log." }
    Write-Warning "Dashboard child PID $($process.Id) is alive but health was not verified; returning the handle to the supervisor for ownership."
}

return [pscustomobject]@{ Process = $process; HealthVerified = $ready }
