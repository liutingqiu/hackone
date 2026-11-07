export type LabelFit = { fontSize: number; fits: boolean };

export type FitLabelOptions = {
  /** 缩到这个字号仍放不下就不画（不画一半） */
  minFontSize?: number;
  maxFontSize?: number;
  /** 格子内左右留白合计 */
  padding?: number;
};

/**
 * 在 cell × cell 的格子里放下完整色号。
 *
 * 从可读字号往下缩，缩到 minFontSize 仍放不下就返回 fits:false；
 * 调用方据此决定「不画」，而不是画出界/被裁掉一半。
 * measure 由调用方提供：浏览器里是 ctx.measureText，测试里可用等宽近似。
 */
export function fitLabel(
  text: string,
  cell: number,
  measure: (text: string, fontSize: number) => number,
  options: FitLabelOptions = {},
): LabelFit {
  const minFontSize = options.minFontSize ?? 6;
  const maxFontSize = options.maxFontSize ?? 12;
  const padding = options.padding ?? 2;
  const available = cell - padding;
  if (!text || available <= 0) return { fontSize: 0, fits: false };

  const start = Math.min(maxFontSize, Math.max(minFontSize, cell * 0.5));
  for (let size = start; size >= minFontSize - 1e-9; size -= 0.25) {
    if (measure(text, size) <= available + 1e-9) {
      return { fontSize: Math.round(size * 100) / 100, fits: true };
    }
  }
  return { fontSize: 0, fits: false };
}
