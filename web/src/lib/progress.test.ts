import { describe, expect, it } from "vitest";
import { splitBoards } from "./split";
import {
  boardProgress,
  countMarks,
  createMask,
  decodeMask,
  encodeMask,
  hashPattern,
  hasMark,
  parseDraftSettings,
  parseLastCell,
  parseStoredPattern,
  percent,
  percentText,
  setMark,
  toggleMark,
} from "./progress";

const pattern = (cols: number, rows: number, cells?: number[]) => ({
  cols,
  rows,
  cells: cells ?? Array.from({ length: cols * rows }, (_, i) => i % 291),
});

describe("hashPattern", () => {
  it("同一张图稳定", () => {
    const p = pattern(12, 8);
    expect(hashPattern(p)).toBe(hashPattern({ ...p, cells: p.cells.slice() }));
  });

  it("格数 / 尺寸 / 像素变化后不同（换图不串）", () => {
    const base = pattern(12, 8);
    const a = hashPattern(base);
    expect(hashPattern(pattern(13, 8))).not.toBe(a);
    expect(hashPattern(pattern(12, 9))).not.toBe(a);
    const changed = base.cells.slice();
    changed[5] = (changed[5] + 1) % 291;
    expect(hashPattern({ ...base, cells: changed })).not.toBe(a);
  });

  it("色板版本参与 hash", () => {
    expect(hashPattern(pattern(4, 4))).toContain("mard291");
  });
});

describe("bitmask", () => {
  it("toggle / set / count", () => {
    const mask = createMask(40);
    expect(mask.length).toBe(5);
    expect(hasMark(mask, 0)).toBe(false);
    expect(toggleMark(mask, 0)).toBe(true);
    expect(toggleMark(mask, 0)).toBe(false);
    setMark(mask, 3, true);
    setMark(mask, 39, true);
    expect(hasMark(mask, 3)).toBe(true);
    expect(hasMark(mask, 39)).toBe(true);
    expect(countMarks(mask)).toBe(2);
    expect(hasMark(mask, 40)).toBe(false);
  });

  it("base64 往返", () => {
    const mask = createMask(100);
    [0, 1, 7, 8, 63, 99].forEach((i) => setMark(mask, i, true));
    const text = encodeMask(mask);
    const back = decodeMask(text, 100);
    expect(Array.from(back)).toEqual(Array.from(mask));
    expect(countMarks(back)).toBe(6);
  });

  it("损坏 / 长度不符时返回空进度，不抛错", () => {
    expect(countMarks(decodeMask("!!!not-base64!!!", 100))).toBe(0);
    const mask = createMask(80);
    setMark(mask, 0, true);
    expect(countMarks(decodeMask(encodeMask(mask), 160))).toBe(0);
    expect(countMarks(decodeMask(null, 10))).toBe(0);
  });
});

describe("last pattern / last cell", () => {
  it("合法图纸可恢复", () => {
    const p = { cols: 2, rows: 2, cells: [0, 1, 2, 3] };
    expect(parseStoredPattern(JSON.stringify(p))).toEqual(p);
    expect(parseStoredPattern(null)).toBeNull();
    expect(parseStoredPattern("{bad json")).toBeNull();
  });

  it("长度/色号/尺寸不合法时拒绝，避免恢复出坏图", () => {
    expect(parseStoredPattern(JSON.stringify({ cols: 2, rows: 2, cells: [0, 1, 2] }))).toBeNull();
    expect(parseStoredPattern(JSON.stringify({ cols: 2, rows: 2, cells: [0, 1, 2, 999] }))).toBeNull();
    expect(parseStoredPattern(JSON.stringify({ cols: 2, rows: 2, cells: [0, 1, 2, 1.5] }))).toBeNull();
    expect(parseStoredPattern(JSON.stringify({ cols: 0, rows: 2, cells: [] }))).toBeNull();
  });

  it("上次格子大小只在 3..40 生效", () => {
    expect(parseLastCell("14")).toBe(14);
    expect(parseLastCell("3")).toBe(3);
    expect(parseLastCell("40")).toBe(40);
    expect(parseLastCell("2")).toBeNull();
    expect(parseLastCell("41")).toBeNull();
    expect(parseLastCell(null)).toBeNull();
  });
});

describe("draft settings", () => {
  it("合法参数恢复", () => {
    expect(parseDraftSettings(JSON.stringify({ minCount: 4, boardSize: 52, selectedColor: 7 }))).toEqual({
      minCount: 4,
      boardSize: 52,
      selectedColor: 7,
    });
    expect(parseDraftSettings(JSON.stringify({ minCount: 2, boardSize: 29, selectedColor: null }))).toEqual({
      minCount: 2,
      boardSize: 29,
      selectedColor: null,
    });
  });

  it("越界/损坏参数拒绝", () => {
    expect(parseDraftSettings(null)).toBeNull();
    expect(parseDraftSettings("{bad")).toBeNull();
    expect(parseDraftSettings(JSON.stringify({ minCount: 0, boardSize: 29, selectedColor: null }))).toBeNull();
    expect(parseDraftSettings(JSON.stringify({ minCount: 2, boardSize: 30, selectedColor: null }))).toBeNull();
    expect(parseDraftSettings(JSON.stringify({ minCount: 2, boardSize: 29, selectedColor: 9999 }))).toBeNull();
  });
});

describe("percent / boardProgress", () => {
  it("百分比四舍五入，0 格为 0", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
    expect(percentText(10, 2304)).toBe("0.4%");
    expect(percentText(1, 3)).toBe("33%");
    expect(percentText(0, 2304)).toBe("0%");
    expect(percentText(0, 0)).toBe("0%");
  });

  it("按板统计：第 2 块板 50%", () => {
    const p = pattern(6, 4, new Array(24).fill(0));
    const grid = splitBoards(6, 4, 3, 2);
    const mask = createMask(24);
    // 第 2 块板 = row0 col1，x 3..5 / y 0..1，共 6 格；标 3 格
    [3, 4, 9].forEach((i) => setMark(mask, i, true));
    const stats = boardProgress(p, grid, mask);
    expect(stats.map((b) => b.index)).toEqual([1, 2, 3, 4]);
    expect(stats[1]).toMatchObject({ index: 2, done: 3, total: 6, percent: 50 });
    expect(stats[0].percent).toBe(0);
    expect(countMarks(mask)).toBe(3);
  });
});
