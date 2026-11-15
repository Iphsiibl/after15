# -*- coding: utf-8 -*-
"""
《下班后的十五分钟》—— 配套治愈系纯音乐（纯 numpy / scipy 数值合成）

设计说明
--------
调性：F 大调 / d 小调色彩，以五声音阶为主（C5 D5 E5 G5 A5 ...）。
速度：68 BPM，4/4 拍，偏慢，留白多。
曲式（段落可听辨）：
  A 段  0:00 - 0:35   雨声底噪 + 稀疏钟琴 / 拨弦单音（黄昏窗边）
  B 段  0:35 - 1:18   温暖 pad（失谐锯齿经低通）与低音进入，主旋律出现
  C 段  1:18 - 2:25   主题重复并变奏，加入高音铃状泛音，pad 更饱满（副歌"亮一下"）
  D 段  2:25 - 3:00   逐渐抽掉中高频，只剩雨声、低音与几颗余音，末尾淡出（像灯灭）

所有声音均由程序实时合成：FM 钟琴、加法合成软钢琴、加法失谐 pad、
滤波噪声雨声、正弦/三角波低音，外加自实现 Schroeder 多抽头混响。
无人声、无采样素材、无外部 IR 文件。

母带链：去直流 → 26Hz 高通 → 预归一 → 软拐点限幅（C1 连续，无硬削波）
      → 峰值归一到 -1.05 dBFS → 1.5s 淡入 / 12s 淡出（末尾 6s 近乎无声）
      → 2ms 边缘斜坡去咔哒。

依赖：numpy、scipy（仅滤波器）；ffmpeg / ffprobe 用于编码与自检。
用法：python tools\\compose_music.py
产物：dist\\after15.mp3（中间 WAV 写入系统临时目录并在结束后删除）

成品实测（第 5 轮）：
  时长 180.000 s / 44.1kHz / 立体声 / mp3 192kbps
  峰值 -1.05 dBFS（PCM）、-1.15 dBFS（mp3 解码）
  RMS  -17.06 dBFS（PCM）、-17.32 dBFS（mp3 解码）
  段落：-30.5 / -17.8 / -14.3 / -24.6 dBFS（A/B/C/D，副歌比主歌亮 3.4dB）
  咔哒 0、削波 0、直流 5.5e-05、末尾 6s 峰值 -30 dBFS（近乎无声）
"""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy import ndimage, signal

# --------------------------------------------------------------------------
# 全局参数
# --------------------------------------------------------------------------
SR = 44100                 # 采样率
BPM = 68.0                 # 速度（落在 66–72 要求区间）
BEAT = 60.0 / BPM          # 0.882353 s/拍
BAR = 4.0 * BEAT           # 3.529412 s/小节
N_BARS = 51                # 51 小节 = 180.000 s
DUR = N_BARS * BAR         # 3 分整
CH = 2                    # 立体声

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "dist")
MP3_PATH = os.path.join(OUT_DIR, "after15.mp3")
BITRATE = "192k"

PEAK_CEIL = 10 ** (-1.05 / 20.0)  # 最终输出峰值上限 ≈ -1.05 dBFS（要求 ≤ -1.0）
TARGET_RMS_DB = -17.0             # 目标整体 RMS（要求 -18 ~ -16 dBFS）

RNG = np.random.default_rng(20241115)   # 固定随机种子，保证可复现

# 分段（以小节为单位）
BAR_A = (0, 10)      # 0:00 - 0:35.3   雨 + 稀疏钟琴
BAR_B = (10, 22)     # 0:35.3 - 1:17.6  pad + 低音 + 主旋律
BAR_C = (22, 41)     # 1:17.6 - 2:24.7  主题变奏 + 高音铃
BAR_D = (41, 51)     # 2:24.7 - 3:00.0  抽高频 + 淡出

# 各声部增益（便于迭代调整）
# 第 1 轮实测：雨声在 A 段电平几乎盖过整个音乐（B 段 -17 dBFS vs 雨 -14.5 dBFS），
#   且 B 段进入瞬间（-13 dB）比副歌 C 段还响，段落感失衡。
# 第 2 轮实测：雨声已退到背景（-26 dB）✓，但 pad（-8.7）比旋律（-13.4）高 4.7 dB，
#   旋律听不清；D 段 pad 仍是主角（-14.2），不符合"抽掉中高频，只留雨声与低音"。
# 第 3 轮据此：pad 整体压 2.5~7 dB、旋律抬 2~3 dB、高音铃抬 6 dB、
#   D 段 pad 退成低暗底（Bass 40→30 dB），让副歌真正"亮一下"。
# 第 5 轮只动母带（分声部增益不再改）：段落动态弧线已符合预期
#   （副歌比主歌亮 3.4dB、A 段安静、D 段渐弱淡出），只需把整体 RMS
#   从 -18.5 dBFS 拉回 -18~-16 窗口内（见 master() 说明）。
GAIN = {
    "rain_A": 0.075,
    "rain_B": 0.055,
    "rain_C": 0.045,
    "rain_D": 0.065,
    "pad_B": 0.34,
    "pad_C": 0.50,
    "pad_D": 0.18,
    "bass_B": 0.36,
    "bass_C": 0.42,
    "bass_D": 0.30,
    "bell_A": 0.42,
    "mel_B": 0.74,
    "mel_C": 1.15,
    "mel_D": 0.50,
    "hi_bell": 0.55,
    "wet": 0.21,       # 混响湿声占比（要求 18%–25%）
}


# --------------------------------------------------------------------------
# 基础工具
# --------------------------------------------------------------------------
def m2f(m: float) -> float:
    """MIDI 音高 → 频率（Hz）。"""
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=float) - 69.0) / 12.0)


def t_axis(n: int, sr: int = SR) -> np.ndarray:
    return np.arange(n, dtype=float) / sr


