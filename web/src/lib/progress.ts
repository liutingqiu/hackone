import { PALETTE } from "./palette";
import type { BoardGrid } from "./split";

/** 换色板就失效：进度键里带上版本 */
export const PALETTE_VERSION = "mard291";
const STORAGE_PREFIX = "pindou:progress:v1:";
const PATTERN_KEY = "pindou:last-pattern:v1";
const CELL_KEY = "pindou:last-cell:v1";
const SETTINGS_KEY = "pindou:draft-settings:v1";

/** 空 bitmask（0 格）；模块级常量，避免每次渲染新建引用 */
export const EMPTY_MASK = new Uint8Array(0);

export type PatternLike = { cols: number; rows: number; cells: ArrayLike<number> };

/** 刷新后恢复用的最后一张图纸（cells 为普通数组，可 JSON 序列化） */
export type StoredPattern = { cols: number; rows: number; cells: number[] };

/** 草稿里的界面参数；图本身在 StoredPattern */
export type DraftSettings = {
  minCount: number;
  boardSize: number;
  selectedColor: number | null;
};

export type BoardProgress = {
  index: number;
  row: number;
  col: number;
  done: number;
  total: number;
  percent: number;
};

const POPCOUNT = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  POPCOUNT[i] = (i & 1) + POPCOUNT[i >> 1];
}

/**
 * 图纸指纹：尺寸 + 每格色号 + 色板版本。
 * 同一张图、同一参数刷新后必须稳定；换图/改格数/换色板必须不同，避免进度串。
 */
