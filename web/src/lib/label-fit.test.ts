import { describe, expect, it } from "vitest";
import { fitLabel } from "./label-fit";

/** 等宽字体近似：每个字符宽 = 字号 × 0.6 */
const monospace = (text: string, size: number) => text.length * size * 0.6;

describe("fitLabel", () => {
  for (const cell of [14, 20, 40]) {
    it(`cell=${cell}px：完整色号不越界、不截断`, () => {
      for (const code of ["A07", "C04", "G14", "H1", "ZG5"]) {
        const fit = fitLabel(code, cell, monospace);
        if (fit.fits) {
          expect(fit.fontSize).toBeGreaterThanOrEqual(6);
          expect(monospace(code, fit.fontSize)).toBeLessThanOrEqual(cell - 2 + 1e-9);
        } else {
          expect(fit.fontSize).toBe(0);
        }
      }
    });
  }

  it("cell=14 时三位色号能放下完整 A07（不再默认不显示）", () => {
    const fit = fitLabel("A07", 14, monospace);
    expect(fit.fits).toBe(true);
    expect(monospace("A07", fit.fontSize)).toBeLessThanOrEqual(12);
  });

  it("cell=40 时字号有上限，不会溢出格子", () => {
    const fit = fitLabel("A07", 40, monospace);
    expect(fit.fits).toBe(true);
    expect(fit.fontSize).toBeLessThanOrEqual(12);
    expect(monospace("A07", fit.fontSize)).toBeLessThanOrEqual(38);
  });

  it("格子太小时宁可不画，也不画一半", () => {
    expect(fitLabel("A07", 8, monospace)).toEqual({ fontSize: 0, fits: false });
    expect(fitLabel("A07", 3, monospace).fits).toBe(false);
  });
});
