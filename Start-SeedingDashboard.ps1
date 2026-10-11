[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgenticRoot = if ([string]::IsNullOrWhiteSpace($env:AGENTIC_ROOT)) { 'D:\build-agentic-AI' } else { $env:AGENTIC_ROOT }
$RuntimeRoot = if ([string]::IsNullOrWhiteSpace($env:SEEDING_DATA_DIR)) { Join-Path $AgenticRoot '.agentic\marketing-seeding' } else { $env:SEEDING_DATA_DIR }
$LogRoot = Join-Path $RuntimeRoot 'logs'
$PidFile = Join-Path $RuntimeRoot 'server.pid.json'
$TokenFile = Join-Path $RuntimeRoot 'operator-token'
$AutomationTokenFile = Join-Path $RuntimeRoot 'automation-token'
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
$operatorToken = Initialize-RuntimeToken $TokenFile
$automationToken = Initialize-RuntimeToken $AutomationTokenFile
if ($operatorToken.Length -lt 32) { throw "Invalid Global Seeding operator token: $TokenFile" }
if ($automationToken.Length -lt 32) { throw "Invalid Global Seeding automation token: $AutomationTokenFile" }

try {
    $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2
    if ($health.ok) {
        Write-Output "Global Seeding dashboard already ready at http://127.0.0.1:4318"
        exit 0
    }
} catch {}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout = Join-Path $LogRoot "server-$stamp.out.log"
$stderr = Join-Path $LogRoot "server-$stamp.err.log"
$hadOperatorToken = Test-Path Env:SEEDING_OPERATOR_TOKEN
$oldOperatorToken = $env:SEEDING_OPERATOR_TOKEN
$hadAutomationToken = Test-Path Env:SEEDING_AUTOMATION_TOKEN
$oldAutomationToken = $env:SEEDING_AUTOMATION_TOKEN
$hadOpenSslConf = Test-Path Env:OPENSSL_CONF
$oldOpenSslConf = $env:OPENSSL_CONF
$hadDataDir = Test-Path Env:SEEDING_DATA_DIR
$oldDataDir = $env:SEEDING_DATA_DIR
$env:SEEDING_OPERATOR_TOKEN = $operatorToken
$env:SEEDING_AUTOMATION_TOKEN = $automationToken
$env:SEEDING_DATA_DIR = $RuntimeRoot
$env:OPENSSL_CONF = ''
try {
    $process = Start-Process -FilePath 'node.exe' `
        -ArgumentList @('src/server.mjs') `
        -WorkingDirectory $AppRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru
} finally {
    if ($hadOperatorToken) { $env:SEEDING_OPERATOR_TOKEN = $oldOperatorToken }
    else { Remove-Item Env:SEEDING_OPERATOR_TOKEN -ErrorAction SilentlyContinue }
    if ($hadAutomationToken) { $env:SEEDING_AUTOMATION_TOKEN = $oldAutomationToken }
    else { Remove-Item Env:SEEDING_AUTOMATION_TOKEN -ErrorAction SilentlyContinue }
    if ($hadOpenSslConf) { $env:OPENSSL_CONF = $oldOpenSslConf }
    else { Remove-Item Env:OPENSSL_CONF -ErrorAction SilentlyContinue }
    if ($hadDataDir) { $env:SEEDING_DATA_DIR = $oldDataDir }
    else { Remove-Item Env:SEEDING_DATA_DIR -ErrorAction SilentlyContinue }
}

[pscustomobject]@{
    pid = $process.Id
    startedAt = (Get-Date).ToString('o')
    stdout = $stdout
    stderr = $stderr
} | ConvertTo-Json | Set-Content -LiteralPath $PidFile -Encoding utf8

$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
        $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2
        if ($health.ok) { $ready = $true; break }
    } catch {}
}
if (-not $ready) { throw "Global Seeding dashboard failed to become ready. Check $stderr" }
Write-Output "Global Seeding dashboard ready at http://127.0.0.1:4318 (PID $($process.Id))"
