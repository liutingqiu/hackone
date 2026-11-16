"""把 classes.dex 与页面资源按 Android 规范打进 APK。

aapt2 在 Windows 上会把 -A 目录里的条目写成 `assets\\www\\index.html`（反斜杠），
AssetManager 按 `www/index.html` 查不到，所以资源统一在这里用正斜杠写入，
并保持原始条目的压缩方式（resources.arsc 必须保持未压缩，Android 11+ 要求）。
"""
import sys
import zipfile

base, dex, html, out = sys.argv[1:5]
FIXED = (1980, 1, 1, 0, 0, 0)


def add(zout, name, path):
    info = zipfile.ZipInfo(name, FIXED)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    with open(path, "rb") as f:
        zout.writestr(info, f.read())


with zipfile.ZipFile(base) as zin, zipfile.ZipFile(out, "w") as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        zout.writestr(item, data)          # 保留原压缩方式 / 时间戳
    add(zout, "classes.dex", dex)
    add(zout, "assets/www/index.html", html)

print("packed ->", out)