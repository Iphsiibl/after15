# -*- coding: utf-8 -*-
"""把 src/ 下的模板 + CSS + JS 打包成一个可离线打开的单文件 HTML。

用法:
    python tools/build.py            # 生成 dist/index.html
    python tools/build.py --out xxx  # 指定输出
"""
import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"


def read(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


def music_link() -> str:
    """配套曲子在 dist/after15.mp3, 存在才给入口(保持单文件也能独立工作)。"""
    mp3 = ROOT / "dist" / "after15.mp3"
    if not mp3.exists():
        return ""
    mb = mp3.stat().st_size / 1024 / 1024
    return (
        '<p class="music-line">'
        '<span class="music-title">配套纯音乐《十五分钟》</span>'
        '<audio controls preload="metadata" src="after15.mp3" aria-label="配套纯音乐《十五分钟》"></audio>'
        '<a class="ghost small" href="after15.mp3" download>下载 mp3</a>'
        f'<span class="micro"> · {mb:.1f} MB · 今晚可以单曲循环</span>'
        '</p>'
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "dist" / "index.html"))
    ap.add_argument("--title", default="")
    args = ap.parse_args()

    html = read(SRC / "index.html")
    css = read(SRC / "styles.css")
    js = read(SRC / "app.js")
    audio_js = read(SRC / "audio.js")
    content_js = read(SRC / "content.js")

    # 模板占位符: {{STYLES}} {{CONTENT_JS}} {{AUDIO_JS}} {{APP_JS}} {{TITLE}} {{MUSIC}}
    html = html.replace("{{TITLE}}", args.title or "下班后的十五分钟")
    html = html.replace("{{STYLES}}", css)
    html = html.replace("{{CONTENT_JS}}", content_js)
    html = html.replace("{{AUDIO_JS}}", audio_js)
    html = html.replace("{{APP_JS}}", js)
    html = html.replace("{{MUSIC}}", music_link())

    leftovers = re.findall(r"\{\{(\w+)\}\}", html)
    if leftovers:
        print("未替换的占位符:", leftovers, file=sys.stderr)
        return 1

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    size_kb = out.stat().st_size / 1024
    print(f"构建完成: {out}  ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
