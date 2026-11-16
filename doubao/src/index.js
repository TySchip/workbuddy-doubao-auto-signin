import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureClient, runWindowsDoubao, showOwnedWindow } from './adapter.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = path.join(root, 'data', 'doubao-profile');
const command = process.argv[2];

try {
  const settingsFile = path.join(root, 'data', 'config.json');
  const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8').replace(/^\uFEFF/, '')) : {};
  const app = settings.app || process.env.DOUBAO_EXE || path.join(process.env.LOCALAPPDATA || '', 'Doubao', 'Application', 'app', 'Doubao.exe');
  if (!['login', 'status', 'checkin'].includes(command)) throw new Error('用法：npm run login、npm run status 或 npm run checkin');
  if (!fs.existsSync(app)) throw new Error('未找到豆包客户端；请安装豆包，或在 data/config.json 中设置 app 完整路径');
  if (command === 'login') {
    const { launchedPid, ownerPid } = await ensureClient({ app, profile });
    if (!launchedPid) await showOwnedWindow(ownerPid, profile);
    console.log('独立豆包窗口已打开，请在该窗口手动登录；完成后运行 npm run status。');
  } else {
    const result = await runWindowsDoubao({ app, profile, dryRun: command === 'status' });
    console.log(`[${result.status}] ${result.detail}`);
    if (!['success', 'already', 'dry_run'].includes(result.status)) process.exitCode = 1;
  }
} catch (err) {
  console.error(`运行失败：${err.message}`);
  process.exitCode = 1;
}