def one_pole_lp(x: np.ndarray, fc: float, sr: int = SR) -> np.ndarray:
    """一阶低通（时间常数法）。

    注意：这里的参数 fc 是"时间常数的倒数"（fc = 1/τ，单位 Hz⁻¹），
    即 τ = 1/fc 秒，**不是** -3dB 截止频率（实际截止 ≈ 1/(2π·fc) Hz）。
    需要按真实频率控制时请改用 one_pole_lp_hz()。
    """
    a = 1.0 / (1.0 + fc * sr)
    return signal.lfilter([a], [1.0, -(1.0 - a)], x)


def one_pole_lp_hz(x: np.ndarray, f_hz: float, sr: int = SR) -> np.ndarray:
    """一阶低通，f_hz 为真实 -3dB 截止频率（Hz）。"""
    a = 1.0 - np.exp(-2.0 * np.pi * f_hz / sr)
    return signal.lfilter([a], [1.0, -(1.0 - a)], x)


def soft_env(n: int, sr: int = SR, attack: float = 0.01, release: float = 0.2) -> np.ndarray:
    """cos 平滑起音/释放包络，避免任何咔哒。"""
    env = np.ones(n)
    k = min(n, max(1, int(attack * sr)))
    env[:k] = 0.5 - 0.5 * np.cos(np.linspace(0.0, np.pi, k))
    if release > 0:
        k = min(n, max(1, int(release * sr)))
        env[n - k:] *= 0.5 + 0.5 * np.cos(np.linspace(0.0, np.pi, k))
    return env


class Bus:
    """立体声总线，等功率声像分配。"""

    def __init__(self, n: int, sr: int = SR):
        self.n = n
        self.sr = sr
        self.L = np.zeros(n, dtype=np.float64)
        self.R = np.zeros(n, dtype=np.float64)

    def add(self, sig: np.ndarray, start: float, gain: float = 1.0, pan: float = 0.0) -> None:
        if sig is None or len(sig) == 0 or gain == 0.0:
            return
        i = int(round(start * self.sr))
        if i >= self.n:            # 超出片长：直接丢弃
            return
        j = min(self.n, i + len(sig))
        if j <= 0:
            return
        if i < 0:
            sig = sig[-i:]
            i = 0
            j = min(self.n, len(sig))
        seg = sig[: j - i] * gain
        ang = (max(-1.0, min(1.0, pan)) + 1.0) * math.pi / 4.0
        self.L[i:j] += seg * math.cos(ang)
        self.R[i:j] += seg * math.sin(ang)

    def stack(self) -> np.ndarray:
        return np.vstack([self.L, self.R])


# --------------------------------------------------------------------------
# 音色合成
# --------------------------------------------------------------------------
def fm_bell(freq: float, dur: float, amp: float = 1.0, sr: int = SR,
            ratio: float = 3.47, index: float = 6.5, decay: float = 1.5) -> np.ndarray:
    """FM 钟琴 / 铃：非谐比调制 + 快衰减调制指数，尾巴长。"""
    n = max(8, int(dur * sr))
    t = t_axis(n, sr)
    mod_env = np.exp(-t * (decay * 4.5))
    mod = index * mod_env * np.sin(2.0 * np.pi * freq * ratio * t)
    ph = 2.0 * np.pi * freq * t + mod
    env = np.exp(-t * decay) * (1.0 - np.exp(-t / 0.003))
    return amp * env * np.sin(ph)


def soft_piano(freq: float, dur: float, amp: float = 1.0, sr: int = SR) -> np.ndarray:
    """软钢琴式加法合成：少量谐波 + 轻微非谐性 + 逐谐波衰减。"""
    n = max(16, int(dur * sr))
    t = t_axis(n, sr)
    parts = [(1, 1.00), (2, 0.42), (3, 0.20), (4, 0.105),
             (5, 0.055), (6, 0.030), (7, 0.017)]
    x = np.zeros(n)
    for k, a in parts:
        fk = freq * k * (1.0 + 0.0006 * k * k)   # 轻微非谐性，像真实弦槌
        x += a * np.sin(2.0 * np.pi * fk * t + 0.63 * k) * np.exp(-t * (1.0 + 0.45 * k) * 2.1)
    env = (1.0 - np.exp(-t / 0.006)) * np.exp(-t * 0.30)
    return amp * x * env


_PAD_CACHE: dict = {}


def pad_voice(freq: float, dur: float, sr: int = SR, n_harm: int = 14,
              detune_cents=(-7.0, -3.5, 0.0, 3.5, 7.0), rolloff: float = 1.15,
              attack: float = 1.3, release: float = 2.6, seed: int = 0) -> np.ndarray:
    """失谐锯齿 pad：多谐波加法合成（等价锯齿）+ 每个谐波微失谐 + 慢速低通。

    谐波加法避免了朴素锯齿的高频混叠；每个谐波再叠加 ±cents 失谐，
    形成缓慢拍频的"合唱"质感，是温暖 pad 的主要来源。
    """
    key = (round(freq, 4), round(dur, 3), n_harm, rolloff, seed)
    if key in _PAD_CACHE:
        return _PAD_CACHE[key]

    n = max(64, int(dur * sr))
    t = t_axis(n, sr)
    rng = np.random.default_rng(1000 + seed)
    x = np.zeros(n)
    for k in range(1, n_harm + 1):
        fk = freq * k
        if fk > 0.42 * sr:
            break
        ak = 1.0 / (k ** rolloff)
        for d in detune_cents:
            fkd = fk * 2.0 ** (d / 1200.0)
            ph = rng.uniform(0.0, 2.0 * np.pi)
            x += ak * np.sin(2.0 * np.pi * fkd * t + ph)
    x /= float(len(detune_cents))

    # 两只静态低通 + 慢速交叉淡化 ≈ 缓慢移动的截止频率
    sos_a = signal.butter(3, 820.0 / (sr / 2), "low", output="sos")
    sos_b = signal.butter(3, 2700.0 / (sr / 2), "low", output="sos")
    ya = signal.sosfilt(sos_a, x)
    yb = signal.sosfilt(sos_b, x)
    w = 0.5 + 0.5 * np.sin(2.0 * np.pi * 0.029 * t + 0.7)
    y = (1.0 - w) * ya + w * yb

    y *= soft_env(n, sr, attack=attack, release=release)
    _PAD_CACHE[key] = y
    return y


