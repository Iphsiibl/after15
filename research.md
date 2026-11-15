# 治愈系网页 / 放松小游戏：通用创作流程与工具链调研

> 面向「自研单文件网页作品」。所有 CDN 链接与本地 Python 环境已实测核验。

## 一、行业通用创作流程（产出物 → 验收标准）

| # | 步骤 | 产出物 | 验收标准 |
|---|---|---|---|
| 1 | 痛点定义 | 一句话场景卡（人群/情境/情绪/单次时长） | 覆盖焦虑·失眠·无聊中至少一类，单轮 ≤15 分钟 |
| 2 | 干预机制设计 | 机制—生理效应—交互载体 对照表 | 每个机制有可感知反馈（节奏/声/形变），禁纯装饰 |
| 3 | 信息架构 | 单屏流程图（首屏 = 一个核心动作） | 无登录、≤3 屏、1 次点击进入核心玩法 |
| 4 | 视觉语言 | 色板 / 字阶 / 圆角 / 暗色 tokens | 对比度 ≥4.5:1，色盲可辨 |
| 5 | 动效语言 | 动效表（时长 / 缓动 / 触发条件） | ≤400ms、无跳变、遵循 prefers-reduced-motion |
| 6 | 交互原型 | 可点 HTML 原型 | 触区 ≥44px、单手可达、无隐藏手势 |
| 7 | 音效配乐 | 三层混音表（环境 / 交互 / 反馈） | 环境层不刺耳，各层可独立静音 |
| 8 | 可用性测试 | 5 人任务记录（完成率 / 卡点） | ≥4/5 独立完成核心动作，无需口头指导 |
| 9 | 迭代 | 改动清单 + 回归用例 | 移动端稳定 60fps，音效无回归 |
| 10 | 发布 | 单 HTML + OG 图 | file:// 双击可跑，无必需外网依赖 |

## 二、可落地的情绪干预机制（实现方式 ｜ 单文件适配）

- **4-7-8 呼吸**：CSS `transform:scale()` 圆球缩放 + 文字阶段提示，setTimeout 串「吸 4 / 屏 7 / 呼 8」｜✅ 纯前端
- **箱式呼吸 4-4-4-4 / 4-4-6**：同上，仅换时长表｜✅
- **渐进式肌肉放松**：分段文案 + 身体部位 SVG 依次高亮 + 收缩动画，localStorage 存进度｜✅
- **雨声**：Web Audio 白噪 buffer → `BiquadFilter(lowpass,1200)` → `Gain(0.08)`；叠加随机水滴（sine 800–2000Hz，0.05s 包络）｜✅
- **揉捏黏土**：`pointerdown/move` 在 canvas 画形变，径向渐变阴影模拟指压｜✅
- **沙画**：canvas 弧形撒沙 + 渐隐层叠加｜✅
- **流体**：verlet 粒子 + 指针引力，requestAnimationFrame｜✅（需降采样）
- **点击爆破 / 消泡**：pointerdown → 噪声脉冲 + 碎片粒子｜✅
- **收集 / 每日一签**：日期串 hash → 固定索引（真随机会让"每日"变脸），localStorage 持久化｜✅
- **宠物养成**：SVG + CSS 状态机（饥饿 / 心情 / 睡眠）｜✅
- **ASMR 音景**：多层正弦 + 滤波 + 自制 impulse 做卷积混响｜✅
- **怀旧音频**：短采样 base64 内嵌（体积受限，见踩坑 9）｜需外部素材

## 三、工具链

**单文件 vs 框架**：单文件优先——双击可跑、易分享、零构建、无环境依赖；只有需要多路由 / 复杂共享状态 / 多人协作时才上 Vite + Vue/React。单文件内用原生 ESM 或 IIFE，避免 importmap 兼容坑；不引入构建期 CSS 预处理器。

**零依赖音效（Web Audio API）**
- 白噪：`const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;`
- 雨声 = 白噪 → lowpass → gain；水滴 = sine + 极短包络
- 音乐盒 = triangle osc 按 `440*2**(n/12)` 排列 + `exponentialRampToValueAtTime(0.001, t+1.2)`
- 钢琴 = sine + triangle 叠加 + lowpass + 快攻长衰；揉捏 = 噪声 burst + bandpass
- 铁律：`AudioContext` 必须在用户手势回调里 `new` + `resume()`，加载即建会处于 suspended

**零依赖插画**：内联 SVG（`currentColor` 图标、`viewBox` + `preserveAspectRatio`）、Canvas 程序化绘图（粒子 / 渐变 / 噪声）、SVG data-URI 作 CSS background 免额外请求。

**本地 Python（已实测预装）**：Python 3.11.4、numpy 1.26.4、pillow 12.1.1、scipy 1.12.0。
用途：PIL `Image.new` + `ImageDraw` 生成 PNG 贴图；numpy 生成波形 + 标准库 `wave` 写 16bit PCM WAV（44100Hz 单声道/立体声）。
解释器路径：`C:\Users\雨果\.dsh\dsh-runtimes\dsh-next-primary-runtime\dependencies\python\python.exe`（其 site-packages 内另有 numpy 2.3.5 / Pillow 12.3.0）。

