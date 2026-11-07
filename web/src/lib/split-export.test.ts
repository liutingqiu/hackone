import { describe, expect, it } from "vitest";
import { buildSplitPages } from "./split-export";
import { splitBoards } from "./split";

describe("split-export 分页布局", () => {
  it("总页数 = K + 1：第 1 页总览，其后每块板一页", () => {
    const grid = splitBoards(100, 100, 29, 29);
    expect(grid.boards).toHaveLength(16);

    const pages = buildSplitPages(grid);
    expect(pages).toHaveLength(grid.boards.length + 1);
    expect(pages[0]).toEqual({ kind: "overview", index: 0 });
    expect(pages.slice(1).every((p) => p.kind === "board")).toBe(true);
  });

  it("每页板号与 splitBoards 输出一致（先行后列、末板裁短）", () => {
    const grid = splitBoards(100, 100, 29, 29);
    const boardPages = buildSplitPages(grid).filter((p) => p.kind === "board");

    expect(boardPages.map((p) => p.index)).toEqual(grid.boards.map((b) => b.index));
    expect(boardPages.map((p) => p.board)).toEqual(grid.boards);
    expect(boardPages[0].board).toMatchObject({ index: 1, row: 0, col: 0, w: 29, h: 29 });
    expect(boardPages[15].board).toMatchObject({ index: 16, row: 3, col: 3, w: 13, h: 13 });

    // 换一种板尺寸也保持同一页序（3 列 × 2 行）
    const small = splitBoards(90, 58, 30, 29);
    const smallPages = buildSplitPages(small).filter((p) => p.kind === "board");
    expect(smallPages.map((p) => p.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(smallPages[5].board).toMatchObject({ index: 6, row: 1, col: 2 });
  });
});