def bass_voice(freq: float, dur: float, amp: float = 1.0, sr: int = SR) -> np.ndarray:
    """正弦 + 轻微三角泛音的低音，带柔和起音与长释放。"""
    n = max(32, int(dur * sr))
    t = t_axis(n, sr)
    x = np.sin(2.0 * np.pi * freq * t)
    x += 0.20 * np.sin(2.0 * np.pi * freq * 2.0 * t) * np.exp(-t * 4.0)
    x += 0.08 * np.sin(2.0 * np.pi * freq * 3.0 * t) * np.exp(-t * 7.0)
    sos = signal.butter(2, 420.0 / (sr / 2), "low", output="sos")
    x = signal.sosfilt(sos, x)
    x *= soft_env(n, sr, attack=0.035, release=min(0.8, dur * 0.4))
    return amp * x


# --------------------------------------------------------------------------
# 雨声
# --------------------------------------------------------------------------
def make_rain(n: int, sr: int = SR) -> np.ndarray:
    """滤波噪声做雨：白噪 → 低通（雨的体）+ 高通（雨的沙）+ 低频轰底 + 缓慢阵风。"""
    rng = np.random.default_rng(777)
    w = rng.standard_normal(n)

    sos_low = signal.butter(2, 5200.0 / (sr / 2), "low", output="sos")
    sos_hp = signal.butter(2, 1100.0 / (sr / 2), "high", output="sos")
    body = signal.sosfilt(sos_low, w)
    hiss = signal.sosfilt(sos_hp, body)
    rumble = signal.sosfilt(signal.butter(2, 190.0 / (sr / 2), "low", output="sos"), w)

    # 缓慢起伏的风（~0.08 Hz）：用一阶低通对 |噪声| 做包络
    gust = one_pole_lp(np.abs(rng.standard_normal(n)), 0.08, sr)
    gust = gust / (np.mean(gust) + 1e-9)
    gust = np.clip(gust, 0.35, 2.2)

    rain = 0.85 * body + 0.55 * hiss + 0.60 * rumble
    rain *= gust
    return rain / (np.std(rain) + 1e-9) * 0.5


def make_drip(freq: float, dur: float = 0.22, amp: float = 1.0, sr: int = SR) -> np.ndarray:
    """雨滴：带通噪声 + 快衰减。"""
    n = max(16, int(dur * sr))
    t = t_axis(n, sr)
    rng = np.random.default_rng(int(freq * 13) + 5)
    x = rng.standard_normal(n)
    sos = signal.butter(2, [freq * 0.65 / (sr / 2), freq * 1.7 / (sr / 2)], "band", output="sos")
    y = signal.sosfilt(sos, x)
    env = np.exp(-t * 20.0)
    y *= env
    return amp * y / (np.max(np.abs(y)) + 1e-9)


# --------------------------------------------------------------------------
# 混响（自实现 Schroeder / 多抽头延迟）
# --------------------------------------------------------------------------
def _residue_lfilter(x: np.ndarray, delay: int, b, a) -> np.ndarray:
    """把长延迟线拆成 delay 条子序列做 lfilter，复杂度 O(N) 而非 O(N*delay)。

    关键：传入的 b/a 必须是「子序列递推」形式（短数组），
    例如梳状滤波器 w[k] = z[k] + g*w[k-1] 用 b=[1], a=[1,-g]。
    """
    n = len(x)
    pad = (-n) % delay
    xp = np.concatenate([x, np.zeros(pad, dtype=x.dtype)])
    m = len(xp) // delay
    z = xp[: m * delay].reshape(m, delay).T          # 每一行是一条子序列
    w = signal.lfilter(b, a, z, axis=-1)
    return w.T.reshape(-1)[:n]


def reverb(x: np.ndarray, sr: int = SR, decay: float = 0.84) -> np.ndarray:
    """多抽头延迟混响：8 个梳状 + 4 个全通（左右略有差异以获得立体声宽度）。"""
    combs = [(1116, 0.86), (1188, 0.86), (1277, 0.86), (1356, 0.86),
             (1422, 0.83), (1491, 0.83), (1557, 0.83), (1617, 0.83)]
    aps = [556, 441, 341, 225]
    out = np.zeros_like(x)
    for d, g in combs:
        out += _residue_lfilter(x, d, [1.0], [1.0, -g])
    out /= len(combs)
    for d in aps:
        out = _residue_lfilter(out, d, [-0.5, 1.0], [1.0, -0.5])
    return out


def reverb_stereo(x: np.ndarray, sr: int = SR) -> np.ndarray:
    """左右各跑一条略有差异的混响，并把湿声电平对齐干声。"""
    rl = reverb(x[0], sr)
    rr = reverb(x[1] * 0.999, sr)
    dry_rms = float(np.sqrt(np.mean(x ** 2))) + 1e-12
    wet_rms = float(np.sqrt(np.mean(np.vstack([rl, rr]) ** 2))) + 1e-12
    k = dry_rms / wet_rms
    return np.vstack([rl * k, rr * k])


# --------------------------------------------------------------------------
# 编曲
# --------------------------------------------------------------------------
CHORDS = {
    # 和弦：低音根音 + pad 音高（MIDI）
    "F":  {"bass": 41, "tones": [53, 60, 65, 69]},
    "Dm": {"bass": 38, "tones": [50, 57, 62, 65]},
    "Bb": {"bass": 34, "tones": [53, 58, 62, 65]},
    "C":  {"bass": 36, "tones": [48, 55, 60, 64]},
}

