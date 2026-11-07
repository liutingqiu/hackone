import { describe, expect, it } from "vitest";
import { fitCellSize } from "./fit";

describe("fitCellSize", () => {
  it("1280 桌面（可用 732×874）48×48 → 15px，整图可见", () => {
    expect(fitCellSize(48, 48, 732, 874)).toBe(15);
  });

  it("测试部窄容器（445px 可视区，可用 397）48×48 → 8px", () => {
    expect(fitCellSize(48, 48, 397, 874)).toBe(8);
  });

  it("极小容器保底 3px，不出现 0 或负尺寸", () => {
    expect(fitCellSize(48, 48, 100, 100)).toBe(3);
    expect(fitCellSize(48, 48, 0, 0)).toBe(3);
  });

  it("超大容器不超过 40px 上限", () => {
    expect(fitCellSize(8, 8, 1000, 1000)).toBe(40);
  });

  it("宽图按高度/宽度取较小值", () => {
    expect(fitCellSize(48, 5, 732, 874)).toBe(15);
    expect(fitCellSize(120, 90, 732, 874)).toBe(6);
  });

  it("非法行列返回保底值", () => {
    expect(fitCellSize(0, 0, 500, 500)).toBe(3);
  });
});
