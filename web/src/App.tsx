import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PALETTE } from "./lib/palette";
import { imageToPattern, reduceNoise, usedColors, type Pattern } from "./lib/quantize";

const BOARD = 29; // 单块拼豆板 29x29

export default function App() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState(48);
  const [cell, setCell] = useState(14);
  const [minCount, setMinCount] = useState(2);
  const [showCodes, setShowCodes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const stats = useMemo(() => (pattern ? usedColors(pattern) : []), [pattern]);
  const total = useMemo(() => stats.reduce((s, x) => s + x.count, 0), [stats]);
  const boards = useMemo(() => {
    if (!pattern) return 0;
    return Math.ceil(pattern.cols / BOARD) * Math.ceil(pattern.rows / BOARD);
  }, [pattern]);

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

    if (showCodes && cell >= 16) {
      ctx.font = `${Math.max(7, cell * 0.34)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let y = 0; y < pattern.rows; y++) {
        for (let x = 0; x < pattern.cols; x++) {
          const i = y * pattern.cols + x;
          const bead = PALETTE[pattern.cells[i]];
          const n = parseInt(bead.hex.slice(1), 16);
          const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
          ctx.fillStyle = lum > 0.6 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";
          ctx.fillText(bead.code.slice(1), x * cell + cell / 2, y * cell + cell / 2);
        }
      }
    }

    if (hover) {
      ctx.strokeStyle = "#2f81f7";
      ctx.lineWidth = 2;
      ctx.strokeRect(hover.x * cell + 1, hover.y * cell + 1, cell - 2, cell - 2);
    }
  }, [pattern, cell, showCodes, showGrid, hover]);

  const onFile = useCallback((f: File | undefined | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      URL.revokeObjectURL(url);
    };
    im.src = url;
  }, []);

  const exportPng = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const a = document.createElement("a");
    a.download = "pattern.png";
    a.href = cv.toDataURL("image/png");
    a.click();
  };

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
          <input type="range" min={6} max={40} value={cell} onChange={(e) => setCell(+e.target.value)} />

          <label className="row">
            <span>杂色合并阈值</span>
            <b>{minCount} 颗</b>
          </label>
          <input type="range" min={1} max={20} value={minCount} onChange={(e) => setMinCount(+e.target.value)} />

          <label className="switch"><input type="checkbox" checked={showCodes} onChange={(e) => setShowCodes(e.target.checked)} /> 显示色号</label>
          <label className="switch"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> 显示网格</label>

          {!img && <p className="hint">把图片拖进来，或点右上角上传</p>}
        </aside>

        <section className="stage">
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
          <div className="row"><span>拼豆板</span><b>{boards ? `${boards} 块 (29×29)` : "—"}</b></div>
          <div className="row"><span>颜色数</span><b>{stats.length || "—"}</b></div>

          <div className="colors">
            {stats.map((s) => (
              <div className="color" key={s.bead.code}>
                <i style={{ background: s.bead.hex }} />
                <span className="code">{s.bead.code}</span>
                <span className="name">{s.bead.name}</span>
                <span className="n">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="footnote">
            {hoverInfo ? `光标：${hoverInfo.code} ${hoverInfo.name}` : "鼠标移到图纸上看色号"}
          </div>
        </aside>
      </main>
    </div>
  );
}
