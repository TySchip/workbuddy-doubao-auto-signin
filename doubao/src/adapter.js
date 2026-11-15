import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import net from 'node:net';
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);

const CARD = '[data-reward-code="daily_signin"]';
const ACTIVITY_URL = 'https://www.doubao.com/pc/agent-explore';
const isDoubaoTarget = (target) => /^(doubao|chrome):\/\/doubao-/.test(target.url || '');

async function dailyState(page) {
  return page.locator(CARD).evaluate((card) => ({
    claimed: !!card.querySelector('[class^="rewarded-"]') || /已领取|已签到|明天再来/.test(card.innerText),
    reward: card.innerText.match(/\+(\d+)\s*额度/)?.[1] || '',
  }));
}

export async function checkDailyPage(page, { dryRun = false } = {}) {
  const card = page.locator(CARD);
  await card.waitFor({ state: 'attached', timeout: 20000 }).catch(() => null);
  if (await card.count() !== 1) {
    const text = await page.evaluate(() => document.body?.innerText || '');
    return /手机号登录|扫码登录|登录\/注册/.test(text)
      ? { status: 'needs_login', detail: '请在独立的豆包签到窗口中重新登录' }
      : { status: 'not_found', detail: '没有找到唯一的每日签到卡片；未点击其他任务' };
  }
  const before = await dailyState(page);
  const meta = { dailyReward: before.reward ? Number(before.reward) : null };
  if (before.claimed) return { status: 'already', detail: `每日签到卡片已领取（活动标注 +${before.reward || '?'} 额度）；未重复领取`, meta };
  const button = card.getByRole('button', { name: /^(立即签到|立即领取)$/ });
  if (await button.count() !== 1) return { status: 'not_found', detail: '签到卡片中没有唯一的领取按钮；未点击其他奖励' };
  if (dryRun) return { status: 'dry_run', detail: '每日签到按钮可用，演练未点击', meta };

  // Only a newly opened confirmation button may be clicked after the daily card.
  await page.evaluate(() => {
    window.__zaobaBeforeClaim = new WeakSet(document.querySelectorAll('button,[role="button"]'));
  });
  try {
    await button.click();
    let confirmed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const hasConfirmation = !confirmed && await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button,[role="button"]')].filter((el) =>
          el.textContent.trim() === '立即领取' && !window.__zaobaBeforeClaim.has(el) && el.getBoundingClientRect().height > 0);
        const button = buttons.length === 1 ? buttons[0] : null;
        if (button) button.setAttribute('data-zaoba-confirm', '');
        return !!button;
      });
      if (hasConfirmation) {
        await page.locator('[data-zaoba-confirm]').click();
        confirmed = true;
      }
      if ((await dailyState(page)).claimed) {
        return { status: 'success', detail: `每日签到领取完成，卡片已变为已领取（活动标注 +${before.reward || '?'} 额度）`, meta };
      }
      await sleep(500);
    }
    return { status: 'uncertain', detail: '已点击每日签到，但未确认已领取状态；请查看活动页' };
  } finally {
    await page.evaluate(() => delete window.__zaobaBeforeClaim).catch(() => null);
  }
}

async function cdpTargets(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1200) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function ensureClient({ app, profile, port = 9446 }) {
  if (process.platform !== 'win32') throw new Error('豆包自动签到目前仅支持 Windows');
  // Only connect to a listener launched with this project's own profile.
  const verifyOwner = async () => {
    const script = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); $c=Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction Stop | Select-Object -First 1; (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $c.OwningProcess)).CommandLine`;
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    if (!stdout.toLowerCase().includes(`--user-data-dir=${profile}`.toLowerCase()) &&
        !stdout.toLowerCase().includes(`--user-data-dir="${profile}"`.toLowerCase())) {
      throw new Error(`端口 ${port} 已被其他程序占用；未连接或关闭该程序`);
    }
  };
  let targets = await cdpTargets(port);
  if (!targets) {
    const occupied = await new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.setTimeout(1200);
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
      socket.once('timeout', () => { socket.destroy(); resolve(true); });
    });
    if (occupied) throw new Error(`端口 ${port} 已被其他程序占用；未连接或关闭该程序`);
    fs.mkdirSync(profile, { recursive: true });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const child = spawn(app, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`], {
      detached: true, stdio: 'ignore', env,
    });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
    for (let attempt = 0; attempt < 40 && !targets?.some(isDoubaoTarget); attempt++) {
      await sleep(1000);
      targets = await cdpTargets(port);
    }
  }
  if (!Array.isArray(targets) || !targets.some(isDoubaoTarget)) {
    throw new Error('独立豆包调试端口未就绪或属于其他程序；未重启任何客户端');
  }
  await verifyOwner();
  return port;
}

export async function runWindowsDoubao({ app, profile, dryRun }) {
  const port = await ensureClient({ app, profile });
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 15000 });
  try {
    const context = browser.contexts()[0];
    const page = context.pages().find((p) => p.url().startsWith(ACTIVITY_URL)) || await context.newPage();
    await page.goto(ACTIVITY_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const result = await checkDailyPage(page, { dryRun });
    if (result.status === 'success') {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
      const verified = await checkDailyPage(page, { dryRun: true });
      if (verified.status !== 'already') return { status: 'uncertain', detail: '已点击签到，但刷新后未确认领取状态，请检查活动页' };
    }
    return result;
  } finally {
    await browser.close();
  }
}