# 和弦时间线：(起始小节, 小节数, 和弦名)
CHORD_TL = [
    (10, 2, "F"), (12, 2, "Dm"), (14, 2, "Bb"), (16, 2, "C"),
    (18, 2, "F"), (20, 2, "Dm"),
    (22, 2, "F"), (24, 2, "Dm"), (26, 2, "Bb"), (28, 2, "C"),
    (30, 2, "F"), (32, 2, "Dm"), (34, 2, "Bb"), (36, 2, "C"),
    (38, 3, "F"),
    (41, 2, "F"), (43, 2, "Dm"), (45, 2, "Bb"), (47, 1, "C"), (48, 3, "F"),
]

# 主旋律乐句：(起始拍, 时值拍, MIDI)，一拍 = 1/4 拍号中的四分音符
PHRASE_P = [
    (0.0, 2.0, 72), (2.0, 1.0, 76), (3.0, 2.0, 79), (5.0, 1.0, 81), (6.0, 2.0, 79),
    (8.0, 2.0, 81), (10.0, 1.0, 79), (11.0, 1.0, 76), (12.0, 2.0, 74), (14.0, 1.0, 72),
    (15.0, 1.0, 0),
    (16.0, 2.0, 79), (18.0, 2.0, 77), (20.0, 1.5, 74), (21.5, 1.5, 77), (23.0, 1.0, 0),
    (24.0, 1.5, 81), (25.5, 1.0, 79), (26.5, 1.5, 76), (28.0, 2.0, 74), (30.0, 1.5, 72),
    (31.5, 0.5, 0),
]

PHRASE_P2 = [   # 变奏：时值拉长、轮廓上扬
    (0.0, 3.0, 72), (3.0, 1.0, 76), (4.0, 3.0, 79), (7.0, 1.0, 81),
    (8.0, 3.0, 81), (11.0, 1.0, 79), (12.0, 3.0, 74), (15.0, 1.0, 0),
    (16.0, 2.5, 79), (18.5, 2.5, 77), (21.0, 2.0, 74), (23.0, 1.0, 0),
    (24.0, 2.0, 81), (26.0, 2.0, 79), (28.0, 2.0, 76), (30.0, 2.0, 74),
]

PHRASE_END = [(0.0, 2.0, 72), (2.0, 2.0, 77), (4.0, 3.0, 79), (7.0, 1.0, 81), (8.0, 4.0, 77)]

PHRASE_D = [(0.0, 2.0, 72), (2.0, 2.0, 69), (4.0, 3.0, 74), (7.0, 1.0, 0), (8.0, 4.0, 77)]


def bar_time(bar: float) -> float:
    return bar * BAR


def chord_at_bar(bar: int):
    for start, dur, name in CHORD_TL:
        if start <= bar < start + dur:
            return name
    return "F"


