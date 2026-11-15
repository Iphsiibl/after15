/* ===========================================================
 * audio.js —— 纯 Web Audio 合成器，零音频素材、零外部依赖
 * 场景: 雨夜 / 暖光 / 地铁 / 森林 等环境床 + 八音盒铃音 + 钢琴质感垫底
 * 所有声音都由代码实时生成, 因此单文件离线可用, 体积为 0。
 * =========================================================== */
(function (global) {
  'use strict';

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- 音阶 ---------- */
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // 五声音阶(宫调式): 听起来"治愈"、不刺耳
  const PENTA = [0, 2, 4, 7, 9];
  function pentFreq(step, root) {
    // step: 全局半音序号, root: 基准半音
    const semis = root + step;
    return 440 * Math.pow(2, (semis - 9) / 12);
  }

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.sceneGain = null;
      this.nodes = [];
      this.muted = false;
      this.volume = 0.7;
      this.scene = 'none';
      this._timer = null;
      this._beat = 0;
      this._nextNoteTime = 0;
      this._started = false;
    }

    /* 必须由用户手势触发(浏览器自动播放策略) */
    ensure() {
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        this.sceneGain = this.ctx.createGain();
        this.sceneGain.gain.value = 0;
        this.sceneGain.connect(this.master);
      }
      if (this.ctx.state === 'suspended') {
        // resume() 返回 Promise, 某些浏览器会 reject; 忽略以免产生未捕获异常
        try { this.ctx.resume().catch(function () {}); } catch (e) { /* 忽略 */ }
      }
      return this.ctx;
    }

    get ready() { return !!this.ctx && this.ctx.state === 'running'; }

    setMuted(m) {
      this.muted = !!m;
      if (this.master) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.08);
      }
      return this.muted;
    }

    /* ---------- 基础音色 ---------- */

    // 八音盒 / 音乐盒: 非谐波加法合成 + 快速衰减
    bell(freq, when, dur = 1.6, gain = 0.5) {
      const ctx = this.ctx;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, when);
      out.gain.linearRampToValueAtTime(gain, when + 0.006);
      out.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      out.connect(this.master);

      const partials = [
        [1.0, 1.0, 1.0],
        [2.01, 0.45, 0.62],
        [3.02, 0.22, 0.42],
        [5.4, 0.08, 0.26],
      ];
      // 所有分音同时结束: 最后一个结束时把整条链路摘掉
      const made = [];
      partials.forEach(([mult, amp, decay]) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(amp, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur * decay);
        o.connect(g); g.connect(out);
        o.start(when); o.stop(when + dur + 0.05);
        made.push({ o: o, g: g });
      });
      made.forEach((it, idx) => {
        // 回收: 不摘掉的话, 每分钟会攒下几百个常驻节点, 久了会拖垮音频线程
        it.o.onended = () => {
          try { it.g.disconnect(); it.o.disconnect(); } catch (e) {}
          if (idx === made.length - 1) { try { out.disconnect(); } catch (e) {} }
        };
      });
      // 轻微敲击起音, 让音头更"有实体"
      const noise = ctx.createBufferSource();
      noise.buffer = this._noiseBuffer(0.03);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(gain * 0.25, when);
      ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
      noise.connect(ng); ng.connect(out);
      noise.start(when);
      noise.stop(when + 0.06);
      noise.onended = () => { try { ng.disconnect(); noise.disconnect(); } catch (e) {} };
    }

    // 柔和钢琴/暖垫: 三角波 + 低通
    pad(freq, when, dur = 4.0, gain = 0.14) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = freq * 2.005;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, when);
      lp.frequency.linearRampToValueAtTime(400, when + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(gain, when + 0.5);
      g.gain.linearRampToValueAtTime(0.0001, when + dur);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.master);
      o.start(when); o2.start(when);
      o.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
      o.onended = () => {
        try { lp.disconnect(); g.disconnect(); o.disconnect(); o2.disconnect(); } catch (e) {}
      };
    }

    // 点击/确认: 短促木琴音
    tick(freq = 880, gain = 0.18) {
      if (!this.ctx) return;
      this.bell(freq, this.ctx.currentTime + 0.01, 0.28, gain);
    }

    /* ---------- 环境床 ---------- */

    _noiseBuffer(seconds) {
      const ctx = this.ctx;
      const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    _pinkBuffer(seconds) {
      // 粉红噪声近似(Voss-McCartney 简化版), 比白噪声更接近雨声
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      return buf;
    }

    _startBed(kind) {
      const ctx = this.ctx;
      this.stopBed();
      const src = ctx.createBufferSource();
      src.loop = true;

      if (kind === 'rain') {
        src.buffer = this._pinkBuffer(4);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 380;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 5200;
        const g = ctx.createGain(); g.gain.value = 0.5;
        src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.sceneGain);
        // 雨势起伏
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
        const lfoG = ctx.createGain(); lfoG.gain.value = 0.16;
        lfo.connect(lfoG); lfoG.connect(g.gain);
        lfo.start();
        this.nodes.push(lfo, lfoG);
        this._dripTimer = setInterval(() => this._drip(), 900);
      } else if (kind === 'wind') {
        src.buffer = this._pinkBuffer(5);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
        const g = ctx.createGain(); g.gain.value = 0.55;
        src.connect(lp); lp.connect(g); g.connect(this.sceneGain);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
        const lfoG = ctx.createGain(); lfoG.gain.value = 620;
        lfo.connect(lfoG); lfoG.connect(lp.frequency);
        lfo.start();
        this.nodes.push(lfo, lfoG);
      } else if (kind === 'room') {
        // 便利店/室内: 极低频底噪 + 远处人声般的窄带噪声
        src.buffer = this._pinkBuffer(4);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.8;
        const g = ctx.createGain(); g.gain.value = 0.22;
        src.connect(bp); bp.connect(g); g.connect(this.sceneGain);
      } else {
        return;
      }
      src.start();
      this.nodes.push(src);
      this.sceneGain.gain.cancelScheduledValues(ctx.currentTime);
      this.sceneGain.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    }

    _drip() {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.02;
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f = 700 + Math.random() * 1400;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05 + Math.random() * 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(this.sceneGain);
      o.start(t); o.stop(t + 0.2);
      o.onended = () => { try { g.disconnect(); o.disconnect(); } catch (e) {} };
    }

    stopBed() {
      if (this._dripTimer) { clearInterval(this._dripTimer); this._dripTimer = null; }
      this.nodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
      this.nodes = [];
      if (this.sceneGain && this.ctx) {
        this.sceneGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.sceneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
      }
    }

    /* ---------- 场景 ---------- */
    // scene: 'rain' | 'wind' | 'room' | 'none'
    setScene(scene) {
      if (!this.ensure()) return;
      if (scene === this.scene) return;
      this.scene = scene;
      if (scene === 'none') { this.stopBed(); return; }
      this._startBed(scene);
    }

    /* ---------- 八音盒旋律 (前瞻调度) ---------- */
    // 8 小节循环, 温柔的 C 大调五声音阶
    startMelody(root = -9, tempo = 76) {
      if (!this.ensure()) return;
      this.stopMelody();
      this._beat = 0;
      this._nextNoteTime = this.ctx.currentTime + 0.15;
      const spb = 60 / tempo;
      const pattern = [
        // [step, 时值(拍)]
        [0, 1], [2, 1], [4, 1], [3, 1],
        [2, 1], [1, 1], [0, 1], [-3, 2],
        [1, 1], [0, 1], [-1, 1], [0, 1],
        [2, 1], [4, 1], [3, 1], [1, 1],
        [0, 1], [-1, 1], [-3, 1], [-5, 2],
      ];
      this._melody = { root, spb, pattern, idx: 0 };
      this._timer = setInterval(() => this._schedule(), 40);
      this._schedule();
    }

    // 每小节底垫: 固定音高, 不得随会话时间漂移
    _padFreq(root) {
      return pentFreq(0, root - 12);
    }

    _schedule() {
      if (!this._melody || !this.ctx) return;
      const { root, spb, pattern } = this._melody;
      const lookahead = 0.25;
      while (this._nextNoteTime < this.ctx.currentTime + lookahead) {
        const [step, beats] = pattern[this._melody.idx % pattern.length];
        const oct = Math.floor(step / 5);
        const inOct = ((step % 5) + 5) % 5;
        const semis = oct * 12 + PENTA[inOct];
        const f = pentFreq(semis, root);
        this.bell(f, this._nextNoteTime, 2.2, 0.22);
        // 每小节底垫
        if (this._melody.idx % 4 === 0) {
          this.pad(this._padFreq(root), this._nextNoteTime, spb * 4.4, 0.08);
        }
        this._nextNoteTime += beats * spb;
        this._melody.idx++;
      }
    }

    stopMelody() {
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      this._melody = null;
    }

    /* ---------- 自检(离线渲染, 供自动化测试) ---------- */
    async selftest() {
      const out = { ok: false };
      try {
        const OC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
        const oc = new OC(2, 44100 * 2, 44100);
        // 复用本引擎的 bell 逻辑需要 this.ctx, 这里做一个轻量替身
        const fake = Object.create(AudioEngine.prototype);
        fake.ctx = oc;
        fake.master = oc.createGain();
        fake.master.gain.value = 1;
        fake.master.connect(oc.destination);
        fake._noiseBuffer = AudioEngine.prototype._noiseBuffer;
        fake.bell(880, 0.05, 1.2, 0.5);
        fake.pad(fake._padFreq(-9), 0.05, 2.0, 0.08);
        const rendered = await oc.startRendering();
        const d = rendered.getChannelData(0);
        let peak = 0, sum = 0;
        for (let i = 0; i < d.length; i++) {
          const a = Math.abs(d[i]);
          if (a > peak) peak = a;
          sum += d[i] * d[i];
        }
        const rms = Math.sqrt(sum / d.length);
        out.ok = isFinite(peak) && isFinite(rms) && peak > 0.01 && peak <= 1.0 && rms > 0.001;
        out.peak = +peak.toFixed(4);
        out.rms = +rms.toFixed(4);
        out.clipped = peak >= 0.999;
        // 底垫音高必须恒定(旧版会随 ctx.currentTime 一路爬升)
        out.padFreq = +this._padFreq(-9).toFixed(2);
        out.padStable = Math.abs(out.padFreq - 77.78) < 0.5;
      } catch (e) {
        out.error = String(e && e.message || e);
      }
      return out;
    }
  }

  const engine = new AudioEngine();
  global.AudioEngine = AudioEngine;
  global.audio = engine;
})(typeof window !== 'undefined' ? window : globalThis);
