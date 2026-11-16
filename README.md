<div align="center">

# 🤖 WorkBuddy & 豆包自动签到

**在 Windows 电脑上，为 WorkBuddy 和豆包工作分别设置每日签到**

![Windows](https://img.shields.io/badge/平台-Windows-0078D4?logo=windows)
![License](https://img.shields.io/badge/License-MIT-8B5CF6)
![Python](https://img.shields.io/badge/WorkBuddy-Python-3776AB?logo=python&logoColor=white)
![Node](https://img.shields.io/badge/豆包-Node.js-339933?logo=nodedotjs&logoColor=white)

</div>

> 两套程序独立安装、独立运行；可以只使用其中一个。奖励、入口和活动是否可用以各平台实际页面为准。

## ✨ 能做什么

| 平台 | 自动处理 | 默认时间 | 所需软件 |
| --- | --- | --- | --- |
| WorkBuddy 国内版 | 每日签到和成长中心；支持补签、Buddy 等上游功能 | 00:05；另在 01、05、09、13、17、21 点轮询 | WorkBuddy 国内版、Python 3 |
| 豆包工作 | 「免费用豆包工作」中的每日签到 | 08:00、12:30 | 豆包 Windows 客户端、Node.js 20+ |

**WorkBuddy 成长中心会主动执行操作**，包括接取任务、使用能量开盲盒、派遣 Buddy 和领取奖励，具体由账户状态决定。若只想签到，可手动使用下文的 `claim`，不要安装默认的成长中心轮询。

豆包只处理“每日签到”卡片，不会自动完成工作任务或领取其他卡片奖励。登录态失效、页面改版或状态不明确时需要人工检查。

## 🚀 准备工作

1. 安装并登录要使用的客户端：[WorkBuddy 国内版](https://www.workbuddy.cn/) / [豆包](https://www.doubao.com/)；确保账号能看到对应签到活动。
2. WorkBuddy 需要 [Python 3](https://www.python.org/downloads/)；豆包需要 [Node.js 20 或更新版本](https://nodejs.org/)。安装时将运行程序加入 PATH，然后重新打开 PowerShell。
3. 下载本仓库 ZIP 并解压，或使用 Git：

   ```powershell
   git clone https://github.com/TySchip/workbuddy-doubao-auto-signin.git
   cd workbuddy-doubao-auto-signin
   ```

以下命令均在 PowerShell 中运行，先进入对应子目录。安装后不要移动或删除项目目录，计划任务使用其中的脚本。

## 🟦 WorkBuddy 安装与使用

```powershell
cd workbuddy
python .\signin.py doctor       # 离线检查运行环境和本地登录态
python .\signin.py status       # 查询签到状态
python .\signin.py claim        # 手动领取今日签到
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1
```

安装器来自上游 [88lin/workbuddy-auto-signin](https://github.com/88lin/workbuddy-auto-signin)，会注册 `WorkBuddyAutoSignin` 和 `WorkBuddyGrowthPoll`。**如果这两个同名任务已存在，上游安装器会覆盖它们**；已有安装的用户请先检查任务的指向，避免重复安装或替换原配置。需要查看详情时：

```powershell
Get-ScheduledTask -TaskName WorkBuddyAutoSignin,WorkBuddyGrowthPoll
Get-Content .\signin.log -Tail 10
```

安装器使用当前 Windows 用户和 `pythonw.exe` 静默运行。账号或活动不适用、客户端登录失效、接口变更等都可能导致失败；`doctor` 通过不等于联网签到成功。

## 🟣 豆包工作安装与使用

1. 进入豆包目录，安装依赖：

   ```powershell
   cd doubao
   npm ci
   ```

2. 启动**独立签到窗口**，在这个新窗口里手动登录自己的豆包账号：

   ```powershell
   npm run login
   ```

   这是单独的客户端数据目录，原客户端已经登录也需要在新窗口登录一次。脚本不会复制原客户端的 Cookie。登录命令会保留窗口，方便手动登录；完成后可自行关闭。

3. 检查活动页，然后手动运行一次：

   ```powershell
   npm run status    # 只检查，不点击
   npm run checkin   # 尝试签到；已领则不重复点击
   ```

   `already` 表示页面显示已领取；`dry_run` 表示找到待领取按钮，但检查模式没有点击；`success` 表示点击后刷新页面仍显示已领取。`needs_login`、`not_found`、`uncertain` 和 `运行失败` 表示需要检查，不能当作成功。检查或签到结束时，会关闭本次运行新显示的独立窗口，开始运行前已经可见的窗口会保留。客户端可能继续在后台运行。

4. 确认手动运行正常后，安装计划任务：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1
   Get-ScheduledTask -TaskName DoubaoAutoSignin | Get-ScheduledTaskInfo
   Get-Content .\data\task.log -Tail 20
   ```

   默认每天 08:00 和 12:30 运行，任务名为 `DoubaoAutoSignin`。如果同名任务已存在，安装器会停止，不会覆盖。需要移除时可运行 `Unregister-ScheduledTask -TaskName DoubaoAutoSignin`；该命令只移除计划任务，登录数据仍在本机。

默认程序路径为 `%LOCALAPPDATA%\Doubao\Application\app\Doubao.exe`。若安装在其他位置，先在 `doubao` 目录运行以下命令，将示例路径换成实际客户端 exe 路径：

```powershell
New-Item -ItemType Directory -Force .\data | Out-Null
@{ app = 'D:\Apps\Doubao\Doubao.exe' } | ConvertTo-Json | Set-Content .\data\config.json -Encoding UTF8
```

此配置只保存在本机，不会被 Git 跟踪。计划任务会记录安装时找到的 Node.js 完整路径；如果之后移动了 Node.js，需要重新安装任务。

## ⏰ 使用条件与排错

- 计划任务依赖本机执行：电脑需开机、联网并登录安装时的 Windows 账户。已设置错过运行后补跑，但关机、休眠或网络故障时无法保证即时签到。
- 手动运行可先确认登录状态。豆包独立窗口退出登录后，重新运行 `npm run login` 并由本人登录；遇到验证码也请本人处理。
- 豆包会在本机 `127.0.0.1:9446` 开启调试端口；脚本检查监听进程使用的是本项目登录目录，端口被其他程序占用时会停止。该端口可能被同一台电脑上的其他本地程序访问，请只在可信设备上运行。
- 不要公开 `doubao/data/`、`signin.log`、客户端资料或其他个人登录数据。仓库的 `.gitignore` 已排除本项目登录目录及日志，但分享前仍请自行检查。
- 界面、接口和奖励可能改变，脚本不保证每天必定成功。发现状态异常时，先查看日志和活动页，再决定是否重新登录或手动领取。

## 🧪 验证情况

- WorkBuddy：国内版曾实际签到并到账；上游相关自动化测试可在 `workbuddy` 目录执行 `python -m unittest discover -s tests`。
- 豆包：本项目所依据的本机 zaoba Windows 适配器于 2026-11-16 实际完成签到，活动卡片显示领取 400 额度；本仓库提取后的独立版已验证已领取状态及模拟页面点击，真实未签到领取仍待独立验证。安装了 Microsoft Edge 后，可在 `doubao` 目录执行 `npm test`；安装器模拟测试为 `powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\installer.test.ps1`，不会修改系统任务。

## 🙏 来源与改动

- WorkBuddy 的 `signin.py`、Windows 安装器与相关测试来自 [88lin/workbuddy-auto-signin](https://github.com/88lin/workbuddy-auto-signin)，基于 `6339d7042e9b74f458f3dc05e395fd476cd45909`；保留原作者及 [MIT 许可](workbuddy/LICENSE)。
- 豆包方案参考 [BorisSun0424-boop/zaoba](https://github.com/BorisSun0424-boop/zaoba) 的客户端 CDP 签到思路，基于本地 `307517b` 适配过程提取并改写为独立 Windows 程序：使用专用登录目录，只匹配每日签到卡片，确认状态后结束。上游 [MIT 许可](doubao/LICENSE) 随仓库保留。
- 调研时还参考了 [totorosir-doubao-checkin](https://skillhub.cn/skills/user_3a370331/totorosir-doubao-checkin) 的签到流程，以及 [magpie-community 的豆包工作插件](https://github.com/magpie-community/plugins/tree/main/packages/doubao-work) 的独立客户端调试思路。本仓库采用 CDP 方案，并非上述 Skill 的直接复制。
- 文档结构与呈现风格参考 WorkBuddy 上游项目。感谢以上项目的作者和贡献者。

本仓库新增内容采用 [MIT License](LICENSE)；上游文件保留各自的版权与许可。此项目为社区工具，与腾讯、豆包及其官方团队无隶属关系。
