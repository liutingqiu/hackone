"""生成 APK 启动图标：3x3 拼豆九宫格。"""
from PIL import Image, ImageDraw
import os

COLORS = ["#e63946", "#f4a11b", "#f6d13c",
          "#22a06b", "#2f6fed", "#0e93ad",
          "#a259ff", "#ff6b9d", "#f7f8fb"]
BG = "#16181d"
OUT = os.path.join(os.path.dirname(__file__), "..", "android", "res")
SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
SS = 8  # 超采样倍数


def make(size: int) -> Image.Image:
    n = size * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(n * 0.22)
    d.rounded_rectangle([0, 0, n - 1, n - 1], radius=r, fill=BG)
    pad = n * 0.16
    gap = n * 0.035
    cell = (n - 2 * pad - 2 * gap) / 3
    tr = int(cell * 0.16)
    for i in range(3):
        for j in range(3):
            x = pad + j * (cell + gap)
            y = pad + i * (cell + gap)
            d.rounded_rectangle([x, y, x + cell, y + cell], radius=tr,
                                fill=COLORS[i * 3 + j])
    return img.resize((size, size), Image.LANCZOS)


for dpi, size in SIZES.items():
    d = os.path.join(OUT, f"mipmap-{dpi}")
    os.makedirs(d, exist_ok=True)
    make(size).convert("RGBA").save(os.path.join(d, "ic_launcher.png"))
    print("wrote", os.path.join(d, "ic_launcher.png"), size)