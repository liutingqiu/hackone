import { PALETTE, type Bead } from "./palette";

export type Pattern = {
  cols: number;
  rows: number;
  cells: number[]; // index into palette
};

// sRGB -> Lab，用于更接近人眼判断的最近色匹配
function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const f = (v: number) => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  };
  const R = f(r), G = f(g), B = f(b);
  let X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  X /= 0.95047; Y /= 1.0; Z /= 1.08883;
  const g2 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = g2(X), fy = g2(Y), fz = g2(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const PALETTE_LAB = PALETTE.map((p) => {
  const n = parseInt(p.hex.slice(1), 16);
  return srgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
});

export function nearestIndex(r: number, g: number, b: number): number {
  const [L, A, B] = srgbToLab(r, g, b);
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PALETTE_LAB.length; i++) {
    const [l2, a2, b2] = PALETTE_LAB[i];
    const d = (L - l2) ** 2 + (A - a2) ** 2 + (B - b2) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// 把图片按区域平均后映射到色板
export function imageToPattern(
  img: HTMLImageElement,
  cols: number,
  rows: number,
): Pattern {
  const c = document.createElement("canvas");
  c.width = cols;
  c.height = rows;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;

  const cells: number[] = new Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    if (a < 40) { cells[i] = 0; continue; } // 透明视为白
    cells[i] = nearestIndex(r, g, b);
  }
  return { cols, rows, cells };
}

// 去掉过少的杂色：把出现次数低于阈值的颜色合并到最接近的高频色
export function reduceNoise(p: Pattern, minCount: number): Pattern {
  const counts = countColors(p);
  const keep = counts
    .map((c, i) => ({ i, n: c }))
    .filter((x) => x.n >= minCount)
    .map((x) => x.i);
  if (keep.length === 0) return p;

  const next = p.cells.slice();
  for (let i = 0; i < next.length; i++) {
    if (!keep.includes(next[i])) {
      const [l, a, b] = PALETTE_LAB[next[i]];
      let best = keep[0], bestD = Infinity;
      for (const k of keep) {
        const [l2, a2, b2] = PALETTE_LAB[k];
        const d = (l - l2) ** 2 + (a - a2) ** 2 + (b - b2) ** 2;
        if (d < bestD) { bestD = d; best = k; }
      }
      next[i] = best;
    }
  }
  return { ...p, cells: next };
}

export function countColors(p: Pattern): number[] {
  const counts = new Array(PALETTE.length).fill(0);
  for (const c of p.cells) counts[c]++;
  return counts;
}

export function usedColors(p: Pattern) {
  const counts = countColors(p);
  return counts
    .map((n, i) => ({ bead: PALETTE[i] as Bead, count: n }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}
