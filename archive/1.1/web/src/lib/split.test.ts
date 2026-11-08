import { describe, expect, it } from "vitest";
import { neighbors, splitBoards, type BoardGrid } from "./split";

/** 断言：所有板不重叠、无空洞，恰好铺满 gw × gh 的图纸 */
function assertTiling(gw: number, gh: number, grid: BoardGrid): void {
  const owner = new Array<number>(gw * gh).fill(0);
  for (const b of grid.boards) {
    expect(b.x0).toBeGreaterThanOrEqual(0);
    expect(b.y0).toBeGreaterThanOrEqual(0);
    expect(b.w).toBeGreaterThan(0);
    expect(b.h).toBeGreaterThan(0);
    expect(b.x0 + b.w).toBeLessThanOrEqual(gw);
    expect(b.y0 + b.h).toBeLessThanOrEqual(gh);
    for (let y = b.y0; y < b.y0 + b.h; y++) {
      for (let x = b.x0; x < b.x0 + b.w; x++) {
        const k = y * gw + x;
        expect(owner[k], `格子 (${x}, ${y}) 被重复覆盖`).toBe(0);
        owner[k] = b.index;
      }
    }
  }
  expect(
    owner.every((v) => v > 0),
    "存在未被任何板覆盖的格子",
  ).toBe(true);
}

describe("splitBoards 切分", () => {
  it("整除：100×60 切 25×20 得到 4×3=12 块，每块满尺寸", () => {
    const grid = splitBoards(100, 60, 25, 20);
    expect(grid.cols).toBe(4);
    expect(grid.rows).toBe(3);
    expect(grid.boards).toHaveLength(12);
    assertTiling(100, 60, grid);

    for (const b of grid.boards) {
      expect(b.w).toBe(25);
      expect(b.h).toBe(20);
    }

    // 编号连续，先行后列：1 在左上，2 在 1 右边，5 在 1 正下方（4 列）
    expect(grid.boards.map((b) => b.index)).toEqual([...Array(12)].map((_, i) => i + 1));
    expect(grid.boards[0]).toMatchObject({ index: 1, row: 0, col: 0, x0: 0, y0: 0 });
    expect(grid.boards[1]).toMatchObject({ index: 2, row: 0, col: 1, x0: 25, y0: 0 });
    expect(grid.boards[4]).toMatchObject({ index: 5, row: 1, col: 0, x0: 0, y0: 20 });
    expect(grid.boards[11]).toMatchObject({ index: 12, row: 2, col: 3, x0: 75, y0: 40 });
  });

  it("不整除：100×100 切 30×30 得到 4×4，最后一行/列被裁短", () => {
    const grid = splitBoards(100, 100, 30, 30);
    expect(grid.cols).toBe(4);
    expect(grid.rows).toBe(4);
    expect(grid.boards).toHaveLength(16);
    assertTiling(100, 100, grid);

    const widths = grid.boards.filter((b) => b.row === 0).map((b) => b.w);
    const heights = grid.boards.filter((b) => b.col === 0).map((b) => b.h);
    expect(widths).toEqual([30, 30, 30, 10]);
    expect(heights).toEqual([30, 30, 30, 10]);
    expect(grid.boards[15]).toMatchObject({
      index: 16,
      row: 3,
      col: 3,
      x0: 90,
      y0: 90,
      w: 10,
      h: 10,
    });
    // 没被裁到的板仍是满尺寸
    expect(grid.boards[0]).toMatchObject({ w: 30, h: 30 });
    expect(grid.boards[5]).toMatchObject({ row: 1, col: 1, x0: 30, y0: 30, w: 30, h: 30 });
  });

  it("单块：图纸刚好一块板，编号为 1，无相邻", () => {
    const grid = splitBoards(29, 29, 29, 29);
    expect(grid).toMatchObject({ cols: 1, rows: 1 });
    expect(grid.boards).toHaveLength(1);
    const only = grid.boards[0];
    expect(only).toMatchObject({ index: 1, row: 0, col: 0, x0: 0, y0: 0, w: 29, h: 29 });
    expect(neighbors(only, grid)).toEqual({});
  });

  it("板比图大：10×8 的图配 100×100 的板，仍只有一块且按图裁尺寸", () => {
    const grid = splitBoards(10, 8, 100, 100);
    expect(grid).toMatchObject({ cols: 1, rows: 1 });
    expect(grid.boards).toHaveLength(1);
    expect(grid.boards[0]).toMatchObject({ index: 1, x0: 0, y0: 0, w: 10, h: 8 });
    assertTiling(10, 8, grid);
    expect(neighbors(grid.boards[0], grid)).toEqual({});
  });

  it("100×100 切 29 得到 4×4=16 块，尺寸为 29/29/29/13", () => {
    const grid = splitBoards(100, 100, 29, 29);
    expect(grid.cols).toBe(4);
    expect(grid.rows).toBe(4);
    expect(grid.boards).toHaveLength(16);
    assertTiling(100, 100, grid);

    const firstRowWidths = grid.boards.slice(0, 4).map((b) => b.w);
    const firstColHeights = grid.boards.filter((b) => b.col === 0).map((b) => b.h);
    expect(firstRowWidths).toEqual([29, 29, 29, 13]);
    expect(firstColHeights).toEqual([29, 29, 29, 13]);
    expect(grid.boards[15]).toMatchObject({ index: 16, x0: 87, y0: 87, w: 13, h: 13 });
  });
});