def synthesize(sr: int = SR) -> np.ndarray:
    """把全部声部混成一条立体声母线。"""
    n = int(round(DUR * sr))
    # 分声部总线，便于分段落测量电平并做配平
    pad_bus = Bus(n, sr)
    bass_bus = Bus(n, sr)
    mel_bus = Bus(n, sr)
    bell_bus = Bus(n, sr)
    rain_bus = Bus(n, sr)
    music = Bus(n, sr)     # 需要送混响的"音乐"总线

    # ---------------- 雨声底噪 ----------------
    rain = make_rain(n, sr)
    # 分段音量：A 段最明显，B/C 段退到背景，D 段略微回来再淡出
    seg = np.zeros(n)
    for (b0, b1), g in [(BAR_A, GAIN["rain_A"]), (BAR_B, GAIN["rain_B"]),
                        (BAR_C, GAIN["rain_C"]), (BAR_D, GAIN["rain_D"])]:
        i, j = int(b0 * BAR * sr), int(b1 * BAR * sr)
        seg[i:j] = g
    # 结尾 12 秒线性淡出到近乎无声（最后 6 秒已是极轻的"灯灭"）
    fade_start = int((DUR - 12.0) * sr)
    seg[fade_start:] *= np.linspace(1.0, 0.0, n - fade_start)
    # 开头 1.5 秒淡入
    fi = int(1.5 * sr)
    seg[:fi] *= np.linspace(0.0, 1.0, fi) ** 1.5
    rain_sig = rain * seg
    # 轻微左右差异，雨不至于死板
    rain_bus.add(rain_sig, 0.0, 1.0, pan=-0.12)
    rain_bus.add(rain_sig, 0.0, 0.92, pan=0.12)

    # 稀疏雨滴（A 段黄昏、D 段收尾）
    drip_times = [3.4, 9.1, 14.6, 21.2, 27.8, 33.0, 128.5, 136.2, 147.0, 156.4]
    for k, tt in enumerate(drip_times):
        d = make_drip(900.0 + 260.0 * (k % 4), 0.26, 0.22, sr)
        pan = -0.35 if k % 2 == 0 else 0.35
        bell_bus.add(d, tt, 1.0, pan)

    # ---------------- A 段：稀疏钟琴 / 拨弦单音 ----------------
    bell_A = [2.6, 6.9, 11.4, 15.8, 20.3, 24.9, 29.6, 33.8]
    bell_pitch = [77, 81, 72, 84, 69, 81, 79, 84]
    for k, (tt, p) in enumerate(zip(bell_A, bell_pitch)):
        b = fm_bell(float(m2f(p)), 4.5, 1.0, sr, ratio=3.47, index=5.5, decay=1.35)
        bell_bus.add(b, tt, GAIN["bell_A"] * (0.85 if k % 3 else 1.0),
                     pan=-0.45 if k % 2 == 0 else 0.45)

    # ---------------- 和弦时间线：pad + 低音 ----------------
    for si, (start_bar, dur_bars, cname) in enumerate(CHORD_TL):
        t0 = bar_time(start_bar)
        span = dur_bars * BAR
        ch = CHORDS[cname]
        # D 段用"更暗"的 pad（谐波更少），形成抽掉中高频的感觉
        if start_bar >= BAR_D[0]:
            n_harm, rolloff, attack, release = 7, 1.6, 1.6, 3.2
        elif start_bar >= BAR_C[0]:
            n_harm, rolloff, attack, release = 14, 1.12, 1.2, 2.6
        else:
            n_harm, rolloff, attack, release = 12, 1.2, 1.4, 2.8

        if start_bar < BAR_D[0] + 6:      # D 段末尾的 pad 慢慢消失
            gain = (GAIN["pad_B"] if start_bar < BAR_C[0] else
                    (GAIN["pad_C"] if start_bar < BAR_D[0] else GAIN["pad_D"]))
        else:
            gain = GAIN["pad_D"] * 0.85

        voice_dur = span + release + 0.4
        for ti, tone in enumerate(ch["tones"]):
            v = pad_voice(float(m2f(tone)), voice_dur, sr, n_harm=n_harm,
                          rolloff=rolloff, attack=attack, release=release,
                          seed=si * 13 + ti)
            # 低音偏左、高音偏右，天然展开立体声
            pan = -0.30 + 0.60 * (ti / max(1, len(ch["tones"]) - 1))
            pad_bus.add(v, t0, gain, pan)

        # 低音：每小节一个根音，第二拍轻微再起一次
        for b in range(start_bar, start_bar + dur_bars):
            if b >= BAR_D[0] + 7:          # D 段 48 小节后低音退出
                break
            bf = float(m2f(ch["bass"]))
            bass = bass_voice(bf, BAR * 0.92, 1.0, sr)
            bg = GAIN["bass_B"] if b < BAR_C[0] else (GAIN["bass_C"] if b < BAR_D[0] else GAIN["bass_D"])
            if b >= BAR_D[0]:
                bg *= max(0.0, 1.0 - (b - BAR_D[0]) / 8.0)
            bass_bus.add(bass, bar_time(b), bg, pan=0.0)
            if b < BAR_D[0]:
                bass_bus.add(bass, bar_time(b) + 2.0 * BEAT, bg * 0.45, pan=0.0)
    # ---------------- 主旋律 ----------------
    def add_melody(phrase, start_bar, gain, vel_scale=1.0, octave2=0.0, pan_base=0.0):
        t0 = bar_time(start_bar)
        for (b0, dur_b, midi) in phrase:
            if midi == 0:
                continue
            f = float(m2f(midi))
            dur_s = dur_b * BEAT
            amp = gain * vel_scale * (1.0 if dur_b >= 1.5 else 0.85)
            sig = soft_piano(f, dur_s * 2.6 + 0.6, amp, sr)
            # 左右各一份，轻微失谐 → 宽度
            sig_l = soft_piano(f * 0.9995, dur_s * 2.6 + 0.6, amp, sr)
            mel_bus.add(sig_l, t0 + b0 * BEAT, 0.85, pan=pan_base - 0.22)
            mel_bus.add(sig, t0 + b0 * BEAT, 0.85, pan=pan_base + 0.22)
            if octave2 > 0:
                low = soft_piano(f * 0.5, dur_s * 2.2 + 0.5, amp * octave2, sr)
                mel_bus.add(low, t0 + b0 * BEAT, 1.0, pan=pan_base)

    # B 段：主题第一次出现（安静、留白多）
    add_melody(PHRASE_P[:16], BAR_B[0], GAIN["mel_B"], vel_scale=0.95)
    add_melody(PHRASE_P, BAR_B[0] + 8, GAIN["mel_B"], vel_scale=0.80)
    # C 段：主题重复 + 变奏（更饱满、低八度衬底）
    add_melody(PHRASE_P, BAR_C[0], GAIN["mel_C"], vel_scale=1.0, octave2=0.32)
    add_melody(PHRASE_P2, BAR_C[0] + 8, GAIN["mel_C"], vel_scale=1.05, octave2=0.30)
    add_melody(PHRASE_END, BAR_C[0] + 16, GAIN["mel_C"], vel_scale=0.92, octave2=0.26)
    # D 段：只剩一个乐句碎片，随后交给雨声
    add_melody(PHRASE_D, BAR_D[0], GAIN["mel_D"], vel_scale=0.80)

    # ---------------- C 段：高音铃状泛音（副歌"亮一下"） ----------------
    hi_bells = [
        (BAR_C[0] + 1.0, 84), (BAR_C[0] + 4.0, 86), (BAR_C[0] + 7.0, 91),
        (BAR_C[0] + 9.0, 84), (BAR_C[0] + 12.0, 89), (BAR_C[0] + 15.0, 91),
        (BAR_C[0] + 17.0, 86), (BAR_C[0] + 20.0, 89), (BAR_C[0] + 23.0, 93),
        (BAR_C[0] + 26.0, 91), (BAR_C[0] + 29.0, 89), (BAR_C[0] + 32.0, 86),
        (BAR_C[0] + 35.0, 84), (BAR_C[0] + 37.0, 77), (BAR_C[0] + 39.0, 81),
    ]
    for k, (bt, p) in enumerate(hi_bells):
        b = fm_bell(float(m2f(p)), 4.0, 1.0, sr, ratio=2.01, index=3.6, decay=1.7)
        bell_bus.add(b, bar_time(bt), GAIN["hi_bell"] * (1.0 if k % 3 else 1.25),
                     pan=-0.5 if k % 2 == 0 else 0.5)

    # D 段：几颗余音（稀疏、渐弱）
    for k, (bt, p) in enumerate([(BAR_D[0] + 1.0, 84), (BAR_D[0] + 4.5, 77),
                                 (BAR_D[0] + 8.0, 72)]):
        b = fm_bell(float(m2f(p)), 5.0, 1.0, sr, ratio=2.01, index=2.4, decay=1.25)
        bell_bus.add(b, bar_time(bt), GAIN["hi_bell"] * 0.85 * (1.0 - 0.22 * k),
                     pan=0.4 if k % 2 else -0.4)

    # ---------------- 各声部汇总 ----------------
    bus_report({"pad": pad_bus, "bass": bass_bus, "melody": mel_bus,
                "bell": bell_bus, "rain": rain_bus}, sr)
    for sub in (pad_bus, bass_bus, mel_bus, bell_bus):
        music.L += sub.L
        music.R += sub.R

    # ---------------- 合成：混响 + 母带 ----------------
    m = music.stack()
    r = reverb_stereo(m, sr)
    mixed = m * (1.0 - 0.03) + r * GAIN["wet"]

    # 雨声（少量混响）
    rr = reverb_stereo(rain_bus.stack(), sr)
    mixed += rain_bus.stack() * 0.94 + rr * 0.06

    return mixed


