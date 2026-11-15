/* 只做一件事: 把结算卡片原图存成 PNG, 方便肉眼检查排版
 * 用法: node tools/test.js --scenario tools/card_shot.js --shots tools/_cardshots
 */
const path = require('path');
const fs = require('fs');

module.exports = async function scenario(page, shots, report) {
  const wait = (ms) => page.waitForTimeout(ms);
  await page.click('#btn-start');
  await wait(500);

  for (let i = 0; i < 6; i++) {
    const kind = await page.getAttribute('#btn-action', 'data-kind');
    if (kind === 'drag') {
      const box = await page.locator('#scene-wrap').boundingBox();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();
    } else if (kind === 'hold') {
      const box = await page.locator('#btn-action').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await wait(1500);
      await page.mouse.up();
    } else {
      await page.click('#scene-wrap');
    }
    await wait(300);
    await page.waitForSelector('#options .opt', { timeout: 12000 });
    const opts = await page.$$('#options .opt');
    await opts[0].click();
    await wait(600);
    await page.waitForSelector('#options .cta.next', { timeout: 8000 });
    await page.click('#options .cta.next');
    await wait(600);
  }

  await page.waitForSelector('#card', { timeout: 8000 });
  await wait(1200);
  const dataUrl = await page.evaluate(() => document.querySelector('#card').toDataURL('image/png'));
  const out = path.join(shots, 'card.png');
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return [{ at: 'card', file: out }];
};
