import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PALETTE } from "./lib/palette";
import { imageToPattern, reduceNoise, usedColors, type Pattern } from "./lib/quantize";
import { fitCellSize } from "./lib/fit";
import { fitLabel } from "./lib/label-fit";
import { splitBoards } from "./lib/split";
import { openSplitPrintWindow } from "./lib/split-export";

// D-03：板尺寸可选，默认 29，可切 52
const BOARD_SIZES = [29, 52] as const;
const DEFAULT_BOARD = 29;

// ui-skeleton：小白模式固定 29，专业模式可改；切换不改画布/图纸状态
type Mode = "beginner" | "pro";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export default function App() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState(48);
  const [cell, setCell] = useState(14);
  const [minCount, setMinCount] = useState(2);
  const [boardSize, setBoardSize] = useState(29);
  const [mode, setMode] = useState<Mode>("beginner");
  const [showCodes, setShowCodes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showBoardIds, setShowBoardIds] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLElement>(null);

  const rows = useMemo(() => {
    if (!img) return 0;
    return Math.max(1, Math.round((cols * img.naturalHeight) / img.naturalWidth));
  }, [img, cols]);

  const raw = useMemo<Pattern | null>(() => {
    if (!img || !rows) return null;
    return imageToPattern(img, cols, rows);
  }, [img, cols, rows]);

  const pattern = useMemo<Pattern | null>(() => {
    if (!raw) return null;
    return minCount > 1 ? reduceNoise(raw, minCount) : raw;
  }, [raw, minCount]);

  const activeBoard = mode === "beginner" ? DEFAULT_BOARD : boardSize;
  const grid = useMemo(
    () => (pattern ? splitBoards(pattern.cols, pattern.rows, activeBoard, activeBoard) : null),
    [pattern, activeBoard],
  );

  const stats = useMemo(() => (pattern ? usedColors(pattern) : []), [pattern]);
  const total = useMemo(() => stats.reduce((s, x) => s + x.count, 0), [stats]);

  // 渲染
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !pattern) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = pattern.cols * cell;
    const h = pattern.rows * cell;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    for (let y = 0; y < pattern.rows; y++) {
      for (let x = 0; x < pattern.cols; x++) {
        const i = y * pattern.cols + x;
        ctx.fillStyle = PALETTE[pattern.cells[i]].hex;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    if (showGrid && cell >= 5) {
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= pattern.cols; x++) {
        ctx.moveTo(x * cell + 0.5, 0);
        ctx.lineTo(x * cell + 0.5, h);
      }
      for (let y = 0; y <= pattern.rows; y++) {
        ctx.moveTo(0, y * cell + 0.5);
        ctx.lineTo(w, y * cell + 0.5);
      }
      ctx.stroke();

      // 每 10 格加粗，方便数格子
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= pattern.cols; x += 10) {
        ctx.moveTo(x * cell + 0.5, 0);
        ctx.lineTo(x * cell + 0.5, h);
      }
      for (let y = 0; y <= pattern.rows; y += 10) {
        ctx.moveTo(0, y * cell + 0.5);
        ctx.lineTo(w, y * cell + 0.5);
      }
      ctx.stroke();
    }

    if (showCodes) {
      const measure = (text: string, size: number) => {
        ctx.font = `${size}px ui-monospace, monospace`;
        return ctx.measureText(text).width;
      };
      // 等宽字体下同长度色号所需字号一致；按长度缓存，避免每格重复 measureText
      const fitByLength = new Map<number, ReturnType<typeof fitLabel>>();
      const fitFor = (code: string) => {
        let fit = fitByLength.get(code.length);
        if (!fit) {
          fit = fitLabel("W".repeat(code.length), cell, measure, {
            minFontSize: 6,
            maxFontSize: 12,
            padding: 2,
          });
          fitByLength.set(code.length, fit);
        }
        return fit;
      };
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let y = 0; y < pattern.rows; y++) {
        for (let x = 0; x < pattern.cols; x++) {
          const i = y * pattern.cols + x;
          const bead = PALETTE[pattern.cells[i]];
          const fit = fitFor(bead.code);
          if (!fit.fits) continue; // 放不下就不画，避免被裁成半截
          const n = parseInt(bead.hex.slice(1), 16);
          const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
          ctx.font = `${fit.fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
          ctx.fillStyle = lum > 0.6 ? "rgba(0,0,0,0.62)" : "rgba(255,255,255,0.82)";
          ctx.fillText(bead.code, x * cell + cell / 2, y * cell + cell / 2);
        }
      }
    }

    // 分板叠加：红色分隔线 + 左上角红色圆角板号标签；格子太小时只画线
    if (showBoardIds && grid) {
      const lineW = Math.max(1.5, Math.min(3, cell * 0.12));
      ctx.strokeStyle = "rgba(220, 38, 38, 0.92)";
      ctx.lineWidth = lineW;
      ctx.beginPath();
      for (const b of grid.boards) {
        const x = b.x0 * cell + 0.5;
        const y = b.y0 * cell + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.moveTo(w - 0.5, 0);
      ctx.lineTo(w - 0.5, h);
      ctx.moveTo(0, h - 0.5);
      ctx.lineTo(w, h - 0.5);
      ctx.stroke();

      if (cell >= 6) {
        const fontSize = Math.max(9, Math.min(12, cell * 0.75));
        ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const b of grid.boards) {
          const label = String(b.index);
          const tw = ctx.measureText(label).width;
          const bw = Math.max(16, tw + 10);
          const bh = fontSize + 6;
          const lx = b.x0 * cell + 3;
          const ly = b.y0 * cell + 3;
          ctx.fillStyle = "rgba(220, 38, 38, 0.96)";
          roundRect(ctx, lx, ly, bw, bh, 4);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillText(label, lx + bw / 2, ly + bh / 2 + 0.5);
        }
      }
    }

    if (hover) {
      ctx.strokeStyle = "#2f81f7";
      ctx.lineWidth = 2;
      ctx.strokeRect(hover.x * cell + 1, hover.y * cell + 1, cell - 2, cell - 2);
    }
  }, [pattern, cell, showCodes, showGrid, showBoardIds, grid, hover]);

  const onFile = useCallback(
    (f: File | undefined | null) => {
      if (!f || !f.type.startsWith("image/")) return;
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = () => {
        URL.revokeObjectURL(url);
        // 导入后按 stage 可用宽高自动 fit，保证默认整图可见；之后仍可用滑杆手调
        const stage = stageRef.current;
        if (stage && im.naturalWidth > 0 && im.naturalHeight > 0) {
          const r = Math.max(1, Math.round((cols * im.naturalHeight) / im.naturalWidth));
          setCell(fitCellSize(cols, r, stage.clientWidth - 48, stage.clientHeight - 48));
        }
        setImg(im);
      };
      im.src = url;
    },
    [cols],
  );

  const exportPng = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const a = document.createElement("a");
    a.download = "pattern.png";
    a.href = cv.toDataURL("image/png");
    a.click();
  };

  const exportSplit = useCallback(() => {
    if (!pattern || !grid) return;
    const win = openSplitPrintWindow({
      pattern,
      grid,
      boardW: activeBoard,
      boardH: activeBoard,
      title: "拼豆图纸",
    });
    if (!win) window.alert("分板导出窗口被浏览器拦截了，请允许弹窗后重试。");
  }, [pattern, grid, activeBoard]);

  const hoverInfo = hover && pattern ? PALETTE[pattern.cells[hover.y * pattern.cols + hover.x]] : null;

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="logo">◉</span>
          <div>
            <h1>拼豆图纸</h1>
            <p>传图 → 出图 → 按色号摆</p>
          </div>
        </div>
        <div className="mode-switch" role="group" aria-label="界面模式">
          <button type="button" className={mode === "beginner" ? "active" : ""} aria-pressed={mode === "beginner"} onClick={() => setMode("beginner")}>小白</button>
          <button type="button" className={mode === "pro" ? "active" : ""} aria-pressed={mode === "pro"} onClick={() => setMode("pro")}>专业</button>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => fileRef.current?.click()}>上传图片</button>
          <button onClick={exportPng} disabled={!pattern}>导出 PNG</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </header>

      <main
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
      >
        <aside className="panel">
          <label className="row">
            <span>每行格数</span>
            <b>{cols}</b>
          </label>
          <input type="range" min={16} max={120} value={cols} onChange={(e) => setCols(+e.target.value)} />

          <label className="row">
            <span>格子大小</span>
            <b>{cell}px</b>
          </label>
          <input type="range" min={3} max={40} value={cell} onChange={(e) => setCell(+e.target.value)} />

          {mode === "pro" && (
            <>
              <label className="row">
                <span>杂色合并阈值</span>
                <b>{minCount} 颗</b>
              </label>
              <input type="range" min={1} max={20} value={minCount} onChange={(e) => setMinCount(+e.target.value)} />

              <label className="switch"><input type="checkbox" checked={showCodes} onChange={(e) => setShowCodes(e.target.checked)} /> 显示色号</label>
              <label className="switch"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> 显示网格</label>
            </>
          )}

          {!img && <p className="hint">把图片拖进来，或点右上角上传</p>}
        </aside>

        <section className="stage" ref={stageRef}>
          {pattern ? (
            <canvas
              ref={canvasRef}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const x = Math.floor((e.clientX - r.left) / cell);
                const y = Math.floor((e.clientY - r.top) / cell);
                if (x >= 0 && y >= 0 && x < pattern.cols && y < pattern.rows) setHover({ x, y, i: y * pattern.cols + x });
              }}
              onMouseLeave={() => setHover(null)}
            />
          ) : (
            <div className="empty">
              <div className="big">拖一张图进来</div>
              <div className="sub">照片、截图、画画都行；越干净的原图，出来的图纸越好摆</div>
            </div>
          )}
        </section>

        <aside className="panel stats">
          <div className="row"><span>图纸</span><b>{pattern ? `${pattern.cols} × ${pattern.rows}` : "—"}</b></div>
          <div className="row"><span>总颗数</span><b>{total || "—"}</b></div>
          <div className="row"><span>颜色数</span><b>{stats.length || "—"}</b></div>

          <section className="board-section">
            <h2>分板</h2>
            <div className="row">
              <span>分板</span>
              <b>{grid ? `${grid.cols} × ${grid.rows} = ${grid.boards.length} 块（${activeBoard}×${activeBoard}）` : "—"}</b>
            </div>
            {mode === "pro" && (
              <label className="row">
                <span>板尺寸</span>
                <select value={boardSize} onChange={(e) => setBoardSize(Number(e.target.value))}>
                  {BOARD_SIZES.map((size) => (
                    <option key={size} value={size}>{size}×{size}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="switch"><input type="checkbox" checked={showBoardIds} onChange={(e) => setShowBoardIds(e.target.checked)} /> 画布显示板号</label>
            <button className="wide" onClick={exportSplit} disabled={!pattern || !grid}>导出分板拼装图</button>
          </section>

          <div className="colors">
            {stats.map((s) => (
              <div className="color" key={s.bead.code}>
                <i style={{ background: s.bead.hex }} />
                <span className="code">{s.bead.code}</span>
                <span className="name">{s.bead.name !== s.bead.code ? s.bead.name : ""}</span>
                <span className="n">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="footnote">
            {hoverInfo ? `光标：${hoverInfo.code}${hoverInfo.name !== hoverInfo.code ? ` ${hoverInfo.name}` : ""}` : "鼠标移到图纸上看色号"}
          </div>
        </aside>
      </main>
    </div>
  );
}
