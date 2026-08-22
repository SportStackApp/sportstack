<#
.SYNOPSIS
Registers or removes the daily SportStack-to-Obsidian note-sync task for the current Windows user.

.DESCRIPTION
The task runs at 7:00 pm local time and starts later if the computer was unavailable at that time.
It uses the committed origin/dev notes and does not touch the active Git working tree.
#>

[CmdletBinding()]
param(
    [string]$TaskName = 'SportStack Obsidian Note Sync',
    [switch]$Remove
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $scriptDirectory '..'))
$syncScript = Join-Path $scriptDirectory 'sync-sportstack-notes-to-obsidian.ps1'

if ($Remove) {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -ne $existingTask) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Output "TASK_REMOVED name=$TaskName"
    }
    else {
        Write-Output "TASK_NOT_FOUND name=$TaskName"
    }
    return
}

if (-not (Test-Path -LiteralPath $syncScript -PathType Leaf)) {
    throw "Note-sync script was not found: $syncScript"
}

$powerShellCommand = Get-Command pwsh.exe -ErrorAction SilentlyContinue
if ($null -eq $powerShellCommand) {
    $powerShellCommand = Get-Command powershell.exe -ErrorAction Stop
}

$actionArguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Fetch' -f $syncScript
$action = New-ScheduledTaskAction `
    -Execute $powerShellCommand.Source `
    -Argument $actionArguments `
    -WorkingDirectory $repositoryRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '19:00'
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Description 'Publishes committed SportStack notes to the Big Brain Obsidian vault.' `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

$registeredTask = Get-ScheduledTask -TaskName $TaskName
Write-Output (
    "TASK_READY name=$TaskName state=$($registeredTask.State) script=$syncScript"
)
