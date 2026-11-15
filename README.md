# 下班后的十五分钟 · After Fifteen Minutes

> 一个不需要你做任何决定的疗愈小程序：6 站「下班回家」的小夜路，配一首程序化生成的纯音乐。

**在线试玩**：<https://Iphsiibl.github.io/after15/>

零依赖、零账号、零网络请求：**单文件 HTML**，双击即跑，离线可用。所有插画是内联 SVG，所有环境音（雨 / 风 / 室内）和提示音由 Web Audio 实时合成。

---

## 玩法

1. 点「打卡下班」，跟着走 6 站：关电脑 → 等电梯 → 在路上 → 便利店 → 楼下 → 被窝。
2. 每站做一个小动作（点掉屏幕 / 按住电梯按钮 / 拖车窗 / 捧热饮 / 跺脚 / 拉被子），再选一个「此刻你会——」。
3. 最后一站盖好被子，会送你两轮 **4-7-8 呼吸**（吸气 4 秒 · 屏住 7 秒 · 呼气 8 秒）。
4. 结算页可以：保存今日卡片 PNG、点卡片全屏放大、复制今日文案、下载配套曲子。
5. 在「被窝」站还能**给明天留一句话**，下次打开它会先把这句递给你。

### 藏在界面里的东西

| 元素 | 真实含义 |
| --- | --- |
| 顶部那条长条 | 不是音量条，是**「剩余电量」**。选不同选项会加减（-3 ~ +6），做小动作 +1，做完两轮呼吸 +4。 |
| 最终电量 | 决定你拿到哪个结局（< 40 / < 78 / ≥ 78），也决定结算卡上的数字。 |
| 右上角喇叭 | 声音开关（静音 / 取消静音）。 |
| 「今日份废话」 | 你今晚总共说了多少字。 |

### 无障碍与操作

- 数字键 `1/2/3` 选择选项，`Enter` 继续，电梯长按可按住 `空格/回车`。
- 叙述太长可点「跳过打字」；卡片灯箱按 `Esc` 收起。
- 尊重 `prefers-reduced-motion`；触控目标 ≥ 44px；场景插画都有中文 `aria-label`。

## 配套音乐

`after15.mp3` —— 180 秒，68 BPM，F 大调五声，四段式（A 雨声 + 稀疏钟琴 → B pad + 低音 + 主旋律 → C 主题变奏 + 高音铃 → D 抽掉中高频淡出到近乎无声）。

它**没有一个采样**：全部由 `tools/compose_music.py` 用 numpy/scipy 程序合成（FM 钟琴、软钢琴、失谐 pad、滤波雨声、正弦低音 + 自实现 Schroeder 混响），种子固定，可复现。

## 本地运行

```bash
# 直接打开（离线也行）
python -m http.server 8080 --directory dist
# → http://127.0.0.1:8080/
```

## 开发

```bash
# 改 src/ 之后重新打包成单文件
python tools/build.py --title "下班后的十五分钟"

# 无头浏览器跑完整流程验收（桌面 + 移动）
node tools/test.js --file dist/index.html --shots dist/shots --scenario tools/scenario.js
node tools/test.js --file dist/index.html --shots dist/shots-mobile --scenario tools/scenario.js --width 390 --height 844

# 重新合成配套曲子（约 80 秒）
python tools/compose_music.py
```

| 目录 | 说明 |
| --- | --- |
| `src/` | 源文件：`index.html` 模板、`styles.css`、`content.js`（文案 + 内联 SVG 插画）、`audio.js`（实时合成）、`app.js`（交互） |
| `tools/` | `build.py` 打包、`test.js` + `scenario.js` 全流程验收、`card_shot.js` 导出卡片原图、`compose_music.py` 合成曲子 |
| `dist/` | 打包产物：`index.html`（单文件）+ `after15.mp3` |
| `docs/` | 给「Deploy from a branch」用的静态站点副本（不想用 Actions 时用这个） |
| `research.md` | 选题调研：社区实证、通用创作流程 10 步、机制清单、踩坑记录 |

## 部署

推 `main` 分支即由 GitHub Actions 自动重新打包并发布到 GitHub Pages（见 `.github/workflows/pages.yml`）。
想走最省事的分支发布路线：Settings → Pages → Source 选 `main` / `docs`。

## License

MIT