def bus_report(buses: dict, sr: int = SR) -> None:
    """打印各声部在四个段落里的电平（dBFS），用于配平。"""
    secs = [("A 0:00-0:35", BAR_A), ("B 0:35-1:18", BAR_B),
            ("C 1:18-2:25", BAR_C), ("D 2:25-3:00", BAR_D)]
    print("\n[0] 各声部分段电平 (dBFS RMS)")
    hdr = "    声部      " + "".join(f"{s[0]:>16s}" for s in secs)
    print(hdr)
    for name, bus in buses.items():
        x = bus.stack()
        cells = []
        for _, (b0, b1) in secs:
            seg = x[:, int(b0 * BAR * sr):int(b1 * BAR * sr)]
            r = float(np.sqrt(np.mean(seg ** 2)))
            cells.append(f"{db(r):16.1f}")
        print(f"    {name:<9s}" + "".join(cells))


# --------------------------------------------------------------------------
# 母带
# --------------------------------------------------------------------------
def compress_stereo(x: np.ndarray, sr: int, thr_db: float, ratio: float,
                    det_hz: float = 60.0, gain_hz: float = 20.0) -> np.ndarray:
    """立体声联动压缩：检测器 → 增益 → 平滑（避免咔哒）。

    第 3 轮教训：检测器太慢（≈17Hz）抓不住瞬态峰值，"波峰因数"降不下来，
    整体 RMS 只能做到 -18.5 dBFS（太安静）。
    第 4 轮：检波器提到 60Hz、增益平滑 20Hz，压缩器才真正作用在峰值上。
    """
    det = np.abs(x).max(axis=0)
    env = one_pole_lp_hz(det, det_hz, sr)
    thr = 10 ** (thr_db / 20.0)
    gain = np.where(env > thr,
                    thr * (np.maximum(env, 1e-9) / thr) ** (1.0 / ratio) / np.maximum(env, 1e-9),
                    1.0)
    gain = one_pole_lp_hz(gain, gain_hz, sr)
    return x * gain


def soft_knee_limit(x: np.ndarray, thr: float, ceil: float) -> np.ndarray:
    """软拐点限幅（软限幅的核心）：|x| ≤ thr 完全线性，之上以指数平滑趋近 ceil。

    为什么不用 tanh 全波形削波：tanh 会把"响的部分"整体压小，
    波峰因数（峰值−RMS）反而变大，整体 RMS 掉到 -18.5 dBFS 以下；
    而软拐点只在阈值之上的少量样本上起作用（C1 连续、单调、无硬削波），
    既能把峰值收进 -1.05 dBFS，又保住了 A 段安静 / 副歌更亮 / 结尾渐弱的段落弧线。
    """
    a = np.abs(x)
    y = a.copy()
    k = max(ceil - thr, 1e-6)
    over = a > thr
    y[over] = thr + k * (1.0 - np.exp(-(a[over] - thr) / k))
    return np.sign(x) * y


def master(x: np.ndarray, sr: int) -> np.ndarray:
    """母带链：去直流 → 高通 → 轻压缩 → 软拐点限幅 → 峰值归一 → 淡入淡出。

    第 3/4 轮教训（重要）：
      · 整体 RMS 与峰值的关系 = 峰值 − 波峰因数。本曲段落跨度大
        （A 段只有雨声、C 段最响），波峰因数天然偏大，
        峰值锁在 -1.05 dBFS 时 RMS 就会偏低。
      · 因此母带的目标是"用最小代价把波峰因数压到 ~16dB"：
        轻压缩做粘合，软拐点限幅削掉最顶的瞬态，再整体归一到 -1.05 dBFS。
      · 一阶低通的时间常数必须换算成真实 Hz（one_pole_lp_hz），
        否则"快检波"会变成 2.5 秒级时间常数，把整首曲子压没（第 4 轮踩坑）。
    """
    y = x - np.mean(x, axis=1, keepdims=True)
    y = signal.sosfilt(signal.butter(2, 26.0 / (sr / 2), "high", output="sos"), y, axis=1)
    # 预缩放到 0 dBFS 峰值，后续阈值/天花板都用绝对 dB 表达，便于扫描
    pk0 = float(np.max(np.abs(y)))
    if pk0 > 1e-9:
        y = y / pk0

    # 扫描 (轻压缩阈值, 软拐点阈值, 软拐点天花板)，挑 RMS 最接近 -17dBFS 的组合
    best = None
    for comp_thr in (None, -16.0):
        z = y if comp_thr is None else compress_stereo(y, sr, comp_thr, 1.3)
        for thr_db in (-7.0, -6.0, -5.0):
            for ceil_db in (-5.0, -4.5, -4.0):
                if ceil_db <= thr_db:
                    continue
                w = soft_knee_limit(z, 10 ** (thr_db / 20.0), 10 ** (ceil_db / 20.0))
                pk = float(np.max(np.abs(w)))
                if pk < 1e-9:
                    continue
                scale = PEAK_CEIL / pk
                out_rms_db = db(float(np.sqrt(np.mean(w ** 2)))) + db(scale)
                if not (-18.4 <= out_rms_db <= -15.9):
                    continue
                # 评分：先看 RMS 偏离 -17 的程度；同分时优先"动得最少"
                # （压缩更轻、拐点更高、天花板更低 = 受影响样本更少）
                score = (abs(out_rms_db - TARGET_RMS_DB),
                         0 if comp_thr is None else -comp_thr, -thr_db, -ceil_db)
                cand = (score, comp_thr, thr_db, ceil_db, w, scale, out_rms_db)
                if best is None or cand[0] < best[0]:
                    best = cand
    if best is None:
        # 兜底：只做软拐点限幅 + 峰值归一，保证不削波
        w = soft_knee_limit(y, 10 ** (-6.0 / 20.0), 10 ** (-4.0 / 20.0))
        pk = float(np.max(np.abs(w)))
        w = w * (PEAK_CEIL / pk)
        out_rms = db(float(np.sqrt(np.mean(w ** 2))))
        print(f"    母带: 兜底（软拐点限幅），RMS {out_rms:.2f} dBFS")
    else:
        _, comp_thr, thr_db, ceil_db, w, scale, out_rms = best
        w = w * scale
        comp_txt = "无" if comp_thr is None else f"{comp_thr}dB/1.3"
        print(f"    母带: 压缩 {comp_txt}，软拐点 {thr_db}/{ceil_db} dBFS，"
              f"输出峰值 {db(PEAK_CEIL):.2f} dBFS，RMS {out_rms:.2f} dBFS")

    # 整体淡入 1.5 秒 + 末尾 12 秒淡出（最后 6 秒近乎无声）
    fi = int(1.5 * sr)
    w[:, :fi] *= np.linspace(0.0, 1.0, fi) ** 1.4
    fo = int(12.0 * sr)
    w[:, -fo:] *= np.linspace(1.0, 0.0, fo) ** 1.6
    # 2 ms 边缘淡入淡出，彻底杜绝咔哒
    k = int(0.002 * sr)
    w[:, :k] *= np.linspace(0.0, 1.0, k)
    w[:, -k:] *= np.linspace(1.0, 0.0, k)
    return w


