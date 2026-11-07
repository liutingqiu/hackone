import { describe, expect, it } from "vitest";
import { PALETTE } from "./palette";

describe("palette", () => {
  it("色号唯一", () => {
    const codes = PALETTE.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("HEX 合法", () => {
    for (const p of PALETTE) {
      expect(p.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("色板规模为 MARD 291", () => {
    expect(PALETTE.length).toBe(291);
  });

  it("使用 MARD 色号，name 回退为色号", () => {
    const codes = PALETTE.map((p) => p.code);
    expect(codes).toContain("A1");
    expect(codes).toContain("ZG8");
    for (const p of PALETTE) {
      expect(p.name).toBe(p.code);
    }
  });
});

describe("quantize", () => {
  it("最近色总是落在色板内", async () => {
    const { nearestIndex } = await import("./quantize");
    for (const rgb of [[255, 255, 255], [0, 0, 0], [255, 0, 0], [18, 52, 86]]) {
      const i = nearestIndex(rgb[0], rgb[1], rgb[2]);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(PALETTE.length);
    }
  });

  it("色板内每个颜色都映射回自身", async () => {
    const { nearestIndex } = await import("./quantize");
    for (let i = 0; i < PALETTE.length; i++) {
      const n = parseInt(PALETTE[i].hex.slice(1), 16);
      const got = nearestIndex((n >> 16) & 255, (n >> 8) & 255, n & 255);
      expect(got, `${PALETTE[i].code} 应映射回自身`).toBe(i);
    }
  });

  it("纯白映射到最接近的白色", async () => {
    const { nearestIndex } = await import("./quantize");
    const bead = PALETTE[nearestIndex(255, 255, 255)];
    const n = parseInt(bead.hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    expect(r + g + b).toBeGreaterThan(300);
  });
});
