$ErrorActionPreference = 'Stop'
$name = 'DoubaoAutoSignin'
if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
    throw "计划任务 $name 已存在，为避免覆盖现有任务，本次未安装。"
}
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) { throw '未找到 node.exe，请安装 Node.js 并加入 PATH。' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\playwright'))) { throw '请先在 doubao 目录运行 npm ci。' }
$script = Join-Path $PSScriptRoot 'run-scheduled.ps1'
$arg = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $script + '" -NodePath "' + $node + '"'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $PSScriptRoot
$triggers = @(New-ScheduledTaskTrigger -Daily -At '08:00'; New-ScheduledTaskTrigger -Daily -At '12:30')
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $triggers -Settings $settings -Principal $principal | Out-Null
Write-Host "已安装 $name：每天 08:00 和 12:30。"