# --------------------------------------------------------------------------
# 统计 / 自检
# --------------------------------------------------------------------------
def db(x: float) -> float:
    return 20.0 * math.log10(max(abs(x), 1e-12))


def analyze(x: np.ndarray, sr: int, label: str = "") -> dict:
    """对成品 PCM 做统计：采样率 / 时长 / 峰值 / RMS / 直流 / 相邻样本跳变等。"""
    n = x.shape[1]
    peak = float(np.max(np.abs(x)))
    rms = float(np.sqrt(np.mean(x ** 2)))
    dc = float(np.mean(x))
    d = np.abs(np.diff(x, axis=1))
    max_delta = float(np.max(d))

    # --- 咔哒（爆音）判定 ---
    # 真爆音是孤立单样本脉冲：它会远远超出周围 30 ms 内 |Δ| 的平均水平。
    # 正常的高频内容（雨声、钟琴泛音）不会这样，所以用相对判据而不是绝对阈值。
    loc = ndimage.uniform_filter1d(d, size=max(3, int(0.03 * sr)), axis=1, mode="nearest")
    thr = np.maximum(10.0 * loc, 0.02)
    click_count = int(np.sum(d > thr))

    # 由最大跳变反推的「等效最高频率」：>12 kHz 说明不是正常带限信号
    amp = ndimage.maximum_filter1d(np.abs(x), size=max(3, int(0.01 * sr)), axis=1)
    amp = np.maximum(amp[:, :-1], amp[:, 1:])
    imp = d * sr / (2.0 * np.pi * np.maximum(amp, 1e-9))
    imp_max = float(np.max(imp))

    clip_samples = int(np.sum(np.abs(x) >= 0.999))
    # 静音检测（0.5 s 块）
    win = sr // 2
    nb = len(x[0]) // win
    brms = np.sqrt(np.mean(x[:, : nb * win].reshape(2, nb, win) ** 2, axis=2)).max(axis=0)
    silence_blocks = int(np.sum(brms < 1e-4))
    # 边缘 10 ms 的最大跳变（淡入淡出是否干净）
    edge_k = int(0.01 * sr)
    edge_max = float(max(np.max(d[:, :edge_k]) if d.shape[1] else 0.0,
                         np.max(d[:, -edge_k:]) if d.shape[1] else 0.0))
    st = {
        "label": label,
        "sr": sr,
        "channels": int(x.shape[0]),
        "duration_s": round(n / sr, 3),
        "peak": round(peak, 6),
        "peak_dbfs": round(db(peak), 2),
        "rms": round(rms, 6),
        "rms_dbfs": round(db(rms), 2),
        "dc_offset": round(dc, 8),
        "max_adjacent_delta": round(max_delta, 6),
        "max_adjacent_delta_dbfs": round(db(max_delta), 2),
        "click_suspects": click_count,
        "implied_max_freq_hz": round(imp_max, 1),
        "edge_10ms_max_delta": round(edge_max, 8),
        "clipped_samples": clip_samples,
        "silent_halfsec_blocks": silence_blocks,
        "first_sample": [round(float(v), 8) for v in x[:, 0]],
        "last_sample": [round(float(v), 8) for v in x[:, -1]],
    }
    return st


def envelope_db(x: np.ndarray, sr: int, step_s: float = 5.0) -> list:
    out = []
    k = int(step_s * sr)
    for i in range(0, x.shape[1] - k + 1, k):
        seg = x[:, i:i + k]
        r = float(np.sqrt(np.mean(seg ** 2)))
        out.append((round(i / sr, 1), round(db(r), 1)))
    return out


# --------------------------------------------------------------------------
# 文件 IO
# --------------------------------------------------------------------------
def write_wav(path: str, x: np.ndarray, sr: int) -> None:
    pcm = np.clip(x.T, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[0])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def read_wav(path: str):
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        n = w.getnframes()
        data = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float64) / 32768.0
    return data.reshape(-1, ch).T, sr


