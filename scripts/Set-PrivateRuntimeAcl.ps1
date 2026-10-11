[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Path
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Path)) {
    throw "Private runtime path does not exist: $Path"
}

$rootItem = Get-Item -LiteralPath $Path -Force
$ownerSecurity = if ($rootItem.PSIsContainer) {
    [IO.Directory]::GetAccessControl($rootItem.FullName, [Security.AccessControl.AccessControlSections]::Owner)
} else {
    [IO.File]::GetAccessControl($rootItem.FullName, [Security.AccessControl.AccessControlSections]::Owner)
}
$currentUserSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$ownerSid = $ownerSecurity.GetOwner([Security.Principal.SecurityIdentifier])
$allowedSids = @(
    $currentUserSid,
    $ownerSid,
    [Security.Principal.SecurityIdentifier]::new('S-1-5-18'),
    [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
) | Sort-Object Value -Unique

function Set-PrivateAcl {
    param([Parameter(Mandatory)]$Item)
    if ($Item.PSIsContainer) {
        $acl = [IO.Directory]::GetAccessControl($Item.FullName, [Security.AccessControl.AccessControlSections]::Access)
    } else {
        $acl = [IO.File]::GetAccessControl($Item.FullName, [Security.AccessControl.AccessControlSections]::Access)
    }
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) {
        [void]$acl.RemoveAccessRuleSpecific($rule)
    }
    foreach ($sid in $allowedSids) {
        if ($Item.PSIsContainer) {
            $rule = [Security.AccessControl.FileSystemAccessRule]::new(
                $sid,
                [Security.AccessControl.FileSystemRights]::FullControl,
                ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),
                [Security.AccessControl.PropagationFlags]::None,
                [Security.AccessControl.AccessControlType]::Allow
            )
        } else {
            $rule = [Security.AccessControl.FileSystemAccessRule]::new(
                $sid,
                [Security.AccessControl.FileSystemRights]::FullControl,
                [Security.AccessControl.AccessControlType]::Allow
            )
        }
        [void]$acl.AddAccessRule($rule)
    }
    if ($Item.PSIsContainer) {
        [IO.Directory]::SetAccessControl($Item.FullName, $acl)
    } else {
        [IO.File]::SetAccessControl($Item.FullName, $acl)
    }
}

Set-PrivateAcl -Item $rootItem
if ($rootItem.PSIsContainer) {
    foreach ($child in @(Get-ChildItem -LiteralPath $rootItem.FullName -Force -Recurse)) {
        Set-PrivateAcl -Item $child
    }
}