**CDN 直链（已核验 entrypoint 文件存在）**
- Tone.js `https://cdn.jsdelivr.net/npm/tone@15.1.22/build/Tone.min.js`
  用法：`new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.01,release:1.2}}).toDestination(); Tone.start();`
- p5.js `https://cdn.jsdelivr.net/npm/p5@2.4.0/lib/p5.min.js`（快速出粒子/图形原型）
- Howler `https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js`
  用法：`new Howl({src:['data:audio/wav;base64,...'],loop:true,volume:0.4}).play();`
- GSAP `https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js`（时间轴编排呼吸/引导动画）

## 四、常见踩坑清单（10 条）

1. **移动端禁自动播放**：`AudioContext` 只能在 `pointerdown/touchstart` 内 `new`+`resume()`，页面加载即建 = suspended 无声。
2. **iOS 静音键掐掉 WebAudio**：Web Audio 输出走 ringer 通道，静音时无声——需提示用户开铃或改用 `<audio playsinline>`。
3. **首次交互前不发声/不弹窗**：Chrome 自动播放策略 + 手势要求，先给「点一下开始」视觉引导再解锁音频。
4. **Retina 屏发糊**：canvas 按 `devicePixelRatio` 设像素宽高并 `ctx.scale(dpr,dpr)`，不要靠 CSS 拉伸；CSS 尺寸与像素尺寸分离。
5. **移动端 100vh 跳动**：地址栏收放导致布局位移，改用 `100dvh` 或 JS 写 `--vh`。
6. **掉帧与发热**：粒子/滤镜/大 canvas 每帧成本高，页面不可见时暂停 rAF，`will-change` 慎用（层过多反而更卡）。
7. **i18n 字体缺字**：font-stack 需含 `"PingFang SC","Microsoft YaHei","Noto Sans SC"`；emoji 跨端差异大，慎作关键图标。
8. **无障碍缺失**：必须响应 `prefers-reduced-motion`（关掉大幅位移）与 `prefers-color-scheme`（否则夜间白屏刺眼）。
9. **体积膨胀**：base64 内嵌音频比原始大 ~33%，>2MB 首屏明显变慢；优先实时合成音频。
10. **隐私模式 / CDN 失效**：`localStorage` 在无痕模式抛异常需 try/catch 兜底；CDN 脚本加 `onerror` 回退到原生 Web Audio 实现，保证离线可用。

## 五、社区实证：「下班疲惫」这个题，社区在供给什么

抓取方式（2026-11 实抓）：B 站 Web 搜索接口 `https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=video&keyword=…`（需带 UA + Referer 头）；微博热榜、知乎热榜、B 站热门榜作旁证。知乎 `search_v3` 接口返回 400（需特定 header/cookie），未取到，故以 B 站搜索结果为主证据。

| 社区现有供给 | 代表内容 | 播放量 | 形态 |
|---|---|---|---|
| 下班歌单 | 「下班路上一键放空…通勤/散步/居家/放松/睡前」 | 5.1 万 | 被动听（音频列表） |
| 下班歌单 | 「超好听的小清新英文歌单…适合下班路上听」 | 16.8 万 | 被动听 |
| 打工人 vlog | 「下班花 220 块在魔都出租屋制作打工人顶级晚餐」 | 87 万 | 陪伴式观看 |
| 打工人 vlog | 「打工人下班如何快速吃上饭」 | 29.9 万 | 视频给方案 |
| 打工人 vlog | 「月薪 3500 租房 850」 | 42.7 万 | 现实叙事 |
| 白噪音助眠 | 「自然音乐」UP 主的雨声视频 | 3122 万 | 单向环境音 |
| 白噪音助眠 | 车内雨声陪伴 | 66 万 | 单向环境音 |

**空白点（选题依据）**

- 社区里的「下班治愈」几乎全是**被动消费**：歌单、白噪音、vlog 陪伴。
- 歌单的代价是**要你自己做决定**：挑哪首、够不够治愈、要不要换一首——一个疲惫的人恰恰没有力气做决定。
- 白噪音的代价是**它不回应你**：听久了只是睡过去，你仍然没有被接住。
- 缺的是**零决策、可交互、十分钟内能走完**的疗愈。

**由此定下的主题**：《下班后的十五分钟》——不问你要不要休息，只给十五分钟，带你走完「关电脑 → 等电梯 → 在路上 → 便利店 → 楼下 → 被窝」这一小段夜路。它切在「歌单听完 → 睡着」之间那段没人负责的空档里。

**可验证的落点**（对应创作流程第 2 步「机制—反馈对照」）：
每站一个小动作＝一个可感知的身体动作（点、按住、拖、捧、跺、拉），结尾两轮 4-7-8 呼吸＝一个生理降唤醒动作，结算卡＝一次可保存的自我结算。三个机制都不需要用户读说明、不需要登录、不需要判断。
