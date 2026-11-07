import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { PALETTE } from "./lib/palette";
import { imageToPattern, reduceNoise, usedColors, type Pattern } from "./lib/quantize";
import { fitCellSize } from "./lib/fit";
import { fitLabel } from "./lib/label-fit";
import { splitBoards } from "./lib/split";
import { openSplitPrintWindow } from "./lib/split-export";
import {
  boardProgress,
  countMarks,
  createMask,
  EMPTY_MASK,
  hashPattern,
  hasMark,
  loadLastCell,
  loadLastPattern,
  loadProgress,
  percent,
  percentText,
  saveLastCell,
  saveLastPattern,
  saveProgress,
  toggleMark,
} from "./lib/progress";

// D-03：板尺寸可选，默认 29，可切 52
const BOARD_SIZES = [29, 52] as const;
const DEFAULT_BOARD = 29;

// ui-skeleton：小白模式固定 29，专业模式可改；切换不改画布/图纸状态
type Mode = "beginner" | "pro";

/** 无标注预览：纯色块 + 网格 + 板界红线，白底，不含色号/板号/用量 */
function buildPreviewCanvas(pattern: Pattern, cell: number): HTMLCanvasElement {
  const scale = 2;
  const w = pattern.cols * cell;
  const h = pattern.rows * cell;
  const cv = document.createElement("canvas");
  cv.width = w * scale;
  cv.height = h * scale;
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < pattern.rows; y++) {
    for (let x = 0; x < pattern.cols; x++) {
      ctx.fillStyle = PALETTE[pattern.cells[y * pattern.cols + x]].hex;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  if (cell >= 5) {
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

  return cv;
}

/** 透明图判定：缩到 32×32 采样，透明像素超过 90% 视为“几乎是空的” */
function isMostlyTransparent(image: HTMLImageElement): boolean {
  const size = 32;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(image, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 8) transparent++;
  }
  return transparent / (size * size) > 0.9;
}

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
  const [restoredPattern, setRestoredPattern] = useState<Pattern | null>(() => loadLastPattern());
  const [cols, setCols] = useState(() => restoredPattern?.cols ?? 48);
  const [cell, setCell] = useState(() => loadLastCell() ?? 14);
  const [minCount, setMinCount] = useState(2);
  const [boardSize, setBoardSize] = useState(29);
  const [mode, setMode] = useState<Mode>("beginner");
  const [showCodes, setShowCodes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showBoardIds, setShowBoardIds] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);
  const [busy, setBusy] = useState<null | "print" | "png">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, setExportedPattern] = useState<Pattern | null>(null);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [marked, setMarked] = useState<Uint8Array>(EMPTY_MASK);
  const [loadedHash, setLoadedHash] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimRef = useRef<HTMLCanvasElement>(null);
  const markRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const notify = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const rows = useMemo(() => {
    if (!img) return 0;
    return Math.max(1, Math.round((cols * img.naturalHeight) / img.naturalWidth));
  }, [img, cols]);

  const raw = useMemo<Pattern | null>(() => {
    if (!img || !rows) return null;
    return imageToPattern(img, cols, rows);
  }, [img, cols, rows]);

  const generatedPattern = useMemo<Pattern | null>(() => {
    if (!raw) return null;
    return minCount > 1 ? reduceNoise(raw, minCount) : raw;
  }, [raw, minCount]);

  // 刷新后恢复上次图纸；上传新图会替换
  const pattern = restoredPattern ?? generatedPattern;
  const restored = img === null && restoredPattern !== null;

  useEffect(() => {
    if (!pattern) return;
    const t = window.setTimeout(() => saveLastPattern(pattern), 250);
    return () => window.clearTimeout(t);
  }, [pattern]);

  useEffect(() => {
    saveLastCell(cell);
  }, [cell]);

  const activeBoard = mode === "beginner" ? DEFAULT_BOARD : boardSize;
  const grid = useMemo(
    () => (pattern ? splitBoards(pattern.cols, pattern.rows, activeBoard, activeBoard) : null),
    [pattern, activeBoard],
  );

  const stats = useMemo(() => (pattern ? usedColors(pattern) : []), [pattern]);
  const total = useMemo(() => stats.reduce((s, x) => s + x.count, 0), [stats]);

  // 离开确认已移除（2026-11-07）：图纸可由原图重算，拦截刷新只会让人烦
  const patternHash = useMemo(() => (pattern ? hashPattern(pattern) : null), [pattern]);
  const maskReady =
    pattern !== null &&
    patternHash !== null &&
    loadedHash === patternHash &&
    marked.length === Math.ceil(pattern.cells.length / 8);
  const activeMask = maskReady ? marked : EMPTY_MASK;

  const colorIndexByCode = useMemo(
    () => new Map(PALETTE.map((b, i) => [b.code, i] as const)),
    [],
  );
  const activeSelected = useMemo(() => {
    if (selectedColor === null) return null;
    return stats.some((s) => colorIndexByCode.get(s.bead.code) === selectedColor)
      ? selectedColor
      : null;
  }, [selectedColor, stats, colorIndexByCode]);

  const progress = useMemo(() => {
    const totalCells = pattern ? pattern.cols * pattern.rows : 0;
    const done = countMarks(activeMask);
    return {
      done,
      total: totalCells,
      percent: percent(done, totalCells),
      boards: pattern && grid ? boardProgress(pattern, grid, activeMask) : [],
    };
  }, [pattern, grid, activeMask]);

  const selectedStat =
    activeSelected === null
      ? null
      : (stats.find((s) => colorIndexByCode.get(s.bead.code) === activeSelected) ?? null);
  const selectedDone = useMemo(() => {
    if (!pattern || activeSelected === null) return 0;
    let n = 0;
    for (let i = 0; i < pattern.cells.length; i++) {
      if (pattern.cells[i] === activeSelected && hasMark(activeMask, i)) n++;
    }
    return n;
  }, [pattern, activeSelected, activeMask]);

  // 换图/改参数后从对应 hash 恢复；不存在则为空进度
  useEffect(() => {
    if (!pattern || !patternHash) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setMarked(loadProgress(patternHash, pattern.cells.length));
    setLoadedHash(patternHash);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pattern, patternHash]);


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

  }, [pattern, cell, showCodes, showGrid, showBoardIds, grid]);

  // 选色高亮层：非选中色压暗（独立层，点标记时不重绘）
  useEffect(() => {
    const cv = dimRef.current;
    if (!cv || !pattern) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = pattern.cols * cell;
    const h = pattern.rows * cell;
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr;
      cv.height = h * dpr;
    }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (activeSelected === null) return;
    ctx.fillStyle = "rgba(8, 11, 16, 0.72)";
    for (let y = 0; y < pattern.rows; y++) {
      for (let x = 0; x < pattern.cols; x++) {
        if (pattern.cells[y * pattern.cols + x] !== activeSelected) {
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  }, [pattern, cell, activeSelected]);

  // 完成标记层：只画已标记格，点击时只重绘这一层
  useEffect(() => {
    const cv = markRef.current;
    if (!cv || !pattern) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = pattern.cols * cell;
    const h = pattern.rows * cell;
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr;
      cv.height = h * dpr;
    }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const totalCells = pattern.cols * pattern.rows;
    for (let i = 0; i < totalCells; i++) {
      if (!hasMark(activeMask, i)) continue;
      const x = i % pattern.cols;
      const y = (i / pattern.cols) | 0;
      ctx.fillStyle = "rgba(16, 185, 129, 0.42)";
      ctx.fillRect(x * cell, y * cell, cell, cell);
      if (cell >= 6) {
        ctx.strokeStyle = "rgba(16, 185, 129, 0.95)";
        ctx.lineWidth = Math.max(1, cell * 0.08);
        ctx.strokeRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
      }
    }
  }, [pattern, cell, activeMask]);

  const onFile = useCallback(
    (f: File | undefined | null) => {
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        notify("这不是图片文件");
        return;
      }
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onerror = () => {
        URL.revokeObjectURL(url);
        notify("这不是图片文件");
      };
      im.onload = () => {
        URL.revokeObjectURL(url);
        if (im.naturalWidth < 2 || im.naturalHeight < 2 || isMostlyTransparent(im)) {
          notify("这张图几乎是空的，可能不是你要的");
        }
        setRestoredPattern(null);
        setImg(im);
        // 等布局完成（窄屏媒体查询切换）再测容器；小于 8px 不再压缩，允许滚动
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const stage = stageRef.current;
            if (!stage || im.naturalWidth <= 0 || im.naturalHeight <= 0) return;
            const r = Math.max(1, Math.round((cols * im.naturalHeight) / im.naturalWidth));
            setCell(fitCellSize(cols, r, stage.clientWidth - 48, stage.clientHeight - 48, { min: 8 }));
          });
        });
      };
      im.src = url;
    },
    [cols, notify],
  );

  const cellFromPoint = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!pattern) return null;
      const r = e.currentTarget.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * pattern.cols);
      const y = Math.floor(((e.clientY - r.top) / r.height) * pattern.rows);
      if (x < 0 || y < 0 || x >= pattern.cols || y >= pattern.rows) return null;
      return { x, y };
    },
    [pattern],
  );

  const toggleCell = useCallback(
    (x: number, y: number) => {
      if (!pattern || !patternHash || !maskReady) return;
      const index = y * pattern.cols + x;
      const next = marked.slice();
      toggleMark(next, index);
      setMarked(next);
      saveProgress(patternHash, next);
    },
    [pattern, patternHash, maskReady, marked],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const c = cellFromPoint(e);
      if (!c) return;
      dragRef.current = { id: e.pointerId, ...c };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // 合成事件没有真实 pointerId；忽略
      }
      if (e.pointerType === "mouse" && pattern) {
        setHover({ ...c, i: c.y * pattern.cols + c.x });
      }
    },
    [cellFromPoint, pattern],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const c = cellFromPoint(e);
      if (!c) return;
      if (e.pointerType === "mouse" && pattern) {
        setHover({ ...c, i: c.y * pattern.cols + c.x });
      }
      const drag = dragRef.current;
      if (drag && drag.id === e.pointerId) {
        drag.x = c.x;
        drag.y = c.y;
      }
    },
    [cellFromPoint, pattern],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || drag.id !== e.pointerId) return;
      const c = cellFromPoint(e) ?? { x: drag.x, y: drag.y };
      toggleCell(c.x, c.y);
    },
    [cellFromPoint, toggleCell],
  );

  const handlePointerCancel = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handlePointerLeave = useCallback(() => setHover(null), []);

  const resetProgress = useCallback(() => {
    if (!pattern || !patternHash) return;
    const empty = createMask(pattern.cells.length);
    setMarked(empty);
    saveProgress(patternHash, empty);
    notify("进度已清空");
  }, [pattern, patternHash, notify]);

  // 次按钮：保留原来的纯色块 PNG（无标注），异步 toBlob 让 loading 态能渲染
  const exportPreview = useCallback(() => {
    if (!pattern || busy) return;
    const previewCell = Math.min(cell, 24);
    const cv = buildPreviewCanvas(pattern, previewCell);
    setBusy("png");
    cv.toBlob((blob) => {
      if (!blob) {
        setBusy(null);
        notify("导出失败，请重试");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = "pattern-preview.png";
      a.href = url;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setBusy(null);
      setExportedPattern(pattern);
      notify("已导出");
    }, "image/png");
  }, [pattern, cell, busy, notify]);

  // 主按钮：可打印图纸（总览 + 每板一页，复用 split-export），弹窗被拦时 toast
  const exportPrintable = useCallback(() => {
    if (!pattern || !grid || busy) return;
    setBusy("print");
    const win = openSplitPrintWindow({
      pattern,
      grid,
      boardW: activeBoard,
      boardH: activeBoard,
      title: "拼豆图纸",
    });
    if (!win) {
      setBusy(null);
      notify("浏览器拦截了新窗口，请允许后重试");
      return;
    }
    setExportedPattern(pattern);
    window.setTimeout(() => {
      setBusy(null);
      notify("已导出");
    }, 700);
  }, [pattern, grid, activeBoard, busy, notify]);

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
          <button onClick={exportPrintable} disabled={!pattern || !!busy}>
            {busy === "print" ? "生成中…" : "导出图纸（可打印）"}
          </button>
          <button className="ghost" onClick={exportPreview} disabled={!pattern || !!busy}>
            {busy === "png" ? "生成中…" : "导出预览图（无标注）"}
          </button>
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
          <input
            type="range"
            min={16}
            max={120}
            value={cols}
            disabled={restored}
            onChange={(e) => setCols(+e.target.value)}
          />

          <label className="row">
            <span>格子大小</span>
            <b>{cell}px</b>
          </label>
          <input type="range" min={3} max={40} value={cell} onChange={(e) => setCell(+e.target.value)} />

          <label className="switch"><input type="checkbox" checked={showCodes} onChange={(e) => setShowCodes(e.target.checked)} /> 显示色号</label>

          {mode === "pro" && (
            <>
              <label className="row">
                <span>杂色合并阈值</span>
                <b>{minCount} 颗</b>
              </label>
              <input
                type="range"
                min={1}
                max={20}
                value={minCount}
                disabled={restored}
                onChange={(e) => setMinCount(+e.target.value)}
              />

              <label className="switch"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> 显示网格</label>
            </>
          )}

          {!pattern && <p className="hint">把图片拖进来，或点右上角上传</p>}
          {restored && (
            <p className="hint">已恢复上次图纸（{pattern?.cols}×{pattern?.rows}）；上传新图可重新调参</p>
          )}
        </aside>

        <section className="stage" ref={stageRef}>
          {pattern ? (
            <div
              className="canvas-stack"
              style={{ width: pattern.cols * cell, height: pattern.rows * cell }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={handlePointerLeave}
              onContextMenu={(e) => e.preventDefault()}
            >
              <canvas ref={canvasRef} className="pattern-canvas" />
              <canvas ref={dimRef} className="pattern-overlay dim-layer" />
              <canvas ref={markRef} className="pattern-overlay mark-layer" />
              {hover && (
                <div
                  className="hover-ring"
                  style={{ left: hover.x * cell, top: hover.y * cell, width: cell, height: cell }}
                />
              )}
            </div>
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
          </section>

          <section className="progress-section">
            <h2>拼装进度</h2>
            {pattern ? (
              <>
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuenow={progress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <i style={{ width: `${progress.percent}%` }} />
                </div>
                <div className="row">
                  <span>已完成</span>
                  <b>{progress.done} / {progress.total} 颗 · {percentText(progress.done, progress.total)}</b>
                </div>
                {activeSelected !== null && selectedStat && (
                  <div className="row">
                    <span>当前 {selectedStat.bead.code}</span>
                    <b>{selectedDone} / {selectedStat.count} 颗</b>
                  </div>
                )}
                <div className="board-progress-list">
                  {progress.boards.map((b) => (
                    <div className="board-progress-row" key={b.index}>
                      <span>第 {b.index} 块板</span>
                      <div className="mini-bar"><i style={{ width: `${b.percent}%` }} /></div>
                      <b>{percentText(b.done, b.total)}</b>
                    </div>
                  ))}
                </div>
                <button type="button" className="link-button" onClick={resetProgress}>
                  重置本图进度
                </button>
                <p className="progress-hint">点格子标记完成；点右侧色号可高亮</p>
              </>
            ) : (
              <p className="hint">导入图片后可记录拼装进度</p>
            )}
          </section>

          <div className="colors">
            {stats.map((s) => {
              const index = colorIndexByCode.get(s.bead.code) ?? -1;
              const selected = activeSelected === index;
              return (
                <div
                  className={`color${selected ? " selected" : ""}`}
                  key={s.bead.code}
                  role="button"
                  tabIndex={0}
                  title={selected ? "点击取消高亮" : "点击高亮该色"}
                  onClick={() => setSelectedColor(selected ? null : index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedColor(selected ? null : index);
                    }
                  }}
                >
                  <i style={{ background: s.bead.hex }} />
                  <span className="code">{s.bead.code}</span>
                  {s.bead.name !== s.bead.code && <span className="name">{s.bead.name}</span>}
                  <span className="n">{s.count}</span>
                </div>
              );
            })}
          </div>
          <div className="footnote">
            {hoverInfo ? `光标：${hoverInfo.code}${hoverInfo.name !== hoverInfo.code ? ` ${hoverInfo.name}` : ""}` : "鼠标移到图纸上看色号"}
          </div>
        </aside>
      </main>
      {toast && (
        <div className="toast" role="status" aria-live="polite">{toast}</div>
      )}
    </div>
  );
}
