/* ===========================================================
 * app.js —— 《下班后的十五分钟》主引擎
 * 状态机: lobby → 关电脑 → 电梯 → 在路上 → 便利店 → 楼下 → 被窝 → 结算
 * =========================================================== */
(function () {
  'use strict';

  const C = window.CONTENT;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  const STORE_KEY = 'after15.state.v1';
  const el = {
    stage: $('#stage'),
    meter: $('#meter-fill'),
    meterText: $('#meter-text'),
    sound: $('#btn-sound'),
    live: $('#live'),
  };

  const state = {
    screen: 'lobby',
    idx: -1,
    battery: 60,
    waste: 0,          // 今日份废话字数
    acts: 0,           // 完成的小动作数
    picks: [],         // 每站选择
    stageStart: 0,
    typed: [],
    sign: '',
    tip: '',
    started: false,
    cardReady: false,
  };

  /* ---------------- 工具 ---------------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  function nowTime() {
    const d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  // 日期 -> 固定索引, 保证"每日一签"当天不变
  function hashDay(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }
  const CLOSE_PUNCT = '」』）〕】》〉"，。、！？：；·…—';
  const wrapLog = [];          // 最近一次排版的每一行(给自检用)
  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    const chars = Array.from(text);
    let line = '', ly = y, lines = 0;
    const emit = (t) => { wrapLog.push(t); ctx.fillText(t, x, ly); ly += lineH; };
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line) {
        if (CLOSE_PUNCT.indexOf(chars[i]) >= 0) {
          // 行首禁则: 收尾标点不另起一行, 悬挂在本行末尾（轻微出血，仍在画布内）
          emit(test);
          line = '';
        } else {
          emit(line);
          line = chars[i];
        }
        lines++;
      } else {
        line = test;
      }
      if (maxLines && lines >= maxLines) return ly;
    }
    if (line && (!maxLines || lines < maxLines)) emit(line);
    return ly;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  /* ---------------- 作者标识（GitHub） ---------------- */
  const GH_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 .8a11.2 11.2 0 0 0-3.55 21.92c.56.1.77-.24.77-.54v-2.1c-3.12.68-3.78-1.3-3.78-1.3-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.6 1.22 3.23.94.1-.73.39-1.22.71-1.5-2.49-.28-5.1-1.25-5.1-5.56 0-1.23.44-2.23 1.16-3.02-.12-.29-.5-1.43.11-2.98 0 0 .94-.3 3.1 1.15a10.7 10.7 0 0 1 5.64 0c2.15-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.69.11 2.98.72.79 1.15 1.79 1.15 3.02 0 4.32-2.62 5.27-5.12 5.55.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z"/></svg>';
  // 页面署名：GitHub 图标 + 账号名 + 仓库地址
  function ghLine() {
    const a = C.AUTHOR || { name: 'Iphsiibl', repo: 'https://github.com/Iphsiibl/after15' };
    return `<p class="gh-line">${GH_ICON}` +
      `<span>作者 ${esc(a.name)}</span>` +
      `<a href="${esc(a.repo)}" target="_blank" rel="noopener noreferrer">${esc(a.repo.replace(/^https?:\/\//, ''))}</a>` +
      `</p>`;
  }
  function setScreen(name) {
    document.body.dataset.screen = name;
  }

  /* ---------------- 音效 ---------------- */
  const A = window.audio;
  function ensureAudio() {
    if (!A) return;
    A.ensure();
    if (!state.started) {
      state.started = true;
      A.setScene(C.STAGES[0].bed || 'room');
      A.startMelody(-9, 72);
    }
  }
  function setBed(bed) {
    if (A && state.started) A.setScene(bed || 'room');
  }

  /* ---------------- 打字机 ---------------- */
  let typingTimers = [];
  let typingPending = [];   // 还没显示的行: {i, ln, p}
  let typingOpts = null;
  let typingSkipBtn = null;
  let typingContainer = null;

  function setTypingClass(on) {
    if (typingContainer) typingContainer.classList.toggle('typing', !!on);
  }
  function clearTyping() {
    typingTimers.forEach((t) => clearTimeout(t));
    typingTimers = [];
    typingPending = [];
    typingOpts = null;
    setTypingClass(false);
    hideTypeSkip();
  }
  function hideTypeSkip() {
    if (typingSkipBtn && typingSkipBtn.parentNode) typingSkipBtn.parentNode.removeChild(typingSkipBtn);
    typingSkipBtn = null;
  }
  function revealLine(p, ln, i) {
    p.classList.add('in');
    p.innerHTML = esc(ln) + '<span class="caret"></span>';
    if (typingOpts && typingOpts.onLine) typingOpts.onLine(i, ln);
  }
  function typeLines(container, lines, opts) {
    clearTyping();
    opts = opts || {};
    typingOpts = opts;
    const delay = opts.delay == null ? 620 : opts.delay;
    const step = opts.step == null ? 700 : opts.step;
    container.innerHTML = '';
    typingContainer = container;
    setTypingClass(true);
    lines.forEach((ln, i) => {
      const p = document.createElement('p');
      p.className = 'line';
      p.setAttribute('data-full', ln);
      p.innerHTML = '<span class="caret"></span>';
      container.appendChild(p);
      const item = { i: i, ln: ln, p: p };
      typingPending.push(item);
      const t = setTimeout(() => {
        typingPending = typingPending.filter((x) => x !== item);
        revealLine(p, ln, i);
        if (!typingPending.length) { hideTypeSkip(); setTypingClass(false); }
      }, delay + i * step);
      typingTimers.push(t);
    });
    // 跳过按钮: 只在还有没显示的行时出现, 打完就消失
    if (typingPending.length && container.parentNode) {
      const b = document.createElement('button');
      b.className = 'type-skip';
      b.type = 'button';
      b.textContent = '跳过打字';
      b.setAttribute('aria-label', '跳过打字，直接显示全部叙述');
      b.addEventListener('click', (e) => { e.stopPropagation(); skipTyping(); });
      container.parentNode.insertBefore(b, container.nextSibling);
      typingSkipBtn = b;
    }
    return typingTimers.length;
  }
  function skipTyping() {
    // 立即显示所有还没出现的行, 并补齐 onLine 回调,
    // 否则选项不会出现, 流程会卡住
    const pend = typingPending.slice();
    typingPending = [];
    typingTimers.forEach((t) => clearTimeout(t));
    typingTimers = [];
    pend.forEach((it) => revealLine(it.p, it.ln, it.i));
    setTypingClass(false);
    hideTypeSkip();
  }

  /* ---------------- 渲染：大厅 ---------------- */
  function renderLobby() {
    state.screen = 'lobby';
    setScreen('lobby');
    setBed('room');
    const done = loadState();
    const note = loadNote();
    const daily = state.sign || (state.sign = C.DAILY_SIGNS[hashDay(dateKey()) % C.DAILY_SIGNS.length]);
    const tip = C.TIPS[hashDay(dateKey() + 'tip') % C.TIPS.length];

    el.stage.innerHTML = `
      <section class="screen lobby fade-in">
        <div class="lobby-sky" aria-hidden="true"></div>
        <div class="lobby-grid">
        <div class="lobby-main">
          <p class="clock">${nowTime()}</p>
          <h1 class="title">下班后的<br><span>十五分钟</span></h1>
          <p class="lede">一个不需要你做任何决定的疗愈小程序。<br>
          接下来的十几分钟，只有你，和一点点声音。</p>
          <div class="lobby-actions">
            <button class="cta" id="btn-start">打卡下班</button>
            ${done ? '<button class="ghost" id="btn-view">今天已经下班过了 · 看结算</button>' : ''}
          </div>
          <p class="micro">全程约 3 分钟 · 会放一点点声音 · 随时可以关掉</p>
          <div class="sign-card">
            <span class="sign-label">今日一签</span>
            <p class="sign-text">${esc(daily)}</p>
            <span class="sign-tip">${esc(tip)}</span>
          </div>
          ${note && !note.taken ? `
          <div class="note-card" id="note-card">
            <span class="sign-label">给明天留的话</span>
            <p class="sign-text">${esc(note.text)}</p>
            <button class="ghost small" id="btn-take">收下了</button>
          </div>` : ''}
          {{MUSIC}}
          ${ghLine()}
        </div>
        <div class="lobby-art-wrap" role="img" aria-label="${esc(C.SCENE_ALT.dusk)}">${C.SCENES.dusk}</div>
        </div>
      </section>`;

    $('#btn-start').addEventListener('click', () => {
      ensureAudio();
      state.battery = 60; state.waste = 0; state.acts = 0; state.picks = [];
      state.idx = -1;
      nextStage();
    });
    const view = $('#btn-view');
    if (view) view.addEventListener('click', () => {
      ensureAudio();
      const s = loadState();
      if (s) {
        state.battery = s.battery; state.waste = s.waste; state.acts = s.acts; state.picks = s.picks || [];
        state.cardReady = true;
        renderResult(true);
      }
    });
    const take = $('#btn-take');
    if (take) take.addEventListener('click', () => {
      takeNote();
      const card = $('#note-card');
      if (card) card.classList.add('fold');
    });
  }

  /* ---------------- 渲染：旅程中的一站 ---------------- */
  function nextStage() {
    state.idx++;
    clearBreath();
    if (state.idx >= C.STAGES.length) { renderResult(); return; }
    const st = C.STAGES[state.idx];
    state.screen = st.id;
    setScreen('stage');
    state.stageStart = Date.now();
    state.rewarded = false;
    setBed(st.bed);

    el.stage.innerHTML = `
      <section class="screen stage-view fade-in" data-stage="${st.id}" tabindex="-1" style="
          --s-a:${st.palette.a}; --s-b:${st.palette.b}; --s-c:${st.palette.c};
          --s-d:${st.palette.d}; --glow:${st.palette.glow};">
        <div class="stage-head">
          <span class="stage-time">${st.time}</span>
          <span class="stage-name">${esc(st.name)}</span>
          <span class="stage-count">${state.idx + 1} / ${C.STAGES.length}</span>
        </div>
        <div class="scene-wrap" id="scene-wrap" role="img" aria-label="${esc(C.SCENE_ALT[st.scene] || st.name)}">${C.SCENES[st.scene]}</div>
        <div class="narration" id="lines" aria-live="polite"></div>
        <button class="action" id="btn-action" data-kind="${st.action.kind}">${esc(st.action.label)}<small>${esc(st.action.hint)}</small></button>
        ${st.id === 'bed' ? `
        <div class="breath" id="breath" hidden>
          <div class="breath-circle" id="breath-circle"></div>
          <p class="breath-word" id="breath-word">准备好了</p>
          <p class="breath-count" id="breath-count">跟着圆圈就好，不用做对</p>
          <button class="ghost small" id="btn-breath-skip">不呼吸了</button>
        </div>` : ''}
        <div class="options" id="options" aria-live="polite"></div>
        <div class="stage-foot">
          <button class="ghost small" id="btn-skip">跳过这一站</button>
        </div>
      </section>`;

    typeLines($('#lines'), st.narration, {
      onLine: (i, ln) => { if (i === st.narration.length - 1) renderOptions(st); },
    });
    // 点叙述文字也可以直接跳过打字
    const narration = $('#lines');
    if (narration) {
      narration.addEventListener('click', () => { if (typingPending.length) skipTyping(); });
    }

    if (st.action.kind === 'hold') setupHold(st);
    else $('#btn-action').addEventListener('click', (e) => doAction(st, e.currentTarget));
    const bskip = $('#btn-breath-skip');
    if (bskip) bskip.addEventListener('click', stopBreathing);
    $('#btn-skip').addEventListener('click', () => { clearTyping(); advance(st); });
    setupSceneAction(st);
    updateMeter();
    const sec = $('.screen.stage-view');
    if (sec) sec.focus({ preventScroll: true });
    // 换站回到顶部, 否则新的一站是从半截屏幕开始的
    scrollTop();
  }
  function scrollTop() {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (e) { window.scrollTo(0, 0); }
  }
  function scrollIntoViewIfNeeded(node, block) {
    if (!node || !node.scrollIntoView) return;
    try { node.scrollIntoView({ block: block || 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
  }

  function renderOptions(st) {
    const box = $('#options');
    if (!box || box.dataset.ready) return;
    box.dataset.ready = '1';
    box.innerHTML = '<p class="options-lead">此刻你会——</p>';
    st.options.forEach((op, i) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = `<span class="opt-key">${'123'[i]}</span><span class="opt-label">${esc(op.label)}</span>`;
      b.addEventListener('click', () => choose(st, op, b));
      box.appendChild(b);
    });
  }

  function choose(st, op, btn) {
    ensureAudio();
    $$('#options .opt').forEach((b) => { b.disabled = true; b.classList.remove('picked'); });
    btn.classList.add('picked');
    if (A) A.tick(660 + Math.random() * 120, 0.16);

    state.battery = Math.max(0, Math.min(100, state.battery + op.delta));
    state.waste += op.reply.join('').replace(/\s/g, '').length;
    state.picks.push({ stage: st.id, tag: op.tag, delta: op.delta });

    const box = $('#options');
    const reply = document.createElement('div');
    reply.className = 'reply fade-in';
    reply.innerHTML = op.reply.map((l) => `<p class="line in">${esc(l)}</p>`).join('');
    box.appendChild(reply);
    if (op.delta >= 4) reply.classList.add('good');
    if (op.delta <= 0) reply.classList.add('bad');
    if (op.note) renderNote(st, op, reply);
    updateMeter();

    const next = document.createElement('button');
    next.className = 'cta next fade-in';
    next.textContent = state.idx === C.STAGES.length - 1 ? '今天结束了，去结算' : '继续往前走 →';
    next.addEventListener('click', () => advance(st));
    box.appendChild(next);
    next.focus({ preventScroll: true });
    // 小屏上回应和按钮常常在折叠线以下, 把它带到眼前
    scrollIntoViewIfNeeded(next, 'nearest');
  }

  function advance(st) {
    clearTyping();
    clearBreath();
    if (A) A.tick(880, 0.12);
    nextStage();
  }

  /* ---------------- 每站的小动作 ---------------- */
  function setupSceneAction(st) {
    const wrap = $('#scene-wrap');
    const kind = st.action.kind;
    if (!wrap) return;
    if (kind === 'screen') {
      wrap.classList.add('clickable');
      wrap.addEventListener('click', () => doAction(st));
    } else if (kind === 'drag') {
      const scroll = $('.scroll', wrap);
      const stars = $('.stars', wrap);
      let dragging = false, x0 = 0, off = 0;
      const move = (dx) => {
        off = Math.max(-120, Math.min(120, dx));
        if (scroll) scroll.setAttribute('transform', `translate(${off * 0.6},0)`);
        if (stars) stars.setAttribute('transform', `translate(${off * 0.25},0)`);
      };
      wrap.addEventListener('pointerdown', (e) => {
        dragging = true; x0 = e.clientX; wrap.setPointerCapture(e.pointerId);
      });
      wrap.addEventListener('pointermove', (e) => { if (dragging) move(e.clientX - x0); });
      wrap.addEventListener('pointerup', () => {
        if (dragging && Math.abs(off) > 40) {
          if (A) A.tick(520, 0.14);
          rewardAction(st.action.success);
        }
        dragging = false;
      });
      wrap.addEventListener('pointercancel', () => { dragging = false; });
    } else if (kind === 'cup') {
      const cup = $('.cup', wrap);
      wrap.classList.add('clickable');
      wrap.addEventListener('click', (e) => {
        if (cup && !e.target.closest('.opt')) doAction(st);
      });
    } else if (kind === 'stomp') {
      wrap.classList.add('clickable');
      wrap.addEventListener('click', () => doAction(st));
      // 不给插画加 tabindex: 它对读屏用户是一张图, 可操作的入口是下面的按钮
    } else if (kind === 'quilt') {
      wrap.classList.add('clickable');
      wrap.addEventListener('click', () => doAction(st));
    }
  }

  /* 按钮兜底：任何一站，点"做点什么"都能完成这一站的小动作 */
  function doAction(st) {
    const kind = st.action.kind;
    const wrap = $('#scene-wrap');
    if (wrap) {
      if (kind === 'screen') wrap.classList.add('is-off');
      else if (kind === 'cup') {
        wrap.classList.add('warm');
        const cup = $('.cup', wrap);
        if (cup) cup.classList.add('steaming');
      } else if (kind === 'stomp') wrap.classList.add('lit');
      else if (kind === 'quilt') wrap.classList.add('pulled');
    }
    const tone = kind === 'screen' ? 320 : kind === 'cup' ? 440 : kind === 'stomp' ? 360 : 300;
    if (A) A.tick(tone, 0.18);
    rewardAction(st.action.success);
  }

  /* 长按：电梯按钮，按住到门来 */
  const HOLD_MS = 1100;
  function setupHold(st) {
    const wrap = $('#scene-wrap');
    if (wrap) wrap.classList.add('clickable');
    const btn = $('#btn-action');
    const svgBtn = wrap ? $('.btn', wrap) : null;
    const targets = [btn, svgBtn].filter(Boolean);
    if (btn) btn.style.setProperty('--p', '0');
    let timer = null, raf = null, start = 0;

    const end = (silent) => {
      const wasHolding = !!timer;
      if (timer) { clearTimeout(timer); timer = null; }
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      targets.forEach((x) => x.classList.remove('holding'));
      if (btn && !state.rewarded) btn.style.setProperty('--p', '0');
      if (wasHolding && !silent && !state.rewarded && el.live) {
        el.live.textContent = '电梯还在楼上。再多按一会儿。';
      }
    };
    const begin = (e, t) => {
      if (state.rewarded || timer) return;
      if (e && e.cancelable) e.preventDefault();
      try { if (e && e.pointerId != null && t && t.setPointerCapture) t.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      start = performance.now();
      targets.forEach((x) => x.classList.add('holding'));
      const step = () => {
        const p = Math.min(1, (performance.now() - start) / HOLD_MS);
        if (btn) btn.style.setProperty('--p', String(p));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      timer = setTimeout(() => {
        end(true);                       // 成功时不要播报"再多按一会儿"
        if (state.rewarded) return;
        const w = $('#scene-wrap');
        if (w) w.classList.add('arrive');
        if (A) A.tick(520, 0.16);
        rewardAction(st.action.success);
      }, HOLD_MS);
    };

    targets.forEach((t) => {
      t.classList.add('holdable');
      t.addEventListener('pointerdown', (e) => begin(e, t));
      t.addEventListener('pointerup', () => end(false));
      t.addEventListener('pointercancel', () => end(false));
    });

    // 键盘也能"按住"：空格 / 回车
    if (btn) {
      btn.addEventListener('keydown', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        if (e.repeat) return;
        e.preventDefault();
        e.stopPropagation();              // 别让全局回车键把这一站跳过去
        begin(e, btn);
      });
      btn.addEventListener('keyup', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        end(false);
      });
      btn.addEventListener('blur', () => { if (timer) end(false); });
    }
  }

  function rewardAction(text) {
    if (state.rewarded) return;
    state.rewarded = true;
    state.acts++;
    state.battery = Math.min(100, state.battery + 1);
    state.waste += text.replace(/\s/g, '').length;
    updateMeter();
    const btn = $('#btn-action');
    if (btn && !btn.dataset.done) {
      btn.dataset.done = '1';
      btn.classList.add('done');
      btn.innerHTML = `已完成 <small>${esc(text)}</small>`;
    }
    const live = el.live;
    if (live) live.textContent = text;
    // 小动作做完后, 顺手把下面的选项带进视野
    const opts = $('#options');
    if (opts && opts.children.length) scrollIntoViewIfNeeded(opts, 'nearest');
    // 最后一站: 被子盖好之后, 顺手送你两轮呼吸
    const st = C.STAGES[state.idx];
    if (st && st.id === 'bed' && $('#breath')) {
      breathTimers.push(setTimeout(startBreathing, 1400));
    }
  }

  /* ---------------- 4-7-8 呼吸 ---------------- */
  const BREATH_CYCLES = 2;
  const BREATH_PHASES = [
    { word: '吸气', ms: 4000, scale: 1, ease: 'cubic-bezier(.2,.7,.3,1)', tone: 392 },
    { word: '停住', ms: 7000, scale: 1, ease: 'linear', tone: 330 },
    { word: '呼气', ms: 8000, scale: 0.42, ease: 'cubic-bezier(.45,0,.4,1)', tone: 294 },
  ];
  let breathTimers = [];
  function clearBreath() {
    breathTimers.forEach((t) => clearTimeout(t));
    breathTimers = [];
  }
  function startBreathing() {
    const box = $('#breath');
    const circle = $('#breath-circle');
    const word = $('#breath-word');
    const count = $('#breath-count');
    if (!box || !circle || !word || !count) return;
    box.hidden = false;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cycle = 0;
    const tone = (f) => {
      if (A && A.ctx) A.bell(f, A.ctx.currentTime + 0.02, 1.9, 0.16);
    };
    const run = (idx) => {
      if (cycle >= BREATH_CYCLES) {
        word.textContent = '今天到这里';
        count.textContent = '你已经把自己放下来了';
        circle.style.transition = 'transform 1.8s ease, opacity 1.8s ease';
        circle.style.transform = 'scale(.42)';
        circle.style.opacity = '.22';
        tone(262);
        state.battery = Math.min(100, state.battery + 4);
        updateMeter();
        return;
      }
      const p = BREATH_PHASES[idx];
      word.textContent = p.word;
      count.textContent = '第 ' + (cycle + 1) + ' / ' + BREATH_CYCLES + ' 轮';
      if (reduced) {
        circle.style.transition = 'none';
        circle.style.opacity = '.5';
      } else {
        circle.style.transition = 'transform ' + p.ms + 'ms ' + p.ease;
        circle.style.transform = 'scale(' + p.scale + ')';
      }
      tone(p.tone);
      breathTimers.push(setTimeout(() => {
        if (idx + 1 >= BREATH_PHASES.length) { cycle++; run(0); }
        else run(idx + 1);
      }, p.ms));
    };
    run(0);
  }
  function stopBreathing() {
    clearBreath();
    const box = $('#breath');
    const word = $('#breath-word');
    const count = $('#breath-count');
    if (box) box.hidden = true;
    if (word) word.textContent = '';
    if (count) count.textContent = '';
  }

  /* ---------------- 电量条 ---------------- */
  function updateMeter() {
    const b = Math.round(state.battery);
    if (el.meter) el.meter.style.width = b + '%';
    if (el.meter) el.meter.classList.toggle('low', b < 40);
    if (el.meterText) el.meterText.textContent = '电量 ' + b + '%';
  }

  /* ---------------- 给明天留一句话 ---------------- */
  const NOTE_KEY = 'after15.note.v1';
  function loadNote() {
    try {
      const raw = localStorage.getItem(NOTE_KEY);
      if (!raw) return null;
      const n = JSON.parse(raw);
      return n && n.text ? n : null;
    } catch (e) { return null; }
  }
  function saveNote(text) {
    try {
      localStorage.setItem(NOTE_KEY, JSON.stringify({ date: dateKey(), text: text, taken: false }));
    } catch (e) { /* 隐私模式：忽略 */ }
  }
  function takeNote() {
    const n = loadNote();
    if (!n) return;
    n.taken = true;
    try { localStorage.setItem(NOTE_KEY, JSON.stringify(n)); } catch (e) { /* ignore */ }
  }
  function renderNote(st, op, reply) {
    const box = document.createElement('div');
    box.className = 'note fade-in';
    box.innerHTML =
      '<label class="note-label" for="note-input">想留给明天的一句话（只存在这台设备上）</label>' +
      '<div class="note-row"><input id="note-input" type="text" maxlength="40" placeholder="比如：明天记得吃早饭">' +
      '<button class="ghost small" id="note-save">写好了</button></div>' +
      '<p class="micro note-hint">写完记得点一下「写好了」，它会替你想起来。</p>';
    reply.appendChild(box);
    const input = box.querySelector('#note-input');
    const save = box.querySelector('#note-save');
    setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
    save.addEventListener('click', () => {
      const v = (input.value || '').trim();
      if (!v) { input.placeholder = '写一句再点呀，哪怕只有两个字'; input.focus(); return; }
      saveNote(v);
      save.textContent = '已留在本机 ✓';
      save.disabled = true;
      input.disabled = true;
      box.querySelector('.note-hint').textContent = '明天打开它，它会先把这句给你看。';
      // 把回应里的占位句换成你真正写下的那句
      const first = reply.querySelector('.line');
      if (first) first.textContent = '你给明天留了一句话：' + v;
      if (el.live) el.live.textContent = '已经替你留好了：' + v;
      if (A) A.bell(660, A.ctx ? A.ctx.currentTime + 0.02 : 0, 1.6, 0.14);
    });
  }

  /* ---------------- 结算 ---------------- */
  function mainline() {
    let best = null;
    state.picks.forEach((p) => { if (!best || p.delta > best.delta) best = p; });
    return best ? best.tag : '按时下班';
  }
  function endingFor(battery) {
    if (battery < 40) return C.ENDINGS.low;
    if (battery < 78) return C.ENDINGS.mid;
    return C.ENDINGS.high;
  }

  function renderResult(isView) {
    state.screen = 'result';
    setScreen('result');
    state.cardReady = true;
    setBed('rain');
    const end = endingFor(state.battery);
    const sign = state.sign || (state.sign = C.DAILY_SIGNS[hashDay(dateKey()) % C.DAILY_SIGNS.length]);

    el.stage.innerHTML = `
      <section class="screen result fade-in">
        <h2 class="result-title" id="result-title" tabindex="-1">今日情绪结算</h2>
        <p class="result-date">${dateKey()} · 下班后的十五分钟</p>
        <div class="card-holder" id="card-holder" title="点一下可以放大看">
          <canvas id="card" width="720" height="1080" role="img"
            aria-label="今日情绪结算卡片：主线 ${esc(mainline())}，废话 ${state.waste} 字，仪式 ${state.acts} 次，电量 ${Math.round(state.battery)}%"></canvas>
          <p class="micro card-cap">点一下卡片可以放大看 · 可以保存下来 · 下面是它写给你看的话</p>
        </div>
        <p class="summary-line" title="主线：今天你做过最像自己的一个选择 · 废话：今天说出口又咽回去的字 · 仪式：你认真完成的小动作 · 电量：还剩多少可以拿去明天">
          <span title="今天你做过最像自己的一个选择">主线 <b>${esc(mainline())}</b></span> ·
          <span title="今天说出口又咽回去的字">废话 ${state.waste} 字</span> ·
          <span title="你认真完成的小动作">仪式 ${state.acts} 次</span> ·
          <span title="还剩多少可以拿去明天">电量 ${Math.round(state.battery)}%</span>
        </p>
        <div class="ending">
          <p class="ending-title">${esc(end.title)}</p>
          ${end.lines.map((l) => `<p class="ending-line">${esc(l)}</p>`).join('')}
          ${C.TOMORROW.map((l) => `<p class="ending-line tomorrow">${esc(l)}</p>`).join('')}
        </div>
        <div class="result-actions">
          <button class="cta" id="btn-save">保存今日卡片</button>
          <button class="ghost" id="btn-copy">复制今日文案</button>
          <button class="ghost" id="btn-again">再下班一次</button>
        </div>
        {{MUSIC}}
        <p class="micro">今天没有解决任何问题，但你把自己带回来了。这也算数。</p>
        ${ghLine()}
      </section>`;

    drawCard();
    saveState();
    // 结算页从头开始看, 别停在上一页的滚动位置
    scrollTop();

    // 卡片放大看: 再点一下（或按 Esc）收起来
    const holder = $('#card-holder');
    if (holder) {
      holder.addEventListener('click', () => {
        const on = document.body.classList.toggle('card-zoom');
        if (A) A.tick(on ? 660 : 520, 0.12);
      });
    }
    // 结算页把焦点交给标题, 读屏用户能知道换页了
    const title = $('#result-title');
    if (title) { try { title.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }

    $('#btn-save').addEventListener('click', () => {
      const c = $('#card');
      const a = document.createElement('a');
      a.download = '下班后的十五分钟-' + dateKey() + '.png';
      a.href = c.toDataURL('image/png');
      a.click();
      if (A) A.tick(990, 0.16);
    });
    $('#btn-copy').addEventListener('click', async (e) => {
      const txt = [
        '【今日情绪结算】' + dateKey(),
        '主线：' + mainline(),
        '废话：' + state.waste + ' 字 · 仪式：' + state.acts + ' 次 · 电量：' + Math.round(state.battery) + '%',
        '今日一签：' + sign,
        '——' + endingFor(state.battery).lines.join(''),
        '作者 ' + ((C.AUTHOR && C.AUTHOR.name) || 'Iphsiibl') + ' · ' + ((C.AUTHOR && C.AUTHOR.repo) || 'https://github.com/Iphsiibl/after15'),
      ].join('\n');
      try {
        await navigator.clipboard.writeText(txt);
        e.currentTarget.textContent = '已复制 ✓';
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); e.currentTarget.textContent = '已复制 ✓'; }
        catch (e2) { e.currentTarget.textContent = '复制失败，长按卡片吧'; }
        ta.remove();
      }
    });
    $('#btn-again').addEventListener('click', () => {
      state.battery = 60; state.waste = 0; state.acts = 0; state.picks = [];
      state.idx = -1;
      nextStage();
    });
  }

  /* ---------------- 卡片绘制 ---------------- */
  function drawCard() {
    const c = $('#card');
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const end = endingFor(state.battery);
    const sign = state.sign;
    const font = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';

    // 背景: 黄昏 → 夜
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2c2444');
    g.addColorStop(0.45, '#4a3a52');
    g.addColorStop(1, '#171a33');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 光晕
    const rg = ctx.createRadialGradient(W * 0.72, H * 0.16, 10, W * 0.72, H * 0.16, 300);
    rg.addColorStop(0, 'rgba(255,190,120,.34)');
    rg.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    // 星点
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * W, y = Math.random() * H * 0.42, r = Math.random() * 1.7 + 0.4;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    const PAD = 64;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.font = '24px ' + font;
    ctx.fillText('下班后的十五分钟', PAD, 116);
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    ctx.font = '20px ' + font;
    ctx.fillText(dateKey(), PAD, 152);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px ' + font;
    ctx.fillText('今日情绪结算', PAD, 224);

    // 分隔线
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, 262); ctx.lineTo(W - PAD, 262); ctx.stroke();

    // 数据
    const rows = [
      ['今日主线', mainline()],
      ['今日份废话', state.waste + ' 字'],
      ['下班仪式', state.acts + ' 次'],
      ['剩余电量', Math.round(state.battery) + '%'],
    ];
    ctx.font = '26px ' + font;
    let y = 322;
    rows.forEach((r) => {
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillText(r[0], PAD, y);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px ' + font;
      ctx.fillText(r[1], W - PAD - ctx.measureText(r[1]).width, y);
      ctx.font = '26px ' + font;
      y += 62;
    });

    // 电量条
    const barY = y + 8, barW = W - PAD * 2, barH = 12;
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    roundRect(ctx, PAD, barY, barW, barH, 6); ctx.fill();
    const b = Math.round(state.battery);
    const bg = ctx.createLinearGradient(PAD, 0, PAD + barW, 0);
    if (b < 40) { bg.addColorStop(0, '#ff9a76'); bg.addColorStop(1, '#ff6f91'); }
    else { bg.addColorStop(0, '#ffd27a'); bg.addColorStop(1, '#8fd6c0'); }
    ctx.fillStyle = bg;
    roundRect(ctx, PAD, barY, barW * (b / 100), barH, 6); ctx.fill();

    // 今日一签
    let sy = barY + 84;
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = '22px ' + font;
    ctx.fillText('今日一签', PAD, sy);
    sy += 40;
    ctx.fillStyle = '#fff';
    ctx.font = '29px ' + font;
    sy = wrapText(ctx, '「' + sign + '」', PAD, sy, W - PAD * 2, 44, 3);

    // 结尾（按流排版: 先量行数, 必要时收紧行距, 绝不压到页脚）
    const FOOT_Y = H - 96;                 // 页脚基线
    const maxW = W - PAD * 2;
    sy += 34;
    ctx.fillStyle = '#ffd9a8';
    ctx.font = 'bold 28px ' + font;
    ctx.fillText(end.title, PAD, sy);
    sy += 44;
    ctx.fillStyle = 'rgba(255,255,255,.86)';
    ctx.font = '26px ' + font;
    const countLines = (t) => Math.max(1, Math.ceil(ctx.measureText(t).width / maxW));
    let need = 0;
    end.lines.forEach((l) => { need += countLines(l); });
    let lineH = 40, gap = 6;
    const space = FOOT_Y - 26 - sy;
    if (need * (lineH + gap) > space) { lineH = 34; gap = 3; }
    if (need * (lineH + gap) > space) { lineH = 29; gap = 0; }
    end.lines.forEach((l) => { sy = wrapText(ctx, l, PAD, sy, maxW, lineH, 3); sy += gap; });

    // 页脚
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = '23px ' + font;
    ctx.fillText('现在，请把手机扣过去。', PAD, Math.max(sy + 30, FOOT_Y));

    // 品牌角标
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.font = '20px ' + font;
    ctx.fillText('下班后的十五分钟 · ' + ((C.AUTHOR && C.AUTHOR.name) || 'Iphsiibl'), W - PAD, H - 62);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.font = '17px ' + font;
    ctx.fillText((C.AUTHOR && C.AUTHOR.short) || 'github.com/Iphsiibl/after15', W - PAD, H - 30);
    ctx.textAlign = 'left';
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- 存档 ---------------- */
  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        date: dateKey(), battery: state.battery, waste: state.waste,
        acts: state.acts, picks: state.picks,
      }));
    } catch (e) { /* 隐私模式：忽略 */ }
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.date !== dateKey()) return null;
      return s;
    } catch (e) { return null; }
  }

  /* ---------------- 声音开关 ---------------- */
  function initSound() {
    if (!el.sound || !A) return;
    el.sound.addEventListener('click', () => {
      ensureAudio();
      const m = A.setMuted(!A.muted);
      el.sound.setAttribute('aria-pressed', String(m));
      el.sound.textContent = m ? '🔇' : '🔊';
      el.sound.classList.toggle('off', m);
    });
  }

  /* ---------------- 键盘可达 ---------------- */
  function initKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Esc: 收起放大的卡片
      if (e.key === 'Escape' && document.body.classList.contains('card-zoom')) {
        document.body.classList.remove('card-zoom');
        e.preventDefault();
        return;
      }
      // 1 / 2 / 3（也接受 A / B / C）选择选项
      const key = String(e.key || '').toLowerCase();
      const order = ['1', '2', '3', 'a', 'b', 'c'];
      if (order.indexOf(key) >= 0) {
        const opts = $$('#options .opt');
        const idx = order.indexOf(key) % 3;
        if (opts[idx] && !opts[idx].disabled) { e.preventDefault(); opts[idx].click(); }
        return;
      }
      // 回车: 推进
      if (e.key === 'Enter' && state.screen !== 'lobby' && state.screen !== 'result') {
        const next = $('#options .cta.next');
        if (next) { e.preventDefault(); next.click(); }
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    state.sign = C.DAILY_SIGNS[hashDay(dateKey()) % C.DAILY_SIGNS.length];
    state.tip = C.TIPS[hashDay(dateKey() + 'tip') % C.TIPS.length];
    // 顶栏的 GitHub 图标: 用 content.js 里的作者信息做唯一出处
    const gh = document.getElementById('gh-top');
    if (gh && C.AUTHOR && C.AUTHOR.repo) {
      gh.setAttribute('href', C.AUTHOR.repo);
      gh.setAttribute('aria-label', '作者 ' + C.AUTHOR.name + ' 的 GitHub 仓库：' + C.AUTHOR.repo.replace(/^https?:\/\//, ''));
    }
    renderLobby();
    initSound();
    initKeys();
    // 首次任意点击解锁音频
    const unlock = () => { ensureAudio(); document.removeEventListener('pointerdown', unlock); };
    document.addEventListener('pointerdown', unlock);
  }

  window.__SELFTEST__ = async function () {
    const c = document.querySelector('#card');
    const out = {
      screen: state.screen,
      battery: state.battery,
      waste: state.waste,
      acts: state.acts,
      stages: C.STAGES.length,
      sign: state.sign,
      audioEngine: !!window.audio,
      canvas: c ? { w: c.width, h: c.height } : null,
      hasLocalStorage: (function () { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (e) { return false; } })(),
    };
    // 离线渲染一段音频, 确认真的能出声且不削波、底垫不漂移
    if (window.audio && window.audio.selftest) {
      try { out.audio = await window.audio.selftest(); }
      catch (e) { out.audio = { ok: false, error: String(e && e.message || e) }; }
    }
    return out;
  };
  window.__WRAPCHECK__ = function () {
    // 用真实 canvas 度量, 检查卡片上的每一句会不会出现"标点落在行首"
    const c = document.createElement('canvas');
    c.width = 720; c.height = 1080;
    const ctx = c.getContext('2d');
    ctx.font = '29px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';
    const maxW = 720 - 64 * 2;
    const texts = [];
    C.DAILY_SIGNS.forEach((s) => texts.push('「' + s + '」'));
    Object.keys(C.ENDINGS).forEach((k) => {
      texts.push(C.ENDINGS[k].title);
      C.ENDINGS[k].lines.forEach((l) => texts.push(l));
    });
    C.TOMORROW.forEach((l) => texts.push(l));
    const bad = [];
    texts.forEach((t) => {
      wrapLog.length = 0;
      wrapText(ctx, t, 64, 100, maxW, 44, 3);
      wrapLog.forEach((line) => {
        if (line && CLOSE_PUNCT.indexOf(line.charAt(0)) >= 0) bad.push(line);
      });
    });
    return { checked: texts.length, bad: bad, ok: bad.length === 0 };
  };
  window.__GOTO__ = function (i) {
    const target = Math.max(0, Math.min(C.STAGES.length - 1, (i || 1) - 1));
    state.idx = target - 1;
    state.rewarded = false;
    nextStage();
  };
  window.__CHOOSE__ = function (i) {
    const st = C.STAGES[state.idx];
    const op = st.options[i];
    const btn = document.querySelectorAll('#options .opt')[i];
    if (op && btn) choose(st, op, btn);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
