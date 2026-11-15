import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { chromium } from 'playwright';
import { checkDailyPage } from '../src/adapter.js';

let browser;
let page;
before(async () => { browser = await chromium.launch({ channel: 'msedge', headless: true }); });
after(async () => { await browser?.close(); });
beforeEach(async () => { page = await browser.newPage(); });
afterEach(async () => { await page?.close(); });

test('recognizes the live icon-only claimed state without clicking the banner', async () => {
  await page.setContent('<button onclick="window.wrong=true">立即领取</button><div data-reward-code="daily_signin">每日签到 +200 额度<div class="rewarded-nPpEuG"><svg></svg></div></div>');
  assert.equal((await checkDailyPage(page)).status, 'already');
  assert.equal(await page.evaluate(() => !!window.wrong), false);
});

test('another task being claimed does not hide a pending daily check-in', async () => {
  await page.setContent('<div>其他任务 已领取</div><div data-reward-code="daily_signin">每日签到 +400 额度<button onclick="window.clicked=true">立即签到</button></div>');
  const result = await checkDailyPage(page, { dryRun: true });
  assert.equal(result.status, 'dry_run');
  assert.equal(result.meta.dailyReward, 400);
  assert.equal(await page.evaluate(() => !!window.clicked), false);
});

test('clicks only the daily card and its newly opened confirmation', async () => {
  await page.setContent('<button id="banner">立即领取</button><div data-reward-code="daily_signin">每日签到 +200 额度<button id="daily">立即签到</button></div>');
  await page.evaluate(() => {
    window.counts = { banner: 0, daily: 0, confirm: 0 };
    document.querySelector('#banner').onclick = () => window.counts.banner++;
    document.querySelector('#daily').onclick = () => {
      window.counts.daily++;
      const confirmation = document.createElement('button');
      confirmation.textContent = '立即领取';
      confirmation.onclick = () => {
        window.counts.confirm++;
        document.querySelector('#daily').remove();
        const marker = document.createElement('div');
        marker.className = 'rewarded-test';
        document.querySelector('[data-reward-code="daily_signin"]').append(marker);
        confirmation.remove();
      };
      document.body.append(confirmation);
    };
  });
  assert.equal((await checkDailyPage(page)).status, 'success');
  assert.deepEqual(await page.evaluate(() => window.counts), { banner: 0, daily: 1, confirm: 1 });
  assert.equal((await checkDailyPage(page)).status, 'already');
  assert.deepEqual(await page.evaluate(() => window.counts), { banner: 0, daily: 1, confirm: 1 });
});

test('an unknown daily card never falls back to claiming another reward', async () => {
  await page.setContent('<button onclick="window.wrong=true">立即领取</button><div data-reward-code="daily_signin">每日签到 +200 额度</div>');
  assert.equal((await checkDailyPage(page)).status, 'not_found');
  assert.equal(await page.evaluate(() => !!window.wrong), false);
});
