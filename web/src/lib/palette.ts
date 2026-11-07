// 色板数据：MARD 291 色（MIT，来源 HansBug/pindou-color-data）
// 2026-11-07 起替换原 56 色占位；PALETTE 接口保持不变，量化/渲染代码无需改动。
// 数据文件的版权头见 ./palette-mard.ts。
import { MARD_PALETTE } from "./palette-mard";

export type Bead = { code: string; hex: string; name: string };

export const PALETTE: Bead[] = MARD_PALETTE;
