import { describe, expect, it } from "vitest";
import { buildPurchaseList, taobaoSearchUrl } from "./purchase";

describe("buildPurchaseList", () => {
  it("格式可直接粘贴：标题 / 色号 × 数量 / 总计", () => {
    const text = buildPurchaseList(
      [
        { code: "H05", count: 180 },
        { code: "A26", count: 233 },
      ],
      413,
    );
    expect(text).toBe(
      "拼豆采购清单（MARD 291）\nA26 × 233\nH05 × 180\n共 2 色 / 413 颗",
    );
  });

  it("按数量降序，不依赖调用方顺序", () => {
    const text = buildPurchaseList(
      [
        { code: "B01", count: 1 },
        { code: "A01", count: 10 },
      ],
      11,
    );
    expect(text.split("\n")).toEqual([
      "拼豆采购清单（MARD 291）",
      "A01 × 10",
      "B01 × 1",
      "共 2 色 / 11 颗",
    ]);
  });

  it("空清单也有可读的标题与总计", () => {
    expect(buildPurchaseList([], 0)).toBe("拼豆采购清单（MARD 291）\n共 0 色 / 0 颗");
  });
});

describe("taobaoSearchUrl", () => {
  it("搜索词包含色号且完整编码", () => {
    expect(taobaoSearchUrl("A26")).toBe(
      "https://s.taobao.com/search?q=MARD%20A26%20%E6%8B%BC%E8%B1%86",
    );
  });
});
