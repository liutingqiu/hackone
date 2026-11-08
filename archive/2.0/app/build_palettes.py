# -*- coding: utf-8 -*-
"""把 data/raw 里的原始色卡归一化成 palettes.json，并做三方交叉校验。

权威性判定：
  * 标准 291（五种中文色号体系）—— Zippland 的 colorSystemMapping.json 与 Pindo 的
    mard/coco/manman/panpan/mixiaowo 五套色板逐色核对，两者一致的值才采信。
  * Hama / Perler / Artkal S —— Pindo 的 lib/data/palettes。
  * 卡卡 / 柿柿 / 童趣 / 优肯 / DMC —— get-colors-from-beans 的 colorMap.json（唯一来源）。
  * 小舞 / 黄豆豆 / DODO 与 MARD 291 逐号对应，作为"同款牌子"提示，不单独成板。
"""
import base64
import json
import os
import sys
from collections import Counter

from color_math import de_hex, hex_to_rgb, norm_code, norm_hex, srgb_to_lab

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")
OUT = os.path.join(HERE, "palettes.json")

BAND_PITCH = {
    "standard": 2.6, "hama": 5.0, "perler": 5.0, "artkal-s": 2.6,
    "kaka": 2.6, "shishi": 2.6, "tongqu": 2.6, "youken": 2.6, "dmc": None,
}

SYSTEM_LABEL = {
    "mard": "MARD", "coco": "COCO", "manman": "漫漫", "panpan": "盼盼", "mixiaowo": "咪小窝",
    "hama": "Hama", "perler": "Perler", "artkal-s": "Artkal S",
    "kaka": "卡卡", "shishi": "柿柿", "tongqu": "童趣", "youken": "优肯", "dmc": "DMC",
}


def load(name):
    p = os.path.join(RAW, name)
    if not os.path.exists(p):
        raise FileNotFoundError(p)
    with open(p, encoding="utf-8-sig") as f:
        return json.load(f)


def unwrap(d):
    """GitHub contents API 把文件放在 base64 的 content 字段里。"""
    if isinstance(d, dict) and d.get("encoding") == "base64" and "content" in d:
        return json.loads(base64.b64decode(d["content"]).decode("utf-8"))
    return d


def pindo(name):
    return unwrap(load(f"pindo_{name}.json"))


def colour(hexv, codes, name=""):
    rgb = hex_to_rgb(hexv)
    return {
        "hex": norm_hex(hexv),
        "rgb": rgb,
        "lab": [round(v, 4) for v in srgb_to_lab(rgb)],
        "codes": {k: v for k, v in codes.items() if v},
        "name": name or "",
    }


