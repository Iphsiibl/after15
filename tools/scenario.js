/* 交互脚本: 走完整个旅程, 逐站截图, 最后校验结算卡片
 * 用法: node tools/test.js --scenario tools/scenario.js
 */
const path = require('path');

module.exports = async function scenario(page, shots, report) {
  const steps = [];
  const shot = async (name) => { await page.screenshot({ path: path.join(shots, name) }); };
  const wait = (ms) => page.waitForTimeout(ms);

  await wait(500);
  await shot('02-lobby.png');
  steps.push({ at: 'lobby', title: await page.title() });

  await page.click('#btn-start');
  await wait(250);

  // --- 回归 1: 跳过打字按钮(先做功能检查, 再截图, 免得截图编码把打字等没了) ---
  const skipBefore = await page.evaluate(() => ({
    hasSkipBtn: !!document.querySelector('.type-skip'),
    pending: document.querySelectorAll('#lines .line:not(.in)').length,
    total: document.querySelectorAll('#lines .line').length,
  }));
  const skipClicked = await page.evaluate(() => {
    const b = document.querySelector('.type-skip');
    if (!b) return false;
    b.click();
    return true;
  });
  await wait(200);
  const skipAfter = await page.evaluate(() => ({
    pending: document.querySelectorAll('#lines .line:not(.in)').length,
    skipGone: !document.querySelector('.type-skip'),
    typed: !document.querySelector('#lines').classList.contains('typing'),
    optionsShown: !!document.querySelector('#options .opt'),
  }));
  steps.push({ at: 'skip-typing', before: skipBefore, clicked: skipClicked, after: skipAfter });
  await shot('03-stage1.png');

  // --- 回归 2: 键盘选选项(按 2) ---
  await page.waitForSelector('#options .opt', { timeout: 12000 });
  await page.keyboard.press('2');
  await wait(500);
  const kbPick = await page.evaluate(() => ({
    picked: (document.querySelector('#options .opt.picked')?.textContent || '').trim(),
    replyShown: !!document.querySelector('#options .reply'),
    nextShown: !!document.querySelector('#options .cta.next'),
  }));
  steps.push({ at: 'keyboard-pick', ...kbPick });

  const total = 6;
  for (let i = 0; i < total; i++) {
    const kind = await page.getAttribute('#btn-action', 'data-kind');
    const info = await page.evaluate(() => ({
      stage: document.querySelector('.stage-name')?.textContent,
      count: document.querySelector('.stage-count')?.textContent,
    }));
    steps.push({ at: 'stage' + (i + 1), kind, ...info });

    // --- 完成这一站的小动作 ---
    if (kind === 'drag') {
      await page.locator('#scene-wrap').scrollIntoViewIfNeeded();
      const box = await page.locator('#scene-wrap').boundingBox();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 12 });
      await page.mouse.up();
    } else if (kind === 'hold') {
      await page.locator('#btn-action').scrollIntoViewIfNeeded();
      if (i === 1) {
        // 第二站用键盘按住: 验证键盘用户也能走完这一站
        await page.focus('#btn-action');
        await page.keyboard.down(' ');
        await wait(1500);
        await page.keyboard.up(' ');
      } else {
        const box = await page.locator('#btn-action').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await wait(1500);
        await page.mouse.up();
      }
    } else {
      await page.locator('#scene-wrap').scrollIntoViewIfNeeded();
      await page.click('#scene-wrap');
    }
    await wait(300);
    const done = await page.evaluate(() => document.querySelector('#btn-action')?.classList.contains('done'));
    steps.push({ at: 'action', stage: i + 1, kind, done });
    await shot('04-action' + (i + 1) + '.png');
    if (kind === 'quilt') {
      await wait(2400);
      const breath = await page.evaluate(() => {
        const b = document.querySelector('#breath');
        return { visible: b ? !b.hidden : false, word: document.querySelector('#breath-word')?.textContent };
      });
      steps.push({ at: 'breath', ...breath });
      await shot('04b-breath.png');
    }

    // --- 等叙述结束、选项出现 ---
    await page.waitForSelector('#options .opt', { timeout: 12000 });
    const opts = await page.$$('#options .opt');
    steps.push({ at: 'options', stage: i + 1, count: opts.length });

    if (i === 0) {
      // 第一站已经用键盘选过了(按钮已禁用), 别再点
      steps.push({ at: 'options-picked', stage: 1, via: 'keyboard' });
    } else {
      await opts[i % opts.length].click();
      await wait(800);
    }

    // 最后一站若选到"给明天写一句话"，补测留话功能
    if (await page.$('#note-input')) {
      await page.fill('#note-input', '明天记得吃早饭');
      await page.click('#note-save');
      await wait(400);
      const note = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('after15.note.v1') || 'null'); } catch (e) { return null; }
      });
      steps.push({ at: 'note', saved: note && note.text, date: note && note.date });
      await shot('05b-note.png');
    }

    await shot('05-reply' + (i + 1) + '.png');

    await page.waitForSelector('#options .cta.next', { timeout: 8000 });
    await page.click('#options .cta.next');
    await wait(700);
  }

  await page.waitForSelector('#card', { timeout: 8000 });
  await wait(1200);
  await shot('06-result.png');
  const result = await page.evaluate(() => {
    const c = document.querySelector('#card');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let nonBlank = 0;
    for (let i = 0; i < d.length; i += 4000) {
      if (d[i] + d[i + 1] + d[i + 2] > 30) nonBlank++;
    }
    return {
      screen: document.body.dataset.screen,
      canvas: { w: c.width, h: c.height },
      sampledNonBlank: nonBlank,
      title: document.querySelector('.result-title')?.textContent,
      summary: Array.from(document.querySelectorAll('.sum, .summary-line')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
      ending: Array.from(document.querySelectorAll('.ending-line')).map((e) => e.textContent.trim()),
    };
  });
  steps.push({ at: 'result', ...result });

  // --- 回归 3: 结算页应该从头开始看 ---
  const scrollAtResult = await page.evaluate(() => window.scrollY);
  steps.push({ at: 'result-scroll', scrollY: scrollAtResult });

  // --- 回归 4: 卡片放大看 + Esc 收起 ---
  await page.click('#card-holder');
  await wait(450);
  const zoomOn = await page.evaluate(() => {
    const h = document.querySelector('#card-holder');
    const r = h.getBoundingClientRect();
    const sec = document.querySelector('.screen.result');
    const cs = sec ? getComputedStyle(sec) : null;
    return {
      zoom: document.body.classList.contains('card-zoom'),
      cardHeight: Math.round(document.querySelector('#card').getBoundingClientRect().height),
      viewport: window.innerHeight,
      overlay: { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
      secTransform: cs ? cs.transform : null,
      secAnim: cs ? cs.animationName : null,
      hintBottom: Math.round(document.querySelector('#card-holder').getBoundingClientRect().bottom),
    };
  });
  await shot('06b-card-zoom.png');
  await page.keyboard.press('Escape');
  await wait(350);
  const zoomOff = await page.evaluate(() => document.body.classList.contains('card-zoom'));
  steps.push({ at: 'card-zoom', ...zoomOn, closedByEsc: !zoomOff });

  // --- 回归 5: 卡片排版不会把标点甩到行首 ---
  const wrapCheck = await page.evaluate(() => window.__WRAPCHECK__());
  steps.push({ at: 'wrap-check', ...wrapCheck });

  // --- 回归 6: 卡片和它下面的说明文字不能压在一起 ---
  const cardLayout = await page.evaluate(() => {
    const c = document.querySelector('#card').getBoundingClientRect();
    const p = document.querySelector('.card-cap').getBoundingClientRect();
    const h = document.querySelector('#card-holder').getBoundingClientRect();
    return {
      card: { w: Math.round(c.width), h: Math.round(c.height), bottom: Math.round(c.bottom) },
      cap: { top: Math.round(p.top), bottom: Math.round(p.bottom) },
      holderH: Math.round(h.height),
      overlap: p.top < c.bottom - 1,
    };
  });
  steps.push({ at: 'card-layout', ...cardLayout });

  const dataUrlLen = await page.evaluate(() => document.querySelector('#card').toDataURL('image/png').length);
  steps.push({ at: 'card', dataUrlLength: dataUrlLen });

  const self = await page.evaluate(() => window.__SELFTEST__());
  steps.push({ at: 'selftest', ...self });

  // --- 第二天再打开: 大厅应该还留着那句话 ---
  await page.reload();
  await wait(900);
  const revisit = await page.evaluate(() => ({
    screen: document.body.dataset.screen,
    noteCard: document.querySelector('#note-card .sign-text')?.textContent || null,
    hasView: !!document.querySelector('#btn-view'),
  }));
  steps.push({ at: 'revisit', ...revisit });
  await shot('07-revisit.png');

  // --- 回归 6: 重新走第一站, 点"跳过打字"之后选项必须出现(否则流程会卡死) ---
  await page.click('#btn-start');
  await wait(260);
  const skip2 = await page.evaluate(() => {
    const b = document.querySelector('.type-skip');
    const before = {
      hasBtn: !!b,
      pending: document.querySelectorAll('#lines .line:not(.in)').length,
    };
    if (b) b.click();
    return before;
  });
  await wait(500);
  const skip2After = await page.evaluate(() => ({
    pending: document.querySelectorAll('#lines .line:not(.in)').length,
    optionsShown: !!document.querySelector('#options .opt'),
  }));
  steps.push({ at: 'skip-typing-revisit', before: skip2, after: skip2After });

  return steps;
};