export function hashPattern(pattern: PatternLike): string {
  let h1 = 0xdeadbeef ^ pattern.cols;
  let h2 = 0x41c6ce57 ^ pattern.rows;
  const cells = pattern.cells;
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i] + 1;
    h1 = Math.imul(h1 ^ v, 2654435761);
    h2 = Math.imul(h2 ^ v, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}-${pattern.cols}x${pattern.rows}-${PALETTE_VERSION}`;
}

/** 完成格 bitmask：1 颗 1 bit */
export function createMask(cellCount: number): Uint8Array {
  return new Uint8Array(Math.ceil(Math.max(0, cellCount) / 8));
}

export function hasMark(mask: Uint8Array, index: number): boolean {
  if (index < 0 || index >= mask.length * 8) return false;
  return (mask[index >> 3] & (1 << (index & 7))) !== 0;
}

export function setMark(mask: Uint8Array, index: number, on: boolean): void {
  if (index < 0 || index >= mask.length * 8) return;
  if (on) mask[index >> 3] |= 1 << (index & 7);
  else mask[index >> 3] &= ~(1 << (index & 7));
}

/** 返回切换后的状态 */
export function toggleMark(mask: Uint8Array, index: number): boolean {
  const on = !hasMark(mask, index);
  setMark(mask, index, on);
  return on;
}

export function countMarks(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += POPCOUNT[mask[i]];
  return n;
}

export function encodeMask(mask: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < mask.length; i++) bin += String.fromCharCode(mask[i]);
  return btoa(bin);
}

export function decodeMask(text: string | null | undefined, cellCount: number): Uint8Array {
  const empty = createMask(cellCount);
  if (!text) return empty;
  try {
    const bin = atob(text);
    if (bin.length !== empty.length) return empty;
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
    return out;
  } catch {
    return empty;
  }
}

export function percent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** 展示用：极少进度不要显示成 0%，37.2% 仍显示 37% */
export function percentText(done: number, total: number): string {
  if (total <= 0) return "0%";
  const p = (done / total) * 100;
  if (p <= 0) return "0%";
  if (p < 1) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

export function progressStorageKey(hash: string): string {
  return STORAGE_PREFIX + hash;
}

/** 校验 localStorage 里的图纸；损坏/色号越界一律返回 null */
export function parseStoredPattern(raw: string | null | undefined): StoredPattern | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { cols?: unknown; rows?: unknown; cells?: unknown };
    const cols = data.cols;
    const rows = data.rows;
    if (!Number.isInteger(cols) || !Number.isInteger(rows)) return null;
    const c = cols as number;
    const r = rows as number;
    if (c < 1 || r < 1 || c > 300 || r > 300) return null;
    if (!Array.isArray(data.cells) || data.cells.length !== c * r) return null;
    const cells = data.cells;
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i];
      if (!Number.isInteger(v) || v < 0 || v >= PALETTE.length) return null;
    }
    return { cols: c, rows: r, cells: cells as number[] };
  } catch {
    return null;
  }
}

export function loadLastPattern(): StoredPattern | null {
  try {
    return parseStoredPattern(getStorage()?.getItem(PATTERN_KEY));
  } catch {
    return null;
  }
}

export function saveLastPattern(pattern: PatternLike): void {
  try {
    getStorage()?.setItem(
      PATTERN_KEY,
      JSON.stringify({ cols: pattern.cols, rows: pattern.rows, cells: Array.from(pattern.cells) }),
    );
  } catch {
    // 配额满/隐私模式：刷新后无法恢复图纸
  }
}

export function parseLastCell(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 3 && n <= 40 ? n : null;
}

export function loadLastCell(): number | null {
  try {
    return parseLastCell(getStorage()?.getItem(CELL_KEY));
  } catch {
    return null;
  }
}

export function saveLastCell(cell: number): void {
  try {
    getStorage()?.setItem(CELL_KEY, String(cell));
  } catch {
    // 忽略
  }
}

export function parseDraftSettings(raw: string | null | undefined): DraftSettings | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<DraftSettings>;
    const minCount = data.minCount;
    const boardSize = data.boardSize;
    const selectedColor = data.selectedColor;
    if (!Number.isInteger(minCount) || (minCount as number) < 1 || (minCount as number) > 20) {
      return null;
    }
    if (boardSize !== 29 && boardSize !== 52) return null;
    if (
      selectedColor !== null &&
      (!Number.isInteger(selectedColor) ||
        (selectedColor as number) < 0 ||
        (selectedColor as number) >= PALETTE.length)
    ) {
      return null;
    }
    return {
      minCount: minCount as number,
      boardSize: boardSize as number,
      selectedColor: selectedColor as number | null,
    };
  } catch {
    return null;
  }
}

export function loadDraftSettings(): DraftSettings | null {
  try {
    return parseDraftSettings(getStorage()?.getItem(SETTINGS_KEY));
  } catch {
    return null;
  }
}

export function saveDraftSettings(settings: DraftSettings): void {
  try {
    getStorage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 忽略
  }
}

/** 清空最后一张图/格子/设置（「重新开始」） */
export function clearDraft(): void {
  try {
    const storage = getStorage();
    storage?.removeItem(PATTERN_KEY);
    storage?.removeItem(CELL_KEY);
    storage?.removeItem(SETTINGS_KEY);
  } catch {
    // 忽略
  }
}

export function clearProgress(hash: string): void {
  try {
    getStorage()?.removeItem(progressStorageKey(hash));
  } catch {
    // 忽略
  }
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** localStorage 不可用/损坏时返回空进度，不抛错 */
export function loadProgress(hash: string, cellCount: number): Uint8Array {
  try {
    return decodeMask(getStorage()?.getItem(progressStorageKey(hash)), cellCount);
  } catch {
    return createMask(cellCount);
  }
}

export function saveProgress(hash: string, mask: Uint8Array): void {
  try {
    getStorage()?.setItem(progressStorageKey(hash), encodeMask(mask));
  } catch {
    // 配额满/隐私模式：进度只在本次会话有效
  }
}

/** 按分板统计完成度；只统计图内格子（末板已被裁短） */
export function boardProgress(
  pattern: PatternLike,
  grid: BoardGrid,
  mask: Uint8Array,
): BoardProgress[] {
  return grid.boards.map((b) => {
    let done = 0;
    for (let y = b.y0; y < b.y0 + b.h; y++) {
      for (let x = b.x0; x < b.x0 + b.w; x++) {
        if (hasMark(mask, y * pattern.cols + x)) done++;
      }
    }
    const total = b.w * b.h;
    return {
      index: b.index,
      row: b.row,
      col: b.col,
      done,
      total,
      percent: percent(done, total),
    };
  });
}