def build():
    report = []

    # ---------- 1. 标准 291：Zippland 为主，Pindo 逐系统校验 ----------
    zip_map = load("zippland_colorSystemMapping.json")
    sys_ids = ["mard", "coco", "manman", "panpan", "mixiaowo"]
    zip_keys = {"MARD": "mard", "COCO": "coco", "漫漫": "manman", "盼盼": "panpan", "咪小窝": "mixiaowo"}

    pindo_by_sys = {}
    for sid, pname in [("mard", "mard"), ("coco", "coco"), ("manman", "manman"),
                       ("panpan", "panpan"), ("mixiaowo", "mixiaowo")]:
        pindo_by_sys[sid] = pindo(pname)

    standard_colors = []
    conflicts = Counter()
    filled_from_pindo = Counter()
    for hexv, codes in zip_map.items():
        h = norm_hex(hexv)
        out = {}
        for zk, sid in zip_keys.items():
            out[sid] = (codes.get(zk) or "").strip()
        standard_colors.append(colour(h, out))

    # 用 Pindo 的每套色板核对：同一 HEX 上的色号是否一致
    for sid in sys_ids:
        pmap = {}
        for e in pindo_by_sys[sid]:
            pmap.setdefault(norm_hex(e["hex"]), []).append(e["code"])
        for c in standard_colors:
            z = c["codes"].get(sid)
            cand = pmap.get(c["hex"])
            if not cand:
                if z:
                    conflicts[sid] += 0  # 仅 Pindo 缺该色，不算冲突
                continue
            if z and z not in cand:
                conflicts[sid] += 1
            elif not z:
                c["codes"][sid] = cand[0]
                filled_from_pindo[sid] += 1
    report.append(("五体系色号冲突数（Zippland vs Pindo）",
                   ", ".join(f"{k}={conflicts[k]}" for k in sys_ids)))
    report.append(("由 Pindo 补齐的空色号",
                   ", ".join(f"{k}={filled_from_pindo[k]}" for k in sys_ids)))

    brands = {}
    brands["standard"] = {
        "id": "standard",
        "label": "国产标准 291（MARD 体系，五品牌色号互查）",
        "short": "标准291",
        "count": len(standard_colors),
        "pitch": BAND_PITCH["standard"],
        "codeSystems": [{"id": s, "label": SYSTEM_LABEL[s]} for s in sys_ids],
        "colors": standard_colors,
    }

    # ---------- 2. Hama / Perler / Artkal S ----------
    for sid, label, short in [("hama", "Hama", "Hama"),
                              ("perler", "Perler", "Perler"),
                              ("artkal-s", "Artkal S（软豆）", "Artkal S")]:
        rows = pindo(sid)
        cols = [colour(e["hex"], {sid: e["code"]}, e.get("name", "")) for e in rows]
        brands[sid] = {
            "id": sid, "label": label, "short": short,
            "count": len(cols), "pitch": BAND_PITCH[sid],
            "codeSystems": [{"id": sid, "label": SYSTEM_LABEL[sid]}],
            "colors": cols,
        }

    # ---------- 3. get-colors 的五个牌子 ----------
    cm = load("getcolors_colorMap.json")
    title_to_id = {
        "卡卡-284": "kaka", "柿柿-220": "shishi", "童趣-120": "tongqu",
        "优肯-174": "youken", "DMC-508": "dmc",
        "小舞-291": "xiaowu", "黄豆豆-291": "huangdoudou", "DODO-291": "dodo",
        "Mard-291": "mard_gc",
    }
    collected = {v: [] for v in title_to_id.values()}
    for hexv, lst in cm.items():
        for e in lst:
            t = e.get("color-title")
            if t in title_to_id:
                collected[title_to_id[t]].append((e.get("color-name", "").strip(), norm_hex(hexv)))

    for sid, label, short in [("kaka", "卡卡", "卡卡"), ("shishi", "柿柿", "柿柿"),
                              ("tongqu", "童趣", "童趣"), ("youken", "优肯 174", "优肯"),
                              ("dmc", "DMC 508（十字绣色卡）", "DMC")]:
        rows = collected[sid]
        cols = [colour(h, {sid: code}) for code, h in rows]
        brands[sid] = {
            "id": sid, "label": label, "short": short,
            "count": len(cols), "pitch": BAND_PITCH[sid],
            "codeSystems": [{"id": sid, "label": SYSTEM_LABEL[sid]}],
            "colors": cols,
        }

    # ---------- 4. 同款牌子 ----------
    # 注意：小舞 / 黄豆豆 / DODO 三家与 get-colors 的「Mard-291」逐号逐色完全一致，
    # 但它们与本工具采用的 MARD 291（Zippland + Pindo）只有 10/291 个 HEX 完全相同，
    # 属于同一牌子的不同批次色卡。所以这里只声明"这三家彼此是同一套色卡"，
    # 绝不把它们等同于 standard 的色号表。
    gc_mard_codes = {c for c, _ in collected["mard_gc"]}
    aliases = []
    same_labels = []
    for aid, label in [("xiaowu", "小舞"), ("huangdoudou", "黄豆豆"), ("dodo", "DODO")]:
        codes = {c for c, _ in collected[aid]}
        same = len(codes & gc_mard_codes)
        report.append((f"{label}-291 与 get-colors Mard-291 同号", f"{same}/{len(gc_mard_codes)}"))
        if same >= len(gc_mard_codes):
            same_labels.append(label)
    zcodes = {c["codes"].get("mard") for c in standard_colors}
    zhex = {norm_code(c["codes"].get("mard")): c["hex"] for c in standard_colors}
    ghex = {norm_code(c): h for c, h in collected["mard_gc"]}
    common = set(zhex) & set(ghex)
    identical = sum(1 for k in common if zhex[k] == ghex[k])
    report.append(("两版 MARD 色卡同号对比",
                   f"同色号 {len(common)}/{len(zhex)}，其中 HEX 完全相同 {identical}（同牌不同批次，故不合并）"))
    if same_labels:
        aliases.append({
            "system": "mard", "sameAs": "gc-mard", "labels": same_labels,
            "note": "三家为同一套色卡换名，色号彼此完全一致",
        })

    # ---------- 5. 交叉校验：两个来源的 HEX 分歧 ----------
    gc_mard = {norm_code(c): h for c, h in collected["mard_gc"]}
    diffs = []
    for c in standard_colors:
        code = norm_code(c["codes"].get("mard"))
        other = gc_mard.get(code)
        if other and other != c["hex"]:
            diffs.append((code, c["hex"], other, de_hex(c["hex"], other)))
    if diffs:
        diffs.sort(key=lambda x: -x[3])
        med = sorted(d[3] for d in diffs)[len(diffs) // 2]
        big = [d for d in diffs if d[3] >= 5]
        report.append(("Zippland vs get-colors 的 MARD HEX 分歧",
                       f"{len(diffs)} 处，中位 ΔE {med:.2f}，其中 ΔE≥5 有 {len(big)} 处"))
        if big:
            report.append(("  最大分歧样例",
                           "; ".join(f"{c}: {a} vs {b} (ΔE {d:.1f})" for c, a, b, d in big[:4])))

    # ---------- 6. 输出 ----------
    total = sum(b["count"] for b in brands.values())
    data = {
        "meta": {
            "totalColors": total,
            "brandCount": len(brands),
            "note": "社区色卡整理，HEX 为屏幕近似值，非光谱实测；实物受显示器/光线/批次影响。",
            "sources": [
                "Zippland/perler-beads src/app/colorSystemMapping.json",
                "LunarXuan/Pindo lib/data/palettes/*.json",
                "abearxiong/get-colors-from-beans colorMap.json",
                "Jett-Wu/Perler_Beads_Generator（第三方校验）",
            ],
        },
        "brands": brands,
        "aliases": aliases,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    return data, report


def main():
    data, report = build()
    for k, v in report:
        print(f"  {k}: {v}")
    print()
    for b in data["brands"].values():
        uniq = len({c["hex"] for c in b["colors"]})
        print(f"  {b['id']:<10} {b['short']:<10} {b['count']:>4} 色  唯一HEX {uniq:>4}  "
              f"体系 {'/'.join(cs['id'] for cs in b['codeSystems'])}")
    print(f"\n  合计 {data['meta']['brandCount']} 个品牌 / {data['meta']['totalColors']} 色")
    print(f"  写出 {OUT}  {os.path.getsize(OUT)/1024:.1f} KB")


if __name__ == "__main__":
    main()

