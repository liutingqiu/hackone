import { PALETTE } from "./palette";

export type PurchaseColor = { code: string; count: number };

/** 可直接粘到微信/淘宝搜索框的纯文本清单；按用量从多到少 */
export function buildPurchaseList(colors: PurchaseColor[], total: number): string {
  const sorted = colors.slice().sort((a, b) => b.count - a.count);
  const lines = [`拼豆采购清单（MARD ${PALETTE.length}）`];
  for (const c of sorted) {
    lines.push(`${c.code} × ${c.count}`);
  }
  lines.push(`共 ${sorted.length} 色 / ${total} 颗`);
  return lines.join("\n");
}

/** 淘宝搜索词只带色号，不绑商品链接，避免失效与风控 */
export function taobaoSearchUrl(code: string): string {
  return "https://s.taobao.com/search?q=" + encodeURIComponent(`MARD ${code} 拼豆`);
}
