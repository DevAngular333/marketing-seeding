[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Supervisor = Join-Path $AppRoot 'Start-SeedingDashboard-Supervisor.ps1'
$TaskName = 'Jang Global Seeding Dashboard'
$PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Supervisor`""
$Action = New-ScheduledTaskAction -Execute $PowerShell -Argument $Arguments -WorkingDirectory $AppRoot
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

if ($PSCmdlet.ShouldProcess($TaskName, 'Register current-user dashboard recovery task')) {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null
    Write-Output "Registered scheduled task: $TaskName"
}
