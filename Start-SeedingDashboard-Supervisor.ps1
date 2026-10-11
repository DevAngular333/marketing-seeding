[CmdletBinding()]
param(
    [switch]$Once,
    [ValidateRange(15, 3600)][int]$CheckIntervalSeconds = 30
)

$ErrorActionPreference = 'Stop'
$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $AppRoot 'Start-SeedingDashboard.ps1'
$HealthUrl = 'http://127.0.0.1:4318/health'

do {
    $ready = $false
    try {
        $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 5
        $ready = [bool]$health.ok
    } catch {}
    if (-not $ready) {
        try { & $StartScript | Out-Null } catch { Write-Error $_ -ErrorAction Continue }
    }
    if (-not $Once) { Start-Sleep -Seconds $CheckIntervalSeconds }
} while (-not $Once)
