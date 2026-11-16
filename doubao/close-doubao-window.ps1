param([int]$ProcessId, [string]$Profile, [switch]$Show, [switch]$List, [string]$Keep)
$process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
if (-not $process) { exit 0 }
if (-not $process.CommandLine.Contains('--user-data-dir=') -or $process.CommandLine.IndexOf($Profile, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
    throw '进程与签到专用目录不匹配，未关闭窗口。'
}
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DoubaoWindow {
    public delegate bool EnumProc(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
}
'@
$windows = New-Object 'System.Collections.Generic.List[IntPtr]'
$callback = [DoubaoWindow+EnumProc]{
    param($window, $parameter)
    $ownerId = 0
    [DoubaoWindow]::GetWindowThreadProcessId($window, [ref]$ownerId) | Out-Null
    if ($ownerId -eq $ProcessId) {
        if ($Show) {
            $title = New-Object System.Text.StringBuilder 256
            [DoubaoWindow]::GetWindowText($window, $title, 256) | Out-Null
            if ($title.ToString() -match '豆包|Doubao') { $windows.Add($window) }
        } elseif ([DoubaoWindow]::IsWindowVisible($window)) { $windows.Add($window) }
    }
    return $true
}
[DoubaoWindow]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
if ($List) { foreach ($window in $windows) { $window.ToInt64().ToString() }; exit 0 }
$preserved = @($Keep -split ',' | Where-Object { $_ })
if ($Show -and $windows.Count -eq 0) { throw '未找到签到专用窗口，请通过豆包托盘图标打开后登录。' }
foreach ($window in $windows) {
    if ($Show) { [DoubaoWindow]::ShowWindowAsync($window, 9) | Out-Null }
    elseif ($preserved -notcontains $window.ToInt64().ToString()) { [DoubaoWindow]::PostMessage($window, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null }
}
