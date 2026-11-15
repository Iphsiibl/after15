/* 用 Playwright + 本机 Edge 无头浏览器做冒烟测试与截图
 * 用法: node tools/test.js [--file dist/index.html] [--url http://127.0.0.1:8000/index.html]
 *                        [--shots dist/shots] [--scenario tools/scenario.js]
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : def;
}

(async () => {
  const urlArg = arg('url', '');
  const file = urlArg ? urlArg : path.resolve(ROOT, arg('file', 'dist/index.html'));
  const shots = path.resolve(ROOT, arg('shots', 'dist/shots'));
  const scenarioPath = arg('scenario', '');
  fs.mkdirSync(shots, { recursive: true });

  const errors = [];
  const logs = [];
  const report = { file, viewport: {}, errors, logs: [], steps: [] };

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: Number(arg('width', 1280)), height: Number(arg('height', 860)) },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    logs.push(`[${m.type()}] ${m.text()}`);
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(urlArg || 'file:///' + file.replace(/\\/g, '/'));
  await page.waitForTimeout(1000);
  report.viewport = page.viewportSize();
  report.title = await page.title();
  await page.screenshot({ path: path.join(shots, '01-load.png') });

  // 页面自检
  const hasSelf = await page.evaluate(() => typeof window.__SELFTEST__ === 'function');
  if (hasSelf) {
    try {
      report.selftest = await page.evaluate(() => window.__SELFTEST__());
    } catch (e) {
      errors.push('selftest: ' + e.message);
    }
  }

  // 交互脚本
  if (scenarioPath) {
    const scenario = require(path.resolve(ROOT, scenarioPath));
    try {
      const steps = await scenario(page, shots, report);
      report.steps = steps || [];
    } catch (e) {
      errors.push('scenario: ' + e.message);
    }
  }

  report.logs = logs.slice(-25);
  await browser.close();

  fs.writeFileSync(path.join(shots, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  process.exit(errors.length ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
