$ErrorActionPreference = 'Stop'
$global:registered = @()
$global:conflict = $false
function Get-ScheduledTask { param($TaskName) if ($global:conflict) { return @{ TaskName = $TaskName } } }
function New-ScheduledTaskAction { param($Execute, $Argument, $WorkingDirectory) return @{ Execute=$Execute; Argument=$Argument; WorkingDirectory=$WorkingDirectory } }
function New-ScheduledTaskTrigger { param([switch]$Daily, $At) return @{ At=$At } }
function New-ScheduledTaskSettingsSet { param([switch]$StartWhenAvailable, $MultipleInstances, [switch]$AllowStartIfOnBatteries, [switch]$DontStopIfGoingOnBatteries) return @{ StartWhenAvailable=$StartWhenAvailable; MultipleInstances=$MultipleInstances } }
function New-ScheduledTaskPrincipal { param($UserId, $LogonType, $RunLevel) return @{ LogonType=$LogonType } }
function Register-ScheduledTask { param($TaskName, $Action, $Trigger, $Settings, $Principal) $global:registered += @{Name=$TaskName; Action=$Action; Triggers=$Trigger; Settings=$Settings; Principal=$Principal} }

$installer = Join-Path (Split-Path $PSScriptRoot) 'install-windows.ps1'
& $installer
if ($global:registered.Count -ne 1) { throw '安装器未注册唯一任务' }
$task = $global:registered[0]
if ($task.Name -ne 'DoubaoAutoSignin' -or $task.Triggers.Count -ne 2 -or $task.Triggers[0].At -ne '08:00' -or $task.Triggers[1].At -ne '12:30') { throw '任务名称或时间不正确' }
if (-not $task.Settings.StartWhenAvailable -or $task.Settings.MultipleInstances -ne 'IgnoreNew') { throw '任务设置不正确' }
if ($task.Principal.LogonType -ne 'Interactive' -or $task.Action.Argument -notlike '*run-scheduled.ps1*') { throw '任务主体或入口不正确' }
$global:conflict = $true
$failed = $false
try { & $installer } catch { $failed = $true }
if (-not $failed -or $global:registered.Count -ne 1) { throw '未保护已有同名任务' }
Write-Host 'Installer mock tests passed; no real scheduled task was changed.'
