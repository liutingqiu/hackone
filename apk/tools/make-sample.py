"""生成一张拼豆风格的示例图，用于导入流程截图。"""
from PIL import Image
import os

W = H = 64
img = Image.new("RGBA", (W, H), (255, 255, 255, 255))
px = img.load()
palette = [
    (230, 57, 70), (244, 161, 27), (246, 209, 60),
    (34, 160, 107), (47, 111, 237), (14, 147, 173),
    (162, 89, 255), (255, 107, 157), (255, 255, 255),
    (28, 31, 38), (240, 220, 180),
]
# 8x8 像素块：用一个简单的心形/笑脸图案填充
art = [
    "0000000000000000",
    "0011110001111000",
    "0112211112221100",
    "1222222222222210",
    "1223333333333210",
    "0123444444432100",
    "0012455555421000",
    "0001245554210000",
    "0000124442100000",
    "0000012321000000",
    "0000001210000000",
    "0000000100000000",
    "0000000000000000",
    "0000000000000000",
    "0000000000000000",
    "0000000000000000",
]
size = W // 16
for y, row in enumerate(art):
    for x, ch in enumerate(row):
        v = int(ch)
        if v == 0:
            continue
        r, g, b = palette[v % len(palette)]
        for yy in range(y * size, (y + 1) * size):
            for xx in range(x * size, (x + 1) * size):
                px[xx, yy] = (r, g, b, 255)

out = os.path.join(os.path.dirname(__file__), "..", "dist", "screenshots", "sample.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out)
print("wrote", out)