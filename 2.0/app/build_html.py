# -*- coding: utf-8 -*-
"""把 palettes.json 注入 app_template.html，产出单文件成品。"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(HERE, "app_template.html")
PAL = os.path.join(HERE, "palettes.json")
OUT = os.path.join(HERE, "拼豆图纸工具.html")


def main():
    with open(PAL, encoding="utf-8") as f:
        raw = f.read()
    data = json.loads(raw)                      # 只为了校验与取统计
    # 内联进 <script> 里，必须防止提前闭合标签
    inline = raw.replace("</", "<\\/")

    with open(TPL, encoding="utf-8") as f:
        html = f.read()
    if "__PALETTE_JSON__" not in html:
        raise SystemExit("模板里没有 __PALETTE_JSON__ 占位符")
    html = html.replace("__PALETTE_JSON__", inline)

    # newline="\n"：模板是 LF，按平台默认写会在 Windows 上变成 CRLF，产物不可复现
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

    size = os.path.getsize(OUT)
    print(f"已生成 {OUT}")
    print(f"  大小 {size/1024:.1f} KB（其中色板数据 {len(inline)/1024:.1f} KB）")
    print(f"  品牌 {data['meta']['brandCount']} 个，色板合计 {data['meta']['totalColors']} 色")


if __name__ == "__main__":
    main()