def run(cmd: list) -> str:
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        raise RuntimeError(f"命令失败: {' '.join(cmd)}\n{p.stderr}")
    return p.stdout


def encode_mp3(wav_path: str, mp3_path: str) -> None:
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", wav_path,
         "-c:a", "libmp3lame", "-b:a", BITRATE, "-ar", "44100", "-ac", "2", mp3_path])


def probe_mp3(mp3_path: str) -> dict:
    out = run(["ffprobe", "-v", "error", "-print_format", "json",
               "-show_format", "-show_streams", mp3_path])
    return json.loads(out)


def decode_mp3(mp3_path: str, wav_path: str) -> None:
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", mp3_path,
         "-f", "wav", "-acodec", "pcm_s16le", wav_path])


# --------------------------------------------------------------------------
# 主流程
# --------------------------------------------------------------------------
def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    tmpdir = tempfile.mkdtemp(prefix="after15_")
    wav_path = os.path.join(tmpdir, "after15.wav")
    dec_path = os.path.join(tmpdir, "after15_dec.wav")

    print("=" * 78)
    print("《下班后的十五分钟》配乐合成中 ...")
    print("=" * 78)

    raw = synthesize(SR)
    y = master(raw, SR)

    st_wav = analyze(y, SR, "合成母线 (PCM)")
    print("\n[1] 合成母线统计")
    for k, v in st_wav.items():
        if k != "label":
            print(f"    {k:26s} : {v}")

    print("\n[2] 每 5 秒 RMS 包络 (dBFS)")
    env = envelope_db(y, SR, 5.0)
    for t, v in env:
        bar = "#" * max(0, int((v + 60) / 2))
        print(f"    {t:6.1f}s  {v:7.1f} dB  {bar}")

    write_wav(wav_path, y, SR)
    encode_mp3(wav_path, MP3_PATH)
    print(f"\n[3] 已写出: {MP3_PATH}")

    info = probe_mp3(MP3_PATH)
    fmt = info.get("format", {})
    strm = [s for s in info.get("streams", []) if s.get("codec_type") == "audio"]
    s0 = strm[0] if strm else {}
    probe = {
        "duration_s": round(float(fmt.get("duration", 0)), 3),
        "bit_rate_bps": int(fmt.get("bit_rate", 0)),
        "format_name": fmt.get("format_name"),
        "codec": s0.get("codec_name"),
        "sample_rate": int(s0.get("sample_rate", 0)),
        "channels": int(s0.get("channels", 0)),
        "size_bytes": int(fmt.get("size", 0)),
    }
    print("\n[4] ffprobe 结果")
    for k, v in probe.items():
        print(f"    {k:26s} : {v}")

    decode_mp3(MP3_PATH, dec_path)
    yd, srd = read_wav(dec_path)
    st_dec = analyze(yd, srd, "mp3 解码回 PCM")
    print("\n[5] mp3 解码后统计")
    for k, v in st_dec.items():
        if k != "label":
            print(f"    {k:26s} : {v}")

    shutil.rmtree(tmpdir, ignore_errors=True)

    # ---------------- 指标判定 ----------------
    print("\n[6] 指标判定")
    checks = [
        ("时长 180–200 s", 180.0 <= probe["duration_s"] <= 200.0, f"{probe['duration_s']} s"),
        ("采样率 44100", probe["sample_rate"] == 44100, f"{probe['sample_rate']}"),
        ("立体声 2 声道", probe["channels"] == 2, f"{probe['channels']}"),
        ("峰值 ≤ -1.0 dBFS (PCM)", st_wav["peak_dbfs"] <= -1.0, f"{st_wav['peak_dbfs']} dBFS"),
        ("峰值 ≤ -1.0 dBFS (MP3 解码)", st_dec["peak_dbfs"] <= -1.0, f"{st_dec['peak_dbfs']} dBFS"),
        ("RMS -18 ~ -16 dBFS (PCM)", -18.5 <= st_wav["rms_dbfs"] <= -15.5, f"{st_wav['rms_dbfs']} dBFS"),
        ("RMS -18 ~ -16 dBFS (MP3)", -18.5 <= st_dec["rms_dbfs"] <= -15.5, f"{st_dec['rms_dbfs']} dBFS"),
        ("无削波样本", st_wav["clipped_samples"] == 0 and st_dec["clipped_samples"] == 0,
         f"PCM {st_wav['clipped_samples']} / MP3 {st_dec['clipped_samples']}"),
        ("无咔哒嫌疑", st_wav["click_suspects"] == 0 and st_dec["click_suspects"] == 0,
         f"PCM {st_wav['click_suspects']} / MP3 {st_dec['click_suspects']}"),
        ("等效最高频率 < 12kHz", st_wav["implied_max_freq_hz"] < 12000
         and st_dec["implied_max_freq_hz"] < 12000,
         f"{st_wav['implied_max_freq_hz']} / {st_dec['implied_max_freq_hz']} Hz"),
        ("首尾 10ms 无跳变", st_wav["edge_10ms_max_delta"] < 0.02
         and st_dec["edge_10ms_max_delta"] < 0.02,
         f"{st_wav['edge_10ms_max_delta']} / {st_dec['edge_10ms_max_delta']}"),
        ("直流偏移 < 1e-4", abs(st_wav["dc_offset"]) < 1e-4 and abs(st_dec["dc_offset"]) < 1e-4,
         f"{st_wav['dc_offset']} / {st_dec['dc_offset']}"),
        ("首尾样本归零", max(abs(v) for v in st_wav["first_sample"]) < 1e-6
         and max(abs(v) for v in st_wav["last_sample"]) < 1e-6, "ok"),
    ]
    for name, ok, val in checks:
        print(f"    [{'PASS' if ok else 'FAIL'}] {name:30s} -> {val}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
