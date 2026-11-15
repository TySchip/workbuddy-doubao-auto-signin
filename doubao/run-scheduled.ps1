param([Parameter(Mandatory=$true)][string]$NodePath)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$logDir = Join-Path $PSScriptRoot 'data'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'task.log'
try {
    if (-not (Test-Path -LiteralPath $NodePath)) { throw 'Node.js 路径不存在，请重新安装计划任务。' }
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') start" | Out-File -FilePath $log -Append -Encoding utf8
    & $NodePath (Join-Path $PSScriptRoot 'src\index.js') checkin 2>&1 | Out-File -FilePath $log -Append -Encoding utf8
    exit $LASTEXITCODE
} catch {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') error: $($_.Exception.Message)" | Out-File -FilePath $log -Append -Encoding utf8
    exit 1
}
