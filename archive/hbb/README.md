# hbb/ — 队友（SShaner0903）本地版本快照

归档于 2026-11-14，原为仓库根目录下未跟踪的 `hbb/`。

基于 2.1 快照，比 `archive/2.1/` 多出三处修复（主线 v1.5 未全部吸收）：

| 位置 | 内容 |
| --- | --- |
| `app_template.html` `flipGrid()` | 翻转时同步镜像进度位图 |
| `app_template.html` `exportPNG()` | 导出像素上限（移动端 12e6 / 桌面 32e6），超限自动降格并提示 |
| `app_template.html` `exportA4()` | A4 导出页数上限（16 页 / 移动端 8 页） |

需要对照时：`diff -u archive/hbb/app/app_template.html archive/2.1/app_template.html`
