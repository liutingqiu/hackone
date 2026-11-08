export type FitCellOptions = {
  min?: number;
  max?: number;
};

/**
 * 按容器可用宽高算「整图默认可见」的格子大小。
 * 取宽、高两个方向都能放下的较小值，再夹在 [min, max] 内。
 */
export function fitCellSize(
  cols: number,
  rows: number,
  availW: number,
  availH: number,
  options: FitCellOptions = {},
): number {
  const min = options.min ?? 3;
  const max = options.max ?? 40;
  if (cols <= 0 || rows <= 0) return min;
  const byW = Math.floor(availW / cols);
  const byH = Math.floor(availH / rows);
  return Math.max(min, Math.min(max, byW, byH));
}
