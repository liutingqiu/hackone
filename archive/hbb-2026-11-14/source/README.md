# source/ — 队友 11-14 版本的源码（从构建产物反推恢复）

## 怎么来的

朋友的 `app_template.html` 丢了，但产物 `../app/拼豆图纸工具.html` 在。
本项目是**零构建单文件**架构：`build_html.py` 只做一件事——把 `palettes.json` 塞进模板的
`__PALETTE_JSON__` 占位符。没有打包、压缩、混淆。所以**产物 ≈ 源码**。

恢复步骤：

1. 找到 `<script type="application/json" id="paletteData">` 到对应 `</script>` 之间的内联色板；
2. 把 `\<\/` 还原成 `</`（`build_html.py` 会反向转义，防止提前闭合标签）；
3. 把这一整段换回 `__PALETTE_JSON__` → 得到 `app_template.html`；
4. 内联的那段 JSON 单独存成 `palettes.json`。

## 验证（可复现）

```bash
cd archive/hbb-2026-11-14/source
python3 build_html.py            # 生成 拼豆图纸工具.html
# 产物用 LF，原产物是 CRLF，转一下再比：
python3 -c "import io; s=io.open('拼豆图纸工具.html',encoding='utf-8',newline='').read(); \
  io.open('out_crlf.html','w',encoding='utf-8',newline='').write(s.replace(chr(10),chr(13)+chr(10)))"
sha256sum out_crlf.html ../app/拼豆图纸工具.html
```

两个哈希都是：

```
66ba28066762576318446bdb27cfd4f6aab7610cfea6401a2bd8977bb2108615
```

**字节级一致**，所以这份就是产生那份产物的原源码，不是近似还原。

## 唯一的差异：换行符

| | 换行 | 字节数 |
| --- | --- | --- |
| 原产物 | CRLF | 451,959 |
| 本目录重建（LF） | LF | 446,116 |

差值 5,843 = 行数，完全是 `\r` 的数量。说明朋友那边是在 Windows 上构建的
（Python 文本模式写入时把 `\n` 转成了 `os.linesep`）。
内容一字不差，不需要追。

## 文件

| 文件 | 说明 |
| --- | --- |
| `app_template.html` | 5843 行，模板源码（LF） |
| `palettes.json` | 9 品牌 1751 色，从产物内联段还原 |
| `build_html.py` | 与本仓库同版本，用于验证 |

> 注意：这份模板**不是** main 的分支，是一条独立演进的代码线。
> 已并入主线的部分见 `docs/RELEASE-NOTES.md` v1.7（ZIP/TXT 工程文件、PNG 图例横排、连通区域标记）。