describe("neighbors 相邻关系", () => {
  it("3 列 × 2 行：角、边、中心的四邻都对", () => {
    const grid = splitBoards(90, 58, 30, 29);
    expect(grid).toMatchObject({ cols: 3, rows: 2 });
    const at = (i: number) => grid.boards[i - 1];

    expect(neighbors(at(1), grid)).toEqual({ right: 2, down: 4 });
    expect(neighbors(at(2), grid)).toEqual({ left: 1, right: 3, down: 5 });
    expect(neighbors(at(3), grid)).toEqual({ left: 2, down: 6 });
    expect(neighbors(at(4), grid)).toEqual({ up: 1, right: 5 });
    expect(neighbors(at(5), grid)).toEqual({ up: 2, left: 4, right: 6 });
    expect(neighbors(at(6), grid)).toEqual({ up: 3, left: 5 });
  });

  it("单列 / 单行时不会把上一行末尾错认成左邻", () => {
    const oneCol = splitBoards(10, 30, 10, 10); // 1 列 3 行
    expect(oneCol).toMatchObject({ cols: 1, rows: 3 });
    expect(neighbors(oneCol.boards[0], oneCol)).toEqual({ down: 2 });
    expect(neighbors(oneCol.boards[1], oneCol)).toEqual({ up: 1, down: 3 });
    expect(neighbors(oneCol.boards[2], oneCol)).toEqual({ up: 2 });

    const oneRow = splitBoards(30, 10, 10, 10); // 3 列 1 行
    expect(oneRow).toMatchObject({ cols: 3, rows: 1 });
    expect(neighbors(oneRow.boards[0], oneRow)).toEqual({ right: 2 });
    expect(neighbors(oneRow.boards[1], oneRow)).toEqual({ left: 1, right: 3 });
    expect(neighbors(oneRow.boards[2], oneRow)).toEqual({ left: 2 });
  });

  it("4×4 大图的角与中心", () => {
    const grid = splitBoards(100, 100, 29, 29);
    expect(neighbors(grid.boards[0], grid)).toEqual({ right: 2, down: 5 });
    expect(neighbors(grid.boards[15], grid)).toEqual({ up: 12, left: 15 });
    // index 6 = row 1 col 1，四邻齐全
    expect(neighbors(grid.boards[5], grid)).toEqual({ up: 2, down: 10, left: 5, right: 7 });
  });
});

describe("splitBoards 入参校验", () => {
  it("非正整数抛 RangeError，避免产生空板或死循环", () => {
    expect(() => splitBoards(0, 10, 5, 5)).toThrow(RangeError);
    expect(() => splitBoards(10, 0, 5, 5)).toThrow(RangeError);
    expect(() => splitBoards(10, 10, 0, 5)).toThrow(RangeError);
    expect(() => splitBoards(10, 10, 5, -1)).toThrow(RangeError);
    expect(() => splitBoards(10, 10, Number.NaN, 5)).toThrow(RangeError);
    expect(() => splitBoards(10, 10, 5.5, 5)).toThrow(RangeError);
  });

  it("最小合法输入 1×1 切 1×1 不抛错", () => {
    expect(() => splitBoards(1, 1, 1, 1)).not.toThrow();
  });
});
