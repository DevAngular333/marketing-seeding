[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$AgenticRoot = if ([string]::IsNullOrWhiteSpace($env:AGENTIC_ROOT)) { 'D:\build-agentic-AI' } else { $env:AGENTIC_ROOT }
$RuntimeRoot = if ([string]::IsNullOrWhiteSpace($env:SEEDING_DATA_DIR)) { Join-Path $AgenticRoot '.agentic\marketing-seeding' } else { $env:SEEDING_DATA_DIR }
$PidFile = Join-Path $RuntimeRoot 'server.pid.json'
$TokenFile = Join-Path $RuntimeRoot 'operator-token'
$AutomationTokenFile = Join-Path $RuntimeRoot 'automation-token'
$BrowserAutomationFile = Join-Path $RuntimeRoot 'browser-automation.json'
$HealthUrl = 'http://127.0.0.1:4318/health'

$health = $null
try { $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2 } catch {}
$pidRecord = if (Test-Path -LiteralPath $PidFile) { Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json } else { $null }
$processAlive = $false
if ($pidRecord -and $pidRecord.pid) {
    $processAlive = $null -ne (Get-Process -Id $pidRecord.pid -ErrorAction SilentlyContinue)
}

[pscustomobject]@{
    ready = [bool]($health -and $health.ok)
    url = 'http://127.0.0.1:4318'
    pid = if ($pidRecord) { $pidRecord.pid } else { $null }
    processAlive = $processAlive
    stateFile = if ($health) { $health.stateFile } else { $null }
    operatorTokenPresent = Test-Path -LiteralPath $TokenFile
    automationTokenPresent = Test-Path -LiteralPath $AutomationTokenFile
    browserAutomationPresent = Test-Path -LiteralPath $BrowserAutomationFile
} | ConvertTo-Json
