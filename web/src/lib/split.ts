/**
 * 分板切分（差异化功能）。
 *
 * 坐标约定：
 * - 图纸是 gw × gh 格，左上角为 (0, 0)，一格对应一颗珠子；
 * - 板是可容纳 bw × bh 颗珠子的物理底板；
 * - 切分后第一块在左上角，编号「先行后列」（row-major，从 1 开始）。
 *
 * 每块板的 x0 / y0 是它在图纸中的左上角坐标，w / h 是**实际占用的区域**：
 * 最后一行 / 列会被图纸边界裁短，因此所有板拼起来既不重叠也不留空洞，
 * 恰好覆盖整张图纸。板自身的物理尺寸始终是 bw × bh，由调用方保留，
 * 不放进 Board（否则「板比图大」时 Board 会越出图纸）。
 */

export type Board = {
  /** 板编号，从 1 开始，先行后列 */
  index: number;
  /** 行号，从 0 开始 */
  row: number;
  /** 列号，从 0 开始 */
  col: number;
  /** 板左上角在图纸中的 x 坐标（格） */
  x0: number;
  /** 板左上角在图纸中的 y 坐标（格） */
  y0: number;
  /** 板实际占用的宽（格），最后一块可能小于 bw */
  w: number;
  /** 板实际占用的高（格），最后一块可能小于 bh */
  h: number;
};

export type BoardGrid = {
  /** 列数 = ceil(gw / bw) */
  cols: number;
  /** 行数 = ceil(gh / bh) */
  rows: number;
  /** 全部板，按 index 升序（先行后列） */
  boards: Board[];
};

/** 相邻板编号；该方向没有板时不返回对应字段 */
export type BoardNeighbors = {
  up?: number;
  down?: number;
  left?: number;
  right?: number;
};

function assertPositiveInt(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} 必须是正整数，收到 ${value}`);
  }
}

/**
 * 按板尺寸切分图纸。
 *
 * @param gw 图纸宽（格）
 * @param gh 图纸高（格）
 * @param bw 板宽（格）
 * @param bh 板高（格）
 * @returns 行列数与全部板；板数 = ceil(gw / bw) × ceil(gh / bh)
 */
export function splitBoards(gw: number, gh: number, bw: number, bh: number): BoardGrid {
  assertPositiveInt("gw", gw);
  assertPositiveInt("gh", gh);
  assertPositiveInt("bw", bw);
  assertPositiveInt("bh", bh);

  const cols = Math.ceil(gw / bw);
  const rows = Math.ceil(gh / bh);
  const boards: Board[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * bw;
      const y0 = row * bh;
      boards.push({
        index: row * cols + col + 1,
        row,
        col,
        x0,
        y0,
        w: Math.min(bw, gw - x0),
        h: Math.min(bh, gh - y0),
      });
    }
  }

  return { cols, rows, boards };
}

/**
 * 返回上下左右相邻板的编号。
 *
 * 只用 board.row / col 与 grid 的行列数做 O(1) 计算，
 * 因此不会因为 grid.boards 的顺序或额外字段而出错。
 */
export function neighbors(board: Board, grid: BoardGrid): BoardNeighbors {
  const result: BoardNeighbors = {};
  const { row, col } = board;

  const indexAt = (r: number, c: number): number | undefined => {
    if (r < 0 || c < 0 || r >= grid.rows || c >= grid.cols) return undefined;
    return r * grid.cols + c + 1;
  };

  const up = indexAt(row - 1, col);
  if (up !== undefined) result.up = up;
  const down = indexAt(row + 1, col);
  if (down !== undefined) result.down = down;
  const left = indexAt(row, col - 1);
  if (left !== undefined) result.left = left;
  const right = indexAt(row, col + 1);
  if (right !== undefined) result.right = right;

  return result;
}
