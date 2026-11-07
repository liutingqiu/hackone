import { PALETTE } from "./palette";
import type { Pattern } from "./quantize";
import { neighbors, type Board, type BoardGrid, type BoardNeighbors } from "./split";

/** 一页导出：第 1 页总览，其余每块板一页 */
export type SplitPage =
  { kind: "overview"; index: 0 } | { kind: "board"; index: number; board: Board };

/** 页序：总览在前，板页按 splitBoards 的先行后列编号排列 */
export function buildSplitPages(grid: BoardGrid): SplitPage[] {
  const pages: SplitPage[] = [{ kind: "overview", index: 0 }];
  for (const board of grid.boards) {
    pages.push({ kind: "board", index: board.index, board });
  }
  return pages;
}

export type SplitExportInput = {
  pattern: Pattern;
  grid: BoardGrid;
  /** 板的物理宽高（格）；末板被图裁短时仍按物理尺寸排版 */
  boardW: number;
  boardH: number;
  title?: string;
  /** false 时不自动调 print()，只渲染（截图/调试用） */
  autoPrint?: boolean;
};

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

type ColorStat = { code: string; hex: string; name: string; count: number };

function colorStats(pattern: Pattern): ColorStat[] {
  const counts = new Array<number>(PALETTE.length).fill(0);
  for (const cell of pattern.cells) {
    if (cell >= 0 && cell < counts.length) counts[cell]++;
  }
  return PALETTE.map((bead, i) => ({ ...bead, count: counts[i] }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

const pct = (v: number): string => `${v.toFixed(4)}%`;

function overviewPage(input: SplitExportInput, pageCount: number): string {
  const { pattern, grid, boardW, boardH } = input;
  const title = esc(input.title ?? "拼豆图纸");
  const stats = colorStats(pattern);
  const total = stats.reduce((s, x) => s + x.count, 0);

  const cells = pattern.cells
    .map((i) => `<i style="background:${PALETTE[i]?.hex ?? "#fff"}"></i>`)
    .join("");

  const boardOverlays = grid.boards
    .map((b) => {
      const style = [
        `left:${pct((b.x0 / pattern.cols) * 100)}`,
        `top:${pct((b.y0 / pattern.rows) * 100)}`,
        `width:${pct((b.w / pattern.cols) * 100)}`,
        `height:${pct((b.h / pattern.rows) * 100)}`,
      ].join(";");
      return `<div class="ov-board" style="${style}"><span>${b.index}</span></div>`;
    })
    .join("");

  // 色多时用 6 列并压缩总览图，保证总览始终只占 1 页（291 色为最坏情况）
  const usageCols = stats.length > 60 ? 6 : 4;
  const usageRows = Math.ceil(stats.length / usageCols);
  const overviewMax = Math.min(160, Math.max(52, 260 - (usageRows * 3.3 + 8.5)));

  const usage = stats
    .map(
      (s) =>
        `<li><i style="background:${s.hex}"></i><b>${esc(s.code)}</b>${s.name !== s.code ? `<span>${esc(s.name)}</span>` : ""}<em>${s.count}</em></li>`,
    )
    .join("");

  return `<section class="sheet sheet-overview">
  <header class="sheet-head">
    <div>
      <h1>${title} · 分板总览</h1>
      <p class="sub">${pattern.cols} × ${pattern.rows} 格 · ${grid.cols} × ${grid.rows} = ${grid.boards.length} 块（${boardW}×${boardH}）</p>
    </div>
    <span class="badge">总览 · 第 1 / ${pageCount} 页</span>
  </header>
  <div class="ov-wrap" style="max-width:${overviewMax.toFixed(1)}mm">
    <div class="ov-grid" style="grid-template-columns:repeat(${pattern.cols},1fr);aspect-ratio:${pattern.cols}/${pattern.rows}">${cells}</div>
    <div class="ov-lines">${boardOverlays}</div>
  </div>
  <div class="usage">
    <div class="usage-head"><b>用量摘要</b><span>共 ${total} 颗 · ${stats.length} 色 · ${grid.boards.length} 块板</span></div>
    <ul class="usage-list" style="columns:${usageCols}">${usage}</ul>
  </div>
  <footer class="sheet-foot"><span>编号先行后列 · 红色分隔线为板边界</span><span>第 1 / ${pageCount} 页</span></footer>
</section>`;
}

function neighborText(board: Board, grid: BoardGrid): string {
  const n = neighbors(board, grid);
  const labels: Array<[keyof BoardNeighbors, string]> = [
    ["up", "上"],
    ["down", "下"],
    ["left", "左"],
    ["right", "右"],
  ];
  const parts = labels
    .filter(([key]) => n[key] !== undefined)
    .map(([key, label]) => `${label} ${n[key]}`);
  return parts.length ? parts.join(" · ") : "无（单板）";
}

function boardPage(input: SplitExportInput, board: Board, pageCount: number): string {
  const { pattern, grid, boardW, boardH } = input;
  // 标准 29×29 板正好 24px/格；更大的板等比缩小，保证一页 A4 放得下
  const cell = Math.min(24, Math.floor(720 / Math.max(boardW, boardH)));
  const font = Math.max(6, Math.min(9, Math.round(cell * 0.34)));

  const head: string[] = ['<div class="corner"></div>'];
  for (let cx = 0; cx < boardW; cx++) {
    const gx = board.x0 + cx;
    const out = gx >= pattern.cols;
    head.push(`<div class="head${out ? " oob" : ""}">${out ? "" : gx + 1}</div>`);
  }

  const rows: string[] = [];
  for (let cy = 0; cy < boardH; cy++) {
    const gy = board.y0 + cy;
    const outRow = gy >= pattern.rows;
    rows.push(`<div class="head${outRow ? " oob" : ""}">${outRow ? "" : gy + 1}</div>`);
    for (let cx = 0; cx < boardW; cx++) {
      const gx = board.x0 + cx;
      if (outRow || gx >= pattern.cols) {
        rows.push('<div class="cell oob"></div>');
        continue;
      }
      const bead = PALETTE[pattern.cells[gy * pattern.cols + gx]];
      const ink = luminance(bead.hex) > 0.62 ? "rgba(0,0,0,.62)" : "rgba(255,255,255,.85)";
      rows.push(
        `<div class="cell" style="background:${bead.hex};color:${ink}">${esc(bead.code)}</div>`,
      );
    }
  }

  const partial = board.w < boardW || board.h < boardH;
  const pageNo = board.index + 1;

  return `<section class="sheet sheet-board">
  <header class="sheet-head">
    <div>
      <h1>${esc(input.title ?? "拼豆图纸")} · 板 ${board.index}</h1>
      <p class="sub">板 ${boardW} × ${boardH}${partial ? ` · 本板有效 ${board.w} × ${board.h}` : ""} · 第 ${board.row + 1} 行 第 ${board.col + 1} 列</p>
    </div>
    <span class="badge">板 ${board.index} / ${grid.boards.length} · 第 ${pageNo} / ${pageCount} 页</span>
  </header>
  <div class="board-frame">
    <i class="crop tl"></i><i class="crop tr"></i><i class="crop bl"></i><i class="crop br"></i>
    <div class="board-grid" style="--cell:${cell}px;--font:${font}px;grid-template-columns:20px repeat(${boardW}, var(--cell))">${head.join("")}${rows.join("")}</div>
  </div>
  <footer class="sheet-foot board-foot">
    <span>板 ${board.index} / ${grid.boards.length} · 全局列 ${board.x0 + 1}–${Math.min(board.x0 + boardW, pattern.cols)} · 全局行 ${board.y0 + 1}–${Math.min(board.y0 + boardH, pattern.rows)}</span>
    <span class="neighbors">相邻：${neighborText(board, grid)}</span>
    <span>第 ${pageNo} / ${pageCount} 页</span>
  </footer>
</section>`;
}

const SPLIT_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: #eef0f3;
  color: #16181d;
  font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.sheet {
  width: 200mm;
  min-height: 287mm;
  margin: 8mm auto;
  padding: 3mm;
  background: #fff;
  box-shadow: 0 2px 14px rgba(0, 0, 0, .16);
  display: flex;
  flex-direction: column;
  page-break-after: always;
  break-after: page;
}
.sheet:last-of-type { page-break-after: auto; break-after: auto; }
.sheet-head {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm;
  border-bottom: 1px solid #e5e7eb; padding-bottom: 2mm; margin-bottom: 3mm;
}
h1 { margin: 0; font-size: 14px; letter-spacing: .2px; }
.sub { margin: 2px 0 0; font-size: 10px; color: #6b7280; }
.badge {
  flex: none; font: 10px ui-monospace, SFMono-Regular, Consolas, monospace;
  color: #dc2626; border: 1px solid #fecaca; background: #fef2f2;
  border-radius: 999px; padding: 3px 8px; white-space: nowrap;
}
.ov-wrap { position: relative; width: 100%; max-width: 160mm; margin: 0 auto; }
.ov-grid { display: grid; grid-auto-rows: 1fr; background: #fff; outline: 1px solid #d1d5db; }
.ov-grid i { display: block; min-width: 0; }
.ov-lines { position: absolute; inset: 0; pointer-events: none; }
.ov-board { position: absolute; border: 1.5px solid #dc2626; }
.ov-board span {
  position: absolute; left: 2px; top: 2px; padding: 1px 4px; border-radius: 4px;
  background: #dc2626; color: #fff; font: 700 9px/1.25 ui-monospace, monospace;
}
.usage { margin-top: 4mm; }
.usage-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; margin-bottom: 1.5mm; }
.usage-head span { color: #6b7280; }
.usage-list { columns: 4; column-gap: 4mm; list-style: none; margin: 0; padding: 0; }
.usage-list li { display: flex; align-items: center; gap: 3px; font-size: 9px; line-height: 1.2; padding: 0.2mm 0; break-inside: avoid; }
.usage-list i { width: 8px; height: 8px; border: 1px solid #e5e7eb; border-radius: 2px; flex: none; }
.usage-list b { font: 9px ui-monospace, monospace; }
.usage-list span { color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.usage-list em { margin-left: auto; font-style: normal; font-variant-numeric: tabular-nums; }

.board-frame { position: relative; width: fit-content; margin: 4mm auto 0; padding: 6px; }
.crop { position: absolute; width: 12px; height: 12px; border: 0 solid #111; }
.crop.tl { left: 0; top: 0; border-left-width: 2px; border-top-width: 2px; }
.crop.tr { right: 0; top: 0; border-right-width: 2px; border-top-width: 2px; }
.crop.bl { left: 0; bottom: 0; border-left-width: 2px; border-bottom-width: 2px; }
.crop.br { right: 0; bottom: 0; border-right-width: 2px; border-bottom-width: 2px; }

.board-grid {
  display: grid; width: fit-content; background: #fff;
  border: 1px solid #111; grid-auto-rows: var(--cell);
}
.board-grid > * { border: 1px solid rgba(0, 0, 0, .14); min-width: 0; }
.corner { background: #fff; }
.head {
  display: flex; align-items: center; justify-content: center;
  background: #f3f4f6; color: #374151;
  font: 7px ui-monospace, SFMono-Regular, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}
.head.oob { background: #fafafa; }
.cell {
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  font: var(--font) ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: -.2px; white-space: nowrap;
}
.cell.oob { background: #fafafa; border-style: dashed; }
.board-foot { margin-top: auto; }
.board-foot .neighbors { color: #b91c1c; font-weight: 600; }

.sheet-foot {
  margin-top: auto; padding-top: 2mm; border-top: 1px solid #e5e7eb;
  display: flex; justify-content: space-between; gap: 4mm;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace; color: #4b5563;
}
.printbar {
  position: fixed; right: 16px; bottom: 16px; z-index: 9;
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: rgba(17, 24, 39, .92); color: #fff; border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, .25); font-size: 11px;
}
.printbar button {
  font: inherit; padding: 6px 12px; border: 0; border-radius: 7px;
  background: #dc2626; color: #fff; cursor: pointer;
}

@page { size: A4; margin: 5mm; }
@media print {
  body { background: #fff; }
  .sheet {
    width: auto; min-height: 0; margin: 0; padding: 0;
    box-shadow: none; page-break-after: always; break-after: page;
  }
  .sheet:last-of-type { page-break-after: auto; break-after: auto; }
  .no-print { display: none !important; }
}
`;

export function renderSplitHtml(input: SplitExportInput): string {
  const pages = buildSplitPages(input.grid);
  const pageCount = pages.length;
  const sheets = pages
    .map((page) =>
      page.kind === "overview"
        ? overviewPage(input, pageCount)
        : boardPage(input, page.board, pageCount),
    )
    .join("\n");
  const title = esc(input.title ?? "拼豆图纸");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · 分板拼装图</title>
<style>${SPLIT_CSS}</style>
</head>
<body>
${sheets}
<div class="no-print printbar"><button type="button" onclick="window.print()">打印 / 保存 PDF</button><span>${pageCount} 页 · A4</span></div>
</body>
</html>`;
}

/** 在新窗口打开可打印 HTML；默认自动调 window.print()。返回被浏览器拦截时为 null。 */
export function openSplitPrintWindow(input: SplitExportInput): Window | null {
  const win = window.open("", "_blank");
  if (!win) return null;
  const html = renderSplitHtml(input);
  win.document.open();
  win.document.write(html);
  win.document.close();
  if (input.autoPrint !== false) {
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // 用户仍可点页面右下角的「打印 / 保存 PDF」
      }
    }, 450);
  }
  return win;
}
