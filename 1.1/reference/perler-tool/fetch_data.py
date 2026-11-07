# -*- coding: utf-8 -*-
"""重新抓取重建拼豆色板所需的原始数据。

来源（全部为公开仓库里的社区色卡，非厂家光谱实测值）：
  Zippland/perler-beads              291 标准色 × 5 品牌色号映射
  LunarXuan/Pindo                    Hama / Perler / Artkal S，以及五套中文色号色板
  abearxiong/get-colors-from-beans   卡卡 / 柿柿 / 童趣 / 优肯 / DMC（colorMap.json）
  Jett-Wu/Perler_Beads_Generator     第三方校验用
"""
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")
os.makedirs(RAW, exist_ok=True)

UA = {"User-Agent": "curl/8"}


def fetch(url, dest, required=True):
    """下载到 data/raw/<dest>；已存在则跳过。"""
    path = os.path.join(RAW, dest)
    if os.path.exists(path) and os.path.getsize(path) > 200:
        print(f"  跳过（已存在） {dest}  {os.path.getsize(path)/1024:.1f} KB")
        return path
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = r.read()
    except Exception as e:
        msg = f"  失败 {dest}: {e}"
        print(msg)
        if required:
            raise
        return None
    with open(path, "wb") as f:
        f.write(data)
    print(f"  ok   {dest}  {len(data)/1024:.1f} KB")
    return path


def gh(repo, path):
    """GitHub contents API，带 raw 媒体类型（比 raw.githubusercontent 更稳）。"""
    return f"https://api.github.com/repos/{repo}/contents/{urllib.parse.quote(path)}?ref=HEAD"


GITHUB = [
    ("Zippland/perler-beads", "src/app/colorSystemMapping.json", "zippland_colorSystemMapping.json"),
    ("Zippland/perler-beads", "色号对应表.csv", "zippland_色号对应表.csv"),
    ("Jett-Wu/Perler_Beads_Generator", "src/palette.ts", "jettwu_palette.ts"),
]

PINDO_PALETTES = [
    "mard", "coco", "manman", "panpan", "mixiaowo", "hama", "perler", "artkal-s",
]

GITEA = "https://git.xiongxiao.me"


def main():
    import urllib.parse  # noqa: F401  (供 gh 使用)

    print("== GitHub (api contents, Accept: raw) ==")
    for repo, path, dest in GITHUB:
        url = gh(repo, path)
        req = urllib.request.Request(url, headers={**UA, "Accept": "application/vnd.github.raw"})
        p = os.path.join(RAW, dest)
        if os.path.exists(p) and os.path.getsize(p) > 200:
            print(f"  跳过（已存在） {dest}")
            continue
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
        except Exception as e:
            print(f"  失败 {dest}: {e}")
            continue
        with open(p, "wb") as f:
            f.write(data)
        print(f"  ok   {dest}  {len(data)/1024:.1f} KB")

    print("== Pindo 色板 ==")
    for name in PINDO_PALETTES:
        fetch(gh("LunarXuan/Pindo", f"lib/data/palettes/{name}.json"), f"pindo_{name}.json", required=False)

    print("== Pindo 原始色板（交叉校验用） ==")
    for name in ["hama", "perler", "artkal-s"]:
        fetch(gh("LunarXuan/Pindo", f"lib/data/raw/{name}.json"), f"pindo_raw_{name}.json", required=False)

    print("== get-colors-from-beans (自建 Gitea) ==")
    fetch(f"{GITEA}/abearxiong/get-colors-from-beans/raw/branch/HEAD/colorMap.json",
          "getcolors_colorMap.json", required=False)


if __name__ == "__main__":
    main()
